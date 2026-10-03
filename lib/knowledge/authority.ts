/** Lower rank = higher authority when reranking retrieval results. */

export const AUTHORITY_RANK_HINT = {
  voorwaarden: 10,
  ipid: 25,
  algemeen: 50,
  faq: 80,
} as const;

export function suggestAuthorityRank(documentType: string | null | undefined): number {
  const d = (documentType ?? "").toLowerCase();
  if (d.includes("voorwaard") || d.includes("polis") || d.includes("policy")) {
    return AUTHORITY_RANK_HINT.voorwaarden;
  }
  if (d.includes("ipid")) return AUTHORITY_RANK_HINT.ipid;
  if (d.includes("faq")) return AUTHORITY_RANK_HINT.faq;
  return AUTHORITY_RANK_HINT.algemeen;
}

export function effectiveAuthorityRank(
  authorityRank: number | null | undefined,
  documentType: string | null | undefined,
): number {
  if (typeof authorityRank === "number" && authorityRank >= 1 && authorityRank <= 100) {
    return authorityRank;
  }
  return suggestAuthorityRank(documentType);
}

export type ProductHint = "AVB" | "BAV" | "AOV" | "UNKNOWN";

export function detectProductsInText(text: string): ProductHint[] {
  const lower = text.toLowerCase();
  const found = new Set<ProductHint>();
  if (/\bavb\b|bedrijfsaansprakelijk|aansprakelijkheidsverzekering voor bedrijven/.test(lower)) {
    found.add("AVB");
  }
  if (/\bbav\b|beroepsaansprakelijk|professional indemnity/.test(lower)) {
    found.add("BAV");
  }
  if (/\baov\b|arbeidsongeschiktheid|eigen risico.*(dagen|dag)/.test(lower)) {
    found.add("AOV");
  }
  return [...found];
}

export function productFromDocumentField(product: string | null | undefined): ProductHint {
  const p = (product ?? "").trim().toUpperCase();
  if (p === "AVB" || p === "BAV" || p === "AOV") return p;
  if (p.includes("AVB")) return "AVB";
  if (p.includes("BAV")) return "BAV";
  if (p.includes("AOV")) return "AOV";
  return "UNKNOWN";
}

/** Penalty 0..0.35 when chunk product conflicts with query focus. */
export function productMismatchPenalty(
  queryProducts: ProductHint[],
  chunkProduct: ProductHint,
): number {
  if (chunkProduct === "UNKNOWN" || queryProducts.length === 0) return 0;
  if (queryProducts.includes(chunkProduct)) return 0;
  return 0.35;
}

export function rerankRetrievalScore(
  similarity: number,
  authorityRank: number,
  productPenalty: number,
): number {
  const authorityBoost = (100 - authorityRank) / 400;
  return similarity + authorityBoost - productPenalty;
}
