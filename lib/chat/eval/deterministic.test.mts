import assert from "node:assert/strict";
import { decideClarification } from "../clarification.ts";
import { parseConversationState } from "../conversation-state.ts";
import { resolveProduct } from "../product-resolution.ts";
import { CONVERSATION_EVAL_CASES, mockAssistant } from "./cases.ts";

function runDeterministicEval(): void {
  for (const evalCase of CONVERSATION_EVAL_CASES) {
    const assistant = mockAssistant(evalCase.assistant);
    const state = parseConversationState(evalCase.priorState ?? {});

    const productResolution = resolveProduct({
      assistant,
      latestUserMessage: evalCase.userMessage,
      state,
      understandingProduct: (state.product as string | null) ?? null,
    });

    if (evalCase.expected.product !== undefined) {
      assert.equal(
        productResolution.product,
        evalCase.expected.product,
        `${evalCase.id}: product resolution`,
      );
    }

    const understanding = {
      intent: evalCase.id.includes("max-dekking") ? "coverage_limit" : "general",
      product: productResolution.product,
      topic: null,
      needs_clarification: evalCase.expected.behaviour === "clarify",
      missing_information:
        evalCase.expected.behaviour === "clarify" ? ["product"] : [],
      clarifying_question:
        evalCase.expected.behaviour === "clarify"
          ? "Over welke verzekering heb je het — bijvoorbeeld AVB, BAV of AOV?"
          : null,
      search_queries: productResolution.product ? [`${productResolution.product} dekking`] : [],
    };

    const clarification = decideClarification({
      assistant,
      state,
      understanding,
      resolvedProduct: productResolution.product,
      searchQueries: understanding.search_queries,
    });

    if (evalCase.expected.behaviour === "clarify") {
      assert.equal(
        clarification.required,
        true,
        `${evalCase.id}: should require clarification`,
      );
      if (evalCase.expected.mustNotRetrieveBeforeClarify) {
        assert.ok(
          understanding.search_queries.length === 0 || !productResolution.product,
          `${evalCase.id}: should not retrieve with product unresolved`,
        );
      }
    }

    if (evalCase.expected.behaviour === "answer" && evalCase.expected.product) {
      assert.equal(clarification.required, false, `${evalCase.id}: should answer`);
      assert.equal(productResolution.product, evalCase.expected.product);
    }
  }

  console.log(`conversation eval: ${CONVERSATION_EVAL_CASES.length} deterministic cases passed`);
}

runDeterministicEval();
