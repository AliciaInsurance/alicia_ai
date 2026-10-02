import { NextResponse, type NextRequest } from "next/server";
import { isAuthRequiredFromEnv } from "@/lib/auth/auth-policy";
import {
  CANONICAL_PRODUCTION_HOST,
  isCanonicalProductionHost,
  isVercelProductionAlias,
} from "@/lib/auth/auth-url";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/api/chat",
  "/api/widget",
  "/embed",
  "/widget.js",
  "/deploy-stamp.txt",
  "/auth/callback",
];

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

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function hasAuthJsSession(request: NextRequest) {
  return request.cookies.getAll().some(
    (cookie) =>
      cookie.name.includes("authjs.session-token") ||
      cookie.name.includes("__Secure-authjs.session-token") ||
      cookie.name.includes("next-auth.session-token"),
  );
}

export function middleware(request: NextRequest) {
  const canonical = redirectToCanonicalHost(request);
  if (canonical) return canonical;

  const { pathname } = request.nextUrl;

  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (!isAuthRequiredFromEnv(process.env)) {
    return NextResponse.next();
  }

  if (!hasAuthJsSession(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|html)$).*)",
  ],
};
