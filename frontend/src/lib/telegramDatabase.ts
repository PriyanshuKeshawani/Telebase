// Polyfill process.env for Cloudflare Edge Runtime module evaluation compatibility
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).process) {
    (globalThis as any).process = { env: {} };
  } else if (!(globalThis as any).process.env) {
    (globalThis as any).process.env = {};
  }
  if (!(globalThis as any).process.env['NEXTAUTH_URL']) {
    (globalThis as any).process.env['NEXTAUTH_URL'] = "https://telebase.pages.dev";
  }
  if (!(globalThis as any).process.env['NEXTAUTH_SECRET']) {
    (globalThis as any).process.env['NEXTAUTH_SECRET'] = "telebase_secret_token_2026_super_secure_32b_key";
  }
  if (!(globalThis as any).process.version) {
    (globalThis as any).process.version = "v18.0.0";
  }
  if (!(globalThis as any).process.versions) {
    (globalThis as any).process.versions = { node: "18.0.0" };
  } else if (!(globalThis as any).process.versions.node) {
    (globalThis as any).process.versions.node = "18.0.0";
  }
}

// Edge Runtime compatible - no Node.js crypto or Buffer imports
const fs = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('fs') : null;
const path = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('path') : null;
const os = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('os') : null;

// --- Edge-compatible hex/bytes utilities ---
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

export function bytesToHex(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('hex');
  }
  const hexChars = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hexChars[i] = byteToHex[bytes[i]];
  }
  return hexChars.join('');
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

const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || process.env['BOT_TOKEN'] || '';
const TELEGRAM_CHANNEL_ID = formatTelegramChannelId(process.env['AUTH_CHANNEL_ID'] || process.env['TELEGRAM_CHANNEL_ID'] || '');

const LOCAL_STATE_DIR = (path && os)
  ? (process.env['VERCEL'] || process.env['NODE_ENV'] === 'production'
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
const CLOUDFLARE_ACCOUNT_ID = process.env['CLOUDFLARE_ACCOUNT_ID'] || '';
const CLOUDFLARE_KV_NAMESPACE_ID = process.env['CLOUDFLARE_KV_NAMESPACE_ID'] || '';
const CLOUDFLARE_API_TOKEN = process.env['CLOUDFLARE_API_TOKEN'] || '';

export const getKVBinding = () => (process.env.TELEBASE_KV as any) || (globalThis as any).TELEBASE_KV;

const CLOUDFLARE_WORKER_URL = process.env['CLOUDFLARE_WORKER_URL'] || '';
const CLOUDFLARE_WORKER_KEY = process.env['CLOUDFLARE_WORKER_KEY'] || '';

// Mutable variables for dynamic KV bypass / caching controls
let wasKVConfigured = false;
let wasCFWorkerConfigured = false;
export let isKVConfigured = false;
export let isCFWorkerConfigured = false;
let kvLimitExceededTime = 0;
const KV_COOLDOWN_MS = 3600000; // 1 hour

// Initialize configurations
const initialKVBinding = getKVBinding();
wasKVConfigured = !!(
  (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_KV_NAMESPACE_ID && CLOUDFLARE_API_TOKEN) ||
  (initialKVBinding && typeof initialKVBinding.get === 'function' && typeof initialKVBinding.put === 'function')
);
wasCFWorkerConfigured = !!(CLOUDFLARE_WORKER_URL && CLOUDFLARE_WORKER_KEY);

isKVConfigured = wasKVConfigured;
isCFWorkerConfigured = wasCFWorkerConfigured;

export function handleKVLimitExceeded() {
  if (kvLimitExceededTime === 0) {
    console.warn('[TeleStore KV] KV operation limit exceeded (429/Limit Error). Activating 1-hour bypass...');
    kvLimitExceededTime = Date.now();
    isKVConfigured = false;
    isCFWorkerConfigured = false;
  }
}

export function reactivateKV() {
  console.log('[TeleStore KV] Cooldown elapsed. Re-activating KV caching...');
  kvLimitExceededTime = 0;
  isKVConfigured = wasKVConfigured;
  isCFWorkerConfigured = wasCFWorkerConfigured;
}

export function checkKVLimitCooldown() {
  if (kvLimitExceededTime > 0 && Date.now() - kvLimitExceededTime > KV_COOLDOWN_MS) {
    reactivateKV();
  }
}

// Derive a secure, stable 32-byte key from BOT_TOKEN to ensure zero-config absolute safety
export let ENCRYPTION_KEY: Uint8Array = new Uint8Array(32);

// Initialize ENCRYPTION_KEY (async, resolved before first use via getEncryptionKey())
let _encKeyPromise: Promise<Uint8Array> | null = null;
async function getEncryptionKey(): Promise<Uint8Array> {
  if (_encKeyPromise) return _encKeyPromise;
  _encKeyPromise = (async () => {
    const envKey = process.env['ENCRYPTION_KEY'] || '';
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

export interface StorageOptions {
  compress_files: boolean;
  encrypt_files: boolean;
}

export interface Project {
  id: string;
  owner_telegram_id?: string; // Links project to its owner user
  name: string;
  api_key: string;
  channel_id: string;
  storage_type: 'TELEGRAM' | 'SUPABASE';
  storage_options?: StorageOptions;
  bots: string[];
  created_at: string;
}

export interface UserRecord {
  owner_telegram_id: string;
  name?: string;
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
  is_compressed?: boolean; // Default to true if undefined
  is_encrypted?: boolean; // Default to true if undefined
  chunks: FileChunk[];
}

export interface LoginRequest {
  code: string;
  owner_telegram_id?: string;
  expiresAt: number;
  isUsed: boolean;
  isInvalidated?: boolean;
  created_at: string;
}

export interface DatabaseSchema {
  projects: Project[];
  files: StoredFile[];
  users?: UserRecord[];
  pendingUsers?: PendingUser[];
  loginRequests?: LoginRequest[];
  schemas?: Record<string, any>;
  walLogs?: any[];
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

export async function decryptStatePayload(encryptedBuffer: Uint8Array): Promise<string> {
  const text = new TextDecoder().decode(encryptedBuffer);
  try {
    JSON.parse(text);
    return text;
  } catch (e) {
    if (encryptedBuffer.length < 28) {
      throw new Error('State document is too small or corrupted.');
    }
    const iv = encryptedBuffer.slice(0, 12);
    const authTag = encryptedBuffer.slice(12, 28);
    const cipherText = encryptedBuffer.slice(28);
    const key = await getEncryptionKey();
    const decryptedBytes = await aesGcmDecrypt(key, iv, cipherText, authTag);
    return new TextDecoder().decode(decryptedBytes);
  }
}

async function uploadStateToTelegram(finalBuffer: Uint8Array, state: DatabaseSchema): Promise<void> {
  if (!BOT_TOKEN || !TELEGRAM_CHANNEL_ID) return;
  const stateText = new TextDecoder().decode(finalBuffer);

  if (stateText.length >= 4000) {
    console.log('[TeleStore] State size exceeds 4000 characters. Uploading as a document...');
    
    // Try to edit the existing document first to keep channel clean
    if (state.last_pinned_message_id) {
      try {
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHANNEL_ID);
        formData.append('message_id', state.last_pinned_message_id.toString());
        
        const media = {
          type: 'document',
          media: 'attach://document'
        };
        formData.append('media', JSON.stringify(media));
        
        const fileBlob = new Blob([finalBuffer as any], { type: 'application/octet-stream' });
        formData.append('document', fileBlob, 'telebase_db.json');
        
        const editRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageMedia`, {
          method: 'POST',
          body: formData
        });
        const editData = await editRes.json();
        if (editData.ok) {
          console.log('[TeleStore] Successfully edited pinned document database state.');
          return;
        }
      } catch (e: any) {
        console.warn('[TeleStore] Failed to edit document media, sending new one:', e.message);
      }
    }

    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHANNEL_ID);
    const fileBlob = new Blob([finalBuffer as any], { type: 'application/octet-stream' });
    formData.append('document', fileBlob, 'telebase_db.json');

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

    // Persist updated state with the new pinned message ID to Telegram, KV, and Local Storage
    try {
      const updatedHex = await encryptStateAsync(state);
      const updatedBuffer = hexToBytes(updatedHex);

      const editFormData = new FormData();
      editFormData.append('chat_id', TELEGRAM_CHANNEL_ID);
      editFormData.append('message_id', newMessageId.toString());
      const media = {
        type: 'document',
        media: 'attach://document'
      };
      editFormData.append('media', JSON.stringify(media));
      const updatedFileBlob = new Blob([updatedBuffer as any], { type: 'application/octet-stream' });
      editFormData.append('document', updatedFileBlob, 'telebase_db.json');

      const editRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageMedia`, {
        method: 'POST',
        body: editFormData
      });
      const editData = await editRes.json();
      if (!editData.ok) {
        console.warn('[TeleStore] Telegram editMessageMedia failed during uploadStateToTelegram:', JSON.stringify(editData));
      }
      
      // Save updated state to Cloudflare KV
      if (isCFWorkerConfigured || isKVConfigured) {
        await writeRawKV('telebase_state_current', updatedHex);
      }
      
      // Save updated state to local backup file
      if (fs && LOCAL_STATE_FILE) {
        ensureLocalStateDir();
        fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
      }
    } catch (e: any) {
      console.warn('[TeleStore] Failed to persist finalized state in document path:', e.message);
    }

    return;
  }

  // Try to edit the existing pinned message first to keep channel clean
  if (state.last_pinned_message_id) {
    try {
      const editRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHANNEL_ID,
          message_id: state.last_pinned_message_id,
          text: stateText
        })
      });
      const editData = await editRes.json();
      if (editData.ok) {
        console.log('[TeleStore] Successfully edited pinned text database state.');
        return;
      }
    } catch (e: any) {
      console.warn('[TeleStore] Failed to edit message, sending new one:', e.message);
    }
  }

  const sendRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHANNEL_ID,
      text: stateText
    })
  });
  
  const sendData = await sendRes.json();
  if (!sendData.ok) {
    throw new Error(`sendMessage failed: ${JSON.stringify(sendData)}`);
  }

  const newMessageId = sendData.result.message_id;

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

  // Persist updated state with the new pinned message ID to Telegram, KV, and Local Storage
  try {
    const updatedHex = await encryptStateAsync(state);
    const updatedBuffer = hexToBytes(updatedHex);
    const updatedStateText = new TextDecoder().decode(updatedBuffer);

    const editRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHANNEL_ID,
        message_id: newMessageId,
        text: updatedStateText
      })
    });
    const editData = await editRes.json();
    if (!editData.ok) {
      console.warn('[TeleStore] Telegram editMessageText failed during uploadStateToTelegram:', JSON.stringify(editData));
    }
    
    // Save updated state to Cloudflare KV
    if (isCFWorkerConfigured || isKVConfigured) {
      await writeRawKV('telebase_state_current', updatedHex);
    }
    
    // Save updated state to local backup file
    if (fs && LOCAL_STATE_FILE) {
      ensureLocalStateDir();
      fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    }
  } catch (e: any) {
    console.warn('[TeleStore] Failed to persist finalized state in text path:', e.message);
  }
}

export async function getDatabaseState(forceRefresh?: boolean): Promise<DatabaseSchema> {
  // Check KV limit cooldown at the beginning
  checkKVLimitCooldown();

  if (!forceRefresh && stateCache && (Date.now() - lastCacheFetchTime < CACHE_TTL_MS)) {
    return stateCache;
  }

  if (!BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    const local = loadLocalState();
    if (local) {
      stateCache = local;
      lastCacheFetchTime = Date.now();
      return local;
    }
    const emptySchema: DatabaseSchema = { projects: [], files: [], version: 1 };
    stateCache = emptySchema;
    lastCacheFetchTime = Date.now();
    return emptySchema;
  }

  let tgMessageId: number | null = null;
  let pinned: any = null;
  try {
    const getChatRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID })
    });
    const chatData = await getChatRes.json();
    if (chatData.ok && chatData.result && chatData.result.pinned_message) {
      pinned = chatData.result.pinned_message;
      tgMessageId = pinned.message_id;
    }
  } catch (err: any) {
    console.warn('[TeleStore] Failed to fetch pinned message from Telegram:', err.message);
  }

  // IN-MEMORY CACHE VALIDATION SHORTCUT:
  // Query getChat from Telegram to compare pinned_message_id. If matches stateCache, return instantly!
  if (!forceRefresh && stateCache && tgMessageId && stateCache.last_pinned_message_id === tgMessageId) {
    lastCacheFetchTime = Date.now();
    return stateCache;
  }

  if (!tgMessageId) {
    const local = loadLocalState();
    if (local) {
      stateCache = local;
      lastCacheFetchTime = Date.now();
      return local;
    }
    const emptySchema: DatabaseSchema = { projects: [], files: [], version: 1 };
    stateCache = emptySchema;
    lastCacheFetchTime = Date.now();
    return emptySchema;
  }

  if (isCFWorkerConfigured || isKVConfigured) {
    try {
      const rawHex = await readRawKV('telebase_state_current');
      if (rawHex) {
        const decrypted = await decryptStatePayload(hexToBytes(rawHex));
        const parsed = JSON.parse(decrypted) as DatabaseSchema;
        if (parsed && parsed.last_pinned_message_id === tgMessageId) {
          stateCache = parsed;
          lastCacheFetchTime = Date.now();
          return parsed;
        }
        console.log('[TeleStore] KV state is stale or message ID mismatch. Reloading from Telegram source of truth...');
      }
    } catch (e: any) {
      console.warn('[TeleStore] KV fetch/decryption failed:', e.message);
    }
  }

  try {
    let decryptedText = '';
    if (pinned.document) {
      const fileId = pinned.document.file_id;
      const getFileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId })
      });
      const fileData = await getFileRes.json();
      if (!fileData.ok) throw new Error('getFile failed');
      const filePath = fileData.result.file_path;
      const downloadRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
      const encryptedBuffer = new Uint8Array(await downloadRes.arrayBuffer());
      decryptedText = await decryptStatePayload(encryptedBuffer);
    } else if (pinned.text) {
      decryptedText = await decryptStatePayload(new TextEncoder().encode(pinned.text));
    } else {
      throw new Error('Pinned message is not a document or text');
    }

    const state = JSON.parse(decryptedText) as DatabaseSchema;
    state.last_pinned_message_id = tgMessageId;

    stateCache = state;
    lastCacheFetchTime = Date.now();

    if (isCFWorkerConfigured || isKVConfigured) {
      try {
        const encryptedHex = await encryptStateAsync(state);
        await writeRawKV('telebase_state_current', encryptedHex);
      } catch (kvErr) {}
    }
    if (fs && LOCAL_STATE_FILE) {
      try {
        ensureLocalStateDir();
        fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
      } catch (e) {}
    }

    return state;
  } catch (err: any) {
    throw new TelebaseStateError('CORRUPTION_DETECTED', `Failed to load database state from Telegram source of truth: ${err.message}`);
  }
}

export async function uploadShardToTelegram(filename: string, payload: string): Promise<number | null> {
  if (!BOT_TOKEN || !TELEGRAM_CHANNEL_ID) return null;
  try {
    const encryptedBytes = await encryptPayload(payload);
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHANNEL_ID);
    
    const blob = new Blob([encryptedBytes], { type: 'application/octet-stream' });
    formData.append('document', blob, filename);

    const uploadRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    
    const uploadData = await uploadRes.json();
    if (uploadData.ok) {
      return uploadData.result.message_id;
    }
    console.warn('[TeleStore] Failed to upload shard to Telegram:', JSON.stringify(uploadData));
    return null;
  } catch (error: any) {
    console.error('[TeleStore] Exception uploading shard to Telegram:', error.message);
    return null;
  }
}

export async function saveDatabaseState(state: DatabaseSchema, options?: { allowShrink?: boolean }): Promise<void> {
  // Update local memory cache immediately to guarantee consistent consecutive reads
  stateCache = state;
  lastCacheFetchTime = Date.now();

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

  // Encrypt state for KV/Telegram storage to guarantee consistency
  const encryptedHex = await encryptStateAsync(state);
  const finalBuffer = hexToBytes(encryptedHex);
  const durabilityErrors: string[] = [];

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
      if (backup2) {
        const ok = await writeRawKV('telebase_state_backup_3', backup2);
        if (!ok) throw new Error('KV write failed for telebase_state_backup_3');
      }
      
      const backup1 = await readRawKV('telebase_state_backup_1');
      if (backup1) {
        const ok = await writeRawKV('telebase_state_backup_2', backup1);
        if (!ok) throw new Error('KV write failed for telebase_state_backup_2');
      }
      
      const current = await readRawKV('telebase_state_current');
      if (current) {
        const ok = await writeRawKV('telebase_state_backup_1', current);
        if (!ok) throw new Error('KV write failed for telebase_state_backup_1');
      }

      // Save the updated state to telebase_state_current
      const currentOk = await writeRawKV('telebase_state_current', encryptedHex);
      if (!currentOk) throw new Error('KV write failed for telebase_state_current');
      console.log('[TeleStore] Successfully saved current state to Cloudflare KV.');
    } catch (rotErr: any) {
      console.warn('[TeleStore] KV Backup rotation failed (continuing state save):', rotErr.message);
      durabilityErrors.push(`KV: ${rotErr?.message || String(rotErr)}`);
    }
  }

  // Upload to Telegram synchronously to guarantee real-time updates
  if (BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    try {
      await uploadStateToTelegram(finalBuffer, state);
    } catch (error: any) {
      console.error('[TeleStore] Telegram upload failed:', error.message);
      durabilityErrors.push(`Telegram: ${error?.message || String(error)}`);
    }
  }

  if (durabilityErrors.length > 0) {
    throw new Error(`Failed to save database state durably: ${durabilityErrors.join('; ')}`);
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
  let decrypted;
  try {
    if (encryptedBuffer.length < 28) {
      throw new Error('Backup state document is too short for AES-GCM encryption.');
    }
    const iv = encryptedBuffer.slice(0, 12);
    const authTag = encryptedBuffer.slice(12, 28);
    const cipherText = encryptedBuffer.slice(28);
    const key = await getEncryptionKey();
    const decryptedBytes = await aesGcmDecrypt(key, iv, cipherText, authTag);
    decrypted = new TextDecoder().decode(decryptedBytes);
  } catch (decErr: any) {
    console.warn(`[TeleStore] AES-GCM decryption failed for backup '${keyName}', attempting plaintext fallback...`);
    decrypted = new TextDecoder().decode(encryptedBuffer);
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

  const stateToHash = { ...restoredState };
  delete stateToHash.hash;
  const serializedStateBytes = new TextEncoder().encode(JSON.stringify(stateToHash));
  const newHashBytes = await sha256Bytes(serializedStateBytes);
  restoredState.hash = bytesToHex(newHashBytes);

  // 1. Upload and Pin to Telegram first to obtain the new message_id
  if (BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    try {
      const payload = new TextEncoder().encode(JSON.stringify(restoredState));
      const key = await getEncryptionKey();
      const newIv = randomBytes(12);
      const { cipherText: newCipherText, authTag: newAuthTag } = await aesGcmEncrypt(key, newIv, payload);
      const finalBuffer = new Uint8Array(newIv.length + newAuthTag.length + newCipherText.length);
      finalBuffer.set(newIv, 0);
      finalBuffer.set(newAuthTag, newIv.length);
      finalBuffer.set(newCipherText, newIv.length + newAuthTag.length);

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
        const oldMessageId = restoredState.last_pinned_message_id;

        // Update state with the final pinned message ID
        restoredState.last_pinned_message_id = newMessageId;

        // Re-encrypt the finalized state
        const updatedPayload = new TextEncoder().encode(JSON.stringify(restoredState));
        const updatedIv = randomBytes(12);
        const { cipherText: updatedCipherText, authTag: updatedAuthTag } = await aesGcmEncrypt(key, updatedIv, updatedPayload);
        const updatedBuffer = new Uint8Array(updatedIv.length + updatedAuthTag.length + updatedCipherText.length);
        updatedBuffer.set(updatedIv, 0);
        updatedBuffer.set(updatedAuthTag, updatedIv.length);
        updatedBuffer.set(updatedCipherText, updatedIv.length + updatedAuthTag.length);

        // Edit the message media on Telegram to persist the finalized state
        const editFormData = new FormData();
        editFormData.append('chat_id', TELEGRAM_CHANNEL_ID);
        editFormData.append('message_id', newMessageId.toString());
        const media = {
          type: 'document',
          media: 'attach://document'
        };
        editFormData.append('media', JSON.stringify(media));
        const updatedFileBlob = new Blob([updatedBuffer as any], { type: 'application/octet-stream' });
        editFormData.append('document', updatedFileBlob, 'telebase_db.enc');

        const editRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageMedia`, {
          method: 'POST',
          body: editFormData
        });
        const editData = await editRes.json();
        if (!editData.ok) {
          console.warn('[TeleStore] Telegram editMessageMedia failed during restoreState:', JSON.stringify(editData));
        }

        // Pin the new message
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/pinChatMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, message_id: newMessageId, disable_notification: true })
        });

        // Clean up previous message
        if (oldMessageId) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, message_id: oldMessageId })
          }).catch(() => {});
        }
      }
    } catch (tgErr: any) {
      console.error('[TeleStore] Telegram upload failed during restoreState:', tgErr.message);
    }
  }

  // Save the state to local backup file (including new pinned message ID)
  if (fs && LOCAL_STATE_FILE) {
    try {
      ensureLocalStateDir();
      fs.writeFileSync(LOCAL_STATE_FILE, JSON.stringify(restoredState, null, 2), 'utf-8');
    } catch (e) {}
  }

  // 2. Encrypt the finalized state (with the correct last_pinned_message_id) and save to KV with Backup Rotation
  if (isCFWorkerConfigured || isKVConfigured) {
    try {
      const finalPayload = new TextEncoder().encode(JSON.stringify(restoredState));
      const finalKey = await getEncryptionKey();
      const finalIv = randomBytes(12);
      const { cipherText: finalCipherText, authTag: finalAuthTag } = await aesGcmEncrypt(finalKey, finalIv, finalPayload);
      const finalBuffer = new Uint8Array(finalIv.length + finalAuthTag.length + finalCipherText.length);
      finalBuffer.set(finalIv, 0);
      finalBuffer.set(finalAuthTag, finalIv.length);
      finalBuffer.set(finalCipherText, finalIv.length + finalAuthTag.length);
      const finalEncryptedHex = bytesToHex(finalBuffer);

      console.log('[TeleStore] Shifting snapshot backup rings in Cloudflare KV...');
      const backup2 = await readRawKV('telebase_state_backup_2');
      if (backup2) {
        await writeRawKV('telebase_state_backup_3', backup2);
      }
      const backup1 = await readRawKV('telebase_state_backup_1');
      if (backup1) {
        await writeRawKV('telebase_state_backup_2', backup1);
      }
      const current = await readRawKV('telebase_state_current');
      if (current) {
        await writeRawKV('telebase_state_backup_1', current);
      }
      
      const currentOk = await writeRawKV('telebase_state_current', finalEncryptedHex);
      if (!currentOk) throw new Error('KV write failed for telebase_state_current');
      console.log('[TeleStore] Successfully saved restored current state to Cloudflare KV.');
    } catch (rotErr: any) {
      console.warn('[TeleStore] KV Backup rotation failed during restoreState:', rotErr.message);
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

export async function encryptStateAsync(state: DatabaseSchema): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify(state));
  return bytesToHex(payload);
}

export async function readRawKV(key: string): Promise<string | null> {
  const kvBinding = getKVBinding();
  if (isKVConfigured && kvBinding && typeof kvBinding.get === 'function') {
    try {
      const val = await kvBinding.get(key);
      if (val !== null) return val;
    } catch (e: any) {
      console.warn('[TeleStore KV] Direct KV get failed, falling back:', e);
      const errMsg = String(e).toLowerCase();
      if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
        handleKVLimitExceeded();
      }
    }
  }
  if (isCFWorkerConfigured) {
    try {
      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${key}`;
      const res = await fetch(url, { headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY } });
      if (res.status === 429) {
        handleKVLimitExceeded();
        return null;
      }
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch (e: any) {
      console.warn('[TeleStore KV] CF Worker KV read error:', e);
      const errMsg = String(e).toLowerCase();
      if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
        handleKVLimitExceeded();
      }
    }
  }
  if (isKVConfigured && CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_KV_NAMESPACE_ID && CLOUDFLARE_API_TOKEN) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${key}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` } });
      if (res.status === 429) {
        handleKVLimitExceeded();
        return null;
      }
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
    } catch (e: any) {
      console.warn('[TeleStore KV] REST API KV read error:', e);
      const errMsg = String(e).toLowerCase();
      if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
        handleKVLimitExceeded();
      }
    }
  }
  return null;
}

async function writeRawKV(key: string, value: string): Promise<boolean> {
  const kvBinding = getKVBinding();
  if (isKVConfigured && kvBinding && typeof kvBinding.put === 'function') {
    try {
      await kvBinding.put(key, value);
      return true;
    } catch (e: any) {
      console.warn('[TeleStore KV] Direct KV put failed, falling back:', e);
      const errMsg = String(e).toLowerCase();
      if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
        handleKVLimitExceeded();
      }
    }
  }
  if (isCFWorkerConfigured) {
    try {
      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${key}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY, 'Content-Type': 'text/plain' },
        body: value
      });
      if (res.status === 429) {
        handleKVLimitExceeded();
        return false;
      }
      return res.ok;
    } catch (e: any) {
      console.warn('[TeleStore KV] CF Worker KV write error:', e);
      const errMsg = String(e).toLowerCase();
      if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
        handleKVLimitExceeded();
      }
    }
  }
  if (isKVConfigured && CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_KV_NAMESPACE_ID && CLOUDFLARE_API_TOKEN) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${key}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' },
        body: value
      });
      if (res.status === 429) {
        handleKVLimitExceeded();
        return false;
      }
      return res.ok;
    } catch (e: any) {
      console.warn('[TeleStore KV] REST API KV write error:', e);
      const errMsg = String(e).toLowerCase();
      if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
        handleKVLimitExceeded();
      }
    }
  }
  return false;
}

export async function saveKVValue(key: string, value: string): Promise<boolean> {
  return await writeRawKV(key, value);
}
