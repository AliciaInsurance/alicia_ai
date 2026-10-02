export const MAX_KNOWLEDGE_FILE_BYTES = 8 * 1024 * 1024;

export const UNSUPPORTED_PDF_MESSAGE =
  "Dit PDF-bestand bevat geen bruikbare tekstlaag. Voeg een OCR-/tekstversie toe of plak de tekst handmatig.";

export const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
  manual_text: "Tekst",
  document: "Bestand",
  web: "Link",
  structured_data: "Data",
};
