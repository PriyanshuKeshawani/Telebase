// Edge-compatible session utility - replaces next-auth/jwt getToken
// Uses Web Crypto API (crypto.subtle) - works on Cloudflare Edge Runtime

const SECRET = process.env['NEXTAUTH_SECRET'] || "telebase_secret_token_2026_super_secure_32b_key";
const COOKIE_NAME = "tb-session";

async function getSecretKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
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

export async function getSession(req: Request): Promise<Record<string, any> | null> {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map(c => {
        const [k, ...v] = c.trim().split("=");
        return [k.trim(), v.join("=")];
      })
    );
    const token = cookies[COOKIE_NAME];
    if (!token) return null;

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
