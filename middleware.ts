import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isGoogleAuthConfigured, isAuthRequiredFromEnv } from "@/lib/auth/auth-policy";
import {
  CANONICAL_PRODUCTION_HOST,
  isCanonicalProductionHost,
  isVercelProductionAlias,
} from "@/lib/auth/auth-url";

const publicPaths = [
  "/login",
  "/api/auth",
  "/api/chat",
  "/api/widget",
  "/embed",
  "/widget.js",
];

const PUBLIC_FILE = /\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|txt|html|xml|webmanifest|js)$/i;

function hasAuthSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (cookie) =>
      cookie.name.includes("authjs.session-token") ||
      cookie.name.includes("__Secure-authjs.session-token") ||
      cookie.name.includes("next-auth.session-token")
  );
}

function redirectToCanonicalHost(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return null;
  const host = request.headers.get("host");
  if (isCanonicalProductionHost(host) || !isVercelProductionAlias(host)) return null;

  const url = request.nextUrl.clone();
  url.hostname = CANONICAL_PRODUCTION_HOST;
  url.protocol = "https:";
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export function middleware(request: NextRequest) {
  try {
    const canonical = redirectToCanonicalHost(request);
    if (canonical) return canonical;

    const { pathname } = request.nextUrl;

    if (PUBLIC_FILE.test(pathname) || publicPaths.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }

    if (!isAuthRequiredFromEnv(process.env)) {
      return NextResponse.next();
    }

    if (!isGoogleAuthConfigured(process.env)) {
      if (pathname.startsWith("/login")) {
        return NextResponse.next();
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "Configuration");
      return NextResponse.redirect(loginUrl);
    }

    if (!hasAuthSessionCookie(request)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  } catch (error) {
    console.error("[middleware] invocation failed", error);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Configuration");
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|webmanifest)$).*)",
  ],
};
