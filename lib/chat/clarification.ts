import type { Assistant } from "@/lib/types/database";
import type { ConversationState } from "@/lib/chat/conversation-state";
import { shouldSkipRepeatClarification } from "@/lib/chat/conversation-state";
import type { ConversationUnderstanding } from "@/lib/chat/understanding";
import { assistantRequiresProductForGrounding } from "@/lib/chat/product-resolution";

export type ClarificationDecision = {
  required: boolean;
  question: string | null;
  reason: string;
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

export function decideClarification(params: {
  assistant: Assistant;
  state: ConversationState;
  understanding: ConversationUnderstanding;
  resolvedProduct: string | null;
  searchQueries: string[];
}): ClarificationDecision {
  const { understanding, resolvedProduct, searchQueries } = params;

  if (understanding.needs_clarification && understanding.clarifying_question) {
    if (shouldSkipRepeatClarification(params.state, understanding.clarifying_question)) {
      return {
        required: false,
        question: null,
        reason: "repeat_clarification_skipped",
      };
    }
    return {
      required: true,
      question: understanding.clarifying_question,
      reason: "understanding",
    };
  }

  const needsProduct =
    !resolvedProduct &&
    assistantRequiresProductForGrounding(params.assistant) &&
    (intentNeedsGrounding(understanding.intent) ||
      (searchQueries.length === 0 && understanding.missing_information.includes("product")));

  if (needsProduct) {
    const question =
      understanding.clarifying_question ??
      "Over welke verzekering heb je het — bijvoorbeeld AVB, BAV of AOV?";
    if (shouldSkipRepeatClarification(params.state, question)) {
      return { required: false, question: null, reason: "repeat_product_clarification_skipped" };
    }
    return { required: true, question, reason: "missing_product" };
  }

  return { required: false, question: null, reason: "sufficient_context" };
}
