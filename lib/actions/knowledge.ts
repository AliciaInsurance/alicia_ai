"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/admin";
import { UNSUPPORTED_PDF_MESSAGE } from "@/lib/knowledge/constants";
import { extractDocumentBuffer } from "@/lib/knowledge/extract-document";
import {
  assertFileSize,
  detectFileFormat,
  hashContent,
  parseOptionalDate,
  sanitizeFilename,
} from "@/lib/knowledge/extract";
import { fetchWebContent } from "@/lib/knowledge/fetch-web";
import { parseCsvBuffer, parseJsonBuffer } from "@/lib/knowledge/parse-structured";
import { processKnowledgeItem } from "@/lib/knowledge/process-item";
import { refreshWebKnowledgeItem } from "@/lib/knowledge/refresh-web-item";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KnowledgeItem } from "@/lib/types/database";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function itemPath(sourceId: string, itemId: string) {
  return `/knowledge-sources/${sourceId}/items/${itemId}`;
}

function redirectItemNotice(
  sourceId: string,
  itemId: string,
  kind: "error" | "notice",
  message: string,
): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`${itemPath(sourceId, itemId)}?${params.toString()}`);
}

function redirectSourceNotice(sourceId: string, kind: "error" | "notice", message: string): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`/knowledge-sources/${sourceId}?${params.toString()}`);
}

function metadataFromForm(formData: FormData) {
  return {
    category: String(formData.get("category") ?? "").trim() || null,
    owner: String(formData.get("owner") ?? "").trim() || null,
    version_label: String(formData.get("version_label") ?? "").trim() || null,
    product: String(formData.get("product") ?? "").trim() || null,
    document_type: String(formData.get("document_type") ?? "").trim() || null,
    valid_from: parseOptionalDate(String(formData.get("valid_from") ?? "")),
    valid_until: parseOptionalDate(String(formData.get("valid_until") ?? "")),
  };
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

export async function addManualTextItem(sourceId: string, formData: FormData) {
  await requireAdminUser();
  const title = String(formData.get("title") ?? "").trim() || "Tekst";
  const text = String(formData.get("text") ?? "").trim();
  const saveAsDraft = formData.get("save_as_draft") === "on";
  if (!text) redirectSourceNotice(sourceId, "error", "Tekst is verplicht.");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      knowledge_source_id: sourceId,
      title,
      knowledge_type: "manual_text",
      source_type: "manual",
      status: "uploaded",
      review_status: saveAsDraft ? "draft" : "pending_review",
      raw_text: text,
      content_hash: hashContent(text),
      ...metadataFromForm(formData),
    })
    .select("id")
    .single();

  if (error) redirectSourceNotice(sourceId, "error", error.message);

  if (!saveAsDraft) {
    const processed = await processKnowledgeItem(data.id);
    if (!processed.ok) {
      redirectItemNotice(sourceId, data.id, "notice", processed.error);
    }
  }

  revalidatePath(`/knowledge-sources/${sourceId}`);
  redirect(itemPath(sourceId, data.id));
}

export async function uploadDocumentItem(sourceId: string, formData: FormData) {
  await requireAdminUser();
  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    redirectSourceNotice(sourceId, "error", "Kies een bestand.");
  }

  const supabase = createAdminClient();
  try {
    assertFileSize(fileEntry.size);
    const filename = sanitizeFilename(fileEntry.name);
    const format = detectFileFormat(fileEntry.type, filename);
    if (!format || !["pdf", "text", "markdown"].includes(format)) {
      redirectSourceNotice(sourceId, "error", "Alleen PDF, TXT of MD.");
    }

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const meta = metadataFromForm(formData);
    const title = String(formData.get("title") ?? "").trim() || filename;

    if (format === "pdf" || format === "text" || format === "markdown") {
      const extracted = await extractDocumentBuffer(
        buffer,
        format === "pdf" ? "pdf" : format === "markdown" ? "markdown" : "text",
      );

      if (!extracted.ok) {
        const { data: unsupportedRow } = await supabase
          .from("knowledge_documents")
          .insert({
            knowledge_source_id: sourceId,
            title,
            filename,
            mime_type: fileEntry.type || null,
            knowledge_type: "document",
            source_type: format,
            status: "unsupported",
            review_status: "pending_review",
            error_message: extracted.message,
            ...meta,
          })
          .select("id")
          .single();
        revalidatePath(`/knowledge-sources/${sourceId}`);
        redirect(itemPath(sourceId, unsupportedRow!.id));
      }

      const { data, error } = await supabase
        .from("knowledge_documents")
        .insert({
          knowledge_source_id: sourceId,
          title,
          filename,
          mime_type: fileEntry.type || null,
          content_type: fileEntry.type || null,
          knowledge_type: "document",
          source_type: format,
          status: "uploaded",
          review_status: "pending_review",
          raw_text: extracted.text,
          content_hash: hashContent(extracted.text),
          ...meta,
        })
        .select("id")
        .single();

      if (error) redirectSourceNotice(sourceId, "error", error.message);
      const processed = await processKnowledgeItem(data.id);
      revalidatePath(`/knowledge-sources/${sourceId}`);
      if (!processed.ok) redirectItemNotice(sourceId, data.id, "notice", processed.error);
      redirect(itemPath(sourceId, data.id));
    }

    redirectSourceNotice(sourceId, "error", "Bestandstype niet ondersteund.");
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : "Upload mislukt";
    redirectSourceNotice(sourceId, "error", message);
  }
}

export async function addWebItem(sourceId: string, formData: FormData) {
  await requireAdminUser();
  const url = String(formData.get("url") ?? "").trim();
  if (!url) redirectSourceNotice(sourceId, "error", "URL is verplicht.");

  const supabase = createAdminClient();
  try {
    const fetched = await fetchWebContent(url);
    const title = String(formData.get("title") ?? "").trim() || fetched.title || url;
    const now = new Date().toISOString();
    const meta = metadataFromForm(formData);

    if (fetched.kind === "unsupported") {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .insert({
          knowledge_source_id: sourceId,
          title,
          knowledge_type: "web",
          source_type: "url",
          source_url: url,
          content_type: fetched.contentType,
          fetched_at: now,
          last_refresh_at: now,
          status: "unsupported",
          review_status: "pending_review",
          error_message: fetched.unsupportedMessage ?? UNSUPPORTED_PDF_MESSAGE,
          ...meta,
        })
        .select("id")
        .single();
      if (error) redirectSourceNotice(sourceId, "error", error.message);
      revalidatePath(`/knowledge-sources/${sourceId}`);
      redirect(itemPath(sourceId, data.id));
    }

    const knowledge_type = fetched.kind === "html" ? "web" : "document";

    const { data, error } = await supabase
      .from("knowledge_documents")
      .insert({
        knowledge_source_id: sourceId,
        title,
        knowledge_type,
        source_type: "url",
        source_url: url,
        content_type: fetched.contentType,
        fetched_at: now,
        last_refresh_at: now,
        status: "uploaded",
        review_status: "pending_review",
        raw_text: fetched.text,
        content_hash: hashContent(fetched.text),
        ...meta,
      })
      .select("id")
      .single();

    if (error) redirectSourceNotice(sourceId, "error", error.message);

    const processed = await processKnowledgeItem(data.id);
    revalidatePath(`/knowledge-sources/${sourceId}`);
    if (!processed.ok) redirectItemNotice(sourceId, data.id, "notice", processed.error);
    redirect(itemPath(sourceId, data.id));
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : "URL toevoegen mislukt";
    redirectSourceNotice(sourceId, "error", message);
  }
}

export async function uploadStructuredDataItem(sourceId: string, formData: FormData) {
  await requireAdminUser();
  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    redirectSourceNotice(sourceId, "error", "Kies een CSV- of JSON-bestand.");
  }

  try {
    assertFileSize(fileEntry.size);
    const filename = sanitizeFilename(fileEntry.name);
    const format = detectFileFormat(fileEntry.type, filename);
    if (!format || (format !== "csv" && format !== "json")) {
      redirectSourceNotice(sourceId, "error", "Alleen CSV of JSON.");
    }

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const structured =
      format === "csv" ? parseCsvBuffer(buffer) : parseJsonBuffer(buffer);
    const title = String(formData.get("title") ?? "").trim() || filename;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_documents")
      .insert({
        knowledge_source_id: sourceId,
        title,
        filename,
        mime_type: fileEntry.type || null,
        content_type: fileEntry.type || null,
        knowledge_type: "structured_data",
        source_type: format,
        status: "uploaded",
        review_status: "pending_review",
        structured_data: structured,
        ...metadataFromForm(formData),
      })
      .select("id")
      .single();

    if (error) redirectSourceNotice(sourceId, "error", error.message);

    const processed = await processKnowledgeItem(data.id);
    revalidatePath(`/knowledge-sources/${sourceId}`);
    if (!processed.ok) redirectItemNotice(sourceId, data.id, "notice", processed.error);
    redirect(itemPath(sourceId, data.id));
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    const message = err instanceof Error ? err.message : "Upload mislukt";
    redirectSourceNotice(sourceId, "error", message);
  }
}

export async function updateKnowledgeItem(itemId: string, sourceId: string, formData: FormData) {
  await requireAdminUser();
  const title = String(formData.get("title") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  const supabase = createAdminClient();
  const payload: Record<string, unknown> = {
    title: title || undefined,
    ...metadataFromForm(formData),
  };

  if (text) {
    payload.raw_text = text;
    payload.content_hash = hashContent(text);
  }

  const { error } = await supabase.from("knowledge_documents").update(payload).eq("id", itemId);
  if (error) redirectItemNotice(sourceId, itemId, "error", error.message);

  revalidatePath(itemPath(sourceId, itemId));
  revalidatePath(`/knowledge-sources/${sourceId}`);
}

export async function approveKnowledgeItem(itemId: string, sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("id", itemId)
    .single();

  const item = row as KnowledgeItem | null;
  if (!item) redirectItemNotice(sourceId, itemId, "error", "Item niet gevonden.");

  if (item.status !== "ready" && item.status !== "uploaded") {
    const processed = await processKnowledgeItem(itemId);
    if (!processed.ok) redirectItemNotice(sourceId, itemId, "notice", processed.error);
  }

  await supabase
    .from("knowledge_documents")
    .update({ review_status: "approved", status: "ready" })
    .eq("id", itemId);

  revalidatePath(itemPath(sourceId, itemId));
  revalidatePath(`/knowledge-sources/${sourceId}`);
  redirectItemNotice(sourceId, itemId, "notice", "Kennisitem goedgekeurd en actief voor retrieval.");
}

export async function rejectKnowledgeItem(itemId: string, sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  await supabase.from("knowledge_chunks").delete().eq("document_id", itemId);
  await supabase
    .from("knowledge_documents")
    .update({ review_status: "rejected", status: "failed" })
    .eq("id", itemId);

  revalidatePath(itemPath(sourceId, itemId));
  revalidatePath(`/knowledge-sources/${sourceId}`);
}

export async function reprocessKnowledgeItem(itemId: string, sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("knowledge_documents")
    .select("knowledge_type")
    .eq("id", itemId)
    .single();

  if ((row as KnowledgeItem | null)?.knowledge_type === "web") {
    const refreshed = await refreshWebKnowledgeItem(itemId);
    if (!refreshed.ok) redirectItemNotice(sourceId, itemId, "notice", refreshed.error);
  }

  const result = await processKnowledgeItem(itemId);
  revalidatePath(itemPath(sourceId, itemId));
  revalidatePath(`/knowledge-sources/${sourceId}`);
  if (!result.ok) redirectItemNotice(sourceId, itemId, "notice", result.error);
}

export async function deleteKnowledgeItem(itemId: string, sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  await supabase.from("knowledge_documents").delete().eq("id", itemId);
  revalidatePath(`/knowledge-sources/${sourceId}`);
  redirect(`/knowledge-sources/${sourceId}`);
}

/** @deprecated No-op batch helper kept for assistant page compatibility */
export async function processAllPending(sourceId: string) {
  await requireAdminUser();
  const supabase = createAdminClient();
  const { data: items } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("knowledge_source_id", sourceId)
    .eq("status", "uploaded");

  for (const item of items ?? []) {
    await processKnowledgeItem(item.id);
  }
  revalidatePath(`/knowledge-sources/${sourceId}`);
}
