import { createClient } from '@supabase/supabase-js';

export async function uploadToSupabase(url: string, key: string, fileUuid: string, buffer: Buffer): Promise<void> {
  const supabase = createClient(url, key);
  
  const { data, error } = await supabase.storage
    .from('telebase')
    .upload(`${fileUuid}.zip`, buffer, {
      contentType: 'application/zip',
      upsert: true
    });

  if (error) {
    throw new Error(`Supabase Upload Error: ${error.message}`);
  }
}

export async function downloadFromSupabase(url: string, key: string, fileUuid: string): Promise<Buffer> {
  const supabase = createClient(url, key);
  
  const { data, error } = await supabase.storage
    .from('telebase')
    .download(`${fileUuid}.zip`);

  if (error) {
    throw new Error(`Supabase Download Error: ${error.message}`);
  }

  // Convert Blob to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
