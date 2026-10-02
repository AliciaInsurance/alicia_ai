import { NextResponse, type NextRequest } from "next/server";
import { sanitizeEmbedReferrer } from "@/lib/chat/referrer";
import { runChat } from "@/lib/chat/orchestrator";
import { log } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/lib/validation/chat";
import { requireApiAuth } from "@/lib/auth/auth";

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const rate = checkRateLimit(`chat:${ip}`);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec ?? 60) } }
      );
    }

    const json = await request.json();
    const parsed = chatRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const body = parsed.data;

    if (body.channel === "admin_test") {
      const authError = await requireApiAuth();
      if (authError) return authError;
    }

    log.info("chat_request", {
      assistant: body.assistant,
      channel: body.channel,
      ip,
    });

    const referrer = sanitizeEmbedReferrer(body.referrerUrl);

    const result = await runChat({
      assistantSlug: body.assistant,
      message: body.message,
      anonymousSessionId: body.sessionId,
      conversationId: body.conversationId,
      channel: body.channel,
      referrerUrl: referrer?.referrerUrl,
      referrerDomain: referrer?.referrerDomain,
    });

    return NextResponse.json(result);
  } catch (err) {
    log.error("chat_error", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "Sorry, something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
