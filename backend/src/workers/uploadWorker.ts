import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { uploadToTelegram } from '../services/telegram';
import { uploadToSupabase } from '../services/supabase';
import fs from 'fs';

export const uploadWorker = new Worker('upload-queue', async (job) => {
  const { fileUuid, chunkIndex, filePath, iv, authTag, storageType, projectBotTokens, channelId, supabaseUrl, supabaseKey } = job.data;

  console.log(`[Upload Worker] Processing chunk ${chunkIndex} for file ${fileUuid}`);
  
  // Read chunk from disk
  const buffer = fs.readFileSync(filePath);

  if (storageType === 'TELEGRAM') {
    // Round robin bot selection
    const botToken = projectBotTokens[chunkIndex % projectBotTokens.length];

    let attempt = 0;
    const maxAttempts = 5;
    let delay = 2000; // Start with 2 seconds baseline

    while (attempt < maxAttempts) {
      try {
        const { fileId } = await uploadToTelegram(botToken, channelId, buffer, `${fileUuid}_part${chunkIndex}.zip`);
        
        // Save chunk metadata to DB (including iv and authTag hex)
        await prisma.fileChunk.create({
          data: {
            file_uuid: fileUuid,
            chunk_index: chunkIndex,
            message_id: fileId, // storing fileId (Telegram file_id) as message_id
            iv: iv || null,
            auth_tag: authTag || null
          }
        });
        
        console.log(`[Upload Worker] Uploaded chunk ${chunkIndex} successfully to Telegram`);

        // Check if all chunks for this file are now uploaded
        const fileRec = await prisma.file.findUnique({
          where: { uuid: fileUuid }
        });
        
        if (fileRec) {
          const uploadedCount = await prisma.fileChunk.count({
            where: { file_uuid: fileUuid }
          });
          
          if (uploadedCount === fileRec.chunk_count) {
            console.log(`[Upload Worker] File ${fileUuid} completely uploaded. Syncing database state to Telegram backup...`);
            // Dynamic import of BackupSyncManager to prevent circular dependency imports
            const { BackupSyncManager } = require('../utils/backupSync');
            BackupSyncManager.syncStateToTelegram().catch((e: any) => console.error('[Upload Worker] Backup sync error:', e.message));
          }
        }

        break; // Upload succeeded!
      } catch (err: any) {
        attempt++;
        console.error(`[Upload Worker] Attempt ${attempt} failed for chunk ${chunkIndex}:`, err.message);
        
        if (attempt >= maxAttempts) {
          // File cleanup on terminal failure
          try { fs.unlinkSync(filePath); } catch(e){}
          throw err; // Fail BullMQ job
        }

        // Check if rate limited (FloodWait - HTTP 429)
        let waitTime = delay;
        if (err.message && err.message.includes('429')) {
          const match = err.message.match(/retry after (\d+)/i);
          if (match && match[1]) {
            waitTime = parseInt(match[1], 10) * 1000 + 500; // wait recommended duration + 500ms safety buffer
            console.warn(`[Upload Worker] Telegram FloodWait detected. Retrying after ${match[1]}s...`);
          } else {
            waitTime = delay * 2;
          }
        } else {
          waitTime = delay * 2;
        }

        delay = waitTime;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

  } else if (storageType === 'SUPABASE') {
    try {
      if(!supabaseUrl || !supabaseKey) throw new Error("Supabase credentials missing");
      await uploadToSupabase(supabaseUrl, supabaseKey, fileUuid, buffer);
      
      await prisma.fileChunk.create({
        data: {
          file_uuid: fileUuid,
          chunk_index: 0,
          message_id: `${fileUuid}.zip`, // S3 object key
          iv: null,
          auth_tag: null
        }
      });
      console.log(`[Upload Worker] Uploaded to Supabase successfully`);
    } catch (err: any) {
      console.error(`[Upload Worker] Supabase Error:`, err.message);
      // File cleanup on failure
      try { fs.unlinkSync(filePath); } catch(e){}
      throw err;
    }
  }

  // Clean up temporary local file chunk
  try { fs.unlinkSync(filePath); } catch(e){}

  return { success: true };
}, { connection: redis });
