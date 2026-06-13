import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState, TelebaseStateError, LoginRequest } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Generate secure random code e.g. TB-XXXXXX
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TB-';
    const randomValues = new Uint32Array(6);
    globalThis.crypto.getRandomValues(randomValues);
    for (let i = 0; i < 6; i++) {
      code += chars[randomValues[i] % chars.length];
    }

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

    // Clean up expired login requests
    const now = Date.now();
    state.loginRequests = state.loginRequests.filter(
      (r: any) => r.expiresAt > now && !r.isUsed
    );

    const newRequest: LoginRequest = {
      code,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes
      isUsed: false,
      created_at: new Date().toISOString()
    };

    state.loginRequests.push(newRequest);
    await saveDatabaseState(state);

    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    let botUsername = 'TelebaseBot';
    if (botToken) {
      try {
        const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const getMeData = await getMeRes.json();
        if (getMeData.ok && getMeData.result.username) {
          botUsername = getMeData.result.username;
        }
      } catch (e) {}
    }

    return NextResponse.json({ success: true, code, botUsername });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
