/**
 * TeleBase Project Auth SDK
 * 
 * Drop this file into your Next.js / any Edge-compatible app.
 * Provides helper functions to verify TeleBase JWT tokens and 
 * integrate with next-auth as a credentials provider.
 * 
 * ---------- QUICK START ----------
 * 
 * 1. Install nothing — this uses Web Crypto API (works everywhere: Vercel, Cloudflare, Node.js)
 * 
 * 2. Copy your TeleBase Project API Key from the dashboard
 *    const PROJECT_API_KEY = "sk_proj_..."
 * 
 * 3. Use any auth endpoint:
 *    POST   /api/auth/project/send-otp   { email, mode: "otp"|"magic_link" }
 *    POST   /api/auth/project/verify     { email, code }
 *    GET    /api/auth/project/user       (Bearer token)
 *    GET    /api/auth/project/session    (next-auth compatible)
 *    POST   /api/auth/project/register   { email }
 *    POST   /api/auth/project/signout
 */

const TELEBASE_URL = process.env.NEXT_PUBLIC_TELEBASE_URL || "https://telebase.pages.dev";

// ─────────────────────────────────────────────────────────────
// Server-side JWT Verification (no external dependencies!)
// ─────────────────────────────────────────────────────────────

/**
 * Verifies a TeleBase project JWT token.
 * Use this on your server / API routes to authenticate your end-users.
 * 
 * @param token  - JWT token from the client
 * @param secret - Your TeleBase Project API Key (sk_proj_...)
 * @returns Decoded payload or null if invalid/expired
 * 
 * @example
 * const payload = await verifyTelebaseToken(req.headers.get("authorization")?.split(" ")[1], process.env.TELEBASE_API_KEY);
 * if (!payload) return new Response("Unauthorized", { status: 401 });
 */
export async function verifyTelebaseToken(
  token: string | null | undefined,
  secret: string
): Promise<{ sub: string; email: string; iat: number; exp: number } | null> {
  if (!token) return null;
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
    const b64 = sigStr.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const sigBytes = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(`${header}.${body}`));
    if (!valid) return null;
    const payloadB64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Client-side API Wrapper
// ─────────────────────────────────────────────────────────────

export class TelebaseAuth {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = TELEBASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private headers(token?: string) {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": this.apiKey
    };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  private url(action: string) {
    return `${this.baseUrl}/api/auth/project/${action}`;
  }

  /**
   * Register a new user by email.
   */
  async register(email: string, metadata?: Record<string, any>) {
    const res = await fetch(this.url("register"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, metadata })
    });
    return res.json();
  }

  /**
   * Send OTP (numeric code) to user's email.
   */
  async sendOTP(email: string) {
    const res = await fetch(this.url("send-otp"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, mode: "otp" })
    });
    return res.json();
  }

  /**
   * Send Magic Link to user's email.
   */
  async sendMagicLink(email: string) {
    const res = await fetch(this.url("send-otp"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, mode: "magic_link" })
    });
    return res.json();
  }

  /**
   * Verify OTP code and get a JWT session token.
   */
  async verifyOTP(email: string, code: string): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
    const res = await fetch(this.url("verify"), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ email, code })
    });
    return res.json();
  }

  /**
   * Get the current user's profile using a JWT token.
   */
  async getUser(token: string): Promise<{ success: boolean; user?: any; error?: string }> {
    const res = await fetch(this.url("user"), {
      headers: this.headers(token)
    });
    return res.json();
  }

  /**
   * Sign out (client-side — discards local token).
   */
  async signOut(token: string) {
    const res = await fetch(this.url("signout"), {
      method: "POST",
      headers: this.headers(token)
    });
    return res.json();
  }

  /**
   * Get session (next-auth compatible format).
   */
  async getSession(token: string): Promise<{ user?: { id: string; email: string }; expires?: string }> {
    const res = await fetch(this.url("session"), {
      headers: this.headers(token)
    });
    return res.json();
  }

  /**
   * List all users (requires valid token).
   */
  async listUsers(token: string): Promise<{ success: boolean; users?: any[]; count?: number }> {
    const res = await fetch(this.url("users"), {
      method: "POST",
      headers: this.headers(token),
      body: JSON.stringify({})
    });
    return res.json();
  }
}

// ─────────────────────────────────────────────────────────────
// next-auth Credentials Provider adapter
// ─────────────────────────────────────────────────────────────
// 
// Use this in your next-auth config to let next-auth manage sessions
// while TeleBase handles the actual OTP/Magic Link authentication.
//
// Example usage in app/api/auth/[...nextauth]/route.ts:
//
// import NextAuth from "next-auth";
// import { TelebaseCredentialsProvider } from "@/lib/telebaseAuthSdk";
//
// export const { handlers, auth } = NextAuth({
//   providers: [TelebaseCredentialsProvider("sk_proj_yourkey")],
// });

export function TelebaseCredentialsProvider(apiKey: string) {
  return {
    id: "telebase",
    name: "TeleBase OTP",
    type: "credentials" as const,
    credentials: {
      email: { label: "Email", type: "email" },
      otp: { label: "Verification Code", type: "text" }
    },
    async authorize(credentials: Record<string, string> | undefined) {
      if (!credentials?.email || !credentials?.otp) return null;
      try {
        const res = await fetch(`${TELEBASE_URL}/api/auth/project/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ email: credentials.email, code: credentials.otp })
        });
        const data = await res.json();
        if (data.success && data.user) {
          return { id: data.user.id, email: data.user.email, name: data.user.email };
        }
        return null;
      } catch {
        return null;
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────
// React Hook (Client-side only)
// ─────────────────────────────────────────────────────────────

/**
 * useTelebaseAuth — lightweight React hook for project auth.
 * Stores token in localStorage. Works with any React framework.
 * 
 * @example
 * const { user, sendOTP, verifyOTP, signOut, loading } = useTelebaseAuth("sk_proj_...");
 */
export function useTelebaseAuth(apiKey: string, baseUrl = TELEBASE_URL) {
  // NOTE: This hook uses React. Import React in your component file.
  // This is provided as a copy-paste template.
  // 
  // const [user, setUser] = React.useState(null);
  // const [loading, setLoading] = React.useState(false);
  // const auth = new TelebaseAuth(apiKey, baseUrl);
  //
  // React.useEffect(() => {
  //   const token = localStorage.getItem("telebase_token");
  //   if (token) auth.getUser(token).then(r => { if (r.success) setUser(r.user); });
  // }, []);
  //
  // return {
  //   user,
  //   loading,
  //   sendOTP: (email) => { setLoading(true); return auth.sendOTP(email).finally(() => setLoading(false)); },
  //   sendMagicLink: (email) => { setLoading(true); return auth.sendMagicLink(email).finally(() => setLoading(false)); },
  //   verifyOTP: async (email, code) => {
  //     setLoading(true);
  //     const r = await auth.verifyOTP(email, code).finally(() => setLoading(false));
  //     if (r.success && r.token) { localStorage.setItem("telebase_token", r.token); setUser(r.user); }
  //     return r;
  //   },
  //   signOut: async () => {
  //     const token = localStorage.getItem("telebase_token");
  //     if (token) await auth.signOut(token);
  //     localStorage.removeItem("telebase_token");
  //     setUser(null);
  //   }
  // };
  void apiKey; void baseUrl; // suppress unused warning
  return null; // Placeholder — copy the comment above into your actual component
}
