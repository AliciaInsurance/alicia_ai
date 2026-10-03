-- Chunk-level product metadata for safe multi-product retrieval

ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS product_neutral boolean NOT NULL DEFAULT false;

ALTER TABLE alicia_ai.knowledge_chunks
  ADD COLUMN IF NOT EXISTS chunk_product text,
  ADD COLUMN IF NOT EXISTS product_neutral boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_chunk_product
  ON alicia_ai.knowledge_chunks (chunk_product)
  WHERE chunk_product IS NOT NULL;

DROP FUNCTION IF EXISTS alicia_ai.match_knowledge_chunks(extensions.vector, uuid[], integer, text);
DROP FUNCTION IF EXISTS alicia_ai.match_knowledge_chunks(extensions.vector, uuid[], integer);
DROP FUNCTION IF EXISTS alicia_ai.match_knowledge_chunks(vector, uuid[], integer);

CREATE FUNCTION alicia_ai.match_knowledge_chunks(
  query_embedding extensions.vector(1536),
  match_source_ids uuid[],
  match_count integer DEFAULT 6,
  match_product text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  knowledge_source_id uuid,
  content text,
  similarity double precision,
  page_from integer,
  page_to integer,
  chunk_product text,
  product_neutral boolean
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
    c.page_to,
    c.chunk_product,
    c.product_neutral
  FROM alicia_ai.knowledge_chunks c
  INNER JOIN alicia_ai.knowledge_documents d ON d.id = c.document_id
  WHERE c.knowledge_source_id = ANY (match_source_ids)
    AND c.embedding IS NOT NULL
    AND d.status = 'ready'
    AND d.review_status = 'approved'
    AND (d.valid_from IS NULL OR d.valid_from <= now())
    AND (d.valid_until IS NULL OR d.valid_until >= now())
    AND (
      match_product IS NULL
      OR btrim(match_product) = ''
      OR c.product_neutral = true
      OR d.product_neutral = true
      OR (
        c.chunk_product IS NOT NULL
        AND upper(trim(c.chunk_product)) = upper(trim(match_product))
      )
      OR (
        c.chunk_product IS NULL
        AND d.product IS NOT NULL
        AND (
          upper(trim(d.product)) = upper(trim(match_product))
          OR upper(d.product) LIKE '%' || upper(trim(match_product)) || '%'
        )
      )
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION alicia_ai.match_knowledge_chunks(extensions.vector, uuid[], integer, text)
  TO service_role;
