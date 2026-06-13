// Edge Runtime compatible - no Node.js crypto or Buffer imports

const fs = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('fs') : null;
const path = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('path') : null;
const os = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('os') : null;

// --- Edge-compatible hex/bytes utilities ---
function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}
async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data as any));
}
async function aesGcmEncrypt(keyBytes: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Promise<{ cipherText: Uint8Array; authTag: Uint8Array }> {
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes as any, { name: 'AES-GCM' }, false, ['encrypt']);
  // Web Crypto AES-GCM appends 16-byte auth tag at the end of ciphertext
  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as any, tagLength: 128 }, key, plaintext as any));
  const cipherText = encrypted.slice(0, encrypted.length - 16);
  const authTag = encrypted.slice(encrypted.length - 16);
  return { cipherText, authTag };
}
async function aesGcmDecrypt(keyBytes: Uint8Array, iv: Uint8Array, cipherText: Uint8Array, authTag: Uint8Array): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes as any, { name: 'AES-GCM' }, false, ['decrypt']);
  // Web Crypto expects ciphertext+authTag concatenated
  const combined = new Uint8Array(cipherText.length + authTag.length);
  combined.set(cipherText);
  combined.set(authTag, cipherText.length);
  return new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any, tagLength: 128 }, key, combined as any));
}

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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = formatTelegramChannelId(process.env.AUTH_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID || '');

const LOCAL_STATE_DIR = (path && os)
  ? (process.env.VERCEL || process.env.NODE_ENV === 'production'
    ? path.join(os.tmpdir(), '.telebase_data')
    : path.join((typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : ''), '.telebase_data'))
  : '';
const LOCAL_STATE_FILE = (path && LOCAL_STATE_DIR) ? path.join(LOCAL_STATE_DIR, 'local_state.json') : '';

function ensureLocalStateDir() {
  if (!fs || !LOCAL_STATE_DIR) return;
  if (!fs.existsSync(LOCAL_STATE_DIR)) {
    fs.mkdirSync(LOCAL_STATE_DIR, { recursive: true });
  }
}

export function loadLocalState(): DatabaseSchema | null {
  if (!fs || !LOCAL_STATE_FILE) return null;
  ensureLocalStateDir();
  if (fs.existsSync(LOCAL_STATE_FILE)) {
    try {
      const raw = fs.readFileSync(LOCAL_STATE_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (e: any) {
      throw new TelebaseStateError('CORRUPTION_DETECTED', `Failed to read local state backup: ${e.message}`);
    }
  }
  return null;
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
export let ENCRYPTION_KEY: Uint8Array = new Uint8Array(32);

// Initialize ENCRYPTION_KEY (async, resolved before first use via getEncryptionKey())
let _encKeyPromise: Promise<Uint8Array> | null = null;
async function getEncryptionKey(): Promise<Uint8Array> {
  if (_encKeyPromise) return _encKeyPromise;
  _encKeyPromise = (async () => {
    const envKey = process.env.ENCRYPTION_KEY || '';
    let derived: Uint8Array;
    if (envKey.length === 64) {
      derived = hexToBytes(envKey);
    } else {
      // Fallback: derive deterministically from BOT_TOKEN
      const encoder = new TextEncoder();
      derived = await sha256Bytes(encoder.encode(BOT_TOKEN));
    }
    ENCRYPTION_KEY = derived;
    return derived;
  })();
  return _encKeyPromise;
}

export type TelebaseErrorType = 'STATE_NOT_FOUND' | 'DECRYPTION_FAILED' | 'TELEGRAM_PIN_MISSING' | 'KV_NOT_FOUND' | 'CORRUPTION_DETECTED' | 'INVALID_OVERWRITE';

export class TelebaseStateError extends Error {
  constructor(public code: TelebaseErrorType, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'TelebaseStateError';
    Object.setPrototypeOf(this, TelebaseStateError.prototype);
  }
}

export interface Project {
  id: string;
  owner_telegram_id?: string; // Links project to its owner user
  name: string;
  api_key: string;
  channel_id: string;
  storage_type: 'TELEGRAM' | 'SUPABASE';
  bots: string[];
  created_at: string;
}

export interface UserRecord {
  owner_telegram_id: string;
  username?: string;
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
  owner_telegram_id?: string; // Links file to its owner user
  filename: string;
  version: number;
  chunk_count: number;
  file_hash: string;
  size: number;
  created_at: string;
  chunks: FileChunk[];
}

export interface LoginRequest {
  code: string;
  owner_telegram_id?: string;
  expiresAt: number;
  isUsed: boolean;
  created_at: string;
}

export interface DatabaseSchema {
  projects: Project[];
  files: StoredFile[];
  users?: UserRecord[];
  pendingUsers?: PendingUser[];
  loginRequests?: LoginRequest[];
  schemas?: Record<string, any>;
  last_pinned_message_id?: number;
  
  // State Versioning & Verification Metadata
  version?: number;
  updatedAt?: string;
  hash?: string;
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
  // This is kept for compatibility but should be replaced with async version
  throw new Error('Use encryptStateAsync instead');
}

export async function encryptStateAsync(state: DatabaseSchema): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify(state));
  const key = await getEncryptionKey();
  const iv = randomBytes(12);
  const { cipherText, authTag } = await aesGcmEncrypt(key, iv, payload);
  const finalBuffer = new Uint8Array(iv.length + authTag.length + cipherText.length);
  finalBuffer.set(iv, 0);
  finalBuffer.set(authTag, iv.length);
  finalBuffer.set(cipherText, iv.length + authTag.length);
  return bytesToHex(finalBuffer);
}

async function readRawKV(key: string): Promise<string | null> {
  if (isCFWorkerConfigured) {
    try {
      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${key}`;
      const res = await fetch(url, { cache: 'no-store', headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY } });
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch (e) {}
  }
  if (isKVConfigured) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${key}`;
      const res = await fetch(url, { cache: 'no-store', headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` } });
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch (e) {}
  }
  return null;
}

async function writeRawKV(key: string, value: string): Promise<boolean> {
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
  if (isKVConfigured) {
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

async function uploadStateToTelegram(finalBuffer: Uint8Array, state: DatabaseSchema): Promise<void> {
  if (!BOT_TOKEN || !TELEGRAM_CHANNEL_ID) return;
  const formData = new FormData();
  formData.append('chat_id', TELEGRAM_CHANNEL_ID);
  
  const fileBlob = new Blob([finalBuffer as any], { type: 'application/octet-stream' });
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

  // Pin the new message
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

  // Clean up previous message
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

  state.last_pinned_message_id = newMessageId;
}

function triggerBackgroundTelegramBackup(finalBuffer: Uint8Array, state: DatabaseSchema) {
  if (BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    (async () => {
      try {
        console.log('[TeleStore BG] Triggering background Telegram backup to keep Telegram in-sync...');
        await uploadStateToTelegram(finalBuffer, state);
        
        if (fs && LOCAL_STATE_FILE) {
          fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
        }
        const updatedHex = await encryptStateAsync(state);
        await writeRawKV('telebase_state_current', updatedHex);
        console.log(`[TeleStore BG] Background Telegram backup completed successfully!`);
      } catch (err: any) {
        console.error('[TeleStore BG] Background Telegram backup failed:', err.message);
      }
    })();
  }
}

/**
 * Downloads the encrypted state from Telegram, decrypts and parses it.
 */
export async function getDatabaseState(forceRefresh = false): Promise<DatabaseSchema> {
  const now = Date.now();
  if (stateCache && !forceRefresh && (now - lastCacheFetchTime < CACHE_TTL_MS)) {
    return stateCache;
  }

  // 1. CLOUDFLARE WORKER + KV FAST-PATH (UNDER 20MS READS!)
  if (isCFWorkerConfigured) {
    try {
      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/telebase_state_current`;
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
          throw new TelebaseStateError('KV_NOT_FOUND', `Cloudflare Worker GET failed: ${res.statusText}`);
        }
        
        const encryptedHex = await res.text();
        const encryptedBuffer = hexToBytes(encryptedHex);

        if (encryptedBuffer.length < 28) {
          throw new TelebaseStateError('CORRUPTION_DETECTED', 'Cloudflare Worker KV state document is too small or corrupted.');
        }

        // Decrypt (AES-256-GCM structure: IV [12b] + AuthTag [16b] + CipherText)
        const iv = encryptedBuffer.slice(0, 12);
        const authTag = encryptedBuffer.slice(12, 28);
        const cipherText = encryptedBuffer.slice(28);

        let decrypted;
        try {
          const key = await getEncryptionKey();
          const decryptedBytes = await aesGcmDecrypt(key, iv, cipherText, authTag);
          decrypted = new TextDecoder().decode(decryptedBytes);
        } catch (decErr: any) {
          throw new TelebaseStateError('DECRYPTION_FAILED', `Decryption failed for Cloudflare Worker state: ${decErr.message}`);
        }

        let state: DatabaseSchema;
        try {
          state = JSON.parse(decrypted) as DatabaseSchema;
        } catch (parseErr: any) {
          throw new TelebaseStateError('CORRUPTION_DETECTED', `JSON Parse failed for Cloudflare Worker state: ${parseErr.message}`);
        }
        
        stateCache = state;
        lastCacheFetchTime = now;
        console.log(`[TeleStore] State successfully synchronized from Cloudflare Worker KV! Loaded ${state.projects.length} projects.`);
        return state;
      }
    } catch (error: any) {
      if (error instanceof TelebaseStateError) throw error;
      console.error('[TeleStore] Cloudflare Worker KV sync failed, falling back:', error.message);
    }
  }

  // 2. CLOUDFLARE KV REST FAST-PATH (UNDER 15MS READS!)
  if (isKVConfigured) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/telebase_state_current`;
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
          throw new TelebaseStateError('KV_NOT_FOUND', `Cloudflare KV GET failed: ${res.statusText}`);
        }
        
        const encryptedHex = await res.text();
        const encryptedBuffer = hexToBytes(encryptedHex);

        if (encryptedBuffer.length < 28) {
          throw new TelebaseStateError('CORRUPTION_DETECTED', 'Cloudflare KV state document is too small or corrupted.');
        }

        // Decrypt (AES-256-GCM structure: IV [12b] + AuthTag [16b] + CipherText)
        const iv = encryptedBuffer.slice(0, 12);
        const authTag = encryptedBuffer.slice(12, 28);
        const cipherText = encryptedBuffer.slice(28);

        let decrypted;
        try {
          const key = await getEncryptionKey();
          const decryptedBytes = await aesGcmDecrypt(key, iv, cipherText, authTag);
          decrypted = new TextDecoder().decode(decryptedBytes);
        } catch (decErr: any) {
          throw new TelebaseStateError('DECRYPTION_FAILED', `Decryption failed for Cloudflare KV state: ${decErr.message}`);
        }

        let state: DatabaseSchema;
        try {
          state = JSON.parse(decrypted) as DatabaseSchema;
        } catch (parseErr: any) {
          throw new TelebaseStateError('CORRUPTION_DETECTED', `JSON Parse failed for Cloudflare KV state: ${parseErr.message}`);
        }
        
        stateCache = state;
        lastCacheFetchTime = now;
        console.log(`[TeleStore] State successfully synchronized from Cloudflare KV! Loaded ${state.projects.length} projects.`);
        return state;
      }
    } catch (error: any) {
      if (error instanceof TelebaseStateError) throw error;
      console.error('[TeleStore] Cloudflare KV sync failed, falling back:', error.message);
    }
  } else {
    // 3. ALWAYS-FREE CLOUD KV FALLBACK (KVDB.IO - UNDER 40MS READS!)
    try {
      const key = await getEncryptionKey();
      const bucketId = bytesToHex(await sha256Bytes(key)).substring(0, 16);
      const url = `https://kvdb.io/${bucketId}/telebase_state_current`;
      console.log(`[TeleStore] Free KV Fallback (kvdb.io): Synchronizing from bucket ${bucketId}...`);
      const res = await fetch(url, { cache: 'no-store' });
      
      if (res.status === 404) {
        console.log('[TeleStore] Free KV (kvdb.io): State not found. Falling back to Telegram/Local.');
      } else if (!res.ok) {
        throw new Error(`Free KV GET failed: ${res.statusText}`);
      } else {
        const encryptedHex = await res.text();
        const encryptedBuffer = hexToBytes(encryptedHex);

        if (encryptedBuffer.length >= 28) {
          const iv = encryptedBuffer.slice(0, 12);
          const authTag = encryptedBuffer.slice(12, 28);
          const cipherText = encryptedBuffer.slice(28);

          let decrypted;
          try {
            const decryptedBytes = await aesGcmDecrypt(key, iv, cipherText, authTag);
            decrypted = new TextDecoder().decode(decryptedBytes);
          } catch (decErr: any) {
            throw new TelebaseStateError('DECRYPTION_FAILED', `Decryption failed for kvdb.io state: ${decErr.message}`);
          }

          let state: DatabaseSchema;
          try {
            state = JSON.parse(decrypted) as DatabaseSchema;
          } catch (parseErr: any) {
            throw new TelebaseStateError('CORRUPTION_DETECTED', `JSON Parse failed for kvdb.io state: ${parseErr.message}`);
          }

          stateCache = state;
          lastCacheFetchTime = now;
          console.log(`[TeleStore] State successfully synchronized from Free KV (kvdb.io)! Loaded ${state.projects.length} projects.`);
          return state;
        }
      }
    } catch (error: any) {
      if (error instanceof TelebaseStateError) throw error;
      console.error('[TeleStore] Free KV (kvdb.io) sync failed, falling back:', error.message);
    }
  }

  // 4. TELEGRAM BACKEND
  if (BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    try {
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
        throw new TelebaseStateError('TELEGRAM_PIN_MISSING', 'Backing Telegram channel has no pinned database document.');
      }

      const fileId = pinnedMessage.document.file_id;
      const latestPinnedMessageId = pinnedMessage.message_id;

      // --- MONOTONIC STATE CACHE CHECK ---
      const localState = loadLocalState();
      if (localState && localState.last_pinned_message_id && latestPinnedMessageId <= localState.last_pinned_message_id) {
        console.log(`[TeleStore] Local state is up-to-date (Pinned ID: ${latestPinnedMessageId}). Skipping download.`);
        localState.last_pinned_message_id = latestPinnedMessageId; // Ensure synced
        stateCache = localState;
        lastCacheFetchTime = now;
        return localState;
      }
      // ------------------------------------

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

      const downloadRes = await fetch(downloadUrl, { cache: 'no-store' });
      const encryptedArrayBuffer = await downloadRes.arrayBuffer();
      const encryptedBuffer = new Uint8Array(encryptedArrayBuffer);

      if (encryptedBuffer.length < 28) {
        throw new TelebaseStateError('CORRUPTION_DETECTED', 'Downloaded Telegram database file is too small or corrupted.');
      }

      const iv = encryptedBuffer.slice(0, 12);
      const authTag = encryptedBuffer.slice(12, 28);
      const cipherText = encryptedBuffer.slice(28);

      let decrypted;
      try {
        const key = await getEncryptionKey();
        const decryptedBytes = await aesGcmDecrypt(key, iv, cipherText, authTag);
        decrypted = new TextDecoder().decode(decryptedBytes);
      } catch (decErr: any) {
        throw new TelebaseStateError('DECRYPTION_FAILED', `Decryption failed for Telegram database file: ${decErr.message}`);
      }

      let state: DatabaseSchema;
      try {
        state = JSON.parse(decrypted) as DatabaseSchema;
      } catch (parseErr: any) {
        throw new TelebaseStateError('CORRUPTION_DETECTED', `JSON Parse failed for Telegram database file: ${parseErr.message}`);
      }
      
      state.last_pinned_message_id = pinnedMessage.message_id;
      stateCache = state;
      lastCacheFetchTime = now;
      console.log(`[TeleStore] State successfully synchronized from Telegram! Loaded ${state.projects.length} projects.`);
      return state;
    } catch (error: any) {
      if (error instanceof TelebaseStateError) throw error;
      console.warn('[TeleStore] Telegram read failed, falling back to local file state:', error.message);
      
      const state = loadLocalState();
      if (state) {
        stateCache = state;
        lastCacheFetchTime = now;
        return state;
      }
      throw new TelebaseStateError('STATE_NOT_FOUND', `Failed to retrieve database state from Telegram or Local fallback. Original error: ${error.message}`);
    }
  }

  // 5. LOCAL STATE FALLBACK ONLY (If no Telegram / Cloudflare credentials)
  console.warn('[TeleStore] No cloud storage credentials configured. Operating in local fallback.');
  const state = loadLocalState();
  if (!state) {
    throw new TelebaseStateError('STATE_NOT_FOUND', 'No local state file found. Setup is uninitialized.');
  }
  stateCache = state;
  lastCacheFetchTime = now;
  return state;
}

/**
 * Encrypts and uploads the updated state to Telegram, pinning the new index and removing the old one.
 */
export async function saveDatabaseState(state: DatabaseSchema, options?: { allowShrink?: boolean }): Promise<void> {
  // Update local memory cache immediately to guarantee consistent consecutive reads
  stateCache = state;
  lastCacheFetchTime = Date.now();

  // Load existing state to perform validation checks
  let existingState: DatabaseSchema | null = null;
  try {
    existingState = await getDatabaseState(true);
  } catch (err) {
    if (err instanceof TelebaseStateError && err.code === 'STATE_NOT_FOUND') {
      existingState = null;
    } else {
      throw new TelebaseStateError('INVALID_OVERWRITE', `Database write aborted. Retrieval of existing state failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (existingState) {
    // A. Never allow an empty schema to overwrite an existing populated state
    if (state.projects.length === 0 && existingState.projects.length > 0 && !options?.allowShrink) {
      console.warn('[TeleStore] Overwrite protection blocked: incoming state has no projects, but existing has data.');
      throw new TelebaseStateError('INVALID_OVERWRITE', 'Aborted save: Cannot overwrite populated database with an empty projects schema.');
    }

    // D. Before save, check size/entity counts
    const incomingProjects = state.projects?.length || 0;
    const existingProjects = existingState.projects?.length || 0;
    const incomingUsers = state.users?.length || 0;
    const existingUsers = existingState.users?.length || 0;
    
    if ((incomingProjects < existingProjects || incomingUsers < existingUsers) && !options?.allowShrink) {
      console.warn(`[TeleStore] Overwrite protection blocked: incoming projects: ${incomingProjects}, existing: ${existingProjects}; incoming users: ${incomingUsers}, existing: ${existingUsers}`);
      throw new TelebaseStateError('INVALID_OVERWRITE', `Aborted save: Incoming state is smaller than existing state (Projects: ${incomingProjects}/${existingProjects}, Users: ${incomingUsers}/${existingUsers}).`);
    }

    const incomingSize = JSON.stringify(state).length;
    const existingSize = JSON.stringify(existingState).length;
    if (incomingSize < existingSize && !options?.allowShrink) {
      console.warn(`[TeleStore] Overwrite protection blocked: incoming size (${incomingSize} chars) is smaller than existing size (${existingSize} chars).`);
      throw new TelebaseStateError('INVALID_OVERWRITE', 'Aborted save: Incoming state payload is smaller than existing state.');
    }

    // E. Implement State Versioning
    if (state.version !== undefined && existingState.version !== undefined && state.version <= existingState.version) {
      state.version = existingState.version + 1;
    }

    // H. Add corruption detection (Concurrent edit checks)
    if (existingState.hash && state.hash && existingState.hash !== state.hash) {
      console.warn(`[TeleStore] Concurrent modification conflict. Server: ${existingState.hash}, Client: ${state.hash}`);
      throw new TelebaseStateError('CORRUPTION_DETECTED', 'Database modified concurrently by another thread. Please reload and retry.');
    }
  }

  // Set default initial version if not set
  if (state.version === undefined) {
    state.version = 1;
  }
  state.updatedAt = new Date().toISOString();

  // Calculate cryptographic hash for the new state
  const stateToHash = { ...state };
  delete stateToHash.hash;
  const serializedStateBytes = new TextEncoder().encode(JSON.stringify(stateToHash));
  const newHashBytes = await sha256Bytes(serializedStateBytes);
  state.hash = bytesToHex(newHashBytes);

  const payload = new TextEncoder().encode(JSON.stringify(state));

  // 1. Encrypt state payload (AES-256-GCM)
  const key = await getEncryptionKey();
  const iv = randomBytes(12);
  const { cipherText, authTag } = await aesGcmEncrypt(key, iv, payload);
  const finalBuffer = new Uint8Array(iv.length + authTag.length + cipherText.length);
  finalBuffer.set(iv, 0);
  finalBuffer.set(authTag, iv.length);
  finalBuffer.set(cipherText, iv.length + authTag.length);
  const encryptedHex = bytesToHex(finalBuffer);

  // Always write to local backup file first to guarantee durability & prevent data loss!
  if (fs && LOCAL_STATE_FILE) {
    try {
      ensureLocalStateDir();
      fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
      console.log('[TeleStore] State successfully synced to local file state!');
    } catch (e: any) {
      console.error('[TeleStore] Local file state sync failed:', e.message);
    }
  }

  // Backup Rotation in Cloudflare KV
  if (isCFWorkerConfigured || isKVConfigured) {
    try {
      console.log('[TeleStore] Shifting snapshot backup rings in Cloudflare KV...');
      const backup2 = await readRawKV('telebase_state_backup_2');
      if (backup2) await writeRawKV('telebase_state_backup_3', backup2);
      
      const backup1 = await readRawKV('telebase_state_backup_1');
      if (backup1) await writeRawKV('telebase_state_backup_2', backup1);
      
      const current = await readRawKV('telebase_state_current');
      if (current) await writeRawKV('telebase_state_backup_1', current);
    } catch (rotErr: any) {
      console.warn('[TeleStore] KV Backup rotation failed (continuing state save):', rotErr.message);
    }
  }

  // -------------------------------------------------------------
  // WRITE CURRENT TO CLOUDFLARE WORKER OR KV REST API
  // -------------------------------------------------------------
  if (isCFWorkerConfigured) {
    try {
      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/telebase_state_current`;
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
      triggerBackgroundTelegramBackup(finalBuffer, state);
      return;
    } catch (error: any) {
      console.error('[TeleStore] Cloudflare Worker KV write failed, falling back to Telegram backup:', error.message);
    }
  }

  if (isKVConfigured) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/telebase_state_current`;
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
      triggerBackgroundTelegramBackup(finalBuffer, state);
      return;
    } catch (error: any) {
      console.error('[TeleStore] Cloudflare KV write failed, falling back to Telegram backup:', error.message);
    }
  } else {
    // ALWAYS-FREE CLOUD KV FALLBACK (KVDB.IO)
    try {
      const bucketId = bytesToHex(await sha256Bytes(key)).substring(0, 16);
      const url = `https://kvdb.io/${bucketId}/telebase_state_current`;
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

  // Upload to Telegram synchronously if no CF KV
  if (BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    await uploadStateToTelegram(finalBuffer, state);
  }
}

/**
 * Restores the active database state to one of the snapshot backups (1, 2, or 3).
 */
export async function restoreState(backupIndex: 1 | 2 | 3): Promise<DatabaseSchema> {
  const keyName = `telebase_state_backup_${backupIndex}`;
  console.log(`[TeleStore] Restoring database state from snapshot backup: ${keyName}...`);

  const rawHex = await readRawKV(keyName);
  if (!rawHex) {
    throw new TelebaseStateError('STATE_NOT_FOUND', `Snapshot backup state '${keyName}' not found in KV store.`);
  }

  const encryptedBuffer = hexToBytes(rawHex);
  if (encryptedBuffer.length < 28) {
    throw new TelebaseStateError('CORRUPTION_DETECTED', `Backup state '${keyName}' is corrupted or incomplete.`);
  }

  const iv = encryptedBuffer.slice(0, 12);
  const authTag = encryptedBuffer.slice(12, 28);
  const cipherText = encryptedBuffer.slice(28);

  let decrypted;
  try {
    const key = await getEncryptionKey();
    const decryptedBytes = await aesGcmDecrypt(key, iv, cipherText, authTag);
    decrypted = new TextDecoder().decode(decryptedBytes);
  } catch (decErr: any) {
    throw new TelebaseStateError('DECRYPTION_FAILED', `Decryption failed for backup '${keyName}': ${decErr.message}`);
  }

  let restoredState: DatabaseSchema;
  try {
    restoredState = JSON.parse(decrypted) as DatabaseSchema;
  } catch (parseErr: any) {
    throw new TelebaseStateError('CORRUPTION_DETECTED', `JSON Parse failed for backup '${keyName}': ${parseErr.message}`);
  }

  // Monotonically advance version for tracking restoration transaction
  const activeState = await getDatabaseState(true).catch(() => null);
  const currentVersion = activeState?.version || restoredState.version || 0;
  restoredState.version = currentVersion + 1;
  restoredState.updatedAt = new Date().toISOString();

  // Save the state (without rotating to prevent loop back)
  if (fs && LOCAL_STATE_FILE) {
    try {
      ensureLocalStateDir();
      fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(restoredState, null, 2), 'utf-8');
    } catch (e) {}
  }

  const stateToHash = { ...restoredState };
  delete stateToHash.hash;
  const serializedStateBytes = new TextEncoder().encode(JSON.stringify(stateToHash));
  const newHashBytes = await sha256Bytes(serializedStateBytes);
  restoredState.hash = bytesToHex(newHashBytes);

  const payload = new TextEncoder().encode(JSON.stringify(restoredState));
  const key = await getEncryptionKey();
  const newIv = randomBytes(12);
  const { cipherText: newCipherText, authTag: newAuthTag } = await aesGcmEncrypt(key, newIv, payload);
  const finalBuffer = new Uint8Array(newIv.length + newAuthTag.length + newCipherText.length);
  finalBuffer.set(newIv, 0);
  finalBuffer.set(newAuthTag, newIv.length);
  finalBuffer.set(newCipherText, newIv.length + newAuthTag.length);
  const newEncryptedHex = bytesToHex(finalBuffer);

  if (isCFWorkerConfigured) {
    const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/telebase_state_current`;
    await fetch(url, {
      method: 'PUT',
      headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY, 'Content-Type': 'text/plain' },
      body: newEncryptedHex
    });
  } else if (isKVConfigured) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/telebase_state_current`;
    await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' },
      body: newEncryptedHex
    });
  }

  if (BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHANNEL_ID);
    const fileBlob = new Blob([finalBuffer as any], { type: 'application/octet-stream' });
    formData.append('document', fileBlob, 'telebase_db.enc');

    const uploadRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    const uploadData = await uploadRes.json();
    if (uploadData.ok) {
      const newMessageId = uploadData.result.message_id;
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/pinChatMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, message_id: newMessageId, disable_notification: true })
      });
      if (restoredState.last_pinned_message_id) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, message_id: restoredState.last_pinned_message_id })
        }).catch(() => {});
      }
      restoredState.last_pinned_message_id = newMessageId;
    }
  }

  stateCache = restoredState;
  lastCacheFetchTime = Date.now();
  console.log(`[TeleStore] Rollback complete. Restored to version ${restoredState.version}.`);
  return restoredState;
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
export async function encryptPayload(payload: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(payload);
  const { cipherText, authTag } = await aesGcmEncrypt(key, iv, plaintext);
  const finalBuffer = new Uint8Array(iv.length + authTag.length + cipherText.length);
  finalBuffer.set(iv, 0);
  finalBuffer.set(authTag, iv.length);
  finalBuffer.set(cipherText, iv.length + authTag.length);
  return bytesToHex(finalBuffer);
}

/**
 * Decrypts arbitrary string payload using the database master key.
 */
export async function decryptPayload(encryptedHex: string): Promise<string> {
  const encryptedBuffer = hexToBytes(encryptedHex);
  if (encryptedBuffer.length < 28) {
    throw new Error('Payload is too small or corrupted.');
  }
  const iv = encryptedBuffer.slice(0, 12);
  const authTag = encryptedBuffer.slice(12, 28);
  const cipherText = encryptedBuffer.slice(28);

  const key = await getEncryptionKey();
  const decryptedBytes = await aesGcmDecrypt(key, iv, cipherText, authTag);
  return new TextDecoder().decode(decryptedBytes);
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
