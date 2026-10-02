import { createAdminClient } from "@/lib/supabase/admin";
import { splitTextIntoChunkSegments } from "@/lib/knowledge/chunking";
import { embedTexts } from "@/lib/knowledge/embeddings";
import { hashContent } from "@/lib/knowledge/extract";
import { log } from "@/lib/logger";
import type { KnowledgeDocument } from "@/lib/types/database";

export type ProcessDocumentResult = { ok: true } | { ok: false; error: string };

function canProcessDocument(doc: KnowledgeDocument): string | null {
  if (doc.extraction_review_status === "pending") {
    return "Extractie wacht op goedkeuring";
  }
  if (doc.extraction_review_status === "rejected") {
    return "Document is afgekeurd";
  }
  if (doc.status === "awaiting_review") {
    return "Document wacht op controle";
  }
  if (doc.status === "extracting") {
    return "Extractie is nog bezig";
  }
  return null;
}

export async function processDocument(documentId: string): Promise<ProcessDocumentResult> {
  const supabase = createAdminClient();
  const started = Date.now();

  const { data: docRow, error: fetchError } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  const doc = docRow as KnowledgeDocument | null;

  if (fetchError || !doc) {
    const message = fetchError?.message ?? "Document not found";
    return { ok: false, error: message };
  }

  const blocked = canProcessDocument(doc);
  if (blocked) {
    return { ok: false, error: blocked };
  }

  if (!doc.raw_text?.trim()) {
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: "No text content to process" })
      .eq("id", documentId);
    return { ok: false, error: "No text content to process" };
  }

  await supabase
    .from("knowledge_documents")
    .update({ status: "processing", error_message: null })
    .eq("id", documentId);

  try {
    const text = doc.raw_text.trim();
    const contentHash = hashContent(text);
    const segments = splitTextIntoChunkSegments(text);

    if (segments.length === 0) {
      throw new Error("Chunking produced no segments");
    }

    await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);

    const embeddings = await embedTexts(segments.map((s) => s.content));
    const rows = segments.map((segment, index) => ({
      document_id: documentId,
      knowledge_source_id: doc.knowledge_source_id,
      chunk_index: index,
      content: segment.content,
      embedding: embeddings[index],
      token_count: Math.ceil(segment.content.length / 4),
      page_from: segment.pageFrom,
      page_to: segment.pageTo,
    }));

    const { error: insertError } = await supabase.from("knowledge_chunks").insert(rows);
    if (insertError) throw new Error(insertError.message);

    await supabase
      .from("knowledge_documents")
      .update({
        status: "ready",
        content_hash: contentHash,
        error_message: null,
        extraction_review_status:
          doc.extraction_review_status === "approved"
            ? "approved"
            : doc.extraction_review_status,
      })
      .eq("id", documentId);

    log.info("document_processed", {
      documentId,
      sourceId: doc.knowledge_source_id,
      chunkCount: segments.length,
      latencyMs: Date.now() - started,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);

    log.error("document_processing_failed", { documentId, message });
    return { ok: false, error: message };
  }
}

export async function processPendingDocumentsForSource(sourceId: string) {
  const supabase = createAdminClient();
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id, status, extraction_review_status")
    .eq("knowledge_source_id", sourceId)
    .eq("status", "uploaded");

  for (const doc of docs ?? []) {
    if (doc.extraction_review_status === "pending") continue;
    await processDocument(doc.id);
  }
}
