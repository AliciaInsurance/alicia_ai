import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ADMIN_PREFIXES = ["/assistants", "/knowledge-sources"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  if (isAdminRoute) {
    const response = await updateSession(request);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/assistants/:path*", "/knowledge-sources/:path*"],
};
