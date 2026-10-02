import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-safe middleware (no Auth.js / env module imports).
 * Session cookie gate only — full auth() + @alicia.insure checks run in server pages/actions.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/chat",
  "/api/widget",
  "/embed",
  "/widget.js",
];

const PUBLIC_FILE = /\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|txt|html|xml|webmanifest|js)$/i;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_FILE.test(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function hasAuthSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (cookie) =>
      cookie.name.includes("authjs.session-token") ||
      cookie.name.includes("__Secure-authjs.session-token") ||
      cookie.name.includes("next-auth.session-token")
  );
}

function isAuthRequired(): boolean {
  const env = process.env;
  if (env.VERCEL_ENV === "production") return true;
  if (env.DEMO_MODE?.trim() === "true") return false;
  const googleOk = Boolean(
    env.GOOGLE_CLIENT_ID?.trim() &&
      env.GOOGLE_CLIENT_SECRET?.trim() &&
      (env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim())
  );
  const supabaseOk = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
  return googleOk || supabaseOk;
}

function isAuthConfigured(): boolean {
  const env = process.env;
  return Boolean(
    env.GOOGLE_CLIENT_ID?.trim() &&
      env.GOOGLE_CLIENT_SECRET?.trim() &&
      (env.AUTH_SECRET?.trim() || env.NEXTAUTH_SECRET?.trim())
  );
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!isAuthRequired()) {
    return NextResponse.next();
  }

  if (!isAuthConfigured()) {
    if (pathname.startsWith("/login")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login?error=Configuration", request.url));
  }

  if (!hasAuthSessionCookie(request)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/assistants/:path*", "/knowledge-sources/:path*"],
};
