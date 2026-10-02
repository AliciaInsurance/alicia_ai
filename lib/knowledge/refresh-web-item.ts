import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWebContent } from "@/lib/knowledge/fetch-web";
import { hashContent } from "@/lib/knowledge/extract";
import type { KnowledgeItem } from "@/lib/types/database";

export async function refreshWebKnowledgeItem(
  itemId: string,
): Promise<{ ok: true; item: KnowledgeItem } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", itemId)
    .single();

  const item = row as KnowledgeItem | null;
  if (error || !item) {
    return { ok: false, error: error?.message ?? "Item not found" };
  }

  if (item.knowledge_type !== "web" || !item.source_url?.trim()) {
    return { ok: true, item };
  }

  try {
    const fetched = await fetchWebContent(item.source_url);
    const now = new Date().toISOString();
    const title =
      item.title?.trim() && item.title !== item.source_url ? item.title : fetched.title;

    if (fetched.kind === "unsupported") {
      const { data: updated, error: updateError } = await supabase
        .from("knowledge_documents")
        .update({
          title,
          content_type: fetched.contentType,
          last_refresh_at: now,
          fetched_at: item.fetched_at ?? now,
          status: "unsupported",
          review_status: "pending_review",
          error_message: fetched.unsupportedMessage ?? "Niet ondersteund",
          raw_text: null,
        })
        .eq("id", itemId)
        .select("*")
        .single();
      if (updateError || !updated) {
        return { ok: false, error: updateError?.message ?? "Update mislukt" };
      }
      return { ok: true, item: updated as KnowledgeItem };
    }

    const knowledge_type = fetched.kind === "html" ? "web" : "document";

    const { data: updated, error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        title,
        knowledge_type,
        content_type: fetched.contentType,
        raw_text: fetched.text,
        content_hash: hashContent(fetched.text),
        last_refresh_at: now,
        fetched_at: item.fetched_at ?? now,
        status: "uploaded",
        review_status: "pending_review",
        error_message: null,
      })
      .eq("id", itemId)
      .select("*")
      .single();

    if (updateError || !updated) {
      return { ok: false, error: updateError?.message ?? "Update mislukt" };
    }
    return { ok: true, item: updated as KnowledgeItem };
  } catch (err) {
    const message = err instanceof Error ? err.message : "URL ophalen mislukt";
    return { ok: false, error: message };
  }
}
