import { createHash } from "crypto";
import { MAX_KNOWLEDGE_FILE_BYTES } from "@/lib/knowledge/constants";

export const MAX_FILE_BYTES = MAX_KNOWLEDGE_FILE_BYTES;

export type FileFormat = "pdf" | "text" | "markdown" | "csv" | "json";

const ALLOWED_MIME: Record<string, FileFormat> = {
  "application/pdf": "pdf",
  "text/plain": "text",
  "text/markdown": "markdown",
  "text/csv": "csv",
  "application/json": "json",
};

export function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return base || "document";
}

export function detectFileFormat(mimeType: string, filename: string): FileFormat | null {
  if (ALLOWED_MIME[mimeType]) return ALLOWED_MIME[mimeType];
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".txt")) return "text";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".json")) return "json";
  return null;
}

export function assertFileSize(size: number) {
  if (size > MAX_FILE_BYTES) {
    throw new Error("File exceeds maximum size of 8MB");
  }
}

export function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function parseOptionalDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
