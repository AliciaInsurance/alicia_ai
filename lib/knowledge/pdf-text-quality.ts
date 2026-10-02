/** Deterministic assessment of pdf-parse text output (not a single magic threshold). */

export type PdfTextQualityLevel = "good" | "poor" | "failed";

export type PdfTextQualityAssessment = {
  quality: PdfTextQualityLevel;
  reason: string;
  stats: {
    charCount: number;
    nonWhitespaceCount: number;
    letterCount: number;
    whitespaceRatio: number;
    charsPerPage: number;
    replacementCharCount: number;
  };
};

export const PDF_TEXT_QUALITY_THRESHOLDS = {
  minNonWhitespaceChars: 80,
  minLetters: 40,
  minLetterRatio: 0.08,
  minCharsPerPage: 25,
  maxWhitespaceRatio: 0.92,
  maxReplacementRatio: 0.05,
} as const;

function countLetters(text: string): number {
  return (text.match(/[\p{L}]/gu) ?? []).length;
}

export function assessPdfTextQuality(
  text: string,
  pageCount: number,
): PdfTextQualityAssessment {
  const trimmed = text.trim();
  const charCount = trimmed.length;
  const nonWhitespaceCount = trimmed.replace(/\s/g, "").length;
  const letterCount = countLetters(trimmed);
  const whitespaceCount = charCount - nonWhitespaceCount;
  const whitespaceRatio = charCount > 0 ? whitespaceCount / charCount : 1;
  const pages = Math.max(pageCount, 1);
  const charsPerPage = nonWhitespaceCount / pages;
  const replacementCharCount = (trimmed.match(/\uFFFD/g) ?? []).length;
  const replacementRatio =
    nonWhitespaceCount > 0 ? replacementCharCount / nonWhitespaceCount : 0;

  const stats = {
    charCount,
    nonWhitespaceCount,
    letterCount,
    whitespaceRatio,
    charsPerPage,
    replacementCharCount,
  };

  if (!trimmed) {
    return {
      quality: "failed",
      reason: "Geen tekst uit PDF geëxtraheerd (waarschijnlijk scan/plaatjes).",
      stats,
    };
  }

  if (nonWhitespaceCount < PDF_TEXT_QUALITY_THRESHOLDS.minNonWhitespaceChars) {
    return {
      quality: "poor",
      reason: `Te weinig tekens (${nonWhitespaceCount} non-whitespace, drempel ${PDF_TEXT_QUALITY_THRESHOLDS.minNonWhitespaceChars}).`,
      stats,
    };
  }

  if (letterCount < PDF_TEXT_QUALITY_THRESHOLDS.minLetters) {
    return {
      quality: "poor",
      reason: `Te weinig letters (${letterCount}).`,
      stats,
    };
  }

  if (letterCount / nonWhitespaceCount < PDF_TEXT_QUALITY_THRESHOLDS.minLetterRatio) {
    return {
      quality: "poor",
      reason: "Tekst bevat vrijwel geen leesbare letters (layout/lijnen?).",
      stats,
    };
  }

  if (charsPerPage < PDF_TEXT_QUALITY_THRESHOLDS.minCharsPerPage) {
    return {
      quality: "poor",
      reason: `Gemiddeld te weinig tekst per pagina (${charsPerPage.toFixed(0)} tekens/pagina).`,
      stats,
    };
  }

  if (whitespaceRatio > PDF_TEXT_QUALITY_THRESHOLDS.maxWhitespaceRatio) {
    return {
      quality: "poor",
      reason: "Ongebruikelijk hoog whitespace-aandeel in extractie.",
      stats,
    };
  }

  if (replacementRatio > PDF_TEXT_QUALITY_THRESHOLDS.maxReplacementRatio) {
    return {
      quality: "poor",
      reason: "Veel vervangtekens () — extractie lijkt corrupt.",
      stats,
    };
  }

  return {
    quality: "good",
    reason: "Text-layer extractie voldoet aan kwaliteitsdrempels.",
    stats,
  };
}

/** @deprecated Use assessPdfTextQuality — kept for callers expecting ok/message shape */
export function assessPdfExtractQuality(
  text: string,
): { ok: true } | { ok: false; message: string } {
  const result = assessPdfTextQuality(text, 1);
  if (result.quality === "good") return { ok: true };
  return { ok: false, message: result.reason };
}
