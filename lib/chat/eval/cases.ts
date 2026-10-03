import type { Assistant } from "@/lib/types/database";

export type ExpectedBehaviour = "clarify" | "answer" | "fallback";

export type ConversationEvalCase = {
  id: string;
  description: string;
  assistant: Partial<Assistant>;
  priorState?: Record<string, unknown>;
  userMessage: string;
  expected: {
    behaviour: ExpectedBehaviour;
    product?: string | null;
    forbiddenProductMentions?: string[];
    mustNotRetrieveBeforeClarify?: boolean;
  };
};

export const CONVERSATION_EVAL_CASES: ConversationEvalCase[] = [
  {
    id: "ambiguous-max-dekking",
    description: "Max dekking zonder product — multi-product sales",
    assistant: {
      assistant_type: "public_sales",
      allowed_products: ["AVB", "BAV", "AOV"],
      default_product: null,
    },
    userMessage: "wat is de maximale dekking?",
    expected: {
      behaviour: "clarify",
      product: null,
      forbiddenProductMentions: ["BAV", "AVB"],
      mustNotRetrieveBeforeClarify: true,
    },
  },
  {
    id: "avb-known-max-dekking",
    description: "Max dekking met product AVB in state",
    assistant: {
      allowed_products: ["AVB", "BAV", "AOV"],
    },
    priorState: { product: "AVB" },
    userMessage: "wat is de maximale dekking?",
    expected: {
      behaviour: "answer",
      product: "AVB",
    },
  },
  {
    id: "insured-vague",
    description: "Ben ik verzekerd zonder situatie",
    assistant: { allowed_products: ["AVB", "BAV"] },
    userMessage: "ben ik hiervoor verzekerd?",
    expected: {
      behaviour: "clarify",
    },
  },
  {
    id: "profession-continuity",
    description: "Profession known — should not re-ask",
    assistant: { allowed_products: ["BAV"] },
    priorState: { profession: "consultant", product: "BAV" },
    userMessage: "kan ik dit afsluiten?",
    expected: {
      behaviour: "answer",
      product: "BAV",
    },
  },
  {
    id: "avb-not-bav",
    description: "Product AVB must not use BAV scope",
    assistant: { allowed_products: ["AVB", "BAV"] },
    priorState: { product: "AVB" },
    userMessage: "wat is de maximale dekking?",
    expected: {
      behaviour: "answer",
      product: "AVB",
      forbiddenProductMentions: ["beroepsfout", "consultant"],
    },
  },
  {
    id: "insufficient-knowledge",
    description: "No grounding when product unknown and policy fact asked",
    assistant: { allowed_products: ["AVB", "BAV"] },
    userMessage: "wat is mijn exacte premie voor polis 123?",
    expected: {
      behaviour: "clarify",
    },
  },
];

export function mockAssistant(partial: Partial<Assistant>): Assistant {
  return {
    id: "eval-assistant",
    internal_name: "Eval",
    slug: "eval",
    status: "active",
    customer_display_name: "Alicia",
    model: "gpt-4o-mini",
    system_instructions: "",
    greeting: "",
    fallback_message: "Geen info.",
    personality_instructions: "",
    assistant_type: "public_sales",
    purpose: "",
    audience: "",
    channel_context: "",
    allowed_products: [],
    partner: null,
    default_product: null,
    goals: "",
    restrictions: "",
    understanding_model: "gpt-4o-mini",
    created_at: "",
    updated_at: "",
    ...partial,
  };
}
