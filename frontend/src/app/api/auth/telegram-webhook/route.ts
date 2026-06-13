import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState, TelebaseStateError, UserRecord, isCFWorkerConfigured, isKVConfigured } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const message = payload.message || payload.edited_message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ ok: true });
    }

    const text = message.text.trim();
    let code = '';

    if (text.startsWith('/login ')) {
      code = text.substring(7).trim();
    } else if (text.startsWith('/start ')) {
      code = text.substring(7).trim();
    }

    if (!code) {
      if (text.startsWith('/start') || text.startsWith('/login')) {
        await replyToTelegram(botToken, chatId, "👋 Welcome to TeleBase!\n\nTo log in, please generate a login code on the website and send:\n`/login TB-XXXXXX` here.");
      }
      return NextResponse.json({ ok: true });
    }

    // Process the code
    let state;
    try {
      state = await getDatabaseState(true);
    } catch (error: any) {
      if (error instanceof TelebaseStateError && error.code === 'STATE_NOT_FOUND') {
        state = { projects: [], files: [], users: [], loginRequests: [] };
      } else {
        throw error;
      }
    }

    if (!state.loginRequests) {
      state.loginRequests = [];
    }

    console.log(`[Webhook] Received code: ${code}`);
    console.log(`[Webhook] Active login requests in database:`, JSON.stringify(state.loginRequests));

    const request = state.loginRequests?.find((r: any) => r.code === code);
    if (!request) {
      const activeCodes = (state.loginRequests || []).map((r: any) => r.code).join(', ') || 'none';
      const source = isCFWorkerConfigured ? 'Worker KV' : (isKVConfigured ? 'KV REST' : (process.env.BOT_TOKEN ? 'Telegram' : 'Local'));
      console.warn(`[Webhook] Code ${code} not found in active database requests.`);
      await replyToTelegram(botToken, chatId, `❌ Code ${code} not found in database.\n\n🔍 Debug Info:\n- Active Codes: ${activeCodes}\n- Storage Source: ${source}\n- Total Projects: ${state.projects?.length || 0}`);
      return NextResponse.json({ ok: true });
    }

    if (request.expiresAt < Date.now()) {
      await replyToTelegram(botToken, chatId, "❌ This login request has expired. Please generate a new one on the website.");
      return NextResponse.json({ ok: true });
    }

    if (request.isUsed) {
      await replyToTelegram(botToken, chatId, "❌ This login request has already been used.");
      return NextResponse.json({ ok: true });
    }

    // Link the request with the Telegram account
    const owner_telegram_id = String(message.from.id);
    request.owner_telegram_id = owner_telegram_id;

    // Check duplicate user registration prevention
    if (!state.users) {
      state.users = [];
    }

    let userExists = state.users.some((u: any) => u.owner_telegram_id === owner_telegram_id);
    if (!userExists) {
      const newUser: UserRecord = {
        owner_telegram_id,
        username: message.from.username || message.from.first_name || 'tg_user',
        created_at: new Date().toISOString()
      };
      state.users.push(newUser);
    }

    await saveDatabaseState(state, { allowShrink: true });

    await replyToTelegram(botToken, chatId, `✅ Login request verified!\n\nYou can now return to the website to access your TeleBase dashboard.`);
    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ ok: true }); // Always return OK to Telegram
  }
}

export async function GET(req: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ success: false, error: 'BOT_TOKEN is not configured.' });
    }

    const nextAuthUrl = process.env.NEXTAUTH_URL || '';
    let webhookUrl = '';

    if (nextAuthUrl && !nextAuthUrl.includes('localhost') && !nextAuthUrl.includes('127.0.0.1')) {
      webhookUrl = `${nextAuthUrl.replace(/\/$/, '')}/api/auth/telegram-webhook`;
    } else {
      const host = req.headers.get('host') || req.headers.get('x-forwarded-host') || '';
      if (!host || host.includes('localhost') || host.includes('127.0.0.1')) {
        return NextResponse.json({ success: true, message: 'Local development environment. Telegram webhook skipped.' });
      }
      const protocol = 'https';
      webhookUrl = `${protocol}://${host}/api/auth/telegram-webhook`;
    }

    console.log(`[Webhook Register] Registering webhook target: ${webhookUrl}`);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const data = await res.json();

    return NextResponse.json({ success: data.ok, result: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

async function replyToTelegram(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  });
}
