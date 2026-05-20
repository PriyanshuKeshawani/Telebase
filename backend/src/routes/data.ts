import { Router, Response } from 'express';
import { AuthRequest, requireApiKey } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { compressData } from '../utils/zip';
import { calculateSHA256 } from '../utils/hash';
import { splitBuffer, CHUNK_SIZE } from '../utils/chunker';
import { uploadQueue } from '../lib/queue';
import { encryptChunk, createDecryptStream } from '../utils/crypto';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const router = Router();
router.use(requireApiKey);

// Setup temp directory
const TMP_DIR = path.join(__dirname, '../../tmp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// 1. Upload Route (POST) - Encrypts and enqueues chunks
router.post('/upload', async (req: AuthRequest, res: Response) => {
  const project = req.project;
  const userUuid = req.userUuid;
  
  try {
    const jsonData = JSON.stringify(req.body);
    const jsonBuffer = Buffer.from(jsonData, 'utf-8');
    
    // Compress original data
    const zipBuffer = await compressData(jsonBuffer);
    
    // Calculate SHA-256 Hash of original compressed buffer for integrity validation
    const hash = calculateSHA256(zipBuffer);
    
    // Create DB entry
    const newFile = await prisma.file.create({
      data: {
        project_id: project.id,
        user_uuid: userUuid!,
        chunk_count: Math.ceil(zipBuffer.length / CHUNK_SIZE),
        file_hash: hash,
        size: jsonBuffer.length,
        version: 1
      }
    });

    // Split into chunks
    const chunks = splitBuffer(zipBuffer);
    
    // Prepare worker jobs with AES-256-GCM encrypted chunks
    for (let i = 0; i < chunks.length; i++) {
        // Encrypt each chunk individually with unique IV and authTag
        const { encryptedBuffer, iv, authTag } = encryptChunk(chunks[i]);

        // Write encrypted chunk to temp file
        const tmpPath = path.join(TMP_DIR, `${newFile.uuid}_chunk_${i}`);
        fs.writeFileSync(tmpPath, encryptedBuffer);

        // Enqueue chunk upload job
        await uploadQueue.add(`upload:${newFile.uuid}:${i}`, {
          fileUuid: newFile.uuid,
          chunkIndex: i,
          filePath: tmpPath,
          iv,
          authTag,
          storageType: project.storage_type,
          projectBotTokens: project.bots.map((b: any) => b.token),
          channelId: project.channel_id,
          supabaseUrl: project.supabase_url,
          supabaseKey: project.supabase_key
        });
    }

    return res.json({ success: true, file: { uuid: newFile.uuid, hash, chunks: chunks.length } });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Download Secure Stream Route (GET) - Decrypts and streams on-the-fly
router.get('/:uuid', async (req: AuthRequest, res: Response) => {
  const { uuid } = req.params;
  const project = req.project;

  try {
    const fileRecord = await prisma.file.findUnique({
      where: { uuid },
      include: { chunks: { orderBy: { chunk_index: 'asc' } } }
    });

    if (!fileRecord || fileRecord.project_id !== project.id) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Wait for all chunks to be fully uploaded first
    if (fileRecord.chunks.length < fileRecord.chunk_count) {
      return res.status(202).json({ error: 'File is still being uploaded/processed' });
    }

    const bots = project.bots;
    if (project.storage_type === 'TELEGRAM' && bots.length === 0) {
      return res.status(500).json({ error: 'No bots connected to download data' });
    }

    // Set streaming headers for the client
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${uuid}.zip"`);
    res.setHeader('Transfer-Encoding', 'chunked');

    // Stream and Decrypt chunks sequentially to client
    for (let i = 0; i < fileRecord.chunks.length; i++) {
      const chunkRec = fileRecord.chunks[i];

      if (project.storage_type === 'TELEGRAM') {
        const botToken = bots[i % bots.length].token;

        // Fetch actual download url from Telegram
        const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${chunkRec.message_id}`;
        const fileRes = await axios.get(getFileUrl);
        
        if (!fileRes.data || !fileRes.data.ok) {
          throw new Error(`Telegram getFile Error for chunk ${i}: ${JSON.stringify(fileRes.data)}`);
        }

        const filePath = fileRes.data.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

        // Get readable stream from Telegram
        const downloadResponse = await axios.get(downloadUrl, { responseType: 'stream' });
        const telegramStream = downloadResponse.data;

        // Create decryption stream if encrypted (iv and auth_tag present)
        if (chunkRec.iv && chunkRec.auth_tag) {
          const decryptStream = createDecryptStream(chunkRec.iv, chunkRec.auth_tag);
          
          await new Promise<void>((resolve, reject) => {
            telegramStream.pipe(decryptStream).pipe(res, { end: false });
            
            telegramStream.on('error', (err: Error) => reject(new Error(`Telegram Stream Error: ${err.message}`)));
            decryptStream.on('error', (err: Error) => reject(new Error(`Decryption Error: ${err.message}`)));
            
            decryptStream.on('end', () => {
              resolve();
            });
          });
        } else {
          // Fallback if chunk wasn't encrypted
          await new Promise<void>((resolve, reject) => {
            telegramStream.pipe(res, { end: false });
            telegramStream.on('error', (err: Error) => reject(err));
            telegramStream.on('end', () => resolve());
          });
        }
      }
    }

    // Terminate response connection cleanly
    res.end();

  } catch (err: any) {
    console.error('[Streaming Error]', err.message);
    if (res.headersSent) {
      res.destroy(err);
    } else {
      return res.status(500).json({ error: err.message });
    }
  }
});

// 3. Update Route (PUT) - Replaces content, encrypts and cleans up old metadata
router.put('/:uuid', async (req: AuthRequest, res: Response) => {
  const { uuid } = req.params;
  const project = req.project;

  try {
    const existingFile = await prisma.file.findUnique({ where: { uuid } });
    if (!existingFile || existingFile.project_id !== project.id) {
       return res.status(404).json({ error: 'File not found' });
    }

    const jsonData = JSON.stringify(req.body);
    const jsonBuffer = Buffer.from(jsonData, 'utf-8');
    const zipBuffer = await compressData(jsonBuffer);
    const hash = calculateSHA256(zipBuffer);
    const chunks = splitBuffer(zipBuffer);

    // Update File in DB
    await prisma.file.update({
      where: { uuid },
      data: {
        version: existingFile.version + 1,
        chunk_count: chunks.length,
        file_hash: hash,
        size: jsonBuffer.length,
      }
    });

    // Clean up old chunks from the database
    // In a future production iteration, we will trigger a background cleanup job 
    // to call the deleteMessage API on Telegram before deleting the DB entries.
    await prisma.fileChunk.deleteMany({
      where: { file_uuid: uuid }
    });

    for (let i = 0; i < chunks.length; i++) {
        const { encryptedBuffer, iv, authTag } = encryptChunk(chunks[i]);
        
        const tmpPath = path.join(TMP_DIR, `${uuid}_v${existingFile.version+1}_chunk_${i}`);
        fs.writeFileSync(tmpPath, encryptedBuffer);

        await uploadQueue.add(`upload:${uuid}:v${existingFile.version+1}:${i}`, {
          fileUuid: uuid,
          chunkIndex: i,
          filePath: tmpPath,
          iv,
          authTag,
          storageType: project.storage_type,
          projectBotTokens: project.bots.map((b: any) => b.token),
          channelId: project.channel_id,
          supabaseUrl: project.supabase_url,
          supabaseKey: project.supabase_key
        });
    }

    return res.json({ success: true, file: { uuid, version: existingFile.version + 1, hash } });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
