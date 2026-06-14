import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState, verifyProjectApiKey, isCFWorkerConfigured, isKVConfigured } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || '';
const CLOUDFLARE_WORKER_KEY = process.env.CLOUDFLARE_WORKER_KEY || '';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

// --- Edge-compatible helpers ---
function hexToBytes(hex: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(hex, 'hex'));
  }
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}

async function aesGcmDecryptChunk(keyBytes: Uint8Array, iv: Uint8Array, cipherText: Uint8Array, authTag: Uint8Array): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes as any, { name: 'AES-GCM' }, false, ['decrypt']);
  const combined = new Uint8Array(cipherText.length + authTag.length);
  combined.set(cipherText);
  combined.set(authTag, cipherText.length);
  return new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any, tagLength: 128 }, key, combined as any));
}

async function fetchTelegramWithRetry(url: string, options?: RequestInit, retries = 5, delayMs = 1500): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store', ...options });
      if (res.status === 429) {
        const wait = parseInt(res.headers.get('Retry-After') || '0') * 1000 || delayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.description || 'Telegram API returned ok=false');
      return data;
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
    }
  }
  throw new Error('Telegram request failed after maximum retries');
}

async function fetchBinaryWithRetry(url: string, options?: RequestInit, retries = 5, delayMs = 1500): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store', ...options });
      if (res.status === 429) {
        const wait = parseInt(res.headers.get('Retry-After') || '0') * 1000 || delayMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
    }
  }
  throw new Error('Binary fetch failed after maximum retries');
}

async function fetchChunkFromKV(kvKey: string): Promise<Uint8Array | null> {
  if (isCFWorkerConfigured) {
    try {
      const res = await fetch(`${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${kvKey}`, { cache: 'no-store', headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY } });
      if (res.ok) {
        const hex = await res.text();
        if (hex && hex !== 'Not found') {
          const buf = hexToBytes(hex);
          if (buf.length >= 28) return buf.slice(28); // strip IV+authTag header, return ciphertext
        }
      }
    } catch (e) {}
  }
  if (isKVConfigured) {
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${kvKey}`, { cache: 'no-store', headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` } });
      if (res.ok) {
        const hex = await res.text();
        const buf = hexToBytes(hex);
        if (buf.length >= 28) return buf.slice(28);
      }
    } catch (e) {}
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
    if (!apiKey) return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });

    const project = await verifyProjectApiKey(apiKey);
    if (!project) return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });

    const state = await getDatabaseState();
    const fileRecord = state.files.find(f => f.uuid === uuid);
    if (!fileRecord || fileRecord.project_id !== project.id) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    console.log(`[Download] Streaming "${fileRecord.filename}" (${fileRecord.chunk_count} chunks)...`);

    // Ensure chunks are sorted by index to prevent sequential corruption
    fileRecord.chunks.sort((a, b) => a.chunk_index - b.chunk_index);

    // Derive project AES key using Web Crypto
    const projectAESKey = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(project.api_key) as any));

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const PREFETCH_WINDOW = 4;
          const activeFetches = new Map<number, Promise<Uint8Array>>();

          const fetchChunkData = async (i: number): Promise<Uint8Array> => {
            const chunk = fileRecord.chunks[i];
            const botToken = project.bots.length > 0 ? project.bots[i % project.bots.length] : BOT_TOKEN;
            const kvKey = `chunk_${fileRecord.uuid}_${chunk.chunk_index}`;

            console.log(`[Download] Fetching chunk ${i + 1}/${fileRecord.chunk_count}...`);

            let cipherText: Uint8Array | null = null;

            // 1. Try Cloudflare KV (fast path)
            cipherText = await fetchChunkFromKV(kvKey);

            // 2. Fallback: pending backup - retry KV
            if (!cipherText && chunk.message_id === 'pending_telegram_backup') {
              console.log(`[Download] Chunk ${chunk.chunk_index} pending. Retrying KV...`);
              for (let attempt = 0; attempt < 10 && !cipherText; attempt++) {
                await new Promise(r => setTimeout(r, 1000));
                cipherText = await fetchChunkFromKV(kvKey);
              }
              if (!cipherText) throw new Error(`Chunk ${chunk.chunk_index} pending backup and not available in KV.`);
            }

            // 3. Fallback: Download from Telegram
            if (!cipherText) {
              console.log(`[Download] Chunk ${chunk.chunk_index} KV miss. Fetching from Telegram...`);
              const fileData = await fetchTelegramWithRetry(`https://api.telegram.org/bot${botToken}/getFile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_id: chunk.message_id })
              });
              const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
              cipherText = await fetchBinaryWithRetry(downloadUrl);
            }

            // 4. Decrypt using AES-256-GCM
            const iv = hexToBytes(chunk.iv);
            const authTag = hexToBytes(chunk.auth_tag);
            return await aesGcmDecryptChunk(projectAESKey, iv, cipherText, authTag);
          };

          // Kick off initial prefetches
          for (let i = 0; i < Math.min(PREFETCH_WINDOW, fileRecord.chunks.length); i++) {
            activeFetches.set(i, fetchChunkData(i));
          }

          for (let i = 0; i < fileRecord.chunks.length; i++) {
            if (!activeFetches.has(i)) {
              activeFetches.set(i, fetchChunkData(i));
            }

            const decryptedChunk = await activeFetches.get(i);
            controller.enqueue(decryptedChunk);
            activeFetches.delete(i);

            // Queue the next fetch
            const nextIdx = i + PREFETCH_WINDOW;
            if (nextIdx < fileRecord.chunks.length) {
              activeFetches.set(nextIdx, fetchChunkData(nextIdx));
            }
          }
          console.log(`[Download] Streaming complete for "${fileRecord.filename}"`);
          controller.close();
        } catch (err: any) {
          console.error(`[Download Error]`, err.message);
          controller.error(err);
        }
      }
    });

    let finalStream: ReadableStream = stream;
    if (fileRecord.version === 1 || fileRecord.version === undefined) {
      finalStream = stream.pipeThrough(new DecompressionStream('gzip'));
    }

    return new NextResponse(finalStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
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
    if (!apiKey) return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });

    const project = await verifyProjectApiKey(apiKey);
    if (!project) return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });

    const state = await getDatabaseState(true);
    const fileIndex = state.files.findIndex(f => f.uuid === uuid);

    if (fileIndex === -1 || state.files[fileIndex].project_id !== project.id) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    state.files.splice(fileIndex, 1);
    await saveDatabaseState(state, { allowShrink: true });

    return NextResponse.json({ success: true, message: 'File deleted successfully from index' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
