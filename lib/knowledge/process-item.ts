import { createAdminClient } from "@/lib/supabase/admin";
import { splitTextIntoChunkSegments } from "@/lib/knowledge/chunking";
import { embedTexts } from "@/lib/knowledge/embeddings";
import { structuredDataToSearchText } from "@/lib/knowledge/parse-structured";
import { hashContent } from "@/lib/knowledge/extract";
import { log } from "@/lib/logger";
import type { KnowledgeItem } from "@/lib/types/database";

export type ProcessItemResult = { ok: true } | { ok: false; error: string };

function textForEmbedding(item: KnowledgeItem): string | null {
  if (item.knowledge_type === "structured_data" && item.structured_data) {
    return structuredDataToSearchText(item.structured_data);
  }
  return item.raw_text?.trim() ?? null;
}

export async function processKnowledgeItem(itemId: string): Promise<ProcessItemResult> {
  const supabase = createAdminClient();
  const started = Date.now();

  const { data: row, error: fetchError } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", itemId)
    .single();

  const item = row as KnowledgeItem | null;
  if (fetchError || !item) {
    return { ok: false, error: fetchError?.message ?? "Item not found" };
  }

  if (item.status === "unsupported") {
    return { ok: false, error: "Item is niet ondersteund" };
  }
  if (item.review_status === "rejected") {
    return { ok: false, error: "Item is afgekeurd" };
  }

  const text = textForEmbedding(item);
  if (!text) {
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: "Geen inhoud om te verwerken" })
      .eq("id", itemId);
    return { ok: false, error: "Geen inhoud om te verwerken" };
  }

  await supabase
    .from("knowledge_documents")
    .update({ status: "processing", error_message: null })
    .eq("id", itemId);

  try {
    const contentHash = hashContent(text);
    const segments = splitTextIntoChunkSegments(text);
    if (segments.length === 0) {
      throw new Error("Chunking produced no segments");
    }

    await supabase.from("knowledge_chunks").delete().eq("document_id", itemId);

    const embeddings = await embedTexts(segments.map((s) => s.content));
    const chunkRows = segments.map((segment, index) => ({
      document_id: itemId,
      knowledge_source_id: item.knowledge_source_id,
      chunk_index: index,
      content: segment.content,
      embedding: embeddings[index],
      token_count: Math.ceil(segment.content.length / 4),
      page_from: segment.pageFrom,
      page_to: segment.pageTo,
    }));

    const { error: insertError } = await supabase.from("knowledge_chunks").insert(chunkRows);
    if (insertError) throw new Error(insertError.message);

    if (item.knowledge_type === "structured_data" && item.structured_data) {
      await supabase.from("knowledge_structured_rows").delete().eq("document_id", itemId);
      const structuredRows = item.structured_data.rows.map((rowData, row_index) => ({
        document_id: itemId,
        row_index,
        row_data: rowData,
      }));
      const { error: structError } = await supabase
        .from("knowledge_structured_rows")
        .insert(structuredRows);
      if (structError) throw new Error(structError.message);
    }

    await supabase
      .from("knowledge_documents")
      .update({
        status: "ready",
        content_hash: contentHash,
        error_message: null,
        review_status:
          item.review_status === "approved" ? "approved" : "pending_review",
      })
      .eq("id", itemId);

    log.info("knowledge_item_processed", {
      itemId,
      sourceId: item.knowledge_source_id,
      chunkCount: segments.length,
      latencyMs: Date.now() - started,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await supabase
      .from("knowledge_documents")
      .update({ status: "failed", error_message: message })
      .eq("id", itemId);
    log.error("knowledge_item_processing_failed", { itemId, message });
    return { ok: false, error: message };
  }
}
