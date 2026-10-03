import { z } from "zod";

/** Evolvable per-conversation memory (JSONB). */
export const ConversationStateSchema = z
  .object({
    intent: z.string().nullable().optional(),
    product: z.string().nullable().optional(),
    journey: z.string().nullable().optional(),
    customer_type: z.string().nullable().optional(),
    profession: z.string().nullable().optional(),
    topic: z.string().nullable().optional(),
    known_facts: z.record(z.string()).optional(),
    open_question: z.string().nullable().optional(),
    last_clarification: z.string().nullable().optional(),
    clarification_attempts: z.number().int().optional(),
  })
  .passthrough();

export type ConversationState = z.infer<typeof ConversationStateSchema>;

export function parseConversationState(raw: unknown): ConversationState {
  if (!raw || typeof raw !== "object") return {};
  const parsed = ConversationStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/** Merge updates without wiping known fields with null/undefined. */
export function mergeConversationState(
  previous: ConversationState,
  update: Partial<ConversationState> & { known_facts?: Record<string, string> },
): ConversationState {
  const next: ConversationState = { ...previous };

  const scalarKeys = [
    "intent",
    "product",
    "journey",
    "customer_type",
    "profession",
    "topic",
    "open_question",
    "last_clarification",
  ] as const;

  if (update.clarification_attempts !== undefined) {
    const attempts = update.clarification_attempts;
    if (typeof attempts === "number" && attempts >= 0) {
      next.clarification_attempts = attempts;
    }
  }

  for (const key of scalarKeys) {
    const value = update[key];
    if (value === undefined) continue;
    if (value === null || String(value).trim() === "") {
      if (key === "open_question" || key === "last_clarification") {
        next[key] = null;
      }
      continue;
    }
    next[key] = value;
  }

  if (update.known_facts && Object.keys(update.known_facts).length > 0) {
    next.known_facts = { ...(previous.known_facts ?? {}), ...update.known_facts };
  }

  return next;
}

export function nextClarificationAttemptCount(
  state: ConversationState,
  clarifyingQuestion: string,
): number {
  const prev = state.clarification_attempts ?? 0;
  const last = (state.last_clarification ?? "").trim().toLowerCase();
  const next = clarifyingQuestion.trim().toLowerCase();
  if (last && last === next) return prev + 1;
  if (state.open_question?.trim()) return prev + 1;
  return 1;
}

/** Clear product clarification lifecycle when product becomes known. */
export function clearClarificationLifecycle(): Partial<ConversationState> {
  return {
    open_question: null,
    last_clarification: null,
    clarification_attempts: 0,
  };
}
