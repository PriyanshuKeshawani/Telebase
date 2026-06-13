import { NextRequest, NextResponse } from "next/server";
import { verifyProjectApiKey, getDatabaseState, saveDatabaseState } from "@/lib/telegramDatabase";
import { TelebaseQueryEngine } from "@/lib/telebaseQueryEngine";
import {
  PROJECT_AUTH_CONFIG,
  generateProjectOTPEmailHTML,
  generateProjectMagicLinkEmailHTML
} from "@/lib/projectAuthConfig";
import { sendProjectEmail } from "@/lib/projectEmailService";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// JWT Helpers (Web Crypto API — Edge Runtime compatible)
// ─────────────────────────────────────────────────────────────

async function signProjectJWT(
  payload: Record<string, any>,
  secret: string,
  expirySeconds = 7 * 24 * 60 * 60
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const header = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expirySeconds,
  })));
  const sigInput = `${header}.${body}`;
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(sigInput));
  return `${sigInput}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyProjectJWT(
  token: string,
  secret: string
): Promise<Record<string, any> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sigStr] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false, ["verify"]
    );
    const sigBytes = b64urlDecode(sigStr);
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(`${header}.${body}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function b64url(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Ensures the system auth tables exist inside the project's Telegram storage */
async function ensureAuthTables(project: any) {
  const state = await getDatabaseState();
  const tables = ["_telebase_users", "_telebase_otps"];
  for (const tableName of tables) {
    const filename = `table_${project.id}_${tableName}.json`;
    const exists = state.files.some((f: any) => f.project_id === project.id && f.filename === filename);
    if (!exists) {
      await TelebaseQueryEngine.executeQuery(project, tableName, {
        type: "INSERT",
        insertData: { id: "schema_init_anchor", __schema_init: true }
      });
      await TelebaseQueryEngine.executeQuery(project, tableName, {
        type: "DELETE",
        noSqlQuery: { __schema_init: true }
      });
    }
  }
}

/** Generates a numeric OTP of configurable length */
function generateOTP(length: number): string {
  const randomValues = new Uint32Array(length);
  globalThis.crypto.getRandomValues(randomValues);
  return Array.from(randomValues).map(v => v % 10).join("");
}

/** Generates a hex-encoded random token for Magic Links */
function generateMagicToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Extract API key from header or query param */
function getApiKey(req: NextRequest): string | null {
  return req.headers.get("x-api-key") || req.nextUrl.searchParams.get("apiKey");
}

/** Extract Bearer JWT from Authorization header or query param */
function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.substring(7);
  return req.nextUrl.searchParams.get("token");
}

// ─────────────────────────────────────────────────────────────
// GET /api/auth/project/[...action]
// ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  try {
    const { action: actionParts } = await params;
    const action = actionParts.join("/");

    const apiKey = getApiKey(req);
    if (!apiKey) return NextResponse.json({ success: false, error: "API key is required" }, { status: 401 });

    const project = await verifyProjectApiKey(apiKey);
    if (!project) return NextResponse.json({ success: false, error: "Invalid API key" }, { status: 401 });

    // ── GET /api/auth/project/user ──────────────────────────────
    // Validates a project-issued JWT and returns the user profile.
    // Compatible with any client using Bearer tokens (including next-auth adapter pattern).
    if (action === "user") {
      const token = getBearerToken(req);
      if (!token) return NextResponse.json({ success: false, error: "Bearer token is required" }, { status: 400 });

      const decoded = await verifyProjectJWT(token, project.api_key);
      if (!decoded) return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 401 });

      await ensureAuthTables(project);
      const res = await TelebaseQueryEngine.executeQuery(project, "_telebase_users", {
        type: "SELECT",
        noSqlQuery: { id: decoded.sub }
      });
      const user = res.records?.find((r: any) => r.id === decoded.sub);
      if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

      return NextResponse.json({ success: true, user });
    }

    // ── GET /api/auth/project/verify ───────────────────────────
    // Handles magic link clicks (browser redirect).
    // Returns a success HTML page and posts token to window.opener.
    if (action === "verify") {
      const token = req.nextUrl.searchParams.get("token");
      if (!token) return new Response("Missing magic link token.", { status: 400 });

      await ensureAuthTables(project);
      const otpRes = await TelebaseQueryEngine.executeQuery(project, "_telebase_otps", {
        type: "SELECT",
        noSqlQuery: { code: token }
      });
      const otpRecord = otpRes.records?.find((r: any) => r.code === token);

      if (!otpRecord)  return new Response("Invalid or expired magic link.", { status: 400 });
      if (otpRecord.is_used) return new Response("This magic link has already been used.", { status: 400 });
      if (otpRecord.expires_at < Date.now()) return new Response("This magic link has expired.", { status: 400 });

      // Consume token
      await TelebaseQueryEngine.executeQuery(project, "_telebase_otps", {
        type: "UPDATE",
        noSqlQuery: { id: otpRecord.id },
        updateSet: { is_used: true }
      });

      // Upsert user
      const userRes = await TelebaseQueryEngine.executeQuery(project, "_telebase_users", {
        type: "SELECT",
        noSqlQuery: { email: otpRecord.email }
      });
      let user = userRes.records?.find((u: any) => u.email === otpRecord.email);
      if (!user) {
        user = { id: globalThis.crypto.randomUUID(), email: otpRecord.email, created_at: new Date().toISOString(), last_sign_in_at: new Date().toISOString() };
        await TelebaseQueryEngine.executeQuery(project, "_telebase_users", { type: "INSERT", insertData: user });
      } else {
        await TelebaseQueryEngine.executeQuery(project, "_telebase_users", {
          type: "UPDATE",
          noSqlQuery: { id: user.id },
          updateSet: { last_sign_in_at: new Date().toISOString() }
        });
      }

      const jwt = await signProjectJWT({ sub: user.id, email: user.email }, project.api_key);
      const successHtml = generateMagicLinkSuccessPage(project.name, jwt);
      return new Response(successHtml, { headers: { "Content-Type": "text/html" } });
    }

    // ── GET /api/auth/project/session ──────────────────────────
    // next-auth compatible session endpoint (for developers using next-auth adapter pattern)
    if (action === "session") {
      const token = getBearerToken(req);
      if (!token) return NextResponse.json({ user: null, expires: null });
      const decoded = await verifyProjectJWT(token, project.api_key);
      if (!decoded) return NextResponse.json({ user: null, expires: null });
      return NextResponse.json({
        user: { id: decoded.sub, email: decoded.email },
        expires: new Date(decoded.exp * 1000).toISOString()
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error: any) {
    console.error("[Project Auth GET Error]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/project/[...action]
// ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string[] }> }
) {
  try {
    const { action: actionParts } = await params;
    const action = actionParts.join("/");

    const apiKey = getApiKey(req);
    if (!apiKey) return NextResponse.json({ success: false, error: "API key is required" }, { status: 401 });

    const project = await verifyProjectApiKey(apiKey);
    if (!project) return NextResponse.json({ success: false, error: "Invalid API key" }, { status: 401 });

    await ensureAuthTables(project);
    const body = await req.json().catch(() => ({}));

    // ── POST /api/auth/project/register ────────────────────────
    // Registers a new project end-user by email.
    if (action === "register") {
      const { email, metadata = {} } = body;
      if (!email || !email.includes("@")) {
        return NextResponse.json({ success: false, error: "Valid email is required" }, { status: 400 });
      }
      const cleanEmail = email.toLowerCase().trim();
      const existRes = await TelebaseQueryEngine.executeQuery(project, "_telebase_users", {
        type: "SELECT",
        noSqlQuery: { email: cleanEmail }
      });
      if (existRes.records?.find((u: any) => u.email === cleanEmail)) {
        return NextResponse.json({ success: false, error: "User already registered" }, { status: 409 });
      }
      const newUser = {
        id: globalThis.crypto.randomUUID(),
        email: cleanEmail,
        created_at: new Date().toISOString(),
        last_sign_in_at: null,
        ...metadata
      };
      await TelebaseQueryEngine.executeQuery(project, "_telebase_users", { type: "INSERT", insertData: newUser });
      return NextResponse.json({ success: true, user: newUser }, { status: 201 });
    }

    // ── POST /api/auth/project/send-otp ────────────────────────
    // Generates and emails a login OTP or Magic Link.
    // Body: { email, mode: "otp" | "magic_link" }
    if (action === "send-otp") {
      const { email, mode = "otp" } = body;
      if (!email || !email.includes("@")) {
        return NextResponse.json({ success: false, error: "Valid email is required" }, { status: 400 });
      }
      if (mode === "otp" && !PROJECT_AUTH_CONFIG.allowOTP) {
        return NextResponse.json({ success: false, error: "OTP mode is disabled in project config" }, { status: 403 });
      }
      if (mode === "magic_link" && !PROJECT_AUTH_CONFIG.allowMagicLink) {
        return NextResponse.json({ success: false, error: "Magic link mode is disabled in project config" }, { status: 403 });
      }

      const cleanEmail = email.toLowerCase().trim();
      const code = mode === "otp"
        ? generateOTP(PROJECT_AUTH_CONFIG.otpLength)
        : generateMagicToken();

      const expiresAt = Date.now() + PROJECT_AUTH_CONFIG.otpExpiryMinutes * 60 * 1000;
      await TelebaseQueryEngine.executeQuery(project, "_telebase_otps", {
        type: "INSERT",
        insertData: {
          id: globalThis.crypto.randomUUID(),
          email: cleanEmail,
          code,
          mode,
          expires_at: expiresAt,
          is_used: false,
          created_at: new Date().toISOString()
        }
      });

      let subject: string;
      let html: string;

      if (mode === "otp") {
        subject = PROJECT_AUTH_CONFIG.emailSubjectOTP.replace("{{code}}", code);
        html = generateProjectOTPEmailHTML(code, project.name);
      } else {
        // Build full magic link URL
        const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const magicLink = `${protocol}://${host}/api/auth/project/verify?token=${code}&apiKey=${project.api_key}`;
        subject = PROJECT_AUTH_CONFIG.emailSubjectMagicLink;
        html = generateProjectMagicLinkEmailHTML(magicLink, project.name);
      }

      const mailResult = await sendProjectEmail({ toEmail: cleanEmail, subject, html });

      return NextResponse.json({
        success: true,
        message: mode === "otp" ? "OTP sent" : "Magic link sent",
        ...(mailResult.error && { note: mailResult.error })
      });
    }

    // ── POST /api/auth/project/verify ──────────────────────────
    // Verifies OTP code and returns a signed JWT.
    // Body: { email, code }
    if (action === "verify") {
      const { email, code } = body;
      if (!code) return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });

      const cleanEmail = email ? email.toLowerCase().trim() : null;
      const otpRes = await TelebaseQueryEngine.executeQuery(project, "_telebase_otps", {
        type: "SELECT",
        noSqlQuery: { code }
      });
      const otpRecord = otpRes.records?.find((r: any) => r.code === code);

      if (!otpRecord) return NextResponse.json({ success: false, error: "Invalid code" }, { status: 400 });
      if (otpRecord.is_used) return NextResponse.json({ success: false, error: "Code already used" }, { status: 400 });
      if (otpRecord.expires_at < Date.now()) return NextResponse.json({ success: false, error: "Code expired" }, { status: 400 });
      if (cleanEmail && otpRecord.email !== cleanEmail) {
        return NextResponse.json({ success: false, error: "Email mismatch" }, { status: 400 });
      }

      // Consume code
      await TelebaseQueryEngine.executeQuery(project, "_telebase_otps", {
        type: "UPDATE",
        noSqlQuery: { id: otpRecord.id },
        updateSet: { is_used: true }
      });

      // Upsert user
      const usersRes = await TelebaseQueryEngine.executeQuery(project, "_telebase_users", {
        type: "SELECT",
        noSqlQuery: { email: otpRecord.email }
      });
      let user = usersRes.records?.find((u: any) => u.email === otpRecord.email);
      if (!user) {
        user = {
          id: globalThis.crypto.randomUUID(),
          email: otpRecord.email,
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString()
        };
        await TelebaseQueryEngine.executeQuery(project, "_telebase_users", { type: "INSERT", insertData: user });
      } else {
        await TelebaseQueryEngine.executeQuery(project, "_telebase_users", {
          type: "UPDATE",
          noSqlQuery: { id: user.id },
          updateSet: { last_sign_in_at: new Date().toISOString() }
        });
      }

      const token = await signProjectJWT({ sub: user.id, email: user.email }, project.api_key);
      return NextResponse.json({ success: true, token, user });
    }

    // ── POST /api/auth/project/signout ─────────────────────────
    // Client-side signout (stateless — just instructs client to drop the token).
    if (action === "signout") {
      return NextResponse.json({ success: true, message: "Signed out. Please discard your local token." });
    }

    // ── POST /api/auth/project/users (Admin: list all users) ───
    if (action === "users") {
      const token = getBearerToken(req);
      if (!token) return NextResponse.json({ success: false, error: "Admin token required" }, { status: 401 });
      // Verify the token is valid (basic check)
      const decoded = await verifyProjectJWT(token, project.api_key);
      if (!decoded) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });

      const usersRes = await TelebaseQueryEngine.executeQuery(project, "_telebase_users", {
        type: "SELECT",
        noSqlQuery: {}
      });
      return NextResponse.json({ success: true, users: usersRes.records || [], count: usersRes.records?.length || 0 });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error: any) {
    console.error("[Project Auth POST Error]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// Magic Link Success HTML Page
// ─────────────────────────────────────────────────────────────

function generateMagicLinkSuccessPage(projectName: string, token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authenticated — ${projectName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #050506;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .card {
      background: #0c0c0f;
      border: 1px solid #1e1e25;
      border-radius: 20px;
      padding: 48px 40px;
      text-align: center;
      max-width: 420px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      animation: fadeUp 0.4s ease;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .icon {
      width: 64px; height: 64px;
      background: linear-gradient(135deg, #10b981, #059669);
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px;
      margin: 0 auto 24px;
      box-shadow: 0 8px 24px rgba(16,185,129,0.3);
    }
    h1 { color: #fff; font-size: 22px; font-weight: 700; margin-bottom: 10px; letter-spacing: -0.3px; }
    p { color: #71717a; font-size: 14px; line-height: 1.6; }
    .badge {
      display: inline-block;
      background: rgba(16,185,129,0.1);
      border: 1px solid rgba(16,185,129,0.2);
      color: #10b981;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    .spinner {
      margin-top: 24px;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      color: #52525b; font-size: 12px;
    }
    .dot {
      width: 6px; height: 6px;
      background: #3b82f6;
      border-radius: 50%;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse {
      0%, 100% { opacity: 0.3; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.1); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <div class="badge">${projectName}</div>
    <h1>Authentication Successful</h1>
    <p>You have signed in successfully. You can now close this window and return to the application.</p>
    <div class="spinner">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
      <span>Redirecting...</span>
    </div>
  </div>
  <script>
    // Securely pass the token back to the originating window/app
    const token = ${JSON.stringify(token)};
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'TELEBASE_AUTH_SUCCESS', token }, '*');
        setTimeout(() => window.close(), 1500);
      }
    } catch(e) {}
    // Store in sessionStorage as fallback for redirect-based flows
    try { sessionStorage.setItem('telebase_token', token); } catch(e) {}
  </script>
</body>
</html>`;
}
