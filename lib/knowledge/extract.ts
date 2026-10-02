import { createHash } from "crypto";
import { assessPdfExtractQuality } from "@/lib/knowledge/pdf-text-quality";
import type { DocumentSourceType } from "@/lib/types/database";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

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

export async function extractTextFromBuffer(
  buffer: Buffer,
  sourceType: DocumentSourceType,
): Promise<string> {
  if (sourceType === "pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(buffer);
      const text = parsed.text?.trim() ?? "";
      const quality = assessPdfExtractQuality(text);
      if (!quality.ok) {
        throw new Error(quality.message);
      }
      return text;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`PDF text extraction failed: ${detail}`);
    }
  }
  return buffer.toString("utf8").trim();
}

export function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
