import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/knowledge/embeddings";
import { CHUNK_CONFIG } from "@/lib/knowledge/chunking";
import {
  effectiveAuthorityRank,
  productFromDocumentField,
  productMismatchPenalty,
  rerankRetrievalScore,
  type ProductHint,
} from "@/lib/knowledge/authority";
import { log } from "@/lib/logger";
import type { KnowledgeItem, MatchedChunk } from "@/lib/types/database";
import type { AssistantSource } from "@/lib/types/supabase-database";

export type RetrievedChunk = MatchedChunk & {
  document_title: string;
  document_type: string | null;
  product: string | null;
  authority_rank: number;
  rerank_score: number;
};

export type RetrievalContext = {
  assistantId: string;
  product: string | null;
  topic: string | null;
  intent: string | null;
  searchQueries: string[];
};

export async function getAssistantSourceIds(assistantId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_sources")
    .select("knowledge_source_id")
    .eq("assistant_id", assistantId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as AssistantSource[]).map((r) => r.knowledge_source_id);
}

function selectWithDocumentCap(
  ranked: RetrievedChunk[],
  limit: number,
  maxPerDocument: number,
): RetrievedChunk[] {
  const perDoc = new Map<string, number>();
  const out: RetrievedChunk[] = [];
  for (const chunk of ranked) {
    const count = perDoc.get(chunk.document_id) ?? 0;
    if (count >= maxPerDocument) continue;
    perDoc.set(chunk.document_id, count + 1);
    out.push(chunk);
    if (out.length >= limit) break;
  }
  return out;
}

function chunkMatchesProduct(
  docProduct: string | null | undefined,
  resolvedProduct: string | null,
): boolean {
  if (!resolvedProduct) return true;
  const chunkProduct = productFromDocumentField(docProduct);
  if (chunkProduct === "UNKNOWN") return true;
  return chunkProduct === resolvedProduct;
}

async function vectorSearchForQuery(
  sourceIds: string[],
  queryEmbedding: number[],
  matchCount: number,
  product: string | null,
): Promise<MatchedChunk[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_source_ids: sourceIds,
    match_count: matchCount,
    match_product: product ?? undefined,
  });

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as MatchedChunk[];
}

function mergeByBestSimilarity(chunks: MatchedChunk[]): MatchedChunk[] {
  const byId = new Map<string, MatchedChunk>();
  for (const chunk of chunks) {
    const existing = byId.get(chunk.id);
    if (!existing || chunk.similarity > existing.similarity) {
      byId.set(chunk.id, chunk);
    }
  }
  return [...byId.values()];
}

export async function retrieveRelevantKnowledge(
  ctx: RetrievalContext,
): Promise<RetrievedChunk[]> {
  const sourceIds = await getAssistantSourceIds(ctx.assistantId);
  const queries = ctx.searchQueries.map((q) => q.trim()).filter(Boolean).slice(0, 3);

  if (sourceIds.length === 0 || queries.length === 0) return [];

  const started = Date.now();
  const embeddings = await embedTexts(queries);
  const perQueryCount = Math.max(
    CHUNK_CONFIG.retrievalCandidateCount,
    Math.ceil(CHUNK_CONFIG.retrievalCandidateCount / queries.length) + 4,
  );

  const rawLists = await Promise.all(
    embeddings.map((embedding) =>
      vectorSearchForQuery(sourceIds, embedding, perQueryCount, ctx.product),
    ),
  );

  const merged = mergeByBestSimilarity(rawLists.flat());
  const aboveThreshold = merged.filter(
    (c) => c.similarity >= CHUNK_CONFIG.similarityThreshold,
  );

  if (aboveThreshold.length === 0) {
    log.info("retrieval_complete", {
      assistantId: ctx.assistantId,
      sourceCount: sourceIds.length,
      matchCount: 0,
      product: ctx.product,
      queryCount: queries.length,
      latencyMs: Date.now() - started,
    });
    return [];
  }

  const docIds = [...new Set(aboveThreshold.map((c) => c.document_id))];
  const supabase = createAdminClient();
  const { data: docRows } = await supabase
    .from("knowledge_documents")
    .select("id, title, document_type, product, authority_rank")
    .in("id", docIds);

  const docMap = new Map(
    ((docRows ?? []) as Pick<
      KnowledgeItem,
      "id" | "title" | "document_type" | "product" | "authority_rank"
    >[]).map((d) => [d.id, d]),
  );

  const queryProducts: ProductHint[] = ctx.product ? [ctx.product as ProductHint] : [];

  const ranked: RetrievedChunk[] = aboveThreshold
    .filter((chunk) => {
      const doc = docMap.get(chunk.document_id);
      return chunkMatchesProduct(doc?.product, ctx.product);
    })
    .map((chunk) => {
      const doc = docMap.get(chunk.document_id);
      const authority = effectiveAuthorityRank(doc?.authority_rank, doc?.document_type);
      const chunkProduct = productFromDocumentField(doc?.product);
      const penalty = productMismatchPenalty(queryProducts, chunkProduct);
      const rerank_score = rerankRetrievalScore(chunk.similarity, authority, penalty);

      return {
        ...chunk,
        document_title: doc?.title ?? "Onbekend document",
        document_type: doc?.document_type ?? null,
        product: doc?.product ?? null,
        authority_rank: authority,
        rerank_score,
      };
    });

  ranked.sort((a, b) => b.rerank_score - a.rerank_score);

  const selected = selectWithDocumentCap(
    ranked,
    CHUNK_CONFIG.retrievalCount,
    CHUNK_CONFIG.maxChunksPerDocument,
  );

  log.info("retrieval_complete", {
    assistantId: ctx.assistantId,
    sourceCount: sourceIds.length,
    candidateCount: aboveThreshold.length,
    matchCount: selected.length,
    product: ctx.product,
    intent: ctx.intent,
    topic: ctx.topic,
    searchQueries: queries,
    latencyMs: Date.now() - started,
  });

  return selected;
}

/** @deprecated Use retrieveRelevantKnowledge */
export async function retrieveRelevantChunks(
  assistantId: string,
  query: string,
): Promise<RetrievedChunk[]> {
  return retrieveRelevantKnowledge({
    assistantId,
    product: null,
    topic: null,
    intent: null,
    searchQueries: [query],
  });
}
