// Polyfill util.inspect.custom for openid-client compatibility on Edge runtime
try {
  const util = require('util');
  if (util) {
    if (!util.inspect) {
      util.inspect = function(val: any) { return String(val); };
    }
    if (util.inspect && !util.inspect.custom) {
      util.inspect.custom = Symbol.for('nodejs.util.inspect.custom');
    }
  }
} catch (e) {}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { getDatabaseState, saveDatabaseState, TelebaseStateError } from "@/lib/telegramDatabase";

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = "telebase_secret_token_2026_super_secure_32b_key";
}
if (!process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = "https://telebase.pages.dev";
}

let handler: any = null;

async function getHandler() {
  if (!handler) {
    const [NextAuth, CredentialsProvider] = await Promise.all([
      import("next-auth").then(m => m.default),
      import("next-auth/providers/credentials").then(m => m.default)
    ]);

    const authOptions: any = {
      providers: [
        CredentialsProvider({
          name: "Telebase Telegram Auth",
          credentials: {
            code: { label: "Login Code", type: "text" }
          },
          async authorize(credentials) {
            if (!credentials?.code) {
              return null;
            }

            const code = credentials.code.trim();

            let state;
            try {
              state = await getDatabaseState(true);
            } catch (error: any) {
              if (error instanceof TelebaseStateError && error.code === 'STATE_NOT_FOUND') {
                return null;
              } else {
                throw error;
              }
            }

            const requests = state.loginRequests || [];
            const reqIdx = requests.findIndex((r: any) => r.code === code);
            if (reqIdx === -1) {
              return null;
            }

            const request = requests[reqIdx];
            if (request.isUsed || request.expiresAt < Date.now() || !request.owner_telegram_id) {
              return null;
            }

            // Mark request as used to prevent replay attacks
            request.isUsed = true;
            try {
              await saveDatabaseState(state, { allowShrink: true });
            } catch (saveErr: any) {
              console.error('[NextAuth] Failed to mark login request as used:', saveErr.message);
            }

            // Telegram user identity matches request owner telegram ID
            return {
              id: request.owner_telegram_id,
              name: request.owner_telegram_id,
            };
          }
        })
      ],
      pages: {
        signIn: "/login",
      },
      session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60,
      },
      callbacks: {
        async jwt({ token, user }: any) {
          if (user) {
            token.owner_telegram_id = user.id;
          }
          return token;
        },
        async session({ session, token }: any) {
          if (token) {
            if (!session.user) {
              session.user = {};
            }
            session.user.owner_telegram_id = token.owner_telegram_id;
            session.user.id = token.owner_telegram_id;
          }
          return session;
        }
      },
      secret: process.env.NEXTAUTH_SECRET || "telebase_secret_token_2026_super_secure_32b_key"
    };

    handler = NextAuth(authOptions);
  }
  return handler;
}

export async function GET(req: any, ctx: any) {
  const h = await getHandler();
  return h(req, ctx);
}

export async function POST(req: any, ctx: any) {
  const h = await getHandler();
  return h(req, ctx);
}
