"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  assertFileSize,
  detectSourceType,
  extractTextFromBuffer,
  hashContent,
  sanitizeFilename,
} from "@/lib/knowledge/extract";
import { fetchUrlContent } from "@/lib/knowledge/fetch-url";
import { processDocument, processPendingDocumentsForSource } from "@/lib/knowledge/process-document";
import { refreshUrlDocumentContent } from "@/lib/knowledge/refresh-url-document";
import { createAdminClient } from "@/lib/supabase/admin";

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

  try {
    assertFileSize(file.size);
    const filename = sanitizeFilename(file.name);
    const sourceType = detectSourceType(file.type, filename);
    if (!sourceType) {
      redirectWithKnowledgeNotice(sourceId, "error", "Bestandstype niet ondersteund (PDF, txt, md).");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromBuffer(buffer, sourceType);
    if (!text) {
      redirectWithKnowledgeNotice(sourceId, "error", "Geen tekst uit dit bestand gehaald.");
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_documents")
      .insert({
        knowledge_source_id: sourceId,
        title: filename,
        filename,
        mime_type: file.type || null,
        source_type: sourceType,
        status: "uploaded",
        raw_text: text,
        content_hash: hashContent(text),
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
        `Bestand opgeslagen; embeddings mislukt: ${processed.error}. Controleer OPENAI_API_KEY en vector/DB.`,
      );
    }
  } catch (err) {
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

  try {
    const fetched = await fetchUrlContent(url);
    const title = titleOverride || fetched.title || url;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_documents")
      .insert({
        knowledge_source_id: sourceId,
        title,
        source_type: "url",
        source_url: url,
        mime_type: fetched.mimeType,
        status: "uploaded",
        raw_text: fetched.text,
        content_hash: hashContent(fetched.text),
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
        `URL opgeslagen; verwerken mislukt: ${processed.error}`,
      );
    }
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : "URL toevoegen mislukt";
    console.error("[addUrlDocument]", err);
    redirectWithKnowledgeNotice(sourceId, "error", message);
  }
}

export async function reprocessDocument(documentId: string, sourceId: string) {
  await requireAdminUser();
  const refreshed = await refreshUrlDocumentContent(documentId);
  if (!refreshed.ok) {
    redirectWithKnowledgeNotice(sourceId, "notice", refreshed.error);
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
