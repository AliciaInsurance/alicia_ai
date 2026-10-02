import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveActiveAssistant } from "@/lib/chat/resolve-assistant";
import type { WidgetConfig } from "@/lib/types/database";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("assistant");
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid assistant" }, { status: 400 });
  }

  try {
    const assistant = await resolveActiveAssistant(slug);
    const supabase = createAdminClient();

    const { data: widgetRow } = await supabase
      .from("widget_configs")
      .select("*")
      .eq("assistant_id", assistant.id)
      .maybeSingle();

    const widget = widgetRow as WidgetConfig | null;

    if (!widget?.is_enabled) {
      return NextResponse.json({ error: "Widget unavailable" }, { status: 404 });
    }

    const config = (widget.config ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      assistant: slug,
      displayName: assistant.customer_display_name,
      greeting: assistant.greeting,
      primaryColor: widget.primary_color ?? "#0f766e",
      position: widget.position ?? "bottom-right",
      suggestedQuestions: (config.suggested_questions as string[]) ?? [],
    });
  } catch {
    return NextResponse.json({ error: "Widget unavailable" }, { status: 404 });
  }
}
