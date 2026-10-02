ALTER TABLE alicia_ai.knowledge_documents
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_source_type_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_source_type_check
  CHECK (source_type IN ('manual', 'pdf', 'text', 'markdown', 'url'));
