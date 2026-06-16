// Custom Edge-Compatible JWT Session Handler
// Uses Web Crypto API (crypto.subtle) - 100% compatible with Cloudflare Edge Runtime
// Replaces next-auth completely

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { getDatabaseState, saveDatabaseState, TelebaseStateError } from "@/lib/telegramDatabase";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rateLimit";

const SECRET = process.env['NEXTAUTH_SECRET'] || "telebase_secret_token_2026_super_secure_32b_key";
const COOKIE_NAME = "tb-session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

async function getSecretKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return keyMaterial;
}

function base64url(data: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64urlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function createSessionToken(payload: Record<string, any>): Promise<string> {
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })).buffer);
  const body = base64url(new TextEncoder().encode(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  })).buffer);
  const sigInput = `${header}.${body}`;
  const key = await getSecretKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sigInput));
  return `${sigInput}.${base64url((sig as ArrayBuffer))}`;
}

export async function verifySessionToken(token: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sigStr] = parts;
    const sigInput = `${header}.${body}`;
    const key = await getSecretKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sigStr),
      new TextEncoder().encode(sigInput)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(body)));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map(c => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
  return cookies[COOKIE_NAME] || null;
}

function setCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;
}

function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Handle POST /api/auth/[...nextauth] (signin)
async function handleSignIn(req: Request): Promise<Response> {
  // Rate limit: 10 requests per 5 minutes per IP
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rl:signin:${ip}`, 10, 300);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  try {
    const body = await req.json();
    const code = body?.code?.trim();
    if (!code) {
      return Response.json({ success: false, error: "Code is required" }, { status: 400 });
    }

    let state;
    try {
      state = await getDatabaseState(true);
    } catch (error: any) {
      if (error instanceof TelebaseStateError && error.code === 'STATE_NOT_FOUND') {
        return Response.json({ success: false, error: "Login failed. Please try again." }, { status: 500 });
      }
      throw error;
    }

    const requests = state.loginRequests || [];
    const reqIdx = requests.findIndex((r: any) => r.code === code);
    if (reqIdx === -1) {
      return Response.json({ success: false, error: "Code not recognised. Please generate a new one." }, { status: 401 });
    }

    const request = requests[reqIdx];

    if (request.isInvalidated) {
      return Response.json({ success: false, error: "Code was cancelled. Please generate a new one." }, { status: 401 });
    }

    if (request.expiresAt < Date.now()) {
      return Response.json({ success: false, error: "Your code has expired. Please generate a new one." }, { status: 401 });
    }

    if (request.isUsed || !request.owner_telegram_id) {
      return Response.json({ success: false, error: "Code not yet verified. Please send the command to the Telegram bot first." }, { status: 401 });
    }

    // Mark as used
    request.isUsed = true;
    try {
      await saveDatabaseState(state, { allowShrink: true });
    } catch {}

    const sessionToken = await createSessionToken({
      owner_telegram_id: request.owner_telegram_id,
      sub: request.owner_telegram_id,
    });

    return new Response(JSON.stringify({ success: true, ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookieHeader(sessionToken),
      },
    });
  } catch (err: any) {
    return Response.json({ success: false, error: "Login failed. Please try again." }, { status: 500 });
  }
}

// Handle GET /api/auth/[...nextauth] (session check, signout)
async function handleGetSession(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  if (action === "signout") {
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearCookieHeader(),
      },
    });
  }

  // GET /api/auth/session
  const rawToken = getSessionFromRequest(req);
  if (!rawToken) {
    return Response.json({ user: null, expires: null });
  }

  const payload = await verifySessionToken(rawToken);
  if (!payload) {
    return new Response(JSON.stringify({ user: null, expires: null }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearCookieHeader(),
      },
    });
  }

  return Response.json({
    user: {
      id: payload.owner_telegram_id,
      owner_telegram_id: payload.owner_telegram_id,
    },
    expires: new Date(payload.exp * 1000).toISOString(),
  });
}

export async function GET(req: Request) {
  try {
    return await handleGetSession(req);
  } catch (err: any) {
    return Response.json({ success: false, error: "An error occurred. Please try again." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    return await handleSignIn(req);
  } catch (err: any) {
    return Response.json({ success: false, error: "Login failed. Please try again." }, { status: 500 });
  }
}
