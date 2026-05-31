import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getDatabaseState } from "@/lib/telegramDatabase";

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Smart URL Detection ───────────────────────────────────────────────────────
// Vercel automatically sets VERCEL_URL on every deployment (no manual setup needed).
// .env.local NEXTAUTH_URL is used for local development.
// Priority: NEXTAUTH_URL (explicit) > VERCEL_URL (auto) > localhost fallback
const resolveNextAuthUrl = (): string => {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

// Inject resolved URL into process.env so NextAuth internals pick it up
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = resolveNextAuthUrl();
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "telebase2026";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Telebase Console Auth",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.toLowerCase().trim();
        const password = credentials.password;

        // Fetch current database state to verify user
        const state = await getDatabaseState(true);
        const users = state.users || [];

        const dbUser = users.find(u => u.email.toLowerCase() === email);
        if (dbUser) {
          const hash = await sha256Hex(password);
          if (dbUser.passwordHash === hash) {
            return { id: dbUser.id, email: dbUser.email, name: dbUser.email.split("@")[0] };
          }
        }

        // Admin fallback
        if (
          (email === ADMIN_USERNAME.toLowerCase() || email === "admin@telebase.io") &&
          password === ADMIN_PASSWORD
        ) {
          return { id: "1", name: "Administrator", email: "admin@telebase.io" };
        }

        return null;
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // JWT tokens last 30 days — users stay logged in and can always re-login
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "telebase_secret_token_2026_super_secure_32b_key",
  // Use resolved URL for proper redirect handling on all environments
  ...(process.env.NEXTAUTH_URL ? { url: process.env.NEXTAUTH_URL } : {})
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

