import assert from "node:assert/strict";
import {
  chunkEligibleForResolvedProduct,
  classifyChunkProductMetadata,
  effectiveChunkProduct,
} from "./chunk-product.ts";

function testChunkProductFiltering(): void {
  const generalFaq = classifyChunkProductMetadata({
    content: "vraag: Hoe neem ik contact op? | antwoord: Mail ons via info@alicia.insure",
    documentProduct: null,
    documentProductNeutral: false,
    rowProduct: null,
  });
  assert.equal(generalFaq.product_neutral, true);

  const avbRow = classifyChunkProductMetadata({
    content: "product: AVB | vraag: maximale dekking",
    documentProduct: null,
    documentProductNeutral: false,
    rowProduct: "AVB",
  });
  assert.equal(avbRow.chunk_product, "AVB");

  const bavRow = classifyChunkProductMetadata({
    content: "product: BAV | vraag: consultant limiet",
    documentProduct: null,
    documentProductNeutral: false,
    rowProduct: "BAV",
  });
  assert.equal(bavRow.chunk_product, "BAV");

  const avbEffective = effectiveChunkProduct({
    chunkProduct: avbRow.chunk_product,
    chunkNeutral: avbRow.product_neutral,
    documentProduct: null,
    documentNeutral: false,
    content: "product: AVB | vraag: maximale dekking",
  });
  const bavEffective = effectiveChunkProduct({
    chunkProduct: bavRow.chunk_product,
    chunkNeutral: bavRow.product_neutral,
    documentProduct: null,
    documentNeutral: false,
    content: "product: BAV | vraag: consultant limiet",
  });
  const generalEffective = effectiveChunkProduct({
    chunkProduct: generalFaq.chunk_product,
    chunkNeutral: generalFaq.product_neutral,
    documentProduct: null,
    documentNeutral: false,
    content: "vraag: Hoe neem ik contact op?",
  });

  assert.equal(chunkEligibleForResolvedProduct("AVB", avbEffective), true);
  assert.equal(chunkEligibleForResolvedProduct("AVB", bavEffective), false);
  assert.equal(chunkEligibleForResolvedProduct("BAV", avbEffective), false);
  assert.equal(chunkEligibleForResolvedProduct("AVB", generalEffective), true);
  assert.equal(chunkEligibleForResolvedProduct("BAV", generalEffective), true);

  const mixed = effectiveChunkProduct({
    chunkProduct: null,
    chunkNeutral: false,
    documentProduct: null,
    documentNeutral: false,
    content: "AVB limiet 2 miljoen en BAV consultant dekking",
  });
  assert.equal(mixed.eligibility, "untagged_mixed");
  assert.equal(chunkEligibleForResolvedProduct("AVB", mixed), false);

  console.log("chunk-product eval: 1 suite passed");
}

testChunkProductFiltering();
