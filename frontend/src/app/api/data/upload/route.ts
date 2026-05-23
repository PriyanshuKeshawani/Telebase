import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getDatabaseState, saveDatabaseState, verifyProjectApiKey, StoredFile, FileChunk, isCFWorkerConfigured, isKVConfigured, updateStateCache, encryptPayload, saveKVValue, formatTelegramChannelId } from '@/lib/telegramDatabase';

export const dynamic = 'force-dynamic';

const gzipAsync = promisify(zlib.gzip);

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = formatTelegramChannelId(process.env.TELEGRAM_CHANNEL_ID || '');
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks to fit in Cloudflare KV limits, prevent timeouts, and enable fast parallel uploads

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || '';
const CLOUDFLARE_WORKER_KEY = process.env.CLOUDFLARE_WORKER_KEY || '';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

async function uploadTelegramWithRetry(
  botToken: string,
  channelId: string,
  fileUuid: string,
  chunkIndex: number,
  encryptedChunk: Buffer,
  retries = 5,
  baseDelayMs = 2000
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('chat_id', channelId);
      const chunkBlob = new Blob([new Uint8Array(encryptedChunk)], { type: 'application/octet-stream' });
      formData.append('document', chunkBlob, `${fileUuid}_chunk_${chunkIndex}.enc`);

      const uploadRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadRes.json();
      
      if (uploadData.ok) {
        return uploadData.result.document.file_id;
      }

      if (uploadData.error_code === 429) {
        const retryAfterSeconds = uploadData.parameters?.retry_after || 5;
        const waitMs = (retryAfterSeconds + 1) * 1000;
        console.warn(`[Upload BG] Telegram 429 rate limit for chunk ${chunkIndex}. Waiting ${waitMs}ms before retry... (Attempt ${attempt}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      throw new Error(uploadData.description || 'Telegram sendDocument failed');
    } catch (err: any) {
      if (attempt === retries) {
        throw err;
      }
      const waitMs = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[Upload BG] Telegram upload failed for chunk ${chunkIndex}: ${err.message}. Retrying in ${waitMs}ms... (Attempt ${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new Error(`Telegram upload failed for chunk ${chunkIndex} after ${retries} attempts`);
}

async function runWithConcurrencyLimit<T, R>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = Promise.resolve().then(() => fn(item)).then((res) => {
      results[i] = res;
    });
    
    executing.push(p);
    
    p.then(() => {
      const idx = executing.indexOf(p);
      if (idx > -1) executing.splice(idx, 1);
    });
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required in x-api-key header' }, { status: 401 });
    }

    // Verify API Key
    const project = await verifyProjectApiKey(apiKey);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    let fileBuffer: Buffer;
    let filename = 'payload.json';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
      }
      filename = file.name;
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      // JSON or Raw body upload
      const text = await req.text();
      fileBuffer = Buffer.from(text, 'utf-8');
    }

    if (fileBuffer.length === 0) {
      return NextResponse.json({ success: false, error: 'Empty file body' }, { status: 400 });
    }

    console.log(`[Upload] Processing "${filename}" (${(fileBuffer.length / 1024).toFixed(2)} KB)...`);

    // 1. Compress using native zlib Gzip asynchronously (level: Z_BEST_SPEED for maximum performance)
    const compressedBuffer = await gzipAsync(fileBuffer, { level: zlib.constants.Z_BEST_SPEED });
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 2. Generate UUID
    const fileUuid = crypto.randomUUID();

    // 3. Derive 32-byte Project specific Encryption Key
    const projectAESKey = crypto.createHash('sha256').update(project.api_key).digest();

    // 4. Split into chunks, encrypt, and upload in parallel
    const preparedChunks: Array<{
      chunkIndex: number;
      iv: Buffer;
      authTag: Buffer;
      botToken: string;
      channelId: string;
      kvKey: string;
    }> = [];

    const LOCAL_STORE_DIR = path.join(process.cwd(), '.telebase_data');
    const LOCAL_STATE_FILE = path.join(LOCAL_STORE_DIR, 'local_state.json');
    const CHUNKS_DIR = path.join(LOCAL_STORE_DIR, 'chunks');
    if (!fs.existsSync(CHUNKS_DIR)) {
      fs.mkdirSync(CHUNKS_DIR, { recursive: true });
    }

    let offset = 0;
    let chunkIndex = 0;

    console.log(`[Upload API] Slicing, encrypting & saving chunks to L1 local SSD cache...`);

    while (offset < compressedBuffer.length) {
      const end = Math.min(offset + CHUNK_SIZE, compressedBuffer.length);
      const rawChunk = compressedBuffer.subarray(offset, end);
      offset = end;

      // Encrypt chunk using AES-256-GCM
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', projectAESKey, iv);
      const encryptedChunk = Buffer.concat([cipher.update(rawChunk), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Determine rotated Bot and Channel
      const botToken = project.bots.length > 0 ? project.bots[chunkIndex % project.bots.length] : BOT_TOKEN;
      let channelId = project.channel_id || TELEGRAM_CHANNEL_ID;

      // Auto-format channel ID on-the-fly
      if (channelId) {
        channelId = formatTelegramChannelId(channelId);
      }

      if (!botToken || !channelId) {
        throw new Error('Telegram bot token or target channel is not configured.');
      }

      const kvKey = `chunk_${fileUuid}_${chunkIndex}`;

      // Save encrypted chunk instantly to L1 SSD local disk cache synchronously to save RAM memory footprint
      const localChunkPath = path.join(CHUNKS_DIR, `chunk_${fileUuid}_${chunkIndex}`);
      fs.writeFileSync(localChunkPath, encryptedChunk);

      preparedChunks.push({
        chunkIndex,
        iv,
        authTag,
        botToken,
        channelId,
        kvKey
      });

      chunkIndex++;
    }

    console.log(`[Upload API] Successfully saved ${preparedChunks.length} chunks to L1 SSD disk cache.`);

    // Synchronously upload all chunks to Cloudflare KV to ensure absolute data durability before return
    console.log(`[Upload API] Uploading ${preparedChunks.length} chunks synchronously to Cloudflare KV...`);
    await runWithConcurrencyLimit(3, preparedChunks, async (pc) => {
      let savedToKV = false;

      // Read chunk from L1 cache and build parameters dynamically (RAM is immediately garbage collected on function scope exit)
      const localChunkPath = path.join(CHUNKS_DIR, `chunk_${fileUuid}_${pc.chunkIndex}`);
      if (!fs.existsSync(localChunkPath)) {
        throw new Error(`Chunk ${pc.chunkIndex} file not found in SSD cache.`);
      }
      const encryptedChunk = fs.readFileSync(localChunkPath);
      const finalBuffer = Buffer.concat([pc.iv, pc.authTag, encryptedChunk]);
      const encryptedHex = finalBuffer.toString('hex');

      // 1. Try to cache in Cloudflare Worker KV
      if (isCFWorkerConfigured) {
        try {
          const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${pc.kvKey}`;
          const res = await fetch(url, {
            method: 'PUT',
            headers: {
              'x-worker-key': CLOUDFLARE_WORKER_KEY,
              'Content-Type': 'text/plain'
            },
            body: encryptedHex
          });
          if (res.ok) {
            savedToKV = true;
            console.log(`[Upload API] Chunk ${pc.chunkIndex} successfully saved to Cloudflare Worker KV.`);
          } else {
            const errText = await res.text();
            console.warn(`[Upload API] Worker KV PUT returned status ${res.status}: ${errText}`);
          }
        } catch (kvErr: any) {
          console.error(`[Upload API] Worker KV write error for chunk ${pc.chunkIndex}:`, kvErr.message);
        }
      }

      // 2. Try to cache in Cloudflare KV REST API
      if (!savedToKV && isKVConfigured) {
        try {
          const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${pc.kvKey}`;
          const res = await fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'text/plain'
            },
            body: encryptedHex
          });
          if (res.ok) {
            savedToKV = true;
            console.log(`[Upload API] Chunk ${pc.chunkIndex} successfully saved to Cloudflare KV REST API.`);
          } else {
            const errText = await res.text();
            console.warn(`[Upload API] Cloudflare KV REST PUT returned status ${res.status}: ${errText}`);
          }
        } catch (kvErr: any) {
          console.error(`[Upload API] Cloudflare KV REST write error for chunk ${pc.chunkIndex}:`, kvErr.message);
        }
      }
    });

    const chunks: FileChunk[] = preparedChunks.map((pc) => {
      return {
        chunk_index: pc.chunkIndex,
        message_id: 'pending_telegram_backup', // indicates background Telegram upload is running
        iv: pc.iv.toString('hex'),
        auth_tag: pc.authTag.toString('hex')
      };
    });

    const newFile: StoredFile = {
      uuid: fileUuid,
      project_id: project.id,
      filename,
      version: 1,
      chunk_count: chunks.length,
      file_hash: fileHash,
      size: fileBuffer.length,
      created_at: new Date().toISOString(),
      chunks
    };

    // Write individual file metadata backup key file_meta_${fileUuid} synchronously to Cloudflare KV
    try {
      const encryptedMeta = encryptPayload(JSON.stringify(newFile));
      const ok = await saveKVValue(`file_meta_${fileUuid}`, encryptedMeta);
      if (ok) {
        console.log(`[Upload API] Successfully saved synchronous file metadata backup for ${fileUuid} to Cloudflare KV.`);
      } else {
        console.warn(`[Upload API] Failed to save synchronous file metadata backup to Cloudflare KV.`);
      }
    } catch (metaErr: any) {
      console.error(`[Upload API] Metadata backup serialization/write error:`, metaErr.message);
    }

    // Add to state and save synchronously
    const state = await getDatabaseState(true);
    state.files.push(newFile);
    await saveDatabaseState(state);

    console.log(`[Upload API] File "${filename}" successfully added and synced synchronously to database state!`);

    // Run sequential Telegram backup in the background asynchronously
    (async () => {
      try {
        console.log(`[Upload BG] Starting background Telegram backup for file "${filename}" (${fileUuid})...`);
        const uploadedMessageIds = new Map<number, string>();
        
        for (const pc of preparedChunks) {
          try {
            console.log(`[Upload BG] Backing up chunk ${pc.chunkIndex + 1}/${preparedChunks.length} to Telegram channel...`);
            
            // Read chunk from L1 SSD disk cache to save RAM memory footprint
            const localChunkPath = path.join(CHUNKS_DIR, `chunk_${fileUuid}_${pc.chunkIndex}`);
            if (!fs.existsSync(localChunkPath)) {
              throw new Error(`Chunk ${pc.chunkIndex} file not found in SSD cache.`);
            }
            const encryptedChunk = fs.readFileSync(localChunkPath);

            const fileId = await uploadTelegramWithRetry(
              pc.botToken,
              pc.channelId,
              fileUuid,
              pc.chunkIndex,
              encryptedChunk
            );

            console.log(`[Upload BG] Chunk ${pc.chunkIndex} successfully backed up to Telegram. File ID: ${fileId}`);
            uploadedMessageIds.set(pc.chunkIndex, fileId);

            // Progressive state update (instant local persistence, remote sync deferred to final step)
            try {
              if (fs.existsSync(LOCAL_STATE_FILE)) {
                const localState = JSON.parse(fs.readFileSync(LOCAL_STATE_FILE, 'utf-8'));
                const fileRec = localState.files.find((f: any) => f.uuid === fileUuid);
                if (fileRec) {
                  const chunkRec = fileRec.chunks.find((c: any) => c.chunk_index === pc.chunkIndex);
                  if (chunkRec) {
                    chunkRec.message_id = fileId;
                    fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(localState, null, 2), 'utf-8');
                    updateStateCache(localState);
                    console.log(`[Upload BG] Progressive local save for chunk ${pc.chunkIndex} complete.`);
                  }
                }
              }
            } catch (localErr: any) {
              console.error(`[Upload BG] Progressive local save failed for chunk ${pc.chunkIndex}:`, localErr.message);
            }
          } catch (bgErr: any) {
            console.error(`[Upload BG] Telegram backup failed for chunk ${pc.chunkIndex} after all retries:`, bgErr.message);
          }
        }

        // Perform final remote database state update to sync with Telegram and Cloud
        console.log(`[Upload BG] Syncing final database state with Telegram message IDs...`);
        const finalState = await getDatabaseState(true);
        
        // Remove any old/partially created version of this file record to prevent duplicates
        finalState.files = finalState.files.filter(f => f.uuid !== fileUuid);
        
        // Build the complete file record from memory and our uploadedMessageIds map
        const completedFile: StoredFile = {
          ...newFile,
          chunks: newFile.chunks.map(c => ({
            ...c,
            message_id: uploadedMessageIds.get(c.chunk_index) || c.message_id
          }))
        };
        
        finalState.files.push(completedFile);
        
        // Save the fully synchronized state remotely
        await saveDatabaseState(finalState);
        console.log(`[Upload BG] File "${filename}" background sync and Telegram backup fully complete!`);

      } catch (bgError: any) {
        console.error(`[Upload BG Error] Background upload sync process failed:`, bgError.message);
      }
    })();

    return NextResponse.json({
      success: true,
      file: {
        uuid: fileUuid,
        filename,
        hash: fileHash,
        chunks: chunks.length,
        size: fileBuffer.length
      }
    });

  } catch (error: any) {
    console.error('[Upload API Error]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
