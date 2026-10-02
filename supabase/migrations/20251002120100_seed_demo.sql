-- Demo assistant + fake FAQ knowledge (NOT real policy terms)
INSERT INTO alicia_ai.platform_settings (key, value)
VALUES (
  'insurance_behaviour',
  '{
    "default_locale": "nl",
    "rules": [
      "Answer using approved knowledge for Alicia/product-specific questions.",
      "Never invent policy coverage, exclusions, pricing, acceptance criteria or claims outcomes.",
      "Say clearly when knowledge is insufficient.",
      "Never pretend to be a human employee.",
      "Do not make automated insurance decisions.",
      "Do not ask for special-category personal data.",
      "Keep answers concise and customer friendly.",
      "Use Dutch by default; reply in English when the customer writes in English."
    ]
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO alicia_ai.assistants (
  id,
  internal_name,
  slug,
  status,
  customer_display_name,
  model,
  system_instructions,
  greeting,
  fallback_message,
  personality_instructions
) VALUES (
  'a1111111-1111-4111-8111-111111111111',
  'BAV Sales',
  'bav-sales',
  'active',
  'Alicia',
  'gpt-4o-mini',
  'Je helpt klanten met vragen over de BAV (beroepsaansprakelijkheidsverzekering) verkoopflow. Gebruik alleen de meegeleverde kennisbronnen voor productfeiten.',
  'Hoi, ik ben Alicia, de AI-assistent van Alicia. Waar kan ik je mee helpen?',
  'Sorry, daar kan ik je nu niet genoeg over vertellen op basis van onze beschikbare informatie. Wil je je vraag anders formuleren, of kan ik je ergens anders mee helpen?',
  'Vriendelijk, rustig, competent en bondig. Vermijd jargon. Stel maximaal één duidelijke vervolgvraag als iets ontbreekt. Geen emoji-overload.'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO alicia_ai.widget_configs (
  assistant_id,
  public_slug,
  is_enabled,
  primary_color,
  config
) VALUES (
  'a1111111-1111-4111-8111-111111111111',
  'bav-sales',
  true,
  '#0f766e',
  '{"suggested_questions": ["Wat dekt de BAV-demo?", "Voor wie is deze verzekering bedoeld?"]}'::jsonb
)
ON CONFLICT (public_slug) DO NOTHING;

INSERT INTO alicia_ai.knowledge_sources (
  id,
  name,
  slug,
  description
) VALUES (
  'b2222222-2222-4222-8222-222222222222',
  'DEMO — BAV FAQ (test)',
  'demo-bav-faq',
  'Fake demo content for development only. Not real policy terms.'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO alicia_ai.assistant_sources (assistant_id, knowledge_source_id)
VALUES (
  'a1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222'
)
ON CONFLICT DO NOTHING;

INSERT INTO alicia_ai.knowledge_documents (
  id,
  knowledge_source_id,
  title,
  source_type,
  status,
  raw_text
) VALUES (
  'd3333333-3333-4333-8333-333333333333',
  'b2222222-2222-4222-8222-222222222222',
  'DEMO BAV FAQ — test content',
  'manual',
  'uploaded',
  E'[DEMO / TEST — GEEN ECHTE POLISVOORWAARDEN]\n\nVraag: Wat is de BAV-demo verzekering?\nAntwoord: Dit is een fictieve demo-productnaam voor testdoeleinden. In werkelijkheid moet je altijd de officiële Alicia productinformatie raadplegen.\n\nVraag: Wat dekt de demo?\nAntwoord: In deze demo dekt het fictieve product alleen voorbeeldsituaties zoals “foutief advies tijdens een proefproject”. Er is geen echte dekking.\n\nVraag: Voor wie is de demo bedoeld?\nAntwoord: Voor interne testers en ontwikkelaars die de Alicia AI chatflow willen uitproberen.\n\nVraag: Hoe vraag ik een offerte aan in de demo?\nAntwoord: In de demo kun je zeggen dat je geïnteresseerd bent; Alicia legt uit dat dit testcontent is en geen echte acceptatie of prijs geeft.\n\nVraag: Kan ik een claim indienen in de demo?\nAntwoord: Nee. Claims zijn niet onderdeel van deze demo en Alicia mag geen claimuitkomsten voorspellen.'
)
ON CONFLICT DO NOTHING;
