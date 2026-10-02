-- Knowledge model refactor: wipe test/demo content, simplify types, approval + validity

-- 1) Remove all knowledge (assistants / widgets / conversations unchanged)
DELETE FROM alicia_ai.assistant_sources;
DELETE FROM alicia_ai.knowledge_chunks;
DELETE FROM alicia_ai.knowledge_documents;
DELETE FROM alicia_ai.knowledge_sources;

-- 2) Structured row storage (deterministic lookup later)
CREATE TABLE IF NOT EXISTS alicia_ai.knowledge_structured_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL
    REFERENCES alicia_ai.knowledge_documents (id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  row_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, row_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_structured_rows_document
  ON alicia_ai.knowledge_structured_rows (document_id);

GRANT ALL ON alicia_ai.knowledge_structured_rows TO service_role;

-- 3) Drop vision / OCR-specific columns (no longer used)
ALTER TABLE alicia_ai.knowledge_documents
  DROP COLUMN IF EXISTS extraction_method,
  DROP COLUMN IF EXISTS extraction_quality,
  DROP COLUMN IF EXISTS extraction_reason,
  DROP COLUMN IF EXISTS page_count,
  DROP COLUMN IF EXISTS extraction_review_status,
  DROP COLUMN IF EXISTS pending_raw_text,
  DROP COLUMN IF EXISTS source_pdf_bytea;

-- 4) New metadata columns
ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS knowledge_type text,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS version_label text,
  ADD COLUMN IF NOT EXISTS product text,
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_refresh_at timestamptz,
  ADD COLUMN IF NOT EXISTS structured_data jsonb;

UPDATE alicia_ai.knowledge_documents
SET knowledge_type = COALESCE(
  CASE source_type
    WHEN 'manual' THEN 'manual_text'
    WHEN 'url' THEN 'web'
    WHEN 'pdf' THEN 'document'
    WHEN 'text' THEN 'document'
    WHEN 'markdown' THEN 'document'
    ELSE 'manual_text'
  END,
  'manual_text'
)
WHERE knowledge_type IS NULL;

UPDATE alicia_ai.knowledge_documents
SET review_status = 'draft'
WHERE review_status IS NULL;

ALTER TABLE alicia_ai.knowledge_documents
  ALTER COLUMN knowledge_type SET NOT NULL,
  ALTER COLUMN review_status SET NOT NULL;

ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_knowledge_type_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_knowledge_type_check
  CHECK (knowledge_type IN ('manual_text', 'document', 'web', 'structured_data'));

ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_review_status_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_review_status_check
  CHECK (review_status IN ('draft', 'pending_review', 'approved', 'rejected'));

ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_status_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_status_check
  CHECK (status IN (
    'uploaded',
    'processing',
    'ready',
    'failed',
    'unsupported'
  ));

-- 5) Retrieval: approved + valid items only
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
    AND d.review_status = 'approved'
    AND (d.valid_from IS NULL OR d.valid_from <= now())
    AND (d.valid_until IS NULL OR d.valid_until >= now())
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION alicia_ai.match_knowledge_chunks(extensions.vector, uuid[], integer)
  TO service_role;
