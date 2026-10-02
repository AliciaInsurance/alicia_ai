import { assertPdfWithinSizeLimits } from "@/lib/knowledge/pdf-limits";
import { parsePdfTextLayer } from "@/lib/knowledge/pdf-text-extract";
import { assessPdfTextQuality } from "@/lib/knowledge/pdf-text-quality";
import { extractPdfWithVision } from "@/lib/knowledge/pdf-vision-extract";
import type { ExtractionMethod, ExtractionQuality, ExtractionReviewStatus } from "@/lib/types/database";

export type PdfIngestResult = {
  text: string;
  extractionMethod: ExtractionMethod;
  extractionQuality: ExtractionQuality;
  extractionReason: string;
  pageCount: number;
  extractionReviewStatus: ExtractionReviewStatus;
  requiresReview: boolean;
};

/**
 * PDF ingestion: text layer first, vision fallback when quality is poor.
 */
export async function ingestPdfBuffer(buffer: Buffer): Promise<PdfIngestResult> {
  assertPdfWithinSizeLimits(buffer.length);

  const { text: textLayer, pageCount } = await parsePdfTextLayer(buffer);
  const assessment = assessPdfTextQuality(textLayer, pageCount);

  if (assessment.quality === "good") {
    return {
      text: textLayer,
      extractionMethod: "text",
      extractionQuality: "good",
      extractionReason: assessment.reason,
      pageCount,
      extractionReviewStatus: "not_required",
      requiresReview: false,
    };
  }

  try {
    const vision = await extractPdfWithVision(buffer);
    return {
      text: vision.text,
      extractionMethod: "vision",
      extractionQuality: assessment.quality === "failed" ? "poor" : "poor",
      extractionReason: `${assessment.reason} Vision-fallback toegepast.`,
      pageCount: vision.pageCount,
      extractionReviewStatus: "pending",
      requiresReview: true,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF-extractie mislukt: ${detail}`);
  }
}
