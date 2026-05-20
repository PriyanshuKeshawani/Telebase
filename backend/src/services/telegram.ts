import axios from 'axios';
import FormData from 'form-data';

export async function uploadToTelegram(botToken: string, channelId: string, chunkBuffer: Buffer, chunkName: string): Promise<{ messageId: string, fileId: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendDocument`;

  const form = new FormData();
  form.append('chat_id', channelId);
  form.append('document', chunkBuffer, { filename: chunkName });

  try {
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    if (!response.data || !response.data.ok) {
      throw new Error(`Telegram API Error: ${JSON.stringify(response.data)}`);
    }

    const messageId = response.data.result.message_id.toString();
    const fileId = response.data.result.document.file_id;
    return { messageId, fileId };
  } catch (error: any) {
    if (error.response) {
      throw new Error(`Telegram API Error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

export async function downloadFromTelegram(botToken: string, fileId: string): Promise<Buffer> {
  try {
    // 1. Get File Path
    const fileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const fileRes = await axios.get(fileUrl);
    
    if (!fileRes.data || !fileRes.data.ok) {
      throw new Error(`Telegram getFile Error: ${JSON.stringify(fileRes.data)}`);
    }

    const filePath = fileRes.data.result.file_path;

    // 2. Download File
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    const downloadRes = await axios.get(downloadUrl, { responseType: 'arraybuffer' });

    return Buffer.from(downloadRes.data);
  } catch (error: any) {
    if (error.response) {
      throw new Error(`Telegram API Error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}
