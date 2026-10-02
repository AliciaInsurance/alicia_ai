export type PdfParseResult = {
  text: string;
  pageCount: number;
};

export async function parsePdfTextLayer(buffer: Buffer): Promise<PdfParseResult> {
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);
  const text = parsed.text?.trim() ?? "";
  const pageCount =
    typeof parsed.numpages === "number" && parsed.numpages > 0 ? parsed.numpages : 1;
  return { text, pageCount };
}
