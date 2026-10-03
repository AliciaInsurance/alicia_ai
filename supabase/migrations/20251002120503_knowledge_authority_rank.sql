-- Lower number = higher authority in retrieval (voorwaarden < IPID < FAQ)
ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS authority_rank integer NOT NULL DEFAULT 50;

ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_authority_rank_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_authority_rank_check
  CHECK (authority_rank >= 1 AND authority_rank <= 100);
