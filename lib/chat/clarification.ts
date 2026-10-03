import type { Assistant } from "@/lib/types/database";
import type { ConversationState } from "@/lib/chat/conversation-state";
import { reformulateClarificationQuestion } from "@/lib/chat/clarification-reformulate";
import type { ConversationUnderstanding } from "@/lib/chat/understanding";
import { assistantRequiresProductForGrounding } from "@/lib/chat/product-resolution";

export type ClarificationDecision = {
  required: boolean;
  question: string | null;
  reason: string;
  blocksPolicyRetrieval: boolean;
};

const GROUNDING_INTENTS = new Set([
  "coverage_limit",
  "coverage",
  "insured_amount",
  "exclusion",
  "deductible",
  "eigen_risico",
  "premium",
  "price",
  "acceptance",
  "policy_fact",
  "cancellation",
  "claim",
]);

function intentNeedsGrounding(intent: string | null): boolean {
  if (!intent) return false;
  const n = intent.toLowerCase();
  if (GROUNDING_INTENTS.has(n)) return true;
  return /coverage|limit|dekking|verzekerd|polis|premie|uitsluit|eigen.risico/.test(n);
}

export function materialAmbiguityBlocksPolicyRetrieval(params: {
  assistant: Assistant;
  understanding: ConversationUnderstanding;
  resolvedProduct: string | null;
  searchQueries: string[];
}): boolean {
  const { understanding, resolvedProduct, searchQueries } = params;

  if (understanding.needs_clarification) return true;

  if (
    !resolvedProduct &&
    assistantRequiresProductForGrounding(params.assistant) &&
    (intentNeedsGrounding(understanding.intent) ||
      (searchQueries.length === 0 && understanding.missing_information.includes("product")))
  ) {
    return true;
  }

  return false;
}

function defaultProductQuestion(understanding: ConversationUnderstanding): string {
  return (
    understanding.clarifying_question ??
    "Over welke verzekering heb je het — bijvoorbeeld AVB, BAV of AOV?"
  );
}

export function decideClarification(params: {
  assistant: Assistant;
  state: ConversationState;
  understanding: ConversationUnderstanding;
  resolvedProduct: string | null;
  searchQueries: string[];
}): ClarificationDecision {
  const blocksPolicyRetrieval = materialAmbiguityBlocksPolicyRetrieval(params);

  if (!blocksPolicyRetrieval) {
    return {
      required: false,
      question: null,
      reason: "sufficient_context",
      blocksPolicyRetrieval: false,
    };
  }

  const baseQuestion =
    params.understanding.needs_clarification && params.understanding.clarifying_question
      ? params.understanding.clarifying_question
      : defaultProductQuestion(params.understanding);

  const question = reformulateClarificationQuestion(params.state, baseQuestion);

  return {
    required: true,
    question,
    reason: params.understanding.needs_clarification ? "understanding" : "missing_product",
    blocksPolicyRetrieval: true,
  };
}
