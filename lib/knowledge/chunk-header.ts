import type { KnowledgeItem } from "@/lib/types/database";
import { effectiveAuthorityRank } from "@/lib/knowledge/authority";

/** Prefix embedded in chunk text so retrieval matches product/document context. */
export function buildKnowledgeChunkHeader(item: Pick<
  KnowledgeItem,
  "title" | "product" | "document_type" | "knowledge_type" | "authority_rank"
>): string {
  const parts = [
    item.product?.trim(),
    item.document_type?.trim(),
    item.title?.trim(),
  ].filter(Boolean);

  const rank = effectiveAuthorityRank(item.authority_rank, item.document_type);
  const typeLabel = item.knowledge_type.replace("_", " ");

  return `[Kennis | type=${typeLabel} | prioriteit=${rank}${parts.length ? ` | ${parts.join(" | ")}` : ""}]\n`;
}
