// Storage Integrity Test Suite

const CHUNK_SIZE = 1 * 1024 * 1024; // 1MB for testing
const projectAESKeyBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));

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
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
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

async function runPipeline(name, originalData, compressFiles, encryptFiles) {
  console.log(`\n--- Running Test: ${name} ---`);
  const originalHash = await getSha256(originalData);
  console.log(`Original Hash: ${originalHash} (Size: ${originalData.length} bytes)`);

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

    const finalBuffer = new Uint8Array(iv.length + authTag.length + cipherText.length);
    finalBuffer.set(iv); 
    finalBuffer.set(authTag, iv.length); 
    finalBuffer.set(cipherText, iv.length + authTag.length);
    const kvHex = Buffer.from(finalBuffer).toString('hex');

    chunksData.push({ iv, authTag, cipherText, kvHex });
    offset = end;
  }
  console.log(`[Upload] Created ${chunksData.length} chunks.`);

  // --- DOWNLOAD PHASE ---
  const reconstructedChunks = [];
  
  for (let i = 0; i < chunksData.length; i++) {
    const chunk = chunksData[i];
    
    let fetchedCipherText = null;
    const kvBuf = new Uint8Array(Buffer.from(chunk.kvHex, 'hex'));
    
    if (encryptFiles) {
      if (kvBuf.length >= 28) fetchedCipherText = kvBuf.slice(28);
      else fetchedCipherText = kvBuf;
    } else {
      fetchedCipherText = kvBuf;
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
  console.log(`Reconstructed Hash: ${newHash} (Size: ${finalReconstructed.length} bytes)`);

  if (originalHash === newHash) {
    console.log(`✅ SUCCESS: Integrity Preserved!`);
  } else {
    console.error(`❌ FAILED: Corruption detected!`);
    throw new Error('Integrity Check Failed');
  }
}

async function executeAll() {
  console.log("Starting Storage Integrity Audit Tests...\n");
  const testPayload = globalThis.crypto.getRandomValues(new Uint8Array(2.5 * 1024 * 1024));
  try {
    await runPipeline("1. Compression OFF + Encryption OFF", testPayload, false, false);
    await runPipeline("2. Compression ON  + Encryption OFF", testPayload, true, false);
    await runPipeline("3. Compression OFF + Encryption ON ", testPayload, false, true);
    await runPipeline("4. Compression ON  + Encryption ON ", testPayload, true, true);
    console.log("\n🎉 ALL PIPELINE INTEGRITY TESTS PASSED!");
  } catch (err) {
    console.error("\n❌ TESTS FAILED:", err.message);
  }
}

executeAll();
