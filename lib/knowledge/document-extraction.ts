import { createAdminClient } from "@/lib/supabase/admin";
import { fetchUrlContent } from "@/lib/knowledge/fetch-url";
import { ingestPdfBuffer } from "@/lib/knowledge/ingest-pdf";
import { hashContent } from "@/lib/knowledge/extract";
import type { KnowledgeDocument } from "@/lib/types/database";

export type ExtractionApplyMode = "initial" | "rerun_keep_ready";

export type AppliedExtraction = {
  text: string;
  pendingText: string | null;
  status: KnowledgeDocument["status"];
  fields: Record<string, unknown>;
};

export async function loadPdfBufferForDocument(
  doc: KnowledgeDocument,
): Promise<Buffer | null> {
  if (doc.source_url?.trim()) {
    const fetched = await fetchUrlContent(doc.source_url, { retainPdfBuffer: true });
    if (fetched.pdfBuffer) return fetched.pdfBuffer;
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("knowledge_documents")
    .select("source_pdf_bytea")
    .eq("id", doc.id)
    .single();

  const raw = data?.source_pdf_bytea;
  if (!raw) return null;
  if (Buffer.isBuffer(raw)) return raw;
  if (typeof raw === "string") return Buffer.from(raw, "base64");
  return null;
}

export function buildDocumentFieldsFromIngest(
  ingest: Awaited<ReturnType<typeof ingestPdfBuffer>>,
  mode: ExtractionApplyMode,
  previousStatus: KnowledgeDocument["status"],
): AppliedExtraction {
  const baseFields = {
    extraction_method: ingest.extractionMethod,
    extraction_quality: ingest.extractionQuality,
    extraction_reason: ingest.extractionReason,
    page_count: ingest.pageCount,
    extraction_review_status: ingest.extractionReviewStatus,
    error_message: null,
  };

  if (ingest.requiresReview) {
    if (mode === "rerun_keep_ready" && previousStatus === "ready") {
      return {
        text: "",
        pendingText: ingest.text,
        status: "awaiting_review",
        fields: {
          ...baseFields,
          extraction_review_status: "pending",
        },
      };
    }
    return {
      text: ingest.text,
      pendingText: null,
      status: "awaiting_review",
      fields: baseFields,
    };
  }

  return {
    text: ingest.text,
    pendingText: null,
    status: "uploaded",
    fields: {
      ...baseFields,
      extraction_review_status: "not_required",
    },
  };
}

export async function extractPdfForDocument(
  doc: KnowledgeDocument,
  mode: ExtractionApplyMode,
): Promise<AppliedExtraction> {
  const buffer = await loadPdfBufferForDocument(doc);
  if (!buffer) {
    throw new Error("Geen PDF-bron beschikbaar voor her-extractie");
  }
  const ingest = await ingestPdfBuffer(buffer);
  return buildDocumentFieldsFromIngest(ingest, mode, doc.status);
}

export function applyTextFields(
  applied: AppliedExtraction,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ...applied.fields,
    status: applied.status,
  };

  if (applied.pendingText !== null) {
    payload.pending_raw_text = applied.pendingText;
    payload.content_hash = null;
  } else {
    payload.raw_text = applied.text;
    payload.pending_raw_text = null;
    payload.content_hash = hashContent(applied.text);
  }

  return payload;
}
