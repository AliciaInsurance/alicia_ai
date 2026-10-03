import assert from "node:assert/strict";
import { decideClarification, materialAmbiguityBlocksPolicyRetrieval } from "../clarification.ts";
import { parseConversationState } from "../conversation-state.ts";
import { resolveProduct } from "../product-resolution.ts";
import { reformulateClarificationQuestion } from "../clarification-reformulate.ts";
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

    const blocks = materialAmbiguityBlocksPolicyRetrieval({
      assistant,
      understanding,
      resolvedProduct: productResolution.product,
      searchQueries: understanding.search_queries,
    });

    const clarification = decideClarification({
      assistant,
      state,
      understanding,
      resolvedProduct: productResolution.product,
      searchQueries: understanding.search_queries,
    });

    if (evalCase.expected.behaviour === "clarify") {
      assert.equal(blocks, true, `${evalCase.id}: should block policy retrieval`);
      assert.equal(
        clarification.required,
        true,
        `${evalCase.id}: should require clarification`,
      );
      assert.equal(
        clarification.blocksPolicyRetrieval,
        true,
        `${evalCase.id}: blocksPolicyRetrieval`,
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

  // Repeat clarification: user still unresolved — must still block retrieval
  {
    const assistant = mockAssistant({ allowed_products: ["AVB", "BAV", "AOV"] });
    const state = parseConversationState({
      open_question: "Over welke verzekering heb je het — bijvoorbeeld AVB, BAV of AOV?",
      last_clarification:
        "Over welke verzekering heb je het — bijvoorbeeld AVB, BAV of AOV?",
      clarification_attempts: 1,
    });
    const understanding = {
      intent: "coverage_limit",
      product: null,
      topic: "insured_amount",
      needs_clarification: true,
      missing_information: ["product"],
      clarifying_question:
        "Over welke verzekering heb je het — bijvoorbeeld AVB, BAV of AOV?",
      search_queries: [],
    };
    const decision = decideClarification({
      assistant,
      state,
      understanding,
      resolvedProduct: null,
      searchQueries: [],
    });
    assert.equal(decision.required, true, "repeat-unresolved: still clarify");
    assert.equal(decision.blocksPolicyRetrieval, true, "repeat-unresolved: block retrieval");
    const reformulated = reformulateClarificationQuestion(
      state,
      understanding.clarifying_question!,
    );
    assert.notEqual(
      reformulated.toLowerCase(),
      state.last_clarification!.toLowerCase(),
      "repeat-unresolved: reformulated question",
    );
  }

  // New topic after resolved answer — prior clarification must not suppress
  {
    const assistant = mockAssistant({ allowed_products: ["AVB", "BAV"] });
    const state = parseConversationState({
      last_clarification: "Over welke verzekering heb je het — bijvoorbeeld AVB, BAV of AOV?",
      open_question: null,
      product: "AVB",
    });
    const understanding = {
      intent: "coverage_limit",
      product: "AVB",
      topic: null,
      needs_clarification: false,
      missing_information: [],
      clarifying_question: null,
      search_queries: ["AVB maximale dekking"],
    };
    const decision = decideClarification({
      assistant,
      state,
      understanding,
      resolvedProduct: "AVB",
      searchQueries: understanding.search_queries,
    });
    assert.equal(decision.required, false, "new-topic: no spurious clarify block");
  }

  console.log(`conversation eval: ${CONVERSATION_EVAL_CASES.length + 2} deterministic cases passed`);
}

runDeterministicEval();
