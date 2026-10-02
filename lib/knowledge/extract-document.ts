import { UNSUPPORTED_PDF_MESSAGE } from "@/lib/knowledge/constants";
import { parsePdfTextLayer } from "@/lib/knowledge/pdf-text-extract";
import { assessPdfTextQuality } from "@/lib/knowledge/pdf-text-quality";

export type DocumentExtractResult =
  | { ok: true; text: string; pageCount: number }
  | { ok: false; unsupported: true; message: string };

export async function extractDocumentBuffer(
  buffer: Buffer,
  format: "pdf" | "text" | "markdown",
): Promise<DocumentExtractResult> {
  if (format === "pdf") {
    const { text, pageCount } = await parsePdfTextLayer(buffer);
    const assessment = assessPdfTextQuality(text, pageCount);
    if (assessment.quality !== "good") {
      return { ok: false, unsupported: true, message: UNSUPPORTED_PDF_MESSAGE };
    }
    return { ok: true, text, pageCount };
  }
  const text = buffer.toString("utf8").trim();
  if (!text) {
    return { ok: false, unsupported: true, message: "Bestand bevat geen tekst." };
  }
  return { ok: true, text, pageCount: 1 };
}
