import { NextRequest, NextResponse } from 'next/server';
import { formatTelegramChannelId } from '@/lib/telegramDatabase';

export const runtime = 'edge';

const BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] || process.env['BOT_TOKEN'] || '';

export async function POST(req: NextRequest) {
  try {
    const urlObj = new URL(req.url);
    const origin = urlObj.origin;
    
    // Webhook URL endpoint
    const webhookUrl = `${origin}/api/webhook/telegram?token=${BOT_TOKEN}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const tgData = await tgRes.json();

    if (tgData.ok) {
      return NextResponse.json({ success: true, message: 'Realtime Webhook successfully connected to Telegram!' });
    } else {
      throw new Error(`Telegram error: ${tgData.description}`);
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
