import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// In production, ensure this is a 32-byte hex string (64 characters) loaded from environment variables
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');

if (ENCRYPTION_KEY.length !== 32) {
    throw new Error('FATAL: ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters) for AES-256.');
}

/**
 * Encrypts a chunk buffer before uploading to Telegram.
 * Returns the encrypted buffer, plus the IV and Auth Tag which MUST be stored in your DB.
 */
export const encryptChunk = (chunkBuffer: Buffer) => {
    const iv = crypto.randomBytes(12); // 12 bytes is standard for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    const encryptedBuffer = Buffer.concat([cipher.update(chunkBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        encryptedBuffer,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
};

/**
 * Creates a Decipher stream for on-the-fly decryption.
 * Pipe the Telegram download stream into this, and pipe this into the Express response.
 */
export const createDecryptStream = (ivHex: string, authTagHex: string): crypto.DecipherGCM => {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    return decipher;
};
