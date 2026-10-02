import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import {
  ALLOWED_EMAIL_DOMAIN,
  isAllowedEmail,
  isAllowedGoogleProfile,
  isAuthRequiredFromEnv,
  isGoogleAuthConfigured,
  normalizeEmail,
} from "@/lib/auth/auth-policy";
import { resolveAuthUrl } from "@/lib/auth/auth-url";
import { getAdminAllowlist } from "@/lib/env";

function trimEnv(name: string) {
  const value = process.env[name];
  return value?.trim() ? value.trim() : undefined;
}

export const effectiveAuthUrl = resolveAuthUrl();
if (effectiveAuthUrl) {
  process.env.AUTH_URL = effectiveAuthUrl;
  process.env.NEXTAUTH_URL = effectiveAuthUrl;
}
process.env.AUTH_TRUST_HOST = "true";

const googleClientId = trimEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = trimEnv("GOOGLE_CLIENT_SECRET");
const authSecret = trimEnv("AUTH_SECRET") ?? trimEnv("NEXTAUTH_SECRET");

const config: NextAuthConfig = {
  secret: authSecret,
  trustHost: true,
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      client: { token_endpoint_auth_method: "client_secret_post" },
      authorization: {
        params: {
          hd: ALLOWED_EMAIL_DOMAIN,
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ profile }) {
      const googleProfile = profile ?? {};
      if (!isAllowedGoogleProfile(googleProfile)) {
        console.error("[auth] signIn denied", googleProfile.email?.split("@")[1]);
        return false;
      }

      const allowlist = getAdminAllowlist();
      const email = normalizeEmail(googleProfile.email);
      if (allowlist.length > 0 && email && !allowlist.includes(email)) {
        console.error("[auth] signIn denied allowlist", email);
        return "/login?error=AccessDenied&reason=allowlist";
      }

      return true;
    },
    jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email.toLowerCase();
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      if (session.user?.email && token.email) {
        session.user.email = String(token.email);
      }
      return session;
    },
  },
  logger: {
    error(error) {
      console.error("[auth]", error);
      const cause = error instanceof Error ? error.cause : undefined;
      if (cause) console.error("[auth cause]", cause);
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

export function isAuthConfigured(): boolean {
  return isGoogleAuthConfigured(process.env);
}

export function isAuthRequired(): boolean {
  return isAuthRequiredFromEnv(process.env);
}

export async function requireApiAuth() {
  if (!isAuthRequired()) return null;

  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "Authentication not configured" }, { status: 503 });
  }

  try {
    const session = await auth();
    if (session?.user && isAllowedEmail(session.user.email)) return null;
  } catch (error) {
    console.error("[auth] requireApiAuth", error);
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
