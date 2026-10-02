import { createAdminClient } from "@/lib/supabase/admin";
import { fetchUrlContent } from "@/lib/knowledge/fetch-url";
import { hashContent } from "@/lib/knowledge/extract";
import type { KnowledgeDocument } from "@/lib/types/database";

export async function refreshUrlDocumentContent(
  documentId: string,
): Promise<{ ok: true; doc: KnowledgeDocument } | { ok: false; error: string }> {
  const supabase = createAdminClient();
  const { data: docRow, error } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  const doc = docRow as KnowledgeDocument | null;
  if (error || !doc) {
    return { ok: false, error: error?.message ?? "Document not found" };
  }

  if (doc.source_type !== "url" || !doc.source_url?.trim()) {
    return { ok: true, doc };
  }

  try {
    const fetched = await fetchUrlContent(doc.source_url);
    const title = doc.title?.trim() && doc.title !== doc.source_url ? doc.title : fetched.title;

    const { data: updated, error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        title,
        raw_text: fetched.text,
        content_hash: hashContent(fetched.text),
        mime_type: fetched.mimeType,
        error_message: null,
        status: "uploaded",
      })
      .eq("id", documentId)
      .select("*")
      .single();

    if (updateError || !updated) {
      return { ok: false, error: updateError?.message ?? "Kon document niet bijwerken" };
    }

    return { ok: true, doc: updated as KnowledgeDocument };
  } catch (err) {
    const message = err instanceof Error ? err.message : "URL ophalen mislukt";
    return { ok: false, error: message };
  }
}
