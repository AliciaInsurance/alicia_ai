-- Fresh installs: remove demo knowledge inserted by 20251002120100_seed_demo.sql
-- (assistant + widget + platform_settings remain)

DELETE FROM alicia_ai.assistant_sources
WHERE knowledge_source_id = 'b2222222-2222-4222-8222-222222222222';

DELETE FROM alicia_ai.knowledge_chunks
WHERE document_id = 'd3333333-3333-4333-8333-333333333333';

DELETE FROM alicia_ai.knowledge_documents
WHERE id = 'd3333333-3333-4333-8333-333333333333';

DELETE FROM alicia_ai.knowledge_sources
WHERE id = 'b2222222-2222-4222-8222-222222222222';
