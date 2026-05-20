import archiver from 'archiver';
import unzipper from 'unzipper';

export async function compressData(data: Buffer, filename: string = 'data.json'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('data', (data) => buffers.push(data));
    archive.on('error', (err) => reject(err));
    archive.on('end', () => resolve(Buffer.concat(buffers)));

    archive.append(data, { name: filename });
    archive.finalize();
  });
}

export async function decompressData(zipBuffer: Buffer): Promise<Buffer> {
  const directory = await unzipper.Open.buffer(zipBuffer);
  if (directory.files.length === 0) {
    throw new Error('Empty zip file');
  }
  return directory.files[0].buffer();
}
