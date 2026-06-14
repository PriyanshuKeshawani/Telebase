import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let envVars = {};
try {
  const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) envVars[match[1]] = match[2].replace(/(^['"]|['"]$)/g, '').trim();
  }
} catch (e) { console.log('No .env.local found'); }

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || envVars.TELEGRAM_BOT_TOKEN || envVars.BOT_TOKEN;
const CHANNEL_ID = process.env.AUTH_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID || envVars.AUTH_CHANNEL_ID || envVars.TELEGRAM_CHANNEL_ID;

if (!BOT_TOKEN || !CHANNEL_ID) {
  console.error("Missing BOT_TOKEN or CHANNEL_ID in .env.local");
  process.exit(1);
}

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB

// --- Helpers ---
function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}
function hexToBytes(hex) {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}
async function sha256(bytes) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(hashBuffer));
}

// Mimic native Web API CompressionStream using Node's zlib for testing, since Web API CompressionStream is available in Node 18+ globally.
async function gzipCompress(data) {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const chunks = [];
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

async function gzipDecompress(data) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  const chunks = [];
  const reader = ds.readable.getReader();
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

async function aesGcmEncryptChunk(keyBytes, plaintext) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plaintext));
  return { iv, cipherText: encrypted.slice(0, encrypted.length - 16), authTag: encrypted.slice(encrypted.length - 16) };
}

async function aesGcmDecryptChunk(keyBytes, iv, cipherText, authTag) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const combined = new Uint8Array(cipherText.length + authTag.length);
  combined.set(cipherText);
  combined.set(authTag, cipherText.length);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, combined));
}

async function runPipelineTest(fileType, originalBytes) {
  console.log(`\n======================================================`);
  console.log(`[TEST] Starting pipeline for ${fileType}`);
  console.log(`======================================================`);
  
  let tStart = Date.now();
  const origHash = await sha256(originalBytes);
  console.log(`Original Size : ${(originalBytes.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Original Hash : ${origHash}`);

  // 1. Compression
  let t = Date.now();
  const compressedBytes = await gzipCompress(originalBytes);
  console.log(`[+] Compressed in ${Date.now() - t}ms. Size: ${(compressedBytes.length / 1024 / 1024).toFixed(2)} MB`);

  // 2. Chunking & Encryption
  t = Date.now();
  const projectAESKey = new Uint8Array(32); // Mock 32-byte key
  crypto.getRandomValues(projectAESKey);
  
  const chunks = [];
  let offset = 0;
  while (offset < compressedBytes.length) {
    const end = Math.min(offset + CHUNK_SIZE, compressedBytes.length);
    const plaintext = compressedBytes.slice(offset, end);
    const { iv, authTag, cipherText } = await aesGcmEncryptChunk(projectAESKey, plaintext);
    chunks.push({ index: chunks.length, iv, authTag, cipherText, plaintextSize: plaintext.length });
    offset = end;
  }
  console.log(`[+] Chunked & Encrypted into ${chunks.length} chunks in ${Date.now() - t}ms.`);

  // 3. Upload to Telegram
  const uploadedChunks = [];
  for (const chunk of chunks) {
    t = Date.now();
    const formData = new FormData();
    formData.append('chat_id', CHANNEL_ID);
    formData.append('document', new Blob([chunk.cipherText], { type: 'application/octet-stream' }), `test_chunk_${chunk.index}.enc`);
    
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.ok) throw new Error(`Telegram Upload Failed: ${data.description}`);
    
    const message_id = data.result.document.file_id;
    console.log(`[+] Uploaded Chunk ${chunk.index} to Telegram in ${Date.now() - t}ms (file_id: ${message_id})`);
    uploadedChunks.push({ ...chunk, message_id });
  }

  // 4. Download from Telegram
  const downloadedChunks = [];
  for (const chunk of uploadedChunks) {
    t = Date.now();
    const getRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file_id: chunk.message_id })
    });
    const fileData = await getRes.json();
    if (!fileData.ok) throw new Error(`Telegram getFile Failed: ${fileData.description}`);
    
    const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
    const dlRes = await fetch(downloadUrl);
    const dlBytes = new Uint8Array(await dlRes.arrayBuffer());
    
    console.log(`[+] Downloaded Chunk ${chunk.index} from Telegram in ${Date.now() - t}ms. Expected Size: ${chunk.cipherText.length}, Actual Size: ${dlBytes.length}`);
    
    if (dlBytes.length !== chunk.cipherText.length) {
      console.error(`[!] CORRUPTION DETECTED: Downloaded size mismatch on Chunk ${chunk.index}!`);
    }

    // Verify exact byte match
    let mismatchOffset = -1;
    for(let i=0; i<dlBytes.length; i++) {
        if (dlBytes[i] !== chunk.cipherText[i]) {
            mismatchOffset = i;
            break;
        }
    }
    if (mismatchOffset !== -1) {
        console.error(`[!] CORRUPTION DETECTED: Bytes mismatch on Chunk ${chunk.index} at offset ${mismatchOffset}! Expected 0x${chunk.cipherText[mismatchOffset].toString(16)}, got 0x${dlBytes[mismatchOffset].toString(16)}`);
    } else {
        console.log(`[+] Chunk ${chunk.index} byte-for-byte identical to upload.`);
    }

    downloadedChunks.push({ ...chunk, dlBytes });
  }

  // 5. Decryption & Reassembly
  t = Date.now();
  let totalDecryptedSize = chunks.reduce((acc, c) => acc + c.plaintextSize, 0);
  const reassembledCompressed = new Uint8Array(totalDecryptedSize);
  let reassembleOffset = 0;

  for (const chunk of downloadedChunks) {
    try {
      const decryptedChunk = await aesGcmDecryptChunk(projectAESKey, chunk.iv, chunk.dlBytes, chunk.authTag);
      reassembledCompressed.set(decryptedChunk, reassembleOffset);
      reassembleOffset += decryptedChunk.length;
    } catch (e) {
      console.error(`[!] CORRUPTION DETECTED: Decryption failed for Chunk ${chunk.index}. AES-GCM AuthTag verification failed! Telegram altered the bytes.`);
      throw e;
    }
  }
  console.log(`[+] Decrypted & Reassembled in ${Date.now() - t}ms.`);

  // 6. Decompression
  t = Date.now();
  let decompressedBytes;
  try {
    decompressedBytes = await gzipDecompress(reassembledCompressed);
  } catch(e) {
    console.error(`[!] CORRUPTION DETECTED: GZIP Decompression failed! Stream truncated or corrupted.`, e.message);
    throw e;
  }
  console.log(`[+] Decompressed in ${Date.now() - t}ms.`);

  // 7. Verification
  const finalHash = await sha256(decompressedBytes);
  console.log(`Final Hash    : ${finalHash}`);
  
  if (origHash === finalHash) {
    console.log(`[RESULT] ${fileType}: PASS! (Took ${Date.now() - tStart}ms)`);
  } else {
    console.error(`[RESULT] ${fileType}: FAIL! Hashes do not match.`);
    let mismatchOffset = -1;
    for(let i=0; i<originalBytes.length; i++) {
        if (originalBytes[i] !== decompressedBytes[i]) {
            mismatchOffset = i;
            break;
        }
    }
    console.error(`First mismatch at offset ${mismatchOffset}. Expected 0x${originalBytes[mismatchOffset].toString(16)}, got 0x${decompressedBytes[mismatchOffset].toString(16)}`);
  }
}

async function runAllTests() {
  // 1. Text File (Highly Compressible)
  const textBytes = Buffer.from("A".repeat(1024 * 1024 * 5)); // 5MB
  await runPipelineTest("Text File (5MB)", new Uint8Array(textBytes));

  // 2. Random Binary File (Incompressible, mimics PNG/ZIP)
  const binBytes = crypto.randomBytes(1024 * 1024 * 6); // 6MB (Spans 2 chunks)
  await runPipelineTest("Random Binary (6MB)", new Uint8Array(binBytes));

  console.log("\nAll diagnostic tests completed.");
}

runAllTests().catch(console.error);
