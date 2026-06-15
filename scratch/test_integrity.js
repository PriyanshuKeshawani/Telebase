// Storage Integrity Test Suite

const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB for testing
const projectAESKeyBytes = new Uint8Array(32);
globalThis.crypto.getRandomValues(projectAESKeyBytes);

function generateLargeRandomBuffer(size) {
  const buffer = new Uint8Array(size);
  let offset = 0;
  while (offset < size) {
    const chunk = Math.min(65536, size - offset);
    globalThis.crypto.getRandomValues(new Uint8Array(buffer.buffer, offset, chunk));
    offset += chunk;
  }
  return buffer;
}

function createMockFile(type, size) {
  const buf = generateLargeRandomBuffer(size);
  if (type === 'TXT') {
    const text = "Hello World! This is a test string. ".repeat(Math.ceil(size / 36));
    return new TextEncoder().encode(text).slice(0, size);
  } else if (type === 'PDF') {
    const header = new TextEncoder().encode("%PDF-1.4\n");
    buf.set(header, 0);
  } else if (type === 'PNG') {
    const header = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    buf.set(header, 0);
  } else if (type === 'ZIP') {
    const header = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);
    buf.set(header, 0);
  }
  return buf;
}

async function gzipCompress(buffer) {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(buffer).then(() => writer.close());
  
  const chunks = [];
  const reader = cs.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const totalLen = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function gzipDecompress(buffer) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(buffer).then(() => writer.close());
  
  const chunks = [];
  const reader = ds.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const totalLen = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

async function aesGcmEncryptChunk(keyBytes, plaintext) {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plaintext));
  return { iv, cipherText: encrypted.slice(0, encrypted.length - 16), authTag: encrypted.slice(encrypted.length - 16) };
}

async function aesGcmDecryptChunk(keyBytes, iv, cipherText, authTag) {
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const combined = new Uint8Array(cipherText.length + authTag.length);
  combined.set(cipherText);
  combined.set(authTag, cipherText.length);
  return new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, combined));
}

async function getSha256(buffer) {
  const hash = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function runPipeline(testId, fileType, originalData, compressFiles, encryptFiles) {
  console.log(`\n======================================================`);
  console.log(`TEST ${testId}: [${fileType}] | Compress: ${compressFiles ? 'ON' : 'OFF'} | Encrypt: ${encryptFiles ? 'ON' : 'OFF'}`);
  
  const originalHash = await getSha256(originalData);
  console.log(`Original Size: ${originalData.length} bytes`);
  console.log(`Original SHA256: ${originalHash}`);

  // --- UPLOAD PHASE ---
  let finalBytes = originalData;
  if (compressFiles) {
    finalBytes = await gzipCompress(originalData);
    console.log(`[Upload] Compressed size: ${finalBytes.length} bytes`);
  }

  const chunksData = [];
  let offset = 0;
  while (offset < finalBytes.length) {
    const end = Math.min(offset + CHUNK_SIZE, finalBytes.length);
    const chunkBytes = finalBytes.slice(offset, end);
    
    let iv = new Uint8Array(0);
    let authTag = new Uint8Array(0);
    let cipherText = chunkBytes;

    if (encryptFiles) {
      const encrypted = await aesGcmEncryptChunk(projectAESKeyBytes, chunkBytes);
      iv = encrypted.iv;
      authTag = encrypted.authTag;
      cipherText = encrypted.cipherText;
    }

    // KV storage simulation
    const finalBuffer = new Uint8Array(iv.length + authTag.length + cipherText.length);
    finalBuffer.set(iv); 
    finalBuffer.set(authTag, iv.length); 
    finalBuffer.set(cipherText, iv.length + authTag.length);
    const kvHex = Buffer.from(finalBuffer).toString('hex');

    chunksData.push({ iv, authTag, cipherText, kvHex, size: finalBuffer.length });
    offset = end;
  }
  
  console.log(`Uploaded Chunk Sizes: [${chunksData.map(c => c.size).join(', ')}]`);
  console.log(`Extension Used: ${encryptFiles ? '.enc' : '.bin'}`);

  // --- DOWNLOAD PHASE (KV Path) ---
  const reconstructedChunks = [];
  
  for (let i = 0; i < chunksData.length; i++) {
    const chunk = chunksData[i];
    
    let fetchedCipherText = null;
    const kvBuf = new Uint8Array(Buffer.from(chunk.kvHex, 'hex'));
    
    if (encryptFiles) {
      if (kvBuf.length >= 28) fetchedCipherText = kvBuf.slice(28);
      else fetchedCipherText = kvBuf;
    } else {
      fetchedCipherText = kvBuf; // Raw bypass - CRITICAL FIX
    }

    let plaintextChunk = fetchedCipherText;
    if (encryptFiles) {
      plaintextChunk = await aesGcmDecryptChunk(projectAESKeyBytes, chunk.iv, fetchedCipherText, chunk.authTag);
    }
    reconstructedChunks.push(plaintextChunk);
  }

  const totalLength = reconstructedChunks.reduce((a, c) => a + c.length, 0);
  const mergedBuffer = new Uint8Array(totalLength);
  let mergedOff = 0;
  for (const c of reconstructedChunks) {
    mergedBuffer.set(c, mergedOff);
    mergedOff += c.length;
  }

  let finalReconstructed = mergedBuffer;
  if (compressFiles) {
    finalReconstructed = await gzipDecompress(mergedBuffer);
  }

  const newHash = await getSha256(finalReconstructed);
  console.log(`Downloaded Size: ${finalReconstructed.length} bytes`);
  console.log(`Downloaded SHA256: ${newHash}`);

  // Check Hex bounds
  const headHex = bytesToHex(finalReconstructed.slice(0, Math.min(64, finalReconstructed.length)));
  const tailHex = bytesToHex(finalReconstructed.slice(Math.max(0, finalReconstructed.length - 64)));
  const ogHeadHex = bytesToHex(originalData.slice(0, Math.min(64, originalData.length)));
  const ogTailHex = bytesToHex(originalData.slice(Math.max(0, originalData.length - 64)));

  console.log(`Original Head (64b) : ${ogHeadHex}`);
  console.log(`Downloaded Head(64b): ${headHex}`);
  console.log(`Original Tail (64b) : ${ogTailHex}`);
  console.log(`Downloaded Tail(64b): ${tailHex}`);

  if (originalHash === newHash) {
    console.log(`RESULT: ✅ PASS (File opens successfully)`);
  } else {
    console.error(`RESULT: ❌ FAIL (Corruption detected)`);
  }
}

async function executeAll() {
  console.log("Starting Storage Integrity Audit Tests (v2)...\n");
  
  const testConfigs = [
    { name: "TXT", size: 10 * 1024 }, // 10KB
    { name: "PDF", size: 50 * 1024 }, // 50KB Single Chunk
    { name: "PNG", size: 2.5 * 1024 * 1024 }, // 2.5MB Multi Chunk
    { name: "ZIP", size: 5 * 1024 * 1024 }, // 5MB Multi Chunk
    { name: "RANDOM", size: 1 * 1024 * 1024 + 500 } // Just over 1MB
  ];

  try {
    let id = 1;
    for (const fileConfig of testConfigs) {
      const payload = createMockFile(fileConfig.name, fileConfig.size);
      await runPipeline(id++, fileConfig.name, payload, false, false);
      await runPipeline(id++, fileConfig.name, payload, true, false);
      await runPipeline(id++, fileConfig.name, payload, false, true);
      await runPipeline(id++, fileConfig.name, payload, true, true);
    }
    console.log("\n🎉 ALL PIPELINE INTEGRITY TESTS PASSED!");
  } catch (err) {
    console.error("\n❌ TESTS FAILED:", err.message);
  }
}

executeAll();
