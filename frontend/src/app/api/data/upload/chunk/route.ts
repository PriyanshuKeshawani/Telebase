import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectApiKey, isCFWorkerConfigured, isKVConfigured, formatTelegramChannelId } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = formatTelegramChannelId(process.env.AUTH_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID || '');

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

async function aesGcmEncryptChunk(keyBytes: Uint8Array, plaintext: Uint8Array): Promise<{ iv: Uint8Array; authTag: Uint8Array; cipherText: Uint8Array }> {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes as any, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as any, tagLength: 128 }, key, plaintext as any));
  return { iv, cipherText: encrypted.slice(0, encrypted.length - 16), authTag: encrypted.slice(encrypted.length - 16) };
}

async function uploadTelegramWithRetry(botToken: string, channelId: string, fileUuid: string, chunkIndex: number, chunkBytes: Uint8Array, isEncrypted: boolean, retries = 5, baseDelayMs = 2000): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const formData = new FormData();
      formData.append('chat_id', channelId);
      const ext = isEncrypted ? 'enc' : 'bin';
      formData.append('document', new Blob([chunkBytes as any], { type: 'application/octet-stream' }), `${fileUuid}_chunk_${chunkIndex}.${ext}`);
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

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');
    const fileUuid = req.headers.get('x-file-uuid');
    const chunkIndexStr = req.headers.get('x-chunk-index');

    if (!apiKey) return NextResponse.json({ success: false, error: 'API key is required in x-api-key header' }, { status: 401 });
    if (!fileUuid) return NextResponse.json({ success: false, error: 'File UUID is required in x-file-uuid header' }, { status: 400 });
    if (chunkIndexStr === null) return NextResponse.json({ success: false, error: 'Chunk index is required in x-chunk-index header' }, { status: 400 });

    const chunkIndex = parseInt(chunkIndexStr, 10);
    if (isNaN(chunkIndex)) return NextResponse.json({ success: false, error: 'Invalid chunk index' }, { status: 400 });

    const project = await verifyProjectApiKey(apiKey);
    if (!project) return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });

    const chunkBytes = new Uint8Array(await req.arrayBuffer());
    if (chunkBytes.length === 0) return NextResponse.json({ success: false, error: 'Empty chunk body' }, { status: 400 });

    console.log(`[Upload Chunk API] Processing chunk ${chunkIndex} for file ${fileUuid} (${(chunkBytes.length / 1024).toFixed(2)} KB)...`);

    const headerIsEncrypted = req.headers.get('x-is-encrypted');
    const headerIsCompressed = req.headers.get('x-is-compressed');
    const kvEncrypt = project.storage_options?.encrypt_files ?? true;
    const kvCompress = project.storage_options?.compress_files ?? true;
    const encryptFiles = headerIsEncrypted !== null ? headerIsEncrypted === 'true' : kvEncrypt;
    const compressFiles = headerIsCompressed !== null ? headerIsCompressed === 'true' : kvCompress;

    console.log(`[TEMP LOG UPLOAD CHUNK]`);
    console.log(`- x-is-encrypted header: ${headerIsEncrypted}`);
    console.log(`- x-is-compressed header: ${headerIsCompressed}`);
    console.log(`- KV encrypt_files value: ${kvEncrypt}`);
    console.log(`- KV compress_files value: ${kvCompress}`);
    console.log(`- Final encrypt decision: ${encryptFiles}`);
    console.log(`- Final compress decision: ${compressFiles}`);
    
    let iv: any = new Uint8Array(0);
    let authTag: any = new Uint8Array(0);
    let cipherText: any = chunkBytes;

    if (encryptFiles) {
      const projectAESKey = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(project.api_key) as any));
      const encrypted = await aesGcmEncryptChunk(projectAESKey, chunkBytes);
      iv = encrypted.iv;
      authTag = encrypted.authTag;
      cipherText = encrypted.cipherText;
    }

    const botToken = project.bots.length > 0 ? project.bots[chunkIndex % project.bots.length] : BOT_TOKEN;
    const channelId = formatTelegramChannelId(project.channel_id || TELEGRAM_CHANNEL_ID);
    if (!botToken || !channelId) throw new Error('Telegram bot token or target channel is not configured.');

    const kvKey = `chunk_${fileUuid}_${chunkIndex}`;
    
    const finalBuffer = new Uint8Array(iv.length + authTag.length + cipherText.length);
    finalBuffer.set(iv); 
    finalBuffer.set(authTag, iv.length); 
    finalBuffer.set(cipherText, iv.length + authTag.length);
    const encryptedHex = bytesToHex(finalBuffer);

    // 1. Upload to Cloudflare KV
    let kvSaved = false;
    if (isCFWorkerConfigured) {
      try {
        const res = await fetch(`${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${kvKey}?expiration_ttl=86400`, { method: 'PUT', headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY, 'Content-Type': 'text/plain' }, body: encryptedHex });
        if (res.ok) kvSaved = true;
      } catch (e: any) { console.error(`[Upload Chunk API] Worker KV error chunk ${chunkIndex}:`, e.message); }
    }
    if (!kvSaved && isKVConfigured) {
      try {
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${kvKey}?expiration_ttl=86400`, { method: 'PUT', headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' }, body: encryptedHex });
        if (res.ok) kvSaved = true;
      } catch (e: any) { console.error(`[Upload Chunk API] KV REST error chunk ${chunkIndex}:`, e.message); }
    }

    // 2. Upload to Telegram
    console.log(`[Upload Chunk API] Uploading chunk ${chunkIndex} to Telegram...`);
    // If not encrypted, we can upload as .bin or .enc. Telegram doesn't care.
    const fileId = await uploadTelegramWithRetry(botToken, channelId, fileUuid, chunkIndex, cipherText, encryptFiles);
    console.log(`[Upload Chunk API] Chunk ${chunkIndex} uploaded successfully. Telegram File ID: ${fileId}`);

    return NextResponse.json({
      success: true,
      chunkData: {
        chunk_index: chunkIndex,
        iv: bytesToHex(iv),
        auth_tag: bytesToHex(authTag),
        message_id: fileId
      }
    });

  } catch (error: any) {
    console.error(`[Upload Chunk API Error]`, error.message);
    return NextResponse.json({ success: false, error: "An internal error occurred" }, { status: 500 });
  }
}
