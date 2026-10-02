export const PDF_VISION_TRANSCRIPTION_PROMPT = `You are a precise document transcription engine for insurance policy PDFs.

Rules (mandatory):
- Transcribe visible text only. Do NOT summarize, paraphrase, translate, or "improve" wording.
- Preserve exact wording, negations, amounts, dates, percentages, policy limits, exclusions, and article/clause numbering.
- Preserve headings, numbered lists, and tables as readable plain text or markdown tables where practical.
- Do NOT infer or invent text that is not clearly readable.
- If a section or fragment is unreadable, write exactly: [ONLEESBAAR]
- Output ONLY the transcribed document content for this page — no commentary.

This page is page {{PAGE}} of {{TOTAL}}. Begin your output with the line:
--- Pagina {{PAGE}} ---
then the transcribed content for this page only.`;

export function visionPromptForPage(page: number, total: number): string {
  return PDF_VISION_TRANSCRIPTION_PROMPT.replace(/\{\{PAGE\}\}/g, String(page)).replace(
    /\{\{TOTAL\}\}/g,
    String(total),
  );
}
