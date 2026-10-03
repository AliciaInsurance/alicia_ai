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

export function shouldSkipRepeatClarification(
  state: ConversationState,
  clarifyingQuestion: string,
): boolean {
  const q = clarifyingQuestion.trim().toLowerCase();
  if (!q) return true;
  const last = (state.last_clarification ?? "").trim().toLowerCase();
  return last === q;
}
