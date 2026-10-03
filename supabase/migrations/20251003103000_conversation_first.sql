-- Conversation-first orchestration: assistant context + conversation state

ALTER TABLE alicia_ai.assistants
  ADD COLUMN IF NOT EXISTS assistant_type text NOT NULL DEFAULT 'public_sales'
    CHECK (assistant_type IN ('public_sales', 'public_service', 'internal_copilot')),
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS channel_context text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS allowed_products text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS partner text,
  ADD COLUMN IF NOT EXISTS default_product text,
  ADD COLUMN IF NOT EXISTS goals text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS restrictions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS understanding_model text NOT NULL DEFAULT 'gpt-4o-mini';

ALTER TABLE alicia_ai.conversations
  ADD COLUMN IF NOT EXISTS conversation_state jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_conversations_state_gin
  ON alicia_ai.conversations USING gin (conversation_state);

-- Optional product filter at retrieval time (primary boundary before rerank)
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
    AND d.review_status = 'approved'
    AND (d.valid_from IS NULL OR d.valid_from <= now())
    AND (d.valid_until IS NULL OR d.valid_until >= now())
    AND (
      match_product IS NULL
      OR btrim(match_product) = ''
      OR d.product IS NULL
      OR upper(trim(d.product)) = upper(trim(match_product))
      OR upper(d.product) LIKE '%' || upper(trim(match_product)) || '%'
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION alicia_ai.match_knowledge_chunks(extensions.vector, uuid[], integer, text)
  TO service_role;
