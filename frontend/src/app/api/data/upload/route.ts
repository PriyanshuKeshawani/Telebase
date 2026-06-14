import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState, verifyProjectApiKey, StoredFile, FileChunk, isCFWorkerConfigured, isKVConfigured, updateStateCache, encryptPayload, saveKVValue, formatTelegramChannelId } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = formatTelegramChannelId(process.env.AUTH_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID || '');
const CHUNK_SIZE = 19 * 1024 * 1024;

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || '';
const CLOUDFLARE_WORKER_KEY = process.env.CLOUDFLARE_WORKER_KEY || '';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

// --- Edge-compatible helpers ---
const byteToHex: string[] = [];
for (let n = 0; n <= 0xff; ++n) {
  byteToHex.push(n.toString(16).padStart(2, '0'));
}

function bytesToHex(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('hex');
  }
  const hexChars = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hexChars[i] = byteToHex[bytes[i]];
  }
  return hexChars.join('');
}

async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new globalThis.CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data as any);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLen = chunks.reduce((a, c) => a + c.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) { result.set(c, off); off += c.length; }
  return result;
}

async function aesGcmEncryptChunk(keyBytes: Uint8Array, plaintext: Uint8Array): Promise<{ iv: Uint8Array; authTag: Uint8Array; cipherText: Uint8Array }> {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes as any, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as any, tagLength: 128 }, key, plaintext as any));
  return { iv, cipherText: encrypted.slice(0, encrypted.length - 16), authTag: encrypted.slice(encrypted.length - 16) };
}

async function uploadTelegramWithRetry(botToken: string, channelId: string, fileUuid: string, chunkIndex: number, chunkBytes: Uint8Array, retries = 5, baseDelayMs = 2000): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('chat_id', channelId);
      formData.append('document', new Blob([chunkBytes as any], { type: 'application/octet-stream' }), `${fileUuid}_chunk_${chunkIndex}.enc`);
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) return data.result.document.file_id;
      if (data.error_code === 429) {
        const wait = ((data.parameters?.retry_after || 5) + 1) * 1000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw new Error(data.description || 'Telegram sendDocument failed');
    } catch (err: any) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  throw new Error(`Telegram upload failed for chunk ${chunkIndex} after ${retries} attempts`);
}

async function runWithConcurrencyLimit<T, R>(concurrency: number, items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const p = Promise.resolve().then(() => fn(item)).then(res => { results[i] = res; });
    executing.push(p);
    p.then(() => { const idx = executing.indexOf(p); if (idx > -1) executing.splice(idx, 1); });
    if (executing.length >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ success: false, error: 'API key is required in x-api-key header' }, { status: 401 });

    const project = await verifyProjectApiKey(apiKey);
    if (!project) return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });

    let fileBytes: Uint8Array;
    let filename = 'payload.json';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
      filename = file.name;
      fileBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      fileBytes = new TextEncoder().encode(await req.text());
    }

    if (fileBytes.length === 0) return NextResponse.json({ success: false, error: 'Empty file body' }, { status: 400 });

    console.log(`[Upload] Processing "${filename}" (${(fileBytes.length / 1024).toFixed(2)} KB)...`);

    const compressedBytes = await gzipCompress(fileBytes);
    const fileHash = bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', fileBytes as any)));
    const fileUuid = globalThis.crypto.randomUUID();
    const projectAESKey = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(project.api_key) as any));

    type PreparedChunk = { chunkIndex: number; iv: Uint8Array; authTag: Uint8Array; botToken: string; channelId: string; kvKey: string; chunkBytes: Uint8Array; };
    const preparedChunks: PreparedChunk[] = [];
    let offset = 0, chunkIdx = 0;

    while (offset < compressedBytes.length) {
      const end = Math.min(offset + CHUNK_SIZE, compressedBytes.length);
      const { iv, authTag, cipherText } = await aesGcmEncryptChunk(projectAESKey, compressedBytes.slice(offset, end));
      offset = end;
      const botToken = project.bots.length > 0 ? project.bots[chunkIdx % project.bots.length] : BOT_TOKEN;
      let channelId = formatTelegramChannelId(project.channel_id || TELEGRAM_CHANNEL_ID);
      if (!botToken || !channelId) throw new Error('Telegram bot token or target channel is not configured.');
      preparedChunks.push({ chunkIndex: chunkIdx, iv, authTag, botToken, channelId, kvKey: `chunk_${fileUuid}_${chunkIdx}`, chunkBytes: cipherText });
      chunkIdx++;
    }

    console.log(`[Upload API] Uploading ${preparedChunks.length} chunks to Cloudflare KV...`);
    await runWithConcurrencyLimit(3, preparedChunks, async (pc) => {
      const finalBuffer = new Uint8Array(pc.iv.length + pc.authTag.length + pc.chunkBytes.length);
      finalBuffer.set(pc.iv); finalBuffer.set(pc.authTag, pc.iv.length); finalBuffer.set(pc.chunkBytes, pc.iv.length + pc.authTag.length);
      const encryptedHex = bytesToHex(finalBuffer);

      if (isCFWorkerConfigured) {
        try {
          const res = await fetch(`${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${pc.kvKey}`, { method: 'PUT', headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY, 'Content-Type': 'text/plain' }, body: encryptedHex });
          if (res.ok) { console.log(`[Upload API] Chunk ${pc.chunkIndex} saved to Worker KV.`); return; }
        } catch (e: any) { console.error(`[Upload API] Worker KV error chunk ${pc.chunkIndex}:`, e.message); }
      }
      if (isKVConfigured) {
        try {
          const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${pc.kvKey}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' }, body: encryptedHex });
          if (res.ok) console.log(`[Upload API] Chunk ${pc.chunkIndex} saved to KV REST API.`);
        } catch (e: any) { console.error(`[Upload API] KV REST error chunk ${pc.chunkIndex}:`, e.message); }
      }
    });

    const chunks: FileChunk[] = preparedChunks.map(pc => ({ chunk_index: pc.chunkIndex, message_id: 'pending_telegram_backup', iv: bytesToHex(pc.iv), auth_tag: bytesToHex(pc.authTag) }));
    const newFile: StoredFile = { uuid: fileUuid, project_id: project.id, owner_telegram_id: project.owner_telegram_id, filename, version: 1, chunk_count: chunks.length, file_hash: fileHash, size: fileBytes.length, created_at: new Date().toISOString(), chunks };

    try {
      const encryptedMeta = await encryptPayload(JSON.stringify(newFile));
      const ok = await saveKVValue(`file_meta_${fileUuid}`, encryptedMeta);
      if (ok) console.log(`[Upload API] File metadata backup saved.`);
    } catch (e: any) { console.error(`[Upload API] Metadata backup error:`, e.message); }

    const state = await getDatabaseState(true);
    state.files.push(newFile);
    await saveDatabaseState(state);
    console.log(`[Upload API] File "${filename}" added to database state!`);

    // Background Telegram backup
    (async () => {
      try {
        const uploadedMessageIds = new Map<number, string>();
        for (const pc of preparedChunks) {
          try {
            const fileId = await uploadTelegramWithRetry(
              pc.botToken,
              pc.channelId,
              fileUuid,
              pc.chunkIndex,
              pc.chunkBytes
            );

            console.log(`[Upload BG] Chunk ${pc.chunkIndex} successfully backed up to Telegram. File ID: ${fileId}`);
            uploadedMessageIds.set(pc.chunkIndex, fileId);
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
        size: fileBytes.length
      }
    });

  } catch (error: any) {
    console.error('[Upload API Error]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
