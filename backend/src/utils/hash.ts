import crypto from 'crypto';

export function calculateSHA256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function verifySHA256(buffer: Buffer, expectedHash: string): boolean {
  return calculateSHA256(buffer) === expectedHash;
}
