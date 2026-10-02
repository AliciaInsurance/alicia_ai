/**
 * Lightweight checks for PDF quality + chunk page markers (run: npx tsx lib/knowledge/pdf-ingest.test.mts)
 */
import assert from "node:assert/strict";
import { splitTextIntoChunkSegments, isPageMarkerLine } from "./chunking.ts";
import { assessPdfTextQuality } from "./pdf-text-quality.ts";

function testQualityGoodTextLayer() {
  const text = "Artikel 1. Dekking.\n".repeat(40);
  const result = assessPdfTextQuality(text, 3);
  assert.equal(result.quality, "good");
}

function testQualityPoorScan() {
  const result = assessPdfTextQuality("---\n| | |\n", 5);
  assert.equal(result.quality, "poor");
}

function testQualityFailedEmpty() {
  const result = assessPdfTextQuality("   ", 2);
  assert.equal(result.quality, "failed");
}

function testPageChunking() {
  const text = `--- Pagina 1 ---
Artikel 1. Foo bar baz.

--- Pagina 2 ---
Artikel 2. Another clause here.`;
  assert.ok(isPageMarkerLine("--- Pagina 1 ---"));
  const segments = splitTextIntoChunkSegments(text);
  assert.ok(segments.length >= 2);
  assert.equal(segments[0]?.pageFrom, 1);
  assert.equal(segments[1]?.pageFrom, 2);
}

for (const [name, fn] of [
  ["quality good text layer", testQualityGoodTextLayer],
  ["quality poor scan", testQualityPoorScan],
  ["quality failed empty", testQualityFailedEmpty],
  ["page-aware chunking", testPageChunking],
] as const) {
  try {
    fn();
    console.log(`ok: ${name}`);
  } catch (err) {
    console.error(`fail: ${name}`, err);
    process.exitCode = 1;
  }
}
