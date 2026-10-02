export const dynamic = "force-dynamic";

import { ChatPanel } from "@/components/chat-panel";
import { resolveActiveAssistant } from "@/lib/chat/resolve-assistant";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WidgetConfig } from "@/lib/types/database";

export default async function EmbedChatPage({
  searchParams,
}: {
  searchParams: Promise<{ assistant?: string; primary?: string; embed_url?: string }>;
}) {
  const params = await searchParams;
  const assistantKey = params.assistant ?? "";

  if (!assistantKey || !/^[a-z0-9-]+$/.test(assistantKey)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-600">
        Widget configuration error.
      </div>
    );
  }

  try {
    const assistant = await resolveActiveAssistant(assistantKey);
    const supabase = createAdminClient();
    const { data: widgetRow } = await supabase
      .from("widget_configs")
      .select("primary_color, is_enabled")
      .eq("assistant_id", assistant.id)
      .maybeSingle();

    const widget = widgetRow as Pick<WidgetConfig, "primary_color" | "is_enabled"> | null;

    if (!widget?.is_enabled) throw new Error("disabled");

    const primary =
      params.primary && /^#[0-9a-fA-F]{6}$/.test(params.primary)
        ? params.primary
        : (widget.primary_color ?? "#0f766e");

    const embedReferrerUrl =
      typeof params.embed_url === "string"
        ? params.embed_url.slice(0, 2000)
        : undefined;

    return (
      <div className="h-screen bg-slate-50 p-2">
        <ChatPanel
          assistantSlug={assistantKey}
          channel="widget"
          displayName={assistant.customer_display_name}
          greeting={assistant.greeting}
          primaryColor={primary}
          embedReferrerUrl={embedReferrerUrl}
        />
      </div>
    );
  } catch {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-600">
        This assistant is not available.
      </div>
    );
  }
}
