import OpenAI from "openai";
import { PDFDocument } from "pdf-lib";
import { getOpenAIApiKey } from "@/lib/env";
import { log } from "@/lib/logger";
import {
  PDF_LIMITS,
  PDF_TOO_LARGE_MESSAGE,
  assertPdfWithinPageLimits,
  assertPdfWithinSizeLimits,
} from "@/lib/knowledge/pdf-limits";
import { visionPromptForPage } from "@/lib/knowledge/pdf-vision-prompt";

const VISION_MODEL = process.env.ALICIA_PDF_VISION_MODEL?.trim() || "gpt-4o";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: getOpenAIApiKey() });
  return openai;
}

async function splitPdfIntoSinglePages(buffer: Buffer): Promise<Buffer[]> {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const total = src.getPageCount();
  assertPdfWithinPageLimits(total);

  const pages: Buffer[] = [];
  for (let i = 0; i < total; i++) {
    const doc = await PDFDocument.create();
    const [copied] = await doc.copyPages(src, [i]);
    doc.addPage(copied);
    const bytes = await doc.save();
    pages.push(Buffer.from(bytes));
  }
  return pages;
}

async function transcribeSinglePagePdf(
  pageBuffer: Buffer,
  pageNum: number,
  total: number,
  signal: AbortSignal,
): Promise<string> {
  const client = getOpenAI();
  const base64 = pageBuffer.toString("base64");
  const prompt = visionPromptForPage(pageNum, total);

  const completion = await client.chat.completions.create(
    {
      model: VISION_MODEL,
      temperature: 0,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "file",
              file: {
                filename: `page-${pageNum}.pdf`,
                file_data: `data:application/pdf;base64,${base64}`,
              },
            },
          ],
        },
      ],
    },
    { signal },
  );

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error(`Vision-extractie levert geen tekst voor pagina ${pageNum}`);
  }
  return content;
}

export type VisionExtractResult = {
  text: string;
  pageCount: number;
  model: string;
};

/** Vision fallback for scanned/image-only PDFs (server-side, page order preserved). */
export async function extractPdfWithVision(buffer: Buffer): Promise<VisionExtractResult> {
  assertPdfWithinSizeLimits(buffer.length);
  const pageBuffers = await splitPdfIntoSinglePages(buffer);
  const total = pageBuffers.length;
  const started = Date.now();
  const deadline = started + PDF_LIMITS.visionTotalTimeoutMs;

  const parts: string[] = [];

  for (let i = 0; i < total; i++) {
    const pageNum = i + 1;
    if (Date.now() > deadline) {
      throw new Error(PDF_TOO_LARGE_MESSAGE);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PDF_LIMITS.visionPageTimeoutMs);

    try {
      const pageText = await transcribeSinglePagePdf(
        pageBuffers[i]!,
        pageNum,
        total,
        controller.signal,
      );
      parts.push(pageText);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      if (detail.includes("abort")) {
        throw new Error(`Timeout bij vision-extractie (pagina ${pageNum})`);
      }
      throw new Error(`Vision-extractie mislukt op pagina ${pageNum}: ${detail}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  const text = parts.join("\n\n").trim();
  if (!text) {
    throw new Error("Vision-extractie leverde geen tekst op");
  }

  log.info("pdf_vision_extract_complete", {
    pageCount: total,
    model: VISION_MODEL,
    latencyMs: Date.now() - started,
  });

  return { text, pageCount: total, model: VISION_MODEL };
}

export function getPdfVisionModel(): string {
  return VISION_MODEL;
}
