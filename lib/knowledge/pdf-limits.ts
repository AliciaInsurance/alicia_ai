/** Tunable guardrails for synchronous PDF / vision ingestion (no background queue). */

export const PDF_LIMITS = {
  /** Matches upload / URL fetch cap */
  maxFileBytes: 8 * 1024 * 1024,
  /** Vision extraction runs page-by-page synchronously */
  maxVisionPages: 40,
  /** Per-page vision call timeout */
  visionPageTimeoutMs: 90_000,
  /** Total vision extraction budget for one document */
  visionTotalTimeoutMs: 12 * 60_000,
} as const;

export const PDF_TOO_LARGE_MESSAGE =
  "Dit document is te groot voor directe verwerking. Splits het document of voeg background processing toe.";

export function assertPdfWithinSizeLimits(byteLength: number): void {
  if (byteLength > PDF_LIMITS.maxFileBytes) {
    throw new Error(PDF_TOO_LARGE_MESSAGE);
  }
  if (byteLength === 0) {
    throw new Error("Leeg PDF-bestand");
  }
}

export function assertPdfWithinPageLimits(pageCount: number): void {
  if (pageCount <= 0) {
    throw new Error("PDF bevat geen pagina's");
  }
  if (pageCount > PDF_LIMITS.maxVisionPages) {
    throw new Error(PDF_TOO_LARGE_MESSAGE);
  }
}
