export const CHUNK_SIZE = 19 * 1024 * 1024; // 19MB

export function splitBuffer(buffer: Buffer): Buffer[] {
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const end = Math.min(offset + CHUNK_SIZE, buffer.length);
    chunks.push(buffer.subarray(offset, end));
    offset = end;
  }

  return chunks;
}

export function mergeBuffers(chunks: Buffer[]): Buffer {
  return Buffer.concat(chunks);
}
