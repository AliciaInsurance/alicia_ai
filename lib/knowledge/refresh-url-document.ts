import { createAdminClient } from "@/lib/supabase/admin";
import {
  applyTextFields,
  buildDocumentFieldsFromIngest,
} from "@/lib/knowledge/document-extraction";
import { fetchUrlContent } from "@/lib/knowledge/fetch-url";
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

    const mode = doc.status === "ready" ? "rerun_keep_ready" : "initial";
    const applied = fetched.pdfIngest
      ? buildDocumentFieldsFromIngest(fetched.pdfIngest, mode, doc.status)
      : {
          text: fetched.text,
          pendingText: null as string | null,
          status: "uploaded" as const,
          fields: {
            extraction_method: null,
            extraction_quality: null,
            extraction_reason: null,
            page_count: null,
            extraction_review_status: "not_required",
            error_message: null,
          },
        };

    const { data: updated, error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        title,
        mime_type: fetched.mimeType,
        ...applyTextFields(applied),
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
