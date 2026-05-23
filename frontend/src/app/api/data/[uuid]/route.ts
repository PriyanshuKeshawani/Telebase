import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDatabaseState, saveDatabaseState, verifyProjectApiKey, isCFWorkerConfigured, isKVConfigured } from '@/lib/telegramDatabase';

export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '';

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || '';
const CLOUDFLARE_WORKER_KEY = process.env.CLOUDFLARE_WORKER_KEY || '';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

async function fetchTelegramWithRetry(url: string, options?: RequestInit, retries = 5, delayMs = 1500): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store', ...options });
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
      const res = await fetch(url, { cache: 'no-store', ...options });
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

            let encryptedChunk: Buffer | null = null;
            const kvKey = `chunk_${fileRecord.uuid}_${chunk.chunk_index}`;

            // 0. Try to read from L1 Local Disk SSD Cache (Lightspeed <1ms read)
            const LOCAL_STORE_DIR = path.join(process.cwd(), '.telebase_data');
            const localChunkPath = path.join(LOCAL_STORE_DIR, 'chunks', `chunk_${fileRecord.uuid}_${chunk.chunk_index}`);
            if (fs.existsSync(localChunkPath)) {
              try {
                encryptedChunk = fs.readFileSync(localChunkPath);
                console.log(`[Download Stream] Chunk ${chunk.chunk_index} loaded directly from L1 Local SSD Cache.`);
              } catch (fsErr: any) {
                console.warn(`[Download Stream] L1 Cache read failed for chunk ${chunk.chunk_index}:`, fsErr.message);
              }
            }

            // 1. Try to read directly from Cloudflare Worker KV
            if (isCFWorkerConfigured) {
              try {
                const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${kvKey}`;
                const res = await fetch(url, {
                  cache: 'no-store',
                  headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY }
                });
                if (res.ok) {
                  const encryptedHex = await res.text();
                  if (encryptedHex !== "Not found") {
                    const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
                    if (encryptedBuffer.length >= 28) {
                      encryptedChunk = encryptedBuffer.subarray(28);
                      console.log(`[Download Stream] Chunk ${chunk.chunk_index} loaded directly from Cloudflare Worker KV.`);
                    }
                  }
                }
              } catch (kvErr: any) {
                console.warn(`[Download Stream] Cloudflare Worker KV read failed for chunk ${chunk.chunk_index}:`, kvErr.message);
              }
            }

            // 2. Try to read directly from Cloudflare KV REST API
            if (!encryptedChunk && isKVConfigured) {
              try {
                const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${kvKey}`;
                const res = await fetch(url, {
                  cache: 'no-store',
                  headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` }
                });
                if (res.ok) {
                  const encryptedHex = await res.text();
                  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
                  if (encryptedBuffer.length >= 28) {
                    encryptedChunk = encryptedBuffer.subarray(28);
                    console.log(`[Download Stream] Chunk ${chunk.chunk_index} loaded directly from Cloudflare KV REST API.`);
                  }
                }
              } catch (kvErr: any) {
                console.warn(`[Download Stream] Cloudflare KV REST read failed for chunk ${chunk.chunk_index}:`, kvErr.message);
              }
            }

            // 3. Fallback: Telegram Download / Pending Retry logic
            if (!encryptedChunk) {
              if (chunk.message_id === 'pending_telegram_backup') {
                console.log(`[Download Stream] Chunk ${chunk.chunk_index} Telegram backup is pending. Retrying Cloudflare KV read...`);
                let attempts = 0;
                while (attempts < 10 && !encryptedChunk) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  // Retry Worker KV
                  if (isCFWorkerConfigured) {
                    try {
                      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${kvKey}`;
                      const res = await fetch(url, { cache: 'no-store', headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY } });
                      if (res.ok) {
                        const encryptedHex = await res.text();
                        if (encryptedHex !== "Not found") {
                          const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
                          if (encryptedBuffer.length >= 28) {
                            encryptedChunk = encryptedBuffer.subarray(28);
                            break;
                          }
                        }
                      }
                    } catch (e) {}
                  }

                  // Retry KV REST
                  if (isKVConfigured) {
                    try {
                      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${kvKey}`;
                      const res = await fetch(url, { cache: 'no-store', headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` } });
                      if (res.ok) {
                        const encryptedHex = await res.text();
                        const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
                        if (encryptedBuffer.length >= 28) {
                          encryptedChunk = encryptedBuffer.subarray(28);
                          break;
                        }
                      }
                    } catch (e) {}
                  }
                  attempts++;
                }

                if (!encryptedChunk) {
                  throw new Error(`Chunk ${chunk.chunk_index} is pending Telegram backup and could not be retrieved from Cloudflare KV.`);
                }
              } else {
                console.log(`[Download Stream] Chunk ${chunk.chunk_index} KV cache miss. Falling back to Telegram retrieval.`);
                // 1. Get chunk file path from Telegram with Retry
                const fileData = await fetchTelegramWithRetry(`https://api.telegram.org/bot${botToken}/getFile`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ file_id: chunk.message_id })
                });

                const filePath = fileData.result.file_path;
                const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

                // 2. Download encrypted chunk binary with Retry
                encryptedChunk = await fetchBinaryChunkWithRetry(downloadUrl);
              }
            }

            // Save chunk back to L1 Local SSD Cache if fetched from network for future lightspeed access
            if (encryptedChunk && !fs.existsSync(localChunkPath)) {
              try {
                const chunksDir = path.join(LOCAL_STORE_DIR, 'chunks');
                if (!fs.existsSync(chunksDir)) {
                  fs.mkdirSync(chunksDir, { recursive: true });
                }
                fs.writeFileSync(localChunkPath, encryptedChunk);
                console.log(`[Download Stream] Chunk ${chunk.chunk_index} successfully cached to L1 Local SSD Cache.`);
              } catch (fsErr: any) {
                console.warn(`[Download Stream] Failed to cache chunk to L1 local disk:`, fsErr.message);
              }
            }

            // 4. Decrypt the chunk using AES-256-GCM
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
