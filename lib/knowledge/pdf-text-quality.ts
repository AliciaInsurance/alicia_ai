/** Detect PDF text extraction that only captured layout lines / no readable copy. */
export function assessPdfExtractQuality(text: string): { ok: true } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      message:
        "Geen tekst uit deze PDF gehaald. Waarschijnlijk een scan of plaatjes-PDF — gebruik een PDF met selecteerbare tekst, een .txt-URL, of plak de tekst handmatig.",
    };
  }

  const letters = (trimmed.match(/[\p{L}]/gu) ?? []).length;
  const nonSpace = trimmed.replace(/\s/g, "").length;

  if (nonSpace < 80) {
    return {
      ok: false,
      message:
        "Te weinig tekst uit deze PDF (minder dan ~80 tekens). Controleer of de PDF kopieerbare tekst heeft.",
    };
  }

  if (letters === 0 || letters / nonSpace < 0.08) {
    return {
      ok: false,
      message:
        "PDF bevat vrijwel geen leesbare tekst (alleen lijnen/streepjes). Dit is geen URL-probleem: de PDF heeft geen bruikbare tekstlaag. Exporteer opnieuw met tekst, zet een .txt op assets, of voeg een FAQ handmatig toe.",
    };
  }

  return { ok: true };
}
