-- Scanned PDF / vision extraction, review workflow, page provenance
--
-- Order matters: knowledge_chunks.page_* MUST exist before match_knowledge_chunks
-- references them. Do not run the function block alone.

-- 1) Chunk page provenance (required by match_knowledge_chunks below)
ALTER TABLE alicia_ai.knowledge_chunks
  ADD COLUMN IF NOT EXISTS page_from integer;

ALTER TABLE alicia_ai.knowledge_chunks
  ADD COLUMN IF NOT EXISTS page_to integer;

-- 2) Document extraction / review columns (one column per statement — safe re-run)
ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS extraction_method text;

ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS extraction_quality text;

ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS extraction_reason text;

ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS page_count integer;

ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS pending_raw_text text;

ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS source_pdf_bytea bytea;

ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS extraction_review_status text DEFAULT 'not_required';

UPDATE alicia_ai.knowledge_documents
SET extraction_review_status = 'not_required'
WHERE extraction_review_status IS NULL;

ALTER TABLE alicia_ai.knowledge_documents
  ALTER COLUMN extraction_review_status SET DEFAULT 'not_required';

ALTER TABLE alicia_ai.knowledge_documents
  ALTER COLUMN extraction_review_status SET NOT NULL;

-- Optional value checks (idempotent)
ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_extraction_method_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_extraction_method_check
  CHECK (extraction_method IS NULL OR extraction_method IN ('text', 'vision'));

ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_extraction_quality_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_extraction_quality_check
  CHECK (extraction_quality IS NULL OR extraction_quality IN ('good', 'poor', 'failed'));

ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_extraction_review_status_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_extraction_review_status_check
  CHECK (extraction_review_status IN ('pending', 'approved', 'rejected', 'not_required'));

-- 3) Document status enum extension
ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_status_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_status_check
  CHECK (status IN (
    'uploaded',
    'extracting',
    'awaiting_review',
    'processing',
    'ready',
    'failed',
    'rejected'
  ));

-- 4) match_knowledge_chunks — return type change requires DROP (not CREATE OR REPLACE)
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
