import assert from "node:assert/strict";
import { splitTextIntoChunkSegments } from "./chunking.ts";
import { assessPdfTextQuality } from "./pdf-text-quality.ts";

assert.equal(assessPdfTextQuality("Artikel 1.\n".repeat(30), 2).quality, "good");
assert.equal(assessPdfTextQuality("---\n| |", 3).quality, "poor");
assert.equal(assessPdfTextQuality("", 1).quality, "failed");

const segments = splitTextIntoChunkSegments("Eerste alinea.\n\nTweede alinea.");
assert.ok(segments.length >= 1);

console.log("ok: pdf-quality tests");
