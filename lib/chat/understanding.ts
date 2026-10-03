import OpenAI from "openai";
import { z } from "zod";
import { formatAssistantContextForPrompt } from "@/lib/chat/assistant-context";
import type { ConversationState } from "@/lib/chat/conversation-state";
import { getOpenAIApiKey } from "@/lib/env";
import type { Assistant, Message } from "@/lib/types/database";

export const ConversationUnderstandingSchema = z.object({
  intent: z.string().nullable(),
  product: z.string().nullable(),
  topic: z.string().nullable(),
  needs_clarification: z.boolean(),
  missing_information: z.array(z.string()),
  clarifying_question: z.string().nullable(),
  search_queries: z.array(z.string()).max(3),
  profession: z.string().nullable().optional(),
  customer_type: z.string().nullable().optional(),
  known_facts_update: z.record(z.string()).optional(),
});

export type ConversationUnderstanding = z.infer<typeof ConversationUnderstandingSchema>;

let openai: OpenAI | null = null;

function getOpenAI() {
  if (!openai) openai = new OpenAI({ apiKey: getOpenAIApiKey() });
  return openai;
}

function formatHistory(messages: Message[]): string {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-12)
    .map((m) => `${m.role === "user" ? "Klant" : "Assistant"}: ${m.content}`)
    .join("\n");
}

export type UnderstandingResult = {
  understanding: ConversationUnderstanding;
  model: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  latencyMs: number;
};

export async function runConversationUnderstanding(params: {
  assistant: Assistant;
  state: ConversationState;
  history: Message[];
  latestUserMessage: string;
  referrerUrl?: string | null;
  referrerDomain?: string | null;
  resolvedProduct: string | null;
}): Promise<UnderstandingResult> {
  const started = Date.now();
  const model = params.assistant.understanding_model?.trim() || "gpt-4o-mini";

  const system = [
    "You analyze insurance customer conversations for Ask Alicia.",
    "Output ONLY valid JSON matching the schema. No markdown.",
    "Determine intent, topic, whether clarification is needed BEFORE any knowledge retrieval.",
    "If policy facts (coverage, limits, exclusions, price, acceptance) need a specific product and product is unknown, set needs_clarification true with ONE concise Dutch clarifying_question.",
    "Never ask for information already in conversation state or assistant context.",
    "If sufficient context exists, set needs_clarification false and provide 1-3 focused Dutch search_queries for retrieval (not the customer's exact words).",
    "If the user only greets or makes small talk, needs_clarification false and search_queries [].",
    "Use resolved_product when provided; do not contradict it without clear user correction.",
    "Product codes: AVB, BAV, AOV unless assistant lists others.",
  ].join("\n");

  const userPayload = {
    assistant_context: formatAssistantContextForPrompt(params.assistant),
    conversation_state: params.state,
    resolved_product: params.resolvedProduct,
    referrer: params.referrerUrl ?? params.referrerDomain ?? null,
    recent_messages: formatHistory(params.history),
    latest_user_message: params.latestUserMessage,
    output_schema: {
      intent: "string | null",
      product: "string | null",
      topic: "string | null",
      needs_clarification: "boolean",
      missing_information: "string[]",
      clarifying_question: "string | null",
      search_queries: "string[] max 3",
      profession: "string | null optional",
      customer_type: "string | null optional",
      known_facts_update: "Record<string,string> optional",
    },
  };

  const client = getOpenAI();
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(userPayload) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {
      intent: null,
      product: params.resolvedProduct,
      topic: null,
      needs_clarification: !params.resolvedProduct,
      missing_information: params.resolvedProduct ? [] : ["product"],
      clarifying_question: params.resolvedProduct
        ? null
        : "Over welke verzekering heb je het — bijvoorbeeld AVB, BAV of AOV?",
      search_queries: [],
    };
  }

  const understanding = ConversationUnderstandingSchema.parse(parsed);

  if (params.resolvedProduct) {
    understanding.product = params.resolvedProduct;
    if (understanding.needs_clarification && understanding.missing_information.every((m) => m !== "product")) {
      // Keep clarification if about something other than product
    } else if (understanding.missing_information.length === 1 && understanding.missing_information[0] === "product") {
      understanding.needs_clarification = false;
      understanding.clarifying_question = null;
      understanding.missing_information = [];
    }
  }

  return {
    understanding,
    model,
    usage: completion.usage,
    latencyMs: Date.now() - started,
  };
}
