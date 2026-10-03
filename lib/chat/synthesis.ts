import OpenAI from "openai";
import { formatAssistantContextForPrompt } from "@/lib/chat/assistant-context";
import type { ConversationState } from "@/lib/chat/conversation-state";
import type { ConversationUnderstanding } from "@/lib/chat/understanding";
import { getOpenAIApiKey } from "@/lib/env";
import { buildGroundedContext, getPlatformInsuranceRules } from "@/lib/platform/rules";
import type { RetrievedChunk } from "@/lib/knowledge/retrieve";
import type { Assistant, Message } from "@/lib/types/database";

let openai: OpenAI | null = null;

function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: getOpenAIApiKey() });
  return openai;
}

const INTELLIGENCE_GUARDRAILS = [
  "Behave like a modern intelligent assistant, not a keyword bot or search interface.",
  "Resolve ambiguity before stating product facts; maintain conversational continuity.",
  "Do not ask for information already known from the conversation state.",
  "Ask at most one useful follow-up when truly needed; avoid interrogation.",
  "Never fabricate policy coverage, limits, exclusions, pricing, or acceptance outcomes.",
  "Never make autonomous insurance decisions.",
  "Answer concisely in natural Dutch (or match the customer's language); do not dump retrieved text or list all options unless the customer asked for options.",
  "Use evidence snippets for concrete policy facts only; if evidence is insufficient, say so honestly.",
  "When sources conflict, prefer formal policy conditions over IPID over FAQ; do not let FAQ override policy text.",
  "Do not expose internal retrieval mechanics or snippet numbering to the customer.",
];

export type SynthesisResult = {
  reply: string;
  model: string;
  usage?: OpenAI.Completions.CompletionUsage | undefined;
  latencyMs: number;
};

export async function synthesizeAnswer(params: {
  assistant: Assistant;
  state: ConversationState;
  understanding: ConversationUnderstanding;
  resolvedProduct: string | null;
  history: Message[];
  latestUserMessage: string;
  chunks: RetrievedChunk[];
  fallbackMessage: string;
}): Promise<SynthesisResult> {
  const started = Date.now();
  const platformRules = await getPlatformInsuranceRules();
  const grounded = buildGroundedContext(params.chunks);

  const stateSummary = JSON.stringify(
    {
      product: params.resolvedProduct ?? params.state.product,
      profession: params.state.profession ?? params.understanding.profession,
      topic: params.understanding.topic ?? params.state.topic,
      intent: params.understanding.intent ?? params.state.intent,
      known_facts: params.state.known_facts ?? {},
    },
    null,
    0,
  );

  const systemParts = [
    `You are ${params.assistant.customer_display_name}, Alicia's customer-facing AI assistant. You are NOT a human employee.`,
    params.assistant.personality_instructions,
    params.assistant.system_instructions,
    "Assistant context:",
    formatAssistantContextForPrompt(params.assistant),
    "Platform insurance behaviour:",
    ...platformRules.map((r) => `- ${r}`),
    "Intelligence guardrails:",
    ...INTELLIGENCE_GUARDRAILS.map((r) => `- ${r}`),
    `Reply in the customer's language; default to Dutch if unclear.`,
    `Resolved product for this turn: ${params.resolvedProduct ?? "none"}`,
    `Intent/topic: ${params.understanding.intent ?? "—"} / ${params.understanding.topic ?? "—"}`,
    `Conversation state summary: ${stateSummary}`,
    `If evidence is insufficient, adapt this fallback tone naturally: ${params.fallbackMessage}`,
    "Evidence snippets (internal — synthesize, do not copy verbatim lists):",
    grounded,
  ];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemParts.join("\n\n") },
    ...params.history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
  ];

  const client = getOpenAI();
  const completion = await client.chat.completions.create({
    model: params.assistant.model,
    messages,
    temperature: 0.35,
  });

  const reply =
    completion.choices[0]?.message?.content?.trim() || params.fallbackMessage;

  return {
    reply,
    model: params.assistant.model,
    usage: completion.usage,
    latencyMs: Date.now() - started,
  };
}

export async function synthesizeClarification(params: {
  assistant: Assistant;
  clarifyingQuestion: string;
}): Promise<string> {
  const q = params.clarifyingQuestion.trim();
  if (q) return q;
  return "Kun je iets specifieker zijn, zodat ik je gericht kan helpen?";
}
