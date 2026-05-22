import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import zlib from 'zlib';
import { getDatabaseState, saveDatabaseState, verifyProjectApiKey, StoredFile, FileChunk } from '@/lib/telegramDatabase';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '';
const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB chunks to be fast and safe under Vercel serverless environment

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

    // 1. Compress using native zlib Gzip (super fast and efficient)
    const compressedBuffer = zlib.gzipSync(fileBuffer);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 2. Generate UUID
    const fileUuid = crypto.randomUUID();

    // 3. Derive 32-byte Project specific Encryption Key
    const projectAESKey = crypto.createHash('sha256').update(project.api_key).digest();

    // 4. Split into chunks and encrypt each
    const chunks: FileChunk[] = [];
    let offset = 0;
    let chunkIndex = 0;

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

      // Auto-format channel ID on-the-fly if it is a numeric ID missing the -100 prefix
      if (channelId) {
        channelId = channelId.trim();
        if (/^-?\d+$/.test(channelId)) {
          if (channelId.startsWith('-')) {
            if (!channelId.startsWith('-100')) {
              channelId = '-100' + channelId.substring(1);
            }
          } else {
            if (channelId.startsWith('100')) {
              channelId = '-' + channelId;
            } else {
              channelId = '-100' + channelId;
            }
          }
        }
      }

      if (!botToken || !channelId) {
        throw new Error('Telegram bot token or target channel is not configured.');
      }

      console.log(`[Upload] Chunk ${chunkIndex}: Uploading ${(encryptedChunk.length / 1024 / 1024).toFixed(2)} MB using bot rotation...`);

      // Upload chunk to Telegram
      const formData = new FormData();
      formData.append('chat_id', channelId);
      const chunkBlob = new Blob([encryptedChunk], { type: 'application/octet-stream' });
      formData.append('document', chunkBlob, `${fileUuid}_chunk_${chunkIndex}.enc`);

      const uploadRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.ok) {
        throw new Error(`Telegram upload failed for chunk ${chunkIndex}: ${JSON.stringify(uploadData)}`);
      }

      const fileId = uploadData.result.document.file_id;

      chunks.push({
        chunk_index: chunkIndex,
        message_id: fileId, // Store file_id directly for rapid download retrieval
        iv: iv.toString('hex'),
        auth_tag: authTag.toString('hex')
      });

      chunkIndex++;
    }

    // 5. Add to state and save
    const state = await getDatabaseState(true);
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

    state.files.push(newFile);
    await saveDatabaseState(state);

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
