import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState, StoredFile } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

function hexToBytes(hex: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(hex, 'hex'));
  }
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}
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

export async function POST(req: NextRequest) {
  try {
    const { startId, endId } = await req.json().catch(() => ({}));
    
    // Force refresh database state
    const state = await getDatabaseState(true);
    
    const botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
    const channelId = process.env.TELEGRAM_CHANNEL_ID || process.env.AUTH_CHANNEL_ID || '';
    
    if (!botToken || !channelId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Telegram Bot Token or Channel ID is not configured.' 
      }, { status: 400 });
    }

    const pinnedId = state.last_pinned_message_id || 1;
    const scanStart = startId ? Number(startId) : Math.max(1, pinnedId - 200);
    const scanEnd = endId ? Number(endId) : pinnedId + 50;

    console.log(`[Telegram Recovery] Scanning channel message range: ${scanStart} to ${scanEnd}`);
    
    const recoveredFiles: StoredFile[] = [];
    const batchSize = 10;
    
    for (let i = scanStart; i <= scanEnd; i += batchSize) {
      const currentBatchEnd = Math.min(scanEnd, i + batchSize - 1);
      const batchPromises = [];
      
      for (let msgId = i; msgId <= currentBatchEnd; msgId++) {
        batchPromises.push((async (id) => {
          try {
            // 1. Silent forward message to the channel itself
            const forwardRes = await fetch(`https://api.telegram.org/bot${botToken}/forwardMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: channelId,
                from_chat_id: channelId,
                message_id: id,
                disable_notification: true
              })
            });
            const forwardData = await forwardRes.json();
            if (!forwardData.ok) return;

            const forwardedMsgId = forwardData.result.message_id;
            const doc = forwardData.result.document;

            // 2. Immediately delete the forwarded message to keep the channel clean
            await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: channelId,
                message_id: forwardedMsgId
              })
            }).catch(() => {});

            // 3. Process the document if it matches database formats
            if (doc && doc.file_name && (doc.file_name.endsWith('_table.enc') || doc.file_name.endsWith('_chunk_0.enc'))) {
              console.log(`[Telegram Recovery] Identified database backup: ${doc.file_name} at message ID ${id}`);
              
              const fileUuid = doc.file_name.split('_')[0];
              const fileId = doc.file_id;
              
              const getFileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_id: fileId })
              });
              const fileData = await getFileRes.json();
              if (!fileData.ok) return;

              const filePath = fileData.result.file_path;
              const downloadRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
              const encryptedBuffer = new Uint8Array(await downloadRes.arrayBuffer());

              if (encryptedBuffer.length >= 28) {
                const iv = encryptedBuffer.slice(0, 12);
                const authTag = encryptedBuffer.slice(12, 28);
                const cipherText = encryptedBuffer.slice(28);

                for (const project of state.projects) {
                  try {
                    const keyData = new TextEncoder().encode(project.api_key);
                    const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', keyData as any);
                    const projectAESKey = new Uint8Array(hashBuf);
                    const cryptoKey = await globalThis.crypto.subtle.importKey('raw', projectAESKey as any, { name: 'AES-GCM' }, false, ['decrypt']);
                    
                    const combined = new Uint8Array(authTag.length + cipherText.length);
                    combined.set(authTag);
                    combined.set(cipherText, authTag.length);

                    const decryptedBytes = new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any }, cryptoKey, combined as any));

                    if (decryptedBytes[0] === 0x1f && decryptedBytes[1] === 0x8b) {
                      // Successfully decrypted database payload!
                      const stream = new Response(decryptedBytes as any).body?.pipeThrough(new globalThis.DecompressionStream('gzip') as any);
                      const decompressedBuffer = await new Response(stream as any).arrayBuffer();
                      const rawJson = new TextDecoder().decode(decompressedBuffer);
                      
                      // Match to a project schema to figure out table name
                      const projectSchemas = state.schemas || {};
                      let matchedTableName = '';
                      
                      // Look for project schemas matching this project
                      const tableNames = Object.keys(projectSchemas).filter(name => {
                        const filename = `table_${project.id}_${name}.json`;
                        return !state.files.some(f => f.project_id === project.id && f.filename === filename);
                      });
                      
                      if (tableNames.length > 0) {
                        matchedTableName = tableNames[0]; // Fallback match
                      } else {
                        matchedTableName = 'recovered_table';
                      }

                      const filename = `table_${project.id}_${matchedTableName}.json`;
                      const fileHashBytes = await globalThis.crypto.subtle.digest('SHA-256', cipherText as any);
                      
                      const newTableFile: StoredFile = {
                        uuid: fileUuid,
                        project_id: project.id,
                        filename,
                        version: 1,
                        chunk_count: 1,
                        file_hash: bytesToHex(new Uint8Array(fileHashBytes)),
                        size: rawJson.length,
                        created_at: new Date().toISOString(),
                        chunks: [{
                          chunk_index: 0,
                          message_id: fileId,
                          iv: bytesToHex(iv),
                          auth_tag: bytesToHex(authTag)
                        }]
                      };

                      state.files = state.files.filter(f => !(f.project_id === project.id && f.filename === filename));
                      state.files.push(newTableFile);
                      recoveredFiles.push(newTableFile);
                      console.log(`[Telegram Recovery] Recovered database table "${matchedTableName}" from message ID ${id}`);
                      break;
                    }
                  } catch (e) {}
                }
              }
            }
          } catch (e) {}
        })(msgId));
      }
      
      await Promise.all(batchPromises);
    }

    if (recoveredFiles.length > 0) {
      await saveDatabaseState(state);
    }

    return NextResponse.json({
      success: true,
      message: `Telegram recovery scan completed! Restored ${recoveredFiles.length} database tables.`,
      recovered: recoveredFiles.map(f => ({ name: f.filename, uuid: f.uuid }))
    });

  } catch (error: any) {
    console.error('[Telegram Recovery Error]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
