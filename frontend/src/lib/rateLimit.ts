/**
 * Edge-compatible KV-backed rate limiter.
 * Uses the same Cloudflare KV binding as telegramDatabase.ts (process.env.KV).
 * Falls back to allowed=true if KV is unavailable so auth is never blocked by infra issues.
 */

interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function getKV(): KVNamespace | null {
  try {
    // @ts-ignore — KV is injected by Cloudflare Pages runtime
    const kv = (process.env as any).KV ?? (globalThis as any).KV ?? null;
    return kv;
  } catch {
    return null;
  }
}

/**
 * Check and enforce rate limit.
 * @param key         Unique identifier e.g. `rl:login-code:1.2.3.4`
 * @param maxRequests Maximum requests allowed in the window
 * @param windowSeconds Window duration in seconds
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const kv = getKV();
  if (!kv) {
    // KV not available — degrade gracefully, allow request
    return { allowed: true, retryAfterSeconds: 0 };
  }

  try {
    const raw = await kv.get(key, 'text');
    const now = Math.floor(Date.now() / 1000);

    if (!raw) {
      // First request in this window — create the counter
      await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), {
        expirationTtl: windowSeconds,
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const record: { count: number; windowStart: number } = JSON.parse(raw);
    const elapsed = now - record.windowStart;

    if (elapsed >= windowSeconds) {
      // Window has rolled over — reset
      await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), {
        expirationTtl: windowSeconds,
      });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (record.count >= maxRequests) {
      const retryAfterSeconds = windowSeconds - elapsed;
      return { allowed: false, retryAfterSeconds };
    }

    // Increment counter
    await kv.put(
      key,
      JSON.stringify({ count: record.count + 1, windowStart: record.windowStart }),
      { expirationTtl: windowSeconds - elapsed }
    );
    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    // Any KV error — degrade gracefully
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Extract client IP from Cloudflare Pages request headers.
 */
export function getClientIp(req: Request): string {
  const headers = req.headers as Headers;
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * Return a standardised 429 response.
 */
export function rateLimitResponse(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Too many requests. Please wait before trying again.',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
