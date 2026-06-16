import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState } from '@/lib/telegramDatabase';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Rate limit: 60 requests per 2 minutes per IP (2-second polling interval)
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rl:poll-login:${ip}`, 60, 120);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) {
      return NextResponse.json({ success: false, error: 'Code parameter is required' }, { status: 400 });
    }

    const state = await getDatabaseState(true);
    const requests = state.loginRequests || [];
    const request = requests.find((r: any) => r.code === code);

    if (!request) {
      return NextResponse.json({ success: false, error: 'Code not recognised. Please generate a new one.' }, { status: 404 });
    }

    if (request.isInvalidated) {
      return NextResponse.json({ success: false, error: 'Code was cancelled. Please generate a new one.' }, { status: 410 });
    }

    if (request.expiresAt < Date.now()) {
      return NextResponse.json({ success: false, error: 'Your code has expired. Please generate a new one.' }, { status: 410 });
    }

    if (request.isUsed) {
      return NextResponse.json({ success: false, error: 'This code has already been used.' }, { status: 409 });
    }

    if (request.owner_telegram_id) {
      return NextResponse.json({ success: true, verified: true, owner_telegram_id: request.owner_telegram_id });
    }

    return NextResponse.json({ success: true, verified: false });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
