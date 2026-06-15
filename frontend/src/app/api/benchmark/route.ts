import { NextRequest, NextResponse } from 'next/server';
import { isKVConfigured, formatTelegramChannelId } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
const TELEGRAM_CHANNEL_ID = formatTelegramChannelId(process.env.AUTH_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID || '');
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

export async function GET() {
  const result = {
    isKVConfigured,
    telegramLatencyMs: 0,
    kvLatencyMs: 0,
    telegramStatus: 'offline',
    kvStatus: 'not_configured',
    kvErrorMessage: null as string | null
  };

  // 1. Measure Telegram Bot API Latency
  if (BOT_TOKEN && TELEGRAM_CHANNEL_ID) {
    try {
      const start = Date.now();
      const getChatUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getChat`;
      const res = await fetch(getChatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID })
      });
      const data = await res.json();
      if (data.ok) {
        result.telegramLatencyMs = Date.now() - start;
        result.telegramStatus = 'online';
      } else {
        result.telegramStatus = 'error';
      }
    } catch (e: any) {
      result.telegramStatus = 'offline';
    }
  }

  // 2. Measure Cloudflare KV REST API Latency
  if (isKVConfigured) {
    try {
      const start = Date.now();
      const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/benchmark_test`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
        }
      });
      
      // We don't care if it's 404 (meaning empty key) or 200, as long as the API responded successfully
      if (res.ok || res.status === 404) {
        result.kvLatencyMs = Date.now() - start;
        result.kvStatus = 'online';
      } else {
        result.kvStatus = 'error';
        result.kvErrorMessage = `HTTP status ${res.status}: ${res.statusText}`;
      }
    } catch (e: any) {
      result.kvStatus = 'error';
      result.kvErrorMessage = e.message;
    }
  } else {
    result.kvLatencyMs = 0;
    result.kvStatus = 'not_configured';
  }

  return NextResponse.json({ success: true, ...result });
}
