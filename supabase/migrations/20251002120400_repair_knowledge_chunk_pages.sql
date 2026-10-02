-- Repair: if match_knowledge_chunks was created before page_from/page_to existed,
-- run this file (or rely on 20251002120300 after the reorder fix).

ALTER TABLE alicia_ai.knowledge_chunks
  ADD COLUMN IF NOT EXISTS page_from integer;

ALTER TABLE alicia_ai.knowledge_chunks
  ADD COLUMN IF NOT EXISTS page_to integer;

DROP FUNCTION IF EXISTS alicia_ai.match_knowledge_chunks(extensions.vector, uuid[], integer);
DROP FUNCTION IF EXISTS alicia_ai.match_knowledge_chunks(vector, uuid[], integer);

CREATE FUNCTION alicia_ai.match_knowledge_chunks(
  query_embedding extensions.vector(1536),
  match_source_ids uuid[],
  match_count integer DEFAULT 6
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  knowledge_source_id uuid,
  content text,
  similarity double precision,
  page_from integer,
  page_to integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id,
    c.document_id,
    c.knowledge_source_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.page_from,
    c.page_to
  FROM alicia_ai.knowledge_chunks c
  INNER JOIN alicia_ai.knowledge_documents d ON d.id = c.document_id
  WHERE c.knowledge_source_id = ANY (match_source_ids)
    AND c.embedding IS NOT NULL
    AND d.status = 'ready'
    AND d.extraction_review_status IN ('approved', 'not_required')
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION alicia_ai.match_knowledge_chunks(extensions.vector, uuid[], integer)
  TO service_role;
