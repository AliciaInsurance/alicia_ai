import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/knowledge/embeddings";
import { CHUNK_CONFIG } from "@/lib/knowledge/chunking";
import { log } from "@/lib/logger";
import type { MatchedChunk } from "@/lib/types/database";
import type { AssistantSource } from "@/lib/types/supabase-database";

export async function getAssistantSourceIds(assistantId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("assistant_sources")
    .select("knowledge_source_id")
    .eq("assistant_id", assistantId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as AssistantSource[]).map((r) => r.knowledge_source_id);
}

export async function retrieveRelevantChunks(
  assistantId: string,
  query: string
): Promise<MatchedChunk[]> {
  const sourceIds = await getAssistantSourceIds(assistantId);
  if (sourceIds.length === 0 || !query.trim()) return [];

  const started = Date.now();
  const [queryEmbedding] = await embedTexts([query]);
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_source_ids: sourceIds,
    match_count: CHUNK_CONFIG.retrievalCount,
  });

  if (error) {
    log.error("retrieval_failed", { assistantId, message: error.message });
    throw new Error(error.message);
  }

  const chunks = (data ?? []) as MatchedChunk[];
  const filtered = chunks.filter(
    (c) => c.similarity >= CHUNK_CONFIG.similarityThreshold
  );

  log.info("retrieval_complete", {
    assistantId,
    sourceCount: sourceIds.length,
    matchCount: filtered.length,
    latencyMs: Date.now() - started,
  });

  return filtered;
}
