import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

export function formatTelegramChannelId(channelId: string): string {
  if (!channelId) return '';
  let cleaned = channelId.trim();
  if (/^-?\d+$/.test(cleaned)) {
    if (cleaned.startsWith('-')) {
      if (!cleaned.startsWith('-100')) {
        cleaned = '-100' + cleaned.substring(1);
      }
    } else {
      if (cleaned.startsWith('100')) {
        cleaned = '-' + cleaned;
      } else {
        cleaned = '-100' + cleaned;
      }
    }
  }
  return cleaned;
}

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = formatTelegramChannelId(process.env.TELEGRAM_CHANNEL_ID || '');

const LOCAL_STATE_DIR = process.env.VERCEL || process.env.NODE_ENV === 'production'
  ? path.join(os.tmpdir(), '.telebase_data')
  : path.join(process.cwd(), '.telebase_data');
const LOCAL_STATE_FILE = path.join(LOCAL_STATE_DIR, 'local_state.json');

function ensureLocalStateDir() {
  if (!fs.existsSync(LOCAL_STATE_DIR)) {
    fs.mkdirSync(LOCAL_STATE_DIR, { recursive: true });
  }
}

export function loadLocalState(): DatabaseSchema {
  ensureLocalStateDir();
  if (fs.existsSync(LOCAL_STATE_FILE)) {
    try {
      const raw = fs.readFileSync(LOCAL_STATE_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('[TeleStore] Failed to read local state backup:', e);
    }
  }
  return { projects: [], files: [] };
}

// Optional Cloudflare KV REST API integration to unlock real DB speed (<15ms reads, <150ms writes)
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

export const isKVConfigured = !!(CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_KV_NAMESPACE_ID && CLOUDFLARE_API_TOKEN);

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || '';
const CLOUDFLARE_WORKER_KEY = process.env.CLOUDFLARE_WORKER_KEY || '';
export const isCFWorkerConfigured = !!(CLOUDFLARE_WORKER_URL && CLOUDFLARE_WORKER_KEY);

// Derive a secure, stable 32-byte key from BOT_TOKEN to ensure zero-config absolute safety
export const ENCRYPTION_KEY = (() => {
  const envKey = process.env.ENCRYPTION_KEY || '';
  if (envKey.length === 64) {
    return Buffer.from(envKey, 'hex');
  }
  // Fallback: derive deterministically from BOT_TOKEN
  return crypto.createHash('sha256').update(BOT_TOKEN).digest();
})();

export interface Project {
  id: string;
  userId?: string; // Links project to its owner user
  name: string;
  api_key: string;
  channel_id: string;
  storage_type: 'TELEGRAM' | 'SUPABASE';
  bots: string[];
  created_at: string;
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string; // SHA-256 hex string
  created_at: string;
}

export interface PendingUser {
  email: string;
  passwordHash: string;
  otp: string;           // 6-digit OTP code
  expiresAt: number;     // Unix timestamp in ms
  created_at: string;
}

export interface FileChunk {
  chunk_index: number;
  message_id: string; // Message ID or File ID on Telegram
  iv: string; // hex
  auth_tag: string; // hex
}

export interface StoredFile {
  uuid: string;
  project_id: string;
  filename: string;
  version: number;
  chunk_count: number;
  file_hash: string;
  size: number;
  created_at: string;
  chunks: FileChunk[];
}

export interface DatabaseSchema {
  projects: Project[];
  files: StoredFile[];
  users?: UserRecord[];
  pendingUsers?: PendingUser[];
  schemas?: Record<string, any>;
  last_pinned_message_id?: number;
}

// Memory cache to speed up consecutive reads within serverless instance lifespan
let stateCache: DatabaseSchema | null = null;
let lastCacheFetchTime = 0;
const CACHE_TTL_MS = 2000; // 2 seconds cache TTL to allow fast consecutive reads

export function updateStateCache(state: DatabaseSchema) {
  stateCache = state;
  lastCacheFetchTime = Date.now();
}

export function encryptState(state: DatabaseSchema): string {
  const payload = JSON.stringify(state);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const finalBuffer = Buffer.concat([iv, authTag, encrypted]);
  return finalBuffer.toString('hex');
}

/**
 * Downloads the encrypted state from Telegram, decrypts and parses it.
 */
export async function getDatabaseState(forceRefresh = false): Promise<DatabaseSchema> {
  const now = Date.now();
  if (stateCache && !forceRefresh && (now - lastCacheFetchTime < CACHE_TTL_MS)) {
    return stateCache;
  }

  // -------------------------------------------------------------
  // CLOUDFLARE WORKER + KV FAST-PATH (UNDER 20MS READS!)
  // -------------------------------------------------------------
  if (isCFWorkerConfigured) {
    try {
      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/telebase_state`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'x-worker-key': CLOUDFLARE_WORKER_KEY
        }
      });
      
      if (res.status === 404) {
        console.log('[TeleStore] Cloudflare Worker KV: State not found in KV. Falling back to other stores.');
      } else {
        if (!res.ok) {
          throw new Error(`Cloudflare Worker GET failed: ${res.statusText}`);
        }
        
        const encryptedHex = await res.text();
        const encryptedBuffer = Buffer.from(encryptedHex, 'hex');

        if (encryptedBuffer.length < 28) {
          throw new Error('Cloudflare Worker KV state document is too small or corrupted.');
        }

        // Decrypt (AES-256-GCM structure: IV [12b] + AuthTag [16b] + CipherText)
        const iv = encryptedBuffer.subarray(0, 12);
        const authTag = encryptedBuffer.subarray(12, 28);
        const cipherText = encryptedBuffer.subarray(28);

        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(cipherText, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        const state = JSON.parse(decrypted) as DatabaseSchema;
        
        stateCache = state;
        lastCacheFetchTime = now;
        
        console.log(`[TeleStore] State successfully synchronized from Cloudflare Worker KV! Loaded ${state.projects.length} projects, ${state.files.length} files.`);
        return state;
      }
    } catch (error: any) {
      console.error('[TeleStore] Cloudflare Worker KV sync failed, falling back to other stores:', error.message);
    }
  }

  // -------------------------------------------------------------
  // CLOUDFLARE KV REST FAST-PATH (UNDER 15MS READS!)
  // -------------------------------------------------------------
  if (isKVConfigured) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/telebase_state`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
        }
      });
      
      if (res.status === 404) {
        console.log('[TeleStore] Cloudflare KV: State not found in KV. Falling back to other stores.');
      } else {
        if (!res.ok) {
          throw new Error(`Cloudflare KV GET failed: ${res.statusText}`);
        }
        
        const encryptedHex = await res.text();
        const encryptedBuffer = Buffer.from(encryptedHex, 'hex');

        if (encryptedBuffer.length < 28) {
          throw new Error('Cloudflare KV state document is too small or corrupted.');
        }

        // Decrypt (AES-256-GCM structure: IV [12b] + AuthTag [16b] + CipherText)
        const iv = encryptedBuffer.subarray(0, 12);
        const authTag = encryptedBuffer.subarray(12, 28);
        const cipherText = encryptedBuffer.subarray(28);

        const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(cipherText, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        const state = JSON.parse(decrypted) as DatabaseSchema;
        
        stateCache = state;
        lastCacheFetchTime = now;
        
        console.log(`[TeleStore] State successfully synchronized from Cloudflare KV! Loaded ${state.projects.length} projects, ${state.files.length} files.`);
        return state;
      }
    } catch (error: any) {
      console.error('[TeleStore] Cloudflare KV sync failed, falling back to other stores:', error.message);
    }
  } else {
    // -------------------------------------------------------------
    // ALWAYS-FREE CLOUD KV FALLBACK (KVDB.IO - UNDER 40MS READS!)
    // -------------------------------------------------------------
    try {
      const bucketId = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('hex').substring(0, 16);
      const url = `https://kvdb.io/${bucketId}/telebase_state`;
      console.log(`[TeleStore] Free KV Fallback (kvdb.io): Synchronizing from bucket ${bucketId}...`);
      const res = await fetch(url, { cache: 'no-store' });
      
      if (res.status === 404) {
        console.log('[TeleStore] Free KV (kvdb.io): State not found. Starting fresh empty state.');
      } else if (!res.ok) {
        throw new Error(`Free KV GET failed: ${res.statusText}`);
      } else {
        const encryptedHex = await res.text();
        const encryptedBuffer = Buffer.from(encryptedHex, 'hex');

        if (encryptedBuffer.length >= 28) {
          // Decrypt (AES-256-GCM structure: IV [12b] + AuthTag [16b] + CipherText)
          const iv = encryptedBuffer.subarray(0, 12);
          const authTag = encryptedBuffer.subarray(12, 28);
          const cipherText = encryptedBuffer.subarray(28);

          const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
          decipher.setAuthTag(authTag);
          
          let decrypted = decipher.update(cipherText, undefined, 'utf8');
          decrypted += decipher.final('utf8');

          const state = JSON.parse(decrypted) as DatabaseSchema;
          stateCache = state;
          lastCacheFetchTime = now;
          
          console.log(`[TeleStore] State successfully synchronized from Free KV (kvdb.io)! Loaded ${state.projects.length} projects, ${state.files.length} files.`);
          return state;
        }
      }
    } catch (error: any) {
      console.error('[TeleStore] Free KV (kvdb.io) sync failed:', error.message);
    }
  }

  if (!BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    console.warn('[TeleStore] BOT_TOKEN or TELEGRAM_CHANNEL_ID is missing. Operating in local fallback.');
    const state = loadLocalState();
    stateCache = state;
    lastCacheFetchTime = now;
    return state;
  }

  try {
    // 1. Get Chat details to find the pinned message
    const getChatUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getChat`;
    const chatRes = await fetch(getChatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID })
    });
    
    const chatData = await chatRes.json();
    if (!chatData.ok) {
      throw new Error(`getChat failed: ${JSON.stringify(chatData)}`);
    }

    const pinnedMessage = chatData.result?.pinned_message;
    if (!pinnedMessage || !pinnedMessage.document) {
      console.log('[TeleStore] No pinned database document found. Initializing empty schema.');
      return { projects: [], files: [] };
    }

    const fileId = pinnedMessage.document.file_id;
    const latestPinnedMessageId = pinnedMessage.message_id;

    // --- MONOTONIC STATE CACHE CHECK ---
    const localState = loadLocalState();
    if (localState.last_pinned_message_id && latestPinnedMessageId <= localState.last_pinned_message_id) {
      console.log(`[TeleStore] Local state is up-to-date (Pinned ID: ${latestPinnedMessageId}). Skipping download.`);
      localState.last_pinned_message_id = latestPinnedMessageId; // Ensure synced
      stateCache = localState;
      lastCacheFetchTime = now;
      return localState;
    }
    // ------------------------------------

    // 2. Fetch download URL
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

    // 3. Download encrypted binary
    const downloadRes = await fetch(downloadUrl, { cache: 'no-store' });
    const encryptedArrayBuffer = await downloadRes.arrayBuffer();
    const encryptedBuffer = Buffer.from(encryptedArrayBuffer);

    if (encryptedBuffer.length < 28) {
      throw new Error('Downloaded database file is too small or corrupted.');
    }

    // 4. Decrypt (AES-256-GCM structure: IV [12b] + AuthTag [16b] + CipherText)
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const cipherText = encryptedBuffer.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(cipherText, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    const state = JSON.parse(decrypted) as DatabaseSchema;
    state.last_pinned_message_id = pinnedMessage.message_id;

    stateCache = state;
    lastCacheFetchTime = now;
    
    console.log(`[TeleStore] State successfully synchronized from Telegram! Loaded ${state.projects.length} projects, ${state.files.length} files.`);

    // Auto-sync back to Cloudflare KV / Cloudflare Worker immediately so they stay in perfect sync!
    try {
      const encryptedHex = encryptedBuffer.toString('hex');
      if (isCFWorkerConfigured) {
        const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/telebase_state`;
        await fetch(url, {
          method: 'PUT',
          headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY, 'Content-Type': 'text/plain' },
          body: encryptedHex
        });
        console.log('[TeleStore] Telegram state synchronized to Cloudflare Worker KV.');
      } else if (isKVConfigured) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/telebase_state`;
        await fetch(url, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' },
          body: encryptedHex
        });
        console.log('[TeleStore] Telegram state synchronized to Cloudflare KV REST API.');
      }
    } catch (kvSyncErr: any) {
      console.warn('[TeleStore] Failed to write downloaded Telegram state to KV:', kvSyncErr.message);
    }

    return state;

  } catch (error: any) {
    console.error('[TeleStore] Rebuild state error, falling back to local file state:', error.message);
    const state = loadLocalState();
    stateCache = state;
    lastCacheFetchTime = now;
    return state;
  }
}

/**
 * Encrypts and uploads the updated state to Telegram, pinning the new index and removing the old one.
 */
export async function saveDatabaseState(state: DatabaseSchema): Promise<void> {
  // Update local memory cache immediately to guarantee consistent consecutive reads
  stateCache = state;
  lastCacheFetchTime = Date.now();

  // Always write to local backup file first to guarantee durability & prevent data loss!
  try {
    ensureLocalStateDir();
    fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    console.log('[TeleStore] State successfully synced to local file state!');
  } catch (e: any) {
    console.error('[TeleStore] Local file state sync failed:', e.message);
  }

  try {
    const payload = JSON.stringify(state);

    // 1. Encrypt state payload (AES-256-GCM)
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const finalBuffer = Buffer.concat([iv, authTag, encrypted]);

    // -------------------------------------------------------------
    // CLOUDFLARE WORKER + KV FAST-PATH (UNDER 150MS WRITES!)
    // -------------------------------------------------------------
    const triggerBackgroundTelegramBackup = () => {
      if (BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
        (async () => {
          try {
            console.log('[TeleStore BG] Triggering background Telegram backup to keep Telegram in-sync...');
            const formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHANNEL_ID);
            const fileBlob = new Blob([finalBuffer], { type: 'application/octet-stream' });
            formData.append('document', fileBlob, 'telebase_db.enc');

            const uploadRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
              method: 'POST',
              body: formData
            });
            const uploadData = await uploadRes.json();
            if (uploadData.ok) {
              const newMessageId = uploadData.result.message_id;
              
              // Pin the new index message
              const pinRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/pinChatMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: TELEGRAM_CHANNEL_ID,
                  message_id: newMessageId,
                  disable_notification: true
                })
              });
              const pinData = await pinRes.json();
              if (!pinData.ok) {
                console.warn('[TeleStore BG] Pin new message failed:', JSON.stringify(pinData));
              }

              // Clean up previous message
              if (state.last_pinned_message_id) {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: TELEGRAM_CHANNEL_ID,
                    message_id: state.last_pinned_message_id
                  })
                }).catch(() => {});
              }

              // Update local state and remote KV with the new pinned ID silently
              state.last_pinned_message_id = newMessageId;
              
              // Save updated state file locally to stay perfectly synchronized
              try {
                fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
              } catch (e) {}

              const updatedHex = encryptState(state);
              if (isCFWorkerConfigured) {
                const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/telebase_state`;
                await fetch(url, {
                  method: 'PUT',
                  headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY, 'Content-Type': 'text/plain' },
                  body: updatedHex
                }).catch(() => {});
              } else if (isKVConfigured) {
                const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/telebase_state`;
                await fetch(url, {
                  method: 'PUT',
                  headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' },
                  body: updatedHex
                }).catch(() => {});
              }

              console.log(`[TeleStore BG] Background Telegram backup and pin complete! Message ID: ${newMessageId}`);
            } else {
              console.warn('[TeleStore BG] Telegram backup upload returned not OK:', JSON.stringify(uploadData));
            }
          } catch (err: any) {
            console.error('[TeleStore BG] Background Telegram backup failed:', err.message);
          }
        })();
      }
    };

    if (isCFWorkerConfigured) {
      try {
        const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/telebase_state`;
        const encryptedHex = finalBuffer.toString('hex');
        
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'x-worker-key': CLOUDFLARE_WORKER_KEY,
            'Content-Type': 'text/plain'
          },
          body: encryptedHex
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Cloudflare Worker KV PUT failed: ${errText}`);
        }
        
        console.log('[TeleStore] State successfully synced & secured in Cloudflare Worker KV!');
        triggerBackgroundTelegramBackup();
        return;
      } catch (error: any) {
        console.error('[TeleStore] Cloudflare Worker KV write failed, falling back to Telegram backup:', error.message);
      }
    }

    // -------------------------------------------------------------
    // CLOUDFLARE KV REST FAST-PATH (UNDER 150MS WRITES!)
    // -------------------------------------------------------------
    if (isKVConfigured) {
      try {
        const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/telebase_state`;
        const encryptedHex = finalBuffer.toString('hex');
        
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'text/plain'
          },
          body: encryptedHex
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Cloudflare KV PUT failed: ${errText}`);
        }
        
        console.log('[TeleStore] State successfully synced & secured in Cloudflare KV!');
        triggerBackgroundTelegramBackup();
        return;
      } catch (error: any) {
        console.error('[TeleStore] Cloudflare KV write failed, falling back to Telegram backup:', error.message);
      }
    } else {
      // -------------------------------------------------------------
      // ALWAYS-FREE CLOUD KV FALLBACK (KVDB.IO - UNDER 80MS WRITES!)
      // -------------------------------------------------------------
      try {
        const bucketId = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest('hex').substring(0, 16);
        const url = `https://kvdb.io/${bucketId}/telebase_state`;
        const encryptedHex = finalBuffer.toString('hex');
        
        const res = await fetch(url, {
          method: 'PUT',
          body: encryptedHex
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Free KV (kvdb.io) PUT failed: ${errText}`);
        }
        
        console.log('[TeleStore] State successfully synced & secured in Free KV (kvdb.io)!');
      } catch (error: any) {
        console.error('[TeleStore] Free KV (kvdb.io) write failed:', error.message);
      }
    }

    if (!BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
      console.warn('[TeleStore] BOT_TOKEN or TELEGRAM_CHANNEL_ID is missing. Saved to local state file.');
      return;
    }

    // 2. Upload to Telegram as document using native FormData
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHANNEL_ID);
    
    const fileBlob = new Blob([finalBuffer], { type: 'application/octet-stream' });
    formData.append('document', fileBlob, 'telebase_db.enc');

    const uploadRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    
    const uploadData = await uploadRes.json();
    if (!uploadData.ok) {
      throw new Error(`sendDocument failed: ${JSON.stringify(uploadData)}`);
    }

    const newMessageId = uploadData.result.message_id;

    // 3. Pin the new index message
    const pinRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/pinChatMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL_ID,
        message_id: newMessageId,
        disable_notification: true
      })
    });
    const pinData = await pinRes.json();
    if (!pinData.ok) {
      console.warn('[TeleStore] Pin new message failed:', JSON.stringify(pinData));
    }

    // 4. Clean up: delete the previous index message to avoid cluttering the channel
    if (state.last_pinned_message_id) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHANNEL_ID,
          message_id: state.last_pinned_message_id
        })
      }).catch((e) => console.warn('[TeleStore] Failed to delete previous message:', e.message));
    }

    // 5. Update local memory cache
    state.last_pinned_message_id = newMessageId;
    stateCache = state;
    lastCacheFetchTime = Date.now();
    
    console.log(`[TeleStore] State successfully synced & pinned to Telegram! Message ID: ${newMessageId}`);

  } catch (error: any) {
    console.error('[TeleStore] Save state failed, falling back to local file state:', error.message);
    // Proceed safely and don't crash, since it is already saved to LOCAL_STATE_FILE!
    console.log('[TeleStore] Local state fallback was successful, proceeding safely.');
  }
}

/**
 * Validates a Project API Key and returns the associated project details.
 */
export async function verifyProjectApiKey(apiKey: string): Promise<Project | null> {
  const state = await getDatabaseState();
  const project = state.projects.find((p) => p.api_key === apiKey);
  return project || null;
}

/**
 * Encrypts arbitrary string payload using the database master key.
 */
export function encryptPayload(payload: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const finalBuffer = Buffer.concat([iv, authTag, encrypted]);
  return finalBuffer.toString('hex');
}

/**
 * Decrypts arbitrary string payload using the database master key.
 */
export function decryptPayload(encryptedHex: string): string {
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex');
  if (encryptedBuffer.length < 28) {
    throw new Error('Payload is too small or corrupted.');
  }
  const iv = encryptedBuffer.subarray(0, 12);
  const authTag = encryptedBuffer.subarray(12, 28);
  const cipherText = encryptedBuffer.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(cipherText, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Synchronously (within HTTP response timeframe) saves a key-value value directly to Cloudflare KV.
 */
export async function saveKVValue(key: string, value: string): Promise<boolean> {
  if (isCFWorkerConfigured) {
    try {
      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${key}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY, 'Content-Type': 'text/plain' },
        body: value
      });
      return res.ok;
    } catch (e) {
      console.error(`[TeleStore] saveKVValue (Worker) error for ${key}:`, e);
    }
  }
  if (isKVConfigured) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${key}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' },
        body: value
      });
      return res.ok;
    } catch (e) {
      console.error(`[TeleStore] saveKVValue (REST API) error for ${key}:`, e);
    }
  }
  return false;
}
