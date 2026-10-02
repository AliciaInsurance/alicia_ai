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
import { processDocument, processPendingDocumentsForSource } from "@/lib/knowledge/process-document";
import { createAdminClient } from "@/lib/supabase/admin";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
  if (!text) throw new Error("Text is required");

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

  if (error) throw new Error(error.message);
  await processDocument(data.id);
  revalidatePath(`/knowledge-sources/${sourceId}`);
}

export async function uploadDocument(sourceId: string, formData: FormData) {
  await requireAdminUser();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("File is required");

  assertFileSize(file.size);
  const filename = sanitizeFilename(file.name);
  const sourceType = detectSourceType(file.type, filename);
  if (!sourceType) throw new Error("Unsupported file type");

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromBuffer(buffer, sourceType);
  if (!text) throw new Error("Could not extract text from file");

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

  if (error) throw new Error(error.message);
  await processDocument(data.id);
  revalidatePath(`/knowledge-sources/${sourceId}`);
}

export async function reprocessDocument(documentId: string, sourceId: string) {
  await requireAdminUser();
  await processDocument(documentId);
  revalidatePath(`/knowledge-sources/${sourceId}`);
}

export async function processAllPending(sourceId: string) {
  await requireAdminUser();
  await processPendingDocumentsForSource(sourceId);
  revalidatePath(`/knowledge-sources/${sourceId}`);
}
