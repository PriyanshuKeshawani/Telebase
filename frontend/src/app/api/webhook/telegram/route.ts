import { NextRequest, NextResponse } from 'next/server';
import { getKVBinding, isKVConfigured, isCFWorkerConfigured, ENCRYPTION_KEY, formatTelegramChannelId } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || process.env['BOT_TOKEN'] || '';
const TELEGRAM_CHANNEL_ID = formatTelegramChannelId(process.env['AUTH_CHANNEL_ID'] || process.env['TELEGRAM_CHANNEL_ID'] || '');
const CLOUDFLARE_WORKER_URL = process.env['CLOUDFLARE_WORKER_URL'] || '';
const CLOUDFLARE_WORKER_KEY = process.env['CLOUDFLARE_WORKER_KEY'] || '';
const CLOUDFLARE_ACCOUNT_ID = process.env['CLOUDFLARE_ACCOUNT_ID'] || '';
const CLOUDFLARE_KV_NAMESPACE_ID = process.env['CLOUDFLARE_KV_NAMESPACE_ID'] || '';
const CLOUDFLARE_API_TOKEN = process.env['CLOUDFLARE_API_TOKEN'] || '';

async function writeRawKV(key: string, value: string): Promise<boolean> {
  const kvBinding = getKVBinding();
  if (kvBinding && typeof kvBinding.put === 'function') {
    try {
      await kvBinding.put(key, value);
      return true;
    } catch (e) {}
  }
  if (isCFWorkerConfigured) {
    try {
      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${key}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY, 'Content-Type': 'text/plain' },
        body: value
      });
      return res.ok;
    } catch (e) {}
  }
  if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_KV_NAMESPACE_ID && CLOUDFLARE_API_TOKEN) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${key}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' },
        body: value
      });
      return res.ok;
    } catch (e) {}
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    
    // Optional basic security: require token to match BOT_TOKEN
    if (token && token !== BOT_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    console.log('[Webhook] Received Telegram update:', payload.update_id);

    // We only care about edits to the channel post
    const post = payload.edited_channel_post || payload.channel_post;
    
    if (!post || !post.chat) {
      return NextResponse.json({ success: true, ignored: 'not a channel post' });
    }

    const chatId = post.chat.id.toString();
    if (chatId !== TELEGRAM_CHANNEL_ID) {
      return NextResponse.json({ success: true, ignored: 'wrong channel' });
    }

    let encryptedHex = '';

    if (post.text) {
      encryptedHex = post.text;
    } else if (post.document && post.document.file_name === 'telebase_db.json') {
      const fileId = post.document.file_id;
      const getFileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId })
      });
      const fileData = await getFileRes.json();
      if (!fileData.ok) {
        throw new Error(`getFile failed: ${JSON.stringify(fileData)}`);
      }

      const filePath = fileData.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

      const downloadRes = await fetch(downloadUrl);
      const arrayBuffer = await downloadRes.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      encryptedHex = new TextDecoder().decode(buffer);
    } else {
      return NextResponse.json({ success: true, ignored: 'no db content found' });
    }

    // Write to KV
    if (encryptedHex && encryptedHex.trim().length > 0) {
      const ok = await writeRawKV('telebase_state_current', encryptedHex);
      if (ok) {
        console.log(`[Webhook] Successfully synced DB update (msg: ${post.message_id}) to KV!`);
        
        // --- BACKGROUND TABLE BACKUP (ZERO-LATENCY FOR USER) ---
        // The edge runtime will try to execute this after responding, if not killed immediately
        // For Next.js on Cloudflare/Vercel, we can just fire-and-forget
        (async () => {
          try {
            const { decryptPayload, encryptStateAsync, getDatabaseState, saveDatabaseState } = await import('@/lib/telegramDatabase');
            const stateJson = await decryptPayload(encryptedHex);
            const state = JSON.parse(stateJson);
            
            const pendingTables = state.files.filter((f: any) => 
              f.filename.startsWith('table_') && 
              f.chunks[0]?.message_id === 'pending_telegram_backup'
            );

            if (pendingTables.length > 0) {
              console.log(`[Webhook] Found ${pendingTables.length} tables pending Telegram backup.`);
              for (const tableFile of pendingTables) {
                // Fetch table data from KV
                const tableKey = `table_${tableFile.project_id}_${tableFile.filename.replace('table_' + tableFile.project_id + '_', '').replace('.json', '')}`;
                let tableHex = '';
                if (CLOUDFLARE_WORKER_URL && CLOUDFLARE_WORKER_KEY) {
                  const res = await fetch(`${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${tableKey}`, { headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY } });
                  if (res.ok) tableHex = await res.text();
                } else if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_KV_NAMESPACE_ID && CLOUDFLARE_API_TOKEN) {
                  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${tableKey}`, { headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` } });
                  if (res.ok) tableHex = await res.text();
                }

                if (tableHex) {
                  // Upload to Telegram
                  const formData = new FormData();
                  formData.append('chat_id', TELEGRAM_CHANNEL_ID);
                  
                  // hex to bytes
                  const hexChars = tableHex.length;
                  const encryptedBytes = new Uint8Array(hexChars / 2);
                  for (let i = 0; i < hexChars; i += 2) {
                    encryptedBytes[i / 2] = parseInt(tableHex.slice(i, i + 2), 16);
                  }

                  const chunkBlob = new Blob([encryptedBytes as any], { type: 'application/octet-stream' });
                  formData.append('document', chunkBlob, `${tableFile.uuid}_table.enc`);

                  const uploadRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
                    method: 'POST',
                    body: formData
                  });
                  const uploadData = await uploadRes.json();
                  
                  if (uploadData.ok) {
                    const fileId = uploadData.result.document.file_id;
                    tableFile.chunks[0].message_id = fileId;
                    console.log(`[Webhook] Successfully backed up ${tableFile.filename} to Telegram.`);
                  }
                }
              }

              // Save the updated state with the new message_ids back to KV and Telegram
              const updatedHex = await encryptStateAsync(state);
              await writeRawKV('telebase_state_current', updatedHex);
              
              const finalBuffer = new TextEncoder().encode(updatedHex);
              const formData = new FormData();
              formData.append('chat_id', TELEGRAM_CHANNEL_ID);
              if (state.last_pinned_message_id) {
                formData.append('message_id', state.last_pinned_message_id.toString());
                const media = { type: 'document', media: 'attach://document' };
                formData.append('media', JSON.stringify(media));
                const fileBlob = new Blob([finalBuffer as any], { type: 'application/octet-stream' });
                formData.append('document', fileBlob, 'telebase_db.json');
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageMedia`, { method: 'POST', body: formData });
              }
            }
          } catch (e: any) {
            console.error('[Webhook] Background table backup failed:', e.message);
          }
        })();
      } else {
        console.warn(`[Webhook] KV write failed.`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Webhook Error]', err.message);
    return NextResponse.json({ success: false, error: "An internal error occurred" }, { status: 500 });
  }
}
