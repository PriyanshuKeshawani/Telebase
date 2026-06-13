import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) {
      return NextResponse.json({ success: false, error: 'Code parameter is required' }, { status: 400 });
    }

    const state = await getDatabaseState(true);
    const requests = state.loginRequests || [];
    const request = requests.find((r: any) => r.code === code);

    if (!request) {
      return NextResponse.json({ success: false, error: 'Login request not found' }, { status: 404 });
    }

    if (request.expiresAt < Date.now()) {
      return NextResponse.json({ success: false, error: 'Login request has expired' }, { status: 410 });
    }

    if (request.isUsed) {
      return NextResponse.json({ success: false, error: 'Login request code has already been used' }, { status: 409 });
    }

    if (request.owner_telegram_id) {
      return NextResponse.json({ success: true, verified: true, owner_telegram_id: request.owner_telegram_id });
    }

    return NextResponse.json({ success: true, verified: false });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
