import type { ConversationState } from "@/lib/chat/conversation-state";

const PRODUCT_CLARIFICATION_VARIANTS = [
  "Over welke verzekering heb je het — bijvoorbeeld AVB, BAV of AOV?",
  "Om je gericht te kunnen helpen: gaat het om AVB (bedrijfsaansprakelijkheid), BAV (beroepsaansprakelijkheid) of AOV?",
  "Geen probleem als je het niet zeker weet — waar gaat je vraag ongeveer over: aansprakelijkheid voor je bedrijf, je beroep, of inkomen bij arbeidsongeschiktheid?",
] as const;

function normalizeQuestion(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when the same clarification is still open and unanswered. */
export function isActiveRepeatClarification(
  state: ConversationState,
  clarifyingQuestion: string,
): boolean {
  if (!state.open_question?.trim()) return false;
  return normalizeQuestion(state.open_question) === normalizeQuestion(clarifyingQuestion);
}

/**
 * If the same clarification is still unresolved, return a reformulated question
 * instead of skipping clarification entirely.
 */
export function reformulateClarificationQuestion(
  state: ConversationState,
  baseQuestion: string,
): string {
  const base = baseQuestion.trim() || PRODUCT_CLARIFICATION_VARIANTS[0];
  if (!isActiveRepeatClarification(state, base)) {
    return base;
  }

  const attempt = Math.max(state.clarification_attempts ?? 1, 1);
  const variantIndex = Math.min(attempt, PRODUCT_CLARIFICATION_VARIANTS.length - 1);
  return PRODUCT_CLARIFICATION_VARIANTS[variantIndex] ?? PRODUCT_CLARIFICATION_VARIANTS[0];
}
