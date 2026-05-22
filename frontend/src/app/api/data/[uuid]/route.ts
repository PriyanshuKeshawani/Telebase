import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDatabaseState, saveDatabaseState, verifyProjectApiKey } from '@/lib/telegramDatabase';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '';

async function fetchTelegramWithRetry(url: string, options?: RequestInit, retries = 5, delayMs = 1500): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : delayMs * Math.pow(2, attempt);
        console.warn(`[Download Stream] Telegram 429 rate limit. Retrying after ${wait}ms... (Attempt ${attempt}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.description || 'Telegram API returned ok=false');
      }
      return data;
    } catch (err: any) {
      if (attempt === retries) {
        throw err;
      }
      const wait = delayMs * Math.pow(2, attempt);
      console.warn(`[Download Stream] Telegram request failed: ${err.message}. Retrying in ${wait}ms... (Attempt ${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw new Error('Telegram request failed after maximum retries');
}

async function fetchBinaryChunkWithRetry(url: string, options?: RequestInit, retries = 5, delayMs = 1500): Promise<Buffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : delayMs * Math.pow(2, attempt);
        console.warn(`[Download Stream] Binary fetch 429 rate limit. Retrying after ${wait}ms... (Attempt ${attempt}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      if (attempt === retries) {
        throw err;
      }
      const wait = delayMs * Math.pow(2, attempt);
      console.warn(`[Download Stream] Binary fetch failed: ${err.message}. Retrying in ${wait}ms... (Attempt ${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw new Error('Binary chunk fetch failed after maximum retries');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
    
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required in headers or query' }, { status: 401 });
    }

    // Verify API Key
    const project = await verifyProjectApiKey(apiKey);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const state = await getDatabaseState();
    const fileRecord = state.files.find((f) => f.uuid === uuid);

    if (!fileRecord || fileRecord.project_id !== project.id) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    console.log(`[Download Stream] Initiating streaming decryption for "${fileRecord.filename}" (${fileRecord.chunk_count} chunks)...`);

    const projectAESKey = crypto.createHash('sha256').update(project.api_key).digest();

    // Create a ReadableStream that fetches, decrypts and streams each chunk sequentially
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (let i = 0; i < fileRecord.chunks.length; i++) {
            const chunk = fileRecord.chunks[i];
            const botToken = project.bots.length > 0 ? project.bots[i % project.bots.length] : BOT_TOKEN;

            console.log(`[Download Stream] Streaming chunk ${i}/${fileRecord.chunk_count}...`);

            // 1. Get chunk file path from Telegram with Retry
            const fileData = await fetchTelegramWithRetry(`https://api.telegram.org/bot${botToken}/getFile`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_id: chunk.message_id })
            });

            const filePath = fileData.result.file_path;
            const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

            // 2. Download encrypted chunk binary with Retry
            const encryptedChunk = await fetchBinaryChunkWithRetry(downloadUrl);

            // 3. Decrypt the chunk using AES-256-GCM
            const iv = Buffer.from(chunk.iv, 'hex');
            const authTag = Buffer.from(chunk.auth_tag, 'hex');
            
            const decipher = crypto.createDecipheriv('aes-256-gcm', projectAESKey, iv);
            decipher.setAuthTag(authTag);

            // Decrypt and emit
            const decryptedChunk = Buffer.concat([decipher.update(encryptedChunk), decipher.final()]);
            
            controller.enqueue(new Uint8Array(decryptedChunk));
          }
          console.log(`[Download Stream] Successfully completed streaming decryption for "${fileRecord.filename}"`);
          controller.close();
        } catch (err: any) {
          console.error(`[Download Stream Error] Failed at chunk decryption: ${err.message}`);
          controller.error(err);
        }
      }
    });

    // Return the response stream with gzip content-encoding so the browser decompress natively!
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'gzip',
        'Content-Disposition': `attachment; filename="${fileRecord.filename}"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error: any) {
    console.error('[Download API Error]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const project = await verifyProjectApiKey(apiKey);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const state = await getDatabaseState(true); // force refresh
    const fileIndex = state.files.findIndex((f) => f.uuid === uuid);

    if (fileIndex === -1 || state.files[fileIndex].project_id !== project.id) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    // Delete file from index
    state.files.splice(fileIndex, 1);
    await saveDatabaseState(state);

    return NextResponse.json({ success: true, message: 'File deleted successfully from index' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
