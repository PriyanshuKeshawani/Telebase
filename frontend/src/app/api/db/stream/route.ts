import { NextRequest, NextResponse } from 'next/server';
import { readRawKV } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // Ensures the request hits the edge worker, but we will return edge cache headers

export async function GET(req: NextRequest) {
  try {
    const stateHex = await readRawKV('telebase_state_current');
    
    if (!stateHex) {
      return new NextResponse(JSON.stringify({ hash: null }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Hash the encrypted hex to create a fast comparison token for the UI
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-1', new TextEncoder().encode(stateHex));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return new NextResponse(JSON.stringify({ hash: hashHex }), {
      headers: {
        'Content-Type': 'application/json',
        // Edge CDN Cache: Store at edge for 5 seconds. Revalidate in background for another 5s.
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    return new NextResponse(JSON.stringify({ error: "An internal error occurred" }), { status: 500 });
  }
}
