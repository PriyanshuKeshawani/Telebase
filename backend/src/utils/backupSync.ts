import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { prisma } from '../lib/prisma';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN}`;
const INDEX_CHANNEL_ID = process.env.INDEX_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID || '';

// 32-byte AES key for metadata encryption (fallback default if env variable is missing)
const BACKUP_ENCRYPTION_KEY_HEX = process.env.BACKUP_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const ENCRYPTION_KEY = Buffer.from(BACKUP_ENCRYPTION_KEY_HEX, 'hex');

export class BackupSyncManager {
  
  /**
   * Generates a full encrypted backup of the SQLite/PostgreSQL DB and uploads it as a pinned document
   */
  public static async syncStateToTelegram(): Promise<void> {
    try {
      if (!INDEX_CHANNEL_ID) {
        console.warn('[BackupSync] Warning: INDEX_CHANNEL_ID/TELEGRAM_CHANNEL_ID is not configured. Skipping backup sync.');
        return;
      }
      
      console.log('[BackupSync] Initiating master state sync...');
      
      // 1. Fetch all metadata (Files + Chunks) from Prisma
      const allFiles = await prisma.file.findMany({
        include: { chunks: true }
      });

      const payload = JSON.stringify(allFiles);

      // 2. Encrypt the payload using AES-256-GCM
      const iv = crypto.randomBytes(12); // 12-byte IV is optimal for AES-GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
      const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Combine IV (12 bytes), AuthTag (16 bytes), and Encrypted Data for the binary file output
      const finalBuffer = Buffer.concat([iv, authTag, encrypted]);
      
      const tempDir = path.join(__dirname, '../../tmp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `backup_${Date.now()}.enc`);
      fs.writeFileSync(tempFilePath, finalBuffer);

      // 3. Upload as a Document to the Index Channel
      const formData = new FormData();
      formData.append('chat_id', INDEX_CHANNEL_ID);
      formData.append('document', fs.createReadStream(tempFilePath), 'master_index.enc');

      const uploadRes = await axios.post(`${TELEGRAM_API}/sendDocument`, formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      if (!uploadRes.data || !uploadRes.data.ok) {
        throw new Error(`Telegram sendDocument failed: ${JSON.stringify(uploadRes.data)}`);
      }

      const messageId = uploadRes.data.result.message_id;

      // 4. Pin the new backup message in the channel
      const pinRes = await axios.post(`${TELEGRAM_API}/pinChatMessage`, {
        chat_id: INDEX_CHANNEL_ID,
        message_id: messageId,
        disable_notification: true
      });

      if (!pinRes.data || !pinRes.data.ok) {
        console.warn(`[BackupSync] Failed to pin message ${messageId}: ${JSON.stringify(pinRes.data)}`);
      }

      // Cleanup local temp file
      fs.unlinkSync(tempFilePath);
      console.log(`[BackupSync] State successfully synced and pinned! Message ID: ${messageId}`);

    } catch (error: any) {
      console.error('[BackupSync] Failed to sync state to Telegram:', error.message);
    }
  }

  /**
   * Fetches the pinned backup from Telegram, decrypts it, and rebuilds the local database
   */
  public static async restoreFromTelegram(): Promise<boolean> {
    try {
      if (!INDEX_CHANNEL_ID) {
        console.warn('[BackupSync] Warning: INDEX_CHANNEL_ID/TELEGRAM_CHANNEL_ID is not configured. Skipping restore.');
        return false;
      }

      console.log('[BackupSync] Checking for pinned backup in Telegram index channel...');

      // 1. Get the pinned message from chat details
      const chatRes = await axios.post(`${TELEGRAM_API}/getChat`, {
        chat_id: INDEX_CHANNEL_ID
      });

      if (!chatRes.data || !chatRes.data.ok) {
        throw new Error(`Telegram getChat failed: ${JSON.stringify(chatRes.data)}`);
      }

      const pinnedMessage = chatRes.data.result.pinned_message;
      if (!pinnedMessage || !pinnedMessage.document) {
        console.log('[BackupSync] No pinned backup document found. Starting fresh.');
        return false;
      }

      const fileId = pinnedMessage.document.file_id;

      // 2. Get download URL for the document
      const fileRes = await axios.post(`${TELEGRAM_API}/getFile`, { file_id: fileId });
      if (!fileRes.data || !fileRes.data.ok) {
        throw new Error(`Telegram getFile failed: ${JSON.stringify(fileRes.data)}`);
      }

      const filePath = fileRes.data.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN}/${filePath}`;

      // 3. Download the encrypted file
      const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      // 4. Decrypt the file
      // AES-GCM structure: IV (12 bytes) + AuthTag (16 bytes) + EncryptedData
      const iv = buffer.subarray(0, 12);
      const authTag = buffer.subarray(12, 28);
      const encryptedData = buffer.subarray(28);

      const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedData, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      const restoredFiles = JSON.parse(decrypted);

      // 5. Rebuild local Database
      console.log(`[BackupSync] Restoring ${restoredFiles.length} files to database...`);
      
      // Wipe current local DB state completely to avoid duplication/conflicts
      await prisma.fileChunk.deleteMany({});
      await prisma.file.deleteMany({});

      // Bulk insert the restored state
      for (const file of restoredFiles) {
        await prisma.file.create({
          data: {
            uuid: file.uuid,
            project_id: file.project_id,
            user_uuid: file.user_uuid,
            version: file.version,
            chunk_count: file.chunk_count,
            file_hash: file.file_hash,
            size: file.size,
            created_at: new Date(file.created_at),
            chunks: {
              create: file.chunks.map((c: any) => ({
                id: c.id,
                chunk_index: c.chunk_index,
                message_id: c.message_id,
                iv: c.iv,
                auth_tag: c.auth_tag,
                created_at: new Date(c.created_at)
              }))
            }
          }
        });
      }

      console.log('[BackupSync] Restoration complete! Local database is 100% in sync with Telegram.');
      return true;

    } catch (error: any) {
      console.error('[BackupSync] Critical failure during restoration:', error.message);
      return false;
    }
  }
}
