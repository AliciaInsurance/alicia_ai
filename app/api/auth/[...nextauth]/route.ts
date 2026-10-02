import { handlers } from "@/lib/auth/auth";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export const { POST } = handlers;

export async function GET(request: NextRequest) {
  const isCallback = request.nextUrl.pathname.includes("/callback/");
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);

  if (isCallback) {
    console.error("[auth callback]", {
      host: request.headers.get("host"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      hasCode: request.nextUrl.searchParams.has("code"),
      oauthError: request.nextUrl.searchParams.get("error"),
      authUrl: process.env.AUTH_URL,
      cookieNames,
    });
  }

  const response = await handlers.GET(request);

  if (isCallback && response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    if (location?.includes("error=")) {
      const url = new URL(location, request.url);
      const googleError = request.nextUrl.searchParams.get("error");
      const hasPkce = cookieNames.some((name) => name.includes("pkce"));
      if (googleError) url.searchParams.set("hint", googleError);
      else if (!hasPkce) url.searchParams.set("hint", "missing_pkce_cookie");
      else url.searchParams.set("hint", "token_exchange");
      return NextResponse.redirect(url);
    }
  }

  return response;
}
