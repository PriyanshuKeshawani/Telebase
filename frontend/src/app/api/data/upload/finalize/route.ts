import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState, verifyProjectApiKey, StoredFile, FileChunk, encryptPayload, saveKVValue, uploadShardToTelegram } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return NextResponse.json({ success: false, error: 'API key is required in x-api-key header' }, { status: 401 });

    const project = await verifyProjectApiKey(apiKey);
    if (!project) return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });

    const { fileUuid, filename, fileHash, size, chunks, version, is_compressed, is_encrypted } = await req.json();

    if (!fileUuid || !filename || !fileHash || typeof size !== 'number' || !Array.isArray(chunks)) {
      return NextResponse.json({ success: false, error: 'Missing or invalid fields in request body' }, { status: 400 });
    }

    console.log(`[Upload Finalize API] Finalizing "${filename}" (${chunks.length} chunks)...`);

    // Ensure chunks are properly formatted
    const fileChunks: FileChunk[] = chunks.map((c: any) => ({
      chunk_index: c.chunk_index,
      message_id: c.message_id,
      iv: c.iv,
      auth_tag: c.auth_tag
    }));

    const finalCompress = is_compressed ?? (project.storage_options?.compress_files ?? true);
    const finalEncrypt = is_encrypted ?? (project.storage_options?.encrypt_files ?? true);

    console.log(`[TEMP LOG FINALIZE API]`);
    console.log(`- received frontend flags: is_compressed=${is_compressed}, is_encrypted=${is_encrypted}`);
    console.log(`- KV values: compress_files=${project.storage_options?.compress_files}, encrypt_files=${project.storage_options?.encrypt_files}`);
    console.log(`- stored metadata values: is_compressed=${finalCompress}, is_encrypted=${finalEncrypt}`);

    // Create the final stored file record
    const newFile: StoredFile = {
      uuid: fileUuid,
      project_id: project.id,
      owner_telegram_id: project.owner_telegram_id,
      filename,
      version: version || 1,
      chunk_count: fileChunks.length,
      file_hash: fileHash,
      size,
      created_at: new Date().toISOString(),
      is_compressed: finalCompress,
      is_encrypted: finalEncrypt,
      chunks: fileChunks
    };

    // Backup metadata to KV
    try {
      const encryptedMeta = await encryptPayload(JSON.stringify(newFile));
      const ok = await saveKVValue(`file_meta_${fileUuid}`, encryptedMeta);
      if (ok) console.log(`[Upload Finalize API] File metadata backup saved.`);
      
      // PHASE 1 SHARDING: Dual-write file_<uuid>.json to KV and Telegram
      const shardFilename = `file_${fileUuid}.json`;
      const shardOk = await saveKVValue(`file_${fileUuid}`, encryptedMeta);
      if (shardOk) console.log(`[Upload Finalize API] Shard saved to KV.`);
      
      const shardMessageId = await uploadShardToTelegram(shardFilename, JSON.stringify(newFile));
      if (shardMessageId) {
        console.log(`[Upload Finalize API] Shard saved to Telegram. Message ID: ${shardMessageId}`);
      }
    } catch (e: any) {
      console.error(`[Upload Finalize API] Metadata backup error:`, e.message);
    }

    // Save to core state
    const state = await getDatabaseState(true);
    
    // Remove if there happens to be an existing one just in case
    state.files = state.files.filter(f => f.uuid !== fileUuid);
    state.files.push(newFile);
    
    await saveDatabaseState(state);
    
    console.log(`[Upload Finalize API] File "${filename}" completely finalized in database state!`);

    return NextResponse.json({
      success: true,
      file: {
        uuid: fileUuid,
        filename,
        hash: fileHash,
        chunks: fileChunks.length,
        size
      }
    });

  } catch (error: any) {
    console.error('[Upload Finalize API Error]', error.message);
    return NextResponse.json({ success: false, error: "An internal error occurred" }, { status: 500 });
  }
}
