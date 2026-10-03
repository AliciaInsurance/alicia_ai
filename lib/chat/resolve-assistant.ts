import { normalizeAssistantRow } from "@/lib/chat/normalize-assistant";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Assistant } from "@/lib/types/database";

/** Resolve an active assistant from internal slug or widget public slug. */
export async function resolveActiveAssistant(
  slugOrPublicSlug: string
): Promise<Assistant> {
  const supabase = createAdminClient();

  const { data: byAssistantSlugRow } = await supabase
    .from("assistants")
    .select("*")
    .eq("slug", slugOrPublicSlug)
    .maybeSingle();

  const byAssistantSlug = byAssistantSlugRow
    ? normalizeAssistantRow(byAssistantSlugRow as Record<string, unknown>)
    : null;

  if (byAssistantSlug?.status === "active") return byAssistantSlug;

  const { data: widget } = await supabase
    .from("widget_configs")
    .select("assistant_id, is_enabled")
    .eq("public_slug", slugOrPublicSlug)
    .maybeSingle();

  if (!widget?.is_enabled) {
    throw new Error("Assistant not found or not available");
  }

  const { data: assistantRow } = await supabase
    .from("assistants")
    .select("*")
    .eq("id", widget.assistant_id)
    .single();

  const assistant = assistantRow
    ? normalizeAssistantRow(assistantRow as Record<string, unknown>)
    : null;

  if (!assistant || assistant.status !== "active") {
    throw new Error("Assistant not found or not available");
  }

  return assistant;
}
