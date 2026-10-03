-- Allow structured data file formats on knowledge_documents.source_type
ALTER TABLE alicia_ai.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_source_type_check;

ALTER TABLE alicia_ai.knowledge_documents
  ADD CONSTRAINT knowledge_documents_source_type_check
  CHECK (source_type IN (
    'manual',
    'pdf',
    'text',
    'markdown',
    'url',
    'csv',
    'json'
  ));
