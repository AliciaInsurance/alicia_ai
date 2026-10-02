"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  applyTextFields,
  buildDocumentFieldsFromIngest,
  extractPdfForDocument,
} from "@/lib/knowledge/document-extraction";
import {
  assertFileSize,
  detectSourceType,
  extractTextFromBuffer,
  hashContent,
  sanitizeFilename,
} from "@/lib/knowledge/extract";
import { fetchUrlContent } from "@/lib/knowledge/fetch-url";
import { ingestPdfBuffer } from "@/lib/knowledge/ingest-pdf";
import { processDocument, processPendingDocumentsForSource } from "@/lib/knowledge/process-document";
import { refreshUrlDocumentContent } from "@/lib/knowledge/refresh-url-document";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KnowledgeDocument } from "@/lib/types/database";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function redirectWithKnowledgeNotice(
  sourceId: string,
  kind: "error" | "notice",
  message: string,
): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`/knowledge-sources/${sourceId}?${params.toString()}`);
}

async function markExtractionFailed(documentId: string, message: string) {
  const supabase = createAdminClient();
  await supabase
    .from("knowledge_documents")
    .update({
      status: "failed",
      error_message: message.slice(0, 2000),
      extraction_quality: "failed",
    })
    .eq("id", documentId);
}

export async function createKnowledgeSource(formData: FormData) {
  await requireAdminUser();
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? name));
  const description = String(formData.get("description") ?? "").trim() || null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_sources")
    .insert({ name, slug, description })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/knowledge-sources");
  redirect(`/knowledge-sources/${data.id}`);
}

export async function attachSourceToAssistant(assistantId: string, sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("assistant_sources")
    .insert({ assistant_id: assistantId, knowledge_source_id: sourceId });
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  revalidatePath(`/assistants/${assistantId}`);
}

export async function detachSourceFromAssistant(assistantId: string, sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("assistant_sources")
    .delete()
    .eq("assistant_id", assistantId)
    .eq("knowledge_source_id", sourceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/assistants/${assistantId}`);
}

export async function addManualDocument(sourceId: string, formData: FormData) {
  await requireAdminUser();
  const title = String(formData.get("title") ?? "Manual entry").trim();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) redirectWithKnowledgeNotice(sourceId, "error", "Tekst is verplicht.");

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_documents")
      .insert({
        knowledge_source_id: sourceId,
        title,
        source_type: "manual",
        status: "uploaded",
        raw_text: text,
        content_hash: hashContent(text),
        extraction_review_status: "not_required",
      })
      .select("id")
      .single();

    if (error) redirectWithKnowledgeNotice(sourceId, "error", error.message);

    const processed = await processDocument(data.id);
    revalidatePath(`/knowledge-sources/${sourceId}`);
    if (!processed.ok) {
      redirectWithKnowledgeNotice(
        sourceId,
        "notice",
        `Opgeslagen, maar verwerken mislukt: ${processed.error}`,
      );
    }
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : "Opslaan mislukt";
    console.error("[addManualDocument]", err);
    redirectWithKnowledgeNotice(sourceId, "error", message);
  }
}

export async function uploadDocument(sourceId: string, formData: FormData) {
  await requireAdminUser();
  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    redirectWithKnowledgeNotice(sourceId, "error", "Kies een bestand om te uploaden.");
  }
  const file = fileEntry;

  const supabase = createAdminClient();
  let documentId: string | null = null;

  try {
    assertFileSize(file.size);
    const filename = sanitizeFilename(file.name);
    const sourceType = detectSourceType(file.type, filename);
    if (!sourceType) {
      redirectWithKnowledgeNotice(sourceId, "error", "Bestandstype niet ondersteund (PDF, txt, md).");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { data: created, error: createError } = await supabase
      .from("knowledge_documents")
      .insert({
        knowledge_source_id: sourceId,
        title: filename,
        filename,
        mime_type: file.type || null,
        source_type: sourceType,
        status: sourceType === "pdf" ? "extracting" : "uploaded",
        extraction_review_status: "not_required",
        source_pdf_bytea: sourceType === "pdf" ? buffer : null,
      })
      .select("id")
      .single();

    if (createError) redirectWithKnowledgeNotice(sourceId, "error", createError.message);
    documentId = created.id;

    let insertUpdate: Record<string, unknown>;

    if (sourceType === "pdf") {
      const ingest = await ingestPdfBuffer(buffer);
      const applied = buildDocumentFieldsFromIngest(ingest, "initial", "uploaded");
      insertUpdate = applyTextFields(applied);
    } else {
      const text = await extractTextFromBuffer(buffer, sourceType);
      if (!text) redirectWithKnowledgeNotice(sourceId, "error", "Geen tekst uit dit bestand gehaald.");
      insertUpdate = {
        status: "uploaded",
        raw_text: text,
        content_hash: hashContent(text),
        extraction_review_status: "not_required",
      };
    }

    const { error: updateError } = await supabase
      .from("knowledge_documents")
      .update(insertUpdate)
      .eq("id", documentId);

    if (updateError) redirectWithKnowledgeNotice(sourceId, "error", updateError.message);

    const uploadedDocId = documentId;
    if (!uploadedDocId) redirectWithKnowledgeNotice(sourceId, "error", "Document kon niet worden aangemaakt.");

    const requiresReview = insertUpdate.status === "awaiting_review";
    if (!requiresReview) {
      const processed = await processDocument(uploadedDocId);
      revalidatePath(`/knowledge-sources/${sourceId}`);
      if (!processed.ok) {
        redirectWithKnowledgeNotice(
          sourceId,
          "notice",
          `Bestand opgeslagen; embeddings mislukt: ${processed.error}. Controleer OPENAI_API_KEY en vector/DB.`,
        );
      }
      return;
    }

    revalidatePath(`/knowledge-sources/${sourceId}`);
    redirectWithKnowledgeNotice(
      sourceId,
      "notice",
      "PDF geëxtraheerd met vision — controleer de tekst en keur goed voordat deze in de assistent komt.",
    );
  } catch (err) {
    if (documentId) {
      const message = err instanceof Error ? err.message : "Upload mislukt";
      await markExtractionFailed(documentId, message);
    }
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : "Upload mislukt";
    console.error("[uploadDocument]", err);
    redirectWithKnowledgeNotice(sourceId, "error", message);
  }
}

export async function addUrlDocument(sourceId: string, formData: FormData) {
  await requireAdminUser();
  const url = String(formData.get("url") ?? "").trim();
  const titleOverride = String(formData.get("title") ?? "").trim();
  if (!url) redirectWithKnowledgeNotice(sourceId, "error", "URL is verplicht.");

  const supabase = createAdminClient();
  let documentId: string | null = null;

  try {
    const { data: created, error: createError } = await supabase
      .from("knowledge_documents")
      .insert({
        knowledge_source_id: sourceId,
        title: titleOverride || url,
        source_type: "url",
        source_url: url,
        status: "extracting",
        extraction_review_status: "not_required",
      })
      .select("id")
      .single();

    if (createError) redirectWithKnowledgeNotice(sourceId, "error", createError.message);
    documentId = created.id;

    const fetched = await fetchUrlContent(url, { retainPdfBuffer: true });
    const title = titleOverride || fetched.title || url;

    const applied = fetched.pdfIngest
      ? buildDocumentFieldsFromIngest(fetched.pdfIngest, "initial", "extracting")
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

    const { error: updateError } = await supabase
      .from("knowledge_documents")
      .update({
        title,
        mime_type: fetched.mimeType,
        source_pdf_bytea: fetched.pdfBuffer ?? null,
        ...applyTextFields(applied),
      })
      .eq("id", documentId);

    if (updateError) redirectWithKnowledgeNotice(sourceId, "error", updateError.message);

    const urlDocId = documentId;
    if (!urlDocId) redirectWithKnowledgeNotice(sourceId, "error", "Document kon niet worden aangemaakt.");

    if (applied.status === "awaiting_review") {
      revalidatePath(`/knowledge-sources/${sourceId}`);
      redirectWithKnowledgeNotice(
        sourceId,
        "notice",
        "PDF van URL geëxtraheerd — controleer de tekst en keur goed.",
      );
    }

    const processed = await processDocument(urlDocId);
    revalidatePath(`/knowledge-sources/${sourceId}`);
    if (!processed.ok) {
      redirectWithKnowledgeNotice(
        sourceId,
        "notice",
        `URL opgeslagen; verwerken mislukt: ${processed.error}`,
      );
    }
  } catch (err) {
    if (documentId) {
      const message = err instanceof Error ? err.message : "URL toevoegen mislukt";
      await markExtractionFailed(documentId, message);
    }
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : "URL toevoegen mislukt";
    console.error("[addUrlDocument]", err);
    redirectWithKnowledgeNotice(sourceId, "error", message);
  }
}

export async function approveDocumentExtraction(documentId: string, sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data: docRow } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  const doc = docRow as KnowledgeDocument | null;
  if (!doc) redirectWithKnowledgeNotice(sourceId, "error", "Document niet gevonden.");

  const text = doc.pending_raw_text?.trim() || doc.raw_text?.trim();
  if (!text) redirectWithKnowledgeNotice(sourceId, "error", "Geen extractietekst om goed te keuren.");

  await supabase
    .from("knowledge_documents")
    .update({
      raw_text: text,
      pending_raw_text: null,
      content_hash: hashContent(text),
      extraction_review_status: "approved",
      status: "uploaded",
      error_message: null,
    })
    .eq("id", documentId);

  const result = await processDocument(documentId);
  revalidatePath(`/knowledge-sources/${sourceId}`);
  if (!result.ok) {
    redirectWithKnowledgeNotice(sourceId, "notice", result.error);
  }
}

export async function rejectDocumentExtraction(documentId: string, sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data: docRow } = await supabase
    .from("knowledge_documents")
    .select("status, pending_raw_text")
    .eq("id", documentId)
    .single();

  const doc = docRow as Pick<KnowledgeDocument, "status" | "pending_raw_text"> | null;
  if (!doc) redirectWithKnowledgeNotice(sourceId, "error", "Document niet gevonden.");

  if (doc.pending_raw_text && doc.status === "awaiting_review") {
    await supabase
      .from("knowledge_documents")
      .update({
        pending_raw_text: null,
        extraction_review_status: "not_required",
        status: "ready",
        error_message: null,
      })
      .eq("id", documentId);
  } else {
    await supabase.from("knowledge_chunks").delete().eq("document_id", documentId);
    await supabase
      .from("knowledge_documents")
      .update({
        extraction_review_status: "rejected",
        status: "rejected",
        pending_raw_text: null,
        error_message: null,
      })
      .eq("id", documentId);
  }

  revalidatePath(`/knowledge-sources/${sourceId}`);
}

export async function rerunDocumentExtraction(documentId: string, sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data: docRow } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  const doc = docRow as KnowledgeDocument | null;
  if (!doc) redirectWithKnowledgeNotice(sourceId, "error", "Document niet gevonden.");

  try {
    await supabase
      .from("knowledge_documents")
      .update({ status: "extracting", error_message: null })
      .eq("id", documentId);

    const mode = doc.status === "ready" ? "rerun_keep_ready" : "initial";

    if (doc.source_type === "url" && doc.source_url) {
      const refreshed = await refreshUrlDocumentContent(documentId);
      if (!refreshed.ok) {
        await markExtractionFailed(documentId, refreshed.error);
        redirectWithKnowledgeNotice(sourceId, "notice", refreshed.error);
      }
      revalidatePath(`/knowledge-sources/${sourceId}`);
      if (refreshed.doc.status === "uploaded") {
        const result = await processDocument(documentId);
        if (!result.ok) redirectWithKnowledgeNotice(sourceId, "notice", result.error);
      }
      return;
    }

    if (doc.source_type === "pdf" || doc.mime_type === "application/pdf") {
      const applied = await extractPdfForDocument(doc, mode);
      await supabase
        .from("knowledge_documents")
        .update(applyTextFields(applied))
        .eq("id", documentId);

      revalidatePath(`/knowledge-sources/${sourceId}`);
      if (applied.status === "awaiting_review") {
        redirectWithKnowledgeNotice(sourceId, "notice", "Nieuwe extractie klaar voor controle.");
      }
      const result = await processDocument(documentId);
      if (!result.ok) redirectWithKnowledgeNotice(sourceId, "notice", result.error);
      return;
    }

    redirectWithKnowledgeNotice(sourceId, "error", "Her-extractie is alleen voor PDF-documenten.");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Her-extractie mislukt";
    await markExtractionFailed(documentId, message);
    redirectWithKnowledgeNotice(sourceId, "error", message);
  }
}

export async function reprocessDocument(documentId: string, sourceId: string) {
  await requireAdminUser();
  const refreshed = await refreshUrlDocumentContent(documentId);
  if (!refreshed.ok) {
    redirectWithKnowledgeNotice(sourceId, "notice", refreshed.error);
  }
  if (refreshed.doc.status === "awaiting_review") {
    revalidatePath(`/knowledge-sources/${sourceId}`);
    redirectWithKnowledgeNotice(sourceId, "notice", "Document wacht op extractie-controle.");
  }
  const result = await processDocument(documentId);
  revalidatePath(`/knowledge-sources/${sourceId}`);
  if (!result.ok) {
    redirectWithKnowledgeNotice(sourceId, "notice", result.error);
  }
}

export async function processAllPending(sourceId: string) {
  await requireAdminUser();
  await processPendingDocumentsForSource(sourceId);
  revalidatePath(`/knowledge-sources/${sourceId}`);
}
