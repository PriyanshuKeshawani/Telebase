import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Forbidden. Debug access disabled.' },
    { status: 403 }
  );
}
