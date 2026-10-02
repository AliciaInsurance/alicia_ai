import { createHash } from "crypto";
import { parsePdfTextLayer } from "@/lib/knowledge/pdf-text-extract";
import { assessPdfTextQuality } from "@/lib/knowledge/pdf-text-quality";
import { PDF_LIMITS } from "@/lib/knowledge/pdf-limits";
import type { DocumentSourceType } from "@/lib/types/database";

export const MAX_FILE_BYTES = PDF_LIMITS.maxFileBytes;

const ALLOWED_MIME: Record<string, DocumentSourceType> = {
  "application/pdf": "pdf",
  "text/plain": "text",
  "text/markdown": "markdown",
};

export function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return base || "document";
}

export function detectSourceType(mimeType: string, filename: string): DocumentSourceType | null {
  if (ALLOWED_MIME[mimeType]) return ALLOWED_MIME[mimeType];
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".txt")) return "text";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

export function assertFileSize(size: number) {
  if (size > MAX_FILE_BYTES) {
    throw new Error("File exceeds maximum size of 8MB");
  }
}

/** Text/markdown and text-layer PDF only (no vision fallback). Prefer ingestPdfBuffer for PDFs. */
export async function extractTextFromBuffer(
  buffer: Buffer,
  sourceType: DocumentSourceType,
): Promise<string> {
  if (sourceType === "pdf") {
    const { text, pageCount } = await parsePdfTextLayer(buffer);
    const assessment = assessPdfTextQuality(text, pageCount);
    if (assessment.quality !== "good") {
      throw new Error(assessment.reason);
    }
    return text;
  }
  return buffer.toString("utf8").trim();
}

export function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
