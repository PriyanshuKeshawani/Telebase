import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState, TelebaseStateError, LoginRequest } from '@/lib/telegramDatabase';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: NextRequest) {
  // Rate limit: 5 requests per 5 minutes per IP
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rl:login-code:${ip}`, 5, 300);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

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

    const now = Date.now();

    // Invalidate all previous active (unexpired, unused, not-invalidated) codes
    state.loginRequests = state.loginRequests.map((r: any) => {
      if (!r.isUsed && !r.isInvalidated && r.expiresAt > now) {
        return { ...r, isInvalidated: true };
      }
      return r;
    });

    // Clean up fully expired / used / invalidated entries older than 10 minutes
    state.loginRequests = state.loginRequests.filter(
      (r: any) => r.expiresAt > now - 5 * 60 * 1000
    );

    const expiresAt = now + CODE_TTL_MS;

    const newRequest: LoginRequest = {
      code,
      expiresAt,
      isUsed: false,
      created_at: new Date().toISOString(),
    };

    state.loginRequests.push(newRequest);
    await saveDatabaseState(state, { allowShrink: true });

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

    return NextResponse.json({ success: true, code, botUsername, expiresAt });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate login code. Please try again.' },
      { status: 500 }
    );
  }
}
