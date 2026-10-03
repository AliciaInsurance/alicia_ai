import { detectProductsInText, productFromDocumentField } from "@/lib/knowledge/authority";
import type { StructuredDataPayload } from "@/lib/types/database";

const ROW_PRODUCT_KEYS = [
  "product",
  "Product",
  "PRODUCT",
  "verzekering",
  "Verzekering",
  "productcode",
  "Productcode",
];

export function normalizeChunkProductCode(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const hint = productFromDocumentField(value);
  return hint === "UNKNOWN" ? value.trim().toUpperCase() : hint;
}

/** Product tag from a structured FAQ/data row. */
export function resolveRowProduct(row: Record<string, string>): string | null {
  for (const key of ROW_PRODUCT_KEYS) {
    const fromColumn = normalizeChunkProductCode(row[key]);
    if (fromColumn) return fromColumn;
  }
  const found = new Set<string>();
  for (const val of Object.values(row)) {
    for (const p of detectProductsInText(val)) {
      found.add(p);
    }
  }
  if (found.size === 1) return [...found][0]!;
  return null;
}

export type ChunkProductMetadata = {
  chunk_product: string | null;
  product_neutral: boolean;
};

/**
 * Classify chunk product metadata at ingest time.
 * Mixed product signals without an explicit tag are NOT neutral (unsafe for filtered retrieval).
 */
export function classifyChunkProductMetadata(params: {
  content: string;
  documentProduct: string | null;
  documentProductNeutral: boolean;
  rowProduct?: string | null;
}): ChunkProductMetadata {
  if (params.documentProductNeutral) {
    return { chunk_product: null, product_neutral: true };
  }

  const rowProduct = normalizeChunkProductCode(params.rowProduct);
  if (rowProduct) {
    return { chunk_product: rowProduct, product_neutral: false };
  }

  const docProduct = normalizeChunkProductCode(params.documentProduct);
  if (docProduct) {
    return { chunk_product: docProduct, product_neutral: false };
  }

  const inContent = detectProductsInText(params.content);
  if (inContent.length === 1) {
    return { chunk_product: inContent[0]!, product_neutral: false };
  }
  if (inContent.length === 0) {
    return { chunk_product: null, product_neutral: true };
  }

  return { chunk_product: null, product_neutral: false };
}

export type EffectiveChunkProduct = {
  chunk_product: string | null;
  document_product: string | null;
  product_neutral: boolean;
  effective_product: string | null;
  eligibility: "neutral" | "specific" | "untagged_mixed";
};

export function effectiveChunkProduct(params: {
  chunkProduct: string | null | undefined;
  chunkNeutral: boolean | undefined;
  documentProduct: string | null | undefined;
  documentNeutral: boolean | undefined;
  content: string;
}): EffectiveChunkProduct {
  const document_product = normalizeChunkProductCode(params.documentProduct);
  const chunk_product = normalizeChunkProductCode(params.chunkProduct);
  const product_neutral = Boolean(params.chunkNeutral || params.documentNeutral);

  if (product_neutral) {
    return {
      chunk_product,
      document_product,
      product_neutral: true,
      effective_product: null,
      eligibility: "neutral",
    };
  }

  if (chunk_product) {
    return {
      chunk_product,
      document_product,
      product_neutral: false,
      effective_product: chunk_product,
      eligibility: "specific",
    };
  }

  if (document_product) {
    return {
      chunk_product: null,
      document_product,
      product_neutral: false,
      effective_product: document_product,
      eligibility: "specific",
    };
  }

  const inContent = detectProductsInText(params.content);
  if (inContent.length === 1) {
    return {
      chunk_product: null,
      document_product: null,
      product_neutral: false,
      effective_product: inContent[0]!,
      eligibility: "specific",
    };
  }
  if (inContent.length === 0) {
    return {
      chunk_product: null,
      document_product: null,
      product_neutral: true,
      effective_product: null,
      eligibility: "neutral",
    };
  }

  return {
    chunk_product: null,
    document_product: null,
    product_neutral: false,
    effective_product: null,
    eligibility: "untagged_mixed",
  };
}

/** When resolved product is known, is this chunk eligible? */
export function chunkEligibleForResolvedProduct(
  resolvedProduct: string | null,
  meta: EffectiveChunkProduct,
): boolean {
  if (!resolvedProduct) return true;
  if (meta.eligibility === "neutral") return true;
  if (meta.eligibility === "untagged_mixed") return false;
  return meta.effective_product === resolvedProduct;
}

export function structuredDataToRowSegments(
  data: StructuredDataPayload,
): { content: string; rowProduct: string | null }[] {
  return data.rows.map((row) => ({
    content: data.headers.map((h) => `${h}: ${row[h] ?? ""}`).join(" | "),
    rowProduct: resolveRowProduct(row),
  }));
}
