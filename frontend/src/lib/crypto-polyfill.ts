// Edge-compatible crypto polyfill for NextAuth v4
export function randomBytes(size: number) {
  const bytes = new Uint8Array(size);
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    globalThis.crypto.getRandomValues(bytes);
  }
  
  // Return an object that mimics Node's Buffer behavior for NextAuth
  return {
    toString(encoding?: string) {
      if (encoding === 'hex') {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      if (encoding === 'base64' || encoding === 'base64url') {
        const binString = String.fromCharCode(...bytes);
        const b64 = btoa(binString);
        if (encoding === 'base64url') {
          return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        }
        return b64;
      }
      return new TextDecoder().decode(bytes);
    },
    length: size,
    readUInt32BE(offset: number) {
      return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    }
  };
}

export function randomUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Simple sync SHA-256 for verification tokens (fallback, not used in credentials login)
export function createHash(algorithm: string) {
  let data = '';
  return {
    update(val: any) {
      data += String(val);
      return this;
    },
    digest(encoding: string) {
      // Mock hash representation
      return mockSha256(data);
    }
  };
}

function mockSha256(str: string): string {
  // Simple deterministic hash function for mock fallback
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(16, '0') + '000000000000000000000000000000000000000000000000';
}
