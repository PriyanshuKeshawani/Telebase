import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[DEBUG-STATE] Fetching database state...');
    const state = await getDatabaseState(true);
    return NextResponse.json({
      success: true,
      message: 'State retrieved successfully',
      state
    });
  } catch (error: any) {
    console.error('[DEBUG-STATE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    }, { status: 500 });
  }
}
