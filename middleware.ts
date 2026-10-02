import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth, isAuthRequired } from "@/lib/auth/auth";
import { isAllowedEmail } from "@/lib/auth/auth-policy";
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

export async function middleware(request: NextRequest) {
  const canonical = redirectToCanonicalHost(request);
  if (canonical) return canonical;

  const { pathname } = request.nextUrl;

  if (PUBLIC_FILE.test(pathname) || publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!isAuthRequired()) {
    return NextResponse.next();
  }

  let session = null;
  try {
    session = await auth();
  } catch (error) {
    console.error("[auth] middleware", error);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "Configuration");
    return NextResponse.redirect(loginUrl);
  }

  if (!session?.user || !isAllowedEmail(session.user.email)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|webmanifest)$).*)",
  ],
};
