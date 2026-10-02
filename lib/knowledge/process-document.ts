import { createAdminClient } from "@/lib/supabase/admin";
import { splitTextIntoChunks } from "@/lib/knowledge/chunking";
import { embedTexts } from "@/lib/knowledge/embeddings";
import { hashContent } from "@/lib/knowledge/extract";
import { log } from "@/lib/logger";
import type { KnowledgeDocument } from "@/lib/types/database";

export async function processDocument(documentId: string): Promise<void> {
  const supabase = createAdminClient();
  const started = Date.now();

  const { data: doc, error: fetchError } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .single<KnowledgeDocument>();

  if (fetchError || !doc) {
    throw new Error(fetchError?.message ?? "Document not found");
  }

  if (!doc.raw_text?.trim()) {
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: "No text content to process" })
      .eq("id", documentId);
    throw new Error("No text content to process");
  }

  await supabase
    .from("knowledge_documents")
    .update({ status: "processing", error_message: null })
    .eq("id", documentId);

  try {
    const text = doc.raw_text.trim();
    const contentHash = hashContent(text);
    const chunks = splitTextIntoChunks(text);

    if (chunks.length === 0) {
      throw new Error("Chunking produced no segments");
    }

    await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);

    const embeddings = await embedTexts(chunks);
    const rows = chunks.map((content, index) => ({
      document_id: documentId,
      knowledge_source_id: doc.knowledge_source_id,
      chunk_index: index,
      content,
      embedding: embeddings[index],
      token_count: Math.ceil(content.length / 4),
    }));

    const { error: insertError } = await supabase.from("knowledge_chunks").insert(rows);
    if (insertError) throw new Error(insertError.message);

    await supabase
      .from("knowledge_documents")
      .update({
        status: "ready",
        content_hash: contentHash,
        error_message: null,
      })
      .eq("id", documentId);

    log.info("document_processed", {
      documentId,
      sourceId: doc.knowledge_source_id,
      chunkCount: chunks.length,
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: message })
      .eq("id", documentId);

    log.error("document_processing_failed", { documentId, message });
    throw err;
  }
}

export async function processPendingDocumentsForSource(sourceId: string) {
  const supabase = createAdminClient();
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id, status")
    .eq("knowledge_source_id", sourceId)
    .eq("status", "uploaded");

  for (const doc of docs ?? []) {
    await processDocument(doc.id);
  }
}
