import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/knowledge/embeddings";
import { CHUNK_CONFIG } from "@/lib/knowledge/chunking";
import {
  detectProductsInText,
  effectiveAuthorityRank,
  productFromDocumentField,
  productMismatchPenalty,
  rerankRetrievalScore,
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

export async function retrieveRelevantChunks(
  assistantId: string,
  query: string,
): Promise<RetrievedChunk[]> {
  const sourceIds = await getAssistantSourceIds(assistantId);
  if (sourceIds.length === 0 || !query.trim()) return [];

  const started = Date.now();
  const [queryEmbedding] = await embedTexts([query]);
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_source_ids: sourceIds,
    match_count: CHUNK_CONFIG.retrievalCandidateCount,
  });

  if (error) {
    log.error("retrieval_failed", { assistantId, message: error.message });
    throw new Error(error.message);
  }

  const rawChunks = (data ?? []) as MatchedChunk[];
  const aboveThreshold = rawChunks.filter(
    (c) => c.similarity >= CHUNK_CONFIG.similarityThreshold,
  );

  if (aboveThreshold.length === 0) {
    log.info("retrieval_complete", {
      assistantId,
      sourceCount: sourceIds.length,
      matchCount: 0,
      latencyMs: Date.now() - started,
    });
    return [];
  }

  const docIds = [...new Set(aboveThreshold.map((c) => c.document_id))];
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

  const queryProducts = detectProductsInText(query);

  const ranked: RetrievedChunk[] = aboveThreshold.map((chunk) => {
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
    assistantId,
    sourceCount: sourceIds.length,
    candidateCount: aboveThreshold.length,
    matchCount: selected.length,
    queryProducts,
    latencyMs: Date.now() - started,
  });

  return selected;
}
