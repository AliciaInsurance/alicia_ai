import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import {
  approveDocumentExtraction,
  rejectDocumentExtraction,
  rerunDocumentExtraction,
  reprocessDocument,
} from "@/lib/actions/knowledge";
import type { KnowledgeDocument } from "@/lib/types/database";

function extractionMethodLabel(method: KnowledgeDocument["extraction_method"]): string {
  if (method === "vision") return "Vision-extractie";
  if (method === "text") return "Tekstextractie";
  return "—";
}

function reviewStatusLabel(status: KnowledgeDocument["extraction_review_status"]): string {
  switch (status) {
    case "pending":
      return "Controle nodig";
    case "approved":
      return "Goedgekeurd";
    case "rejected":
      return "Afgekeurd";
    default:
      return "Geen controle nodig";
  }
}

export function KnowledgeDocumentRow({
  doc,
  sourceId,
}: {
  doc: KnowledgeDocument;
  sourceId: string;
}) {
  const previewSource =
    doc.pending_raw_text?.trim() || doc.raw_text?.trim() || "";
  const preview = previewSource.slice(0, 2400);
  const showReview =
    doc.status === "awaiting_review" || doc.extraction_review_status === "pending";

  return (
    <li className="py-4 text-[15px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink">{doc.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone">
            <span>{doc.source_type}</span>
            <StatusBadge status={doc.status} />
            {doc.extraction_method ? (
              <span className="rounded-full bg-cream px-2 py-0.5 ring-1 ring-ink/5">
                {extractionMethodLabel(doc.extraction_method)}
              </span>
            ) : null}
            <span className="text-muted">{reviewStatusLabel(doc.extraction_review_status)}</span>
            {doc.page_count ? <span>{doc.page_count} pagina&apos;s</span> : null}
          </div>
          {doc.source_url ? (
            <a
              href={doc.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block max-w-xl truncate text-xs text-accent hover:underline"
            >
              {doc.source_url}
            </a>
          ) : doc.filename ? (
            <div className="mt-1 text-xs text-stone">{doc.filename}</div>
          ) : null}
          {doc.extraction_reason ? (
            <div className="mt-1 text-xs text-muted">{doc.extraction_reason}</div>
          ) : null}
          {doc.error_message ? (
            <div className="mt-1 text-xs text-danger">{doc.error_message}</div>
          ) : null}
          {preview ? (
            <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-cream/60 p-3 text-xs leading-relaxed text-ink whitespace-pre-wrap">
              {preview}
              {previewSource.length > preview.length ? "…" : ""}
            </pre>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {showReview ? (
            <>
              <form action={approveDocumentExtraction.bind(null, doc.id, sourceId)}>
                <Button type="submit" size="sm">
                  Goedkeuren
                </Button>
              </form>
              <form action={rejectDocumentExtraction.bind(null, doc.id, sourceId)}>
                <Button type="submit" variant="secondary" size="sm">
                  Afgekeurd
                </Button>
              </form>
            </>
          ) : null}
          <form action={rerunDocumentExtraction.bind(null, doc.id, sourceId)}>
            <Button type="submit" variant="ghost" size="sm">
              Extractie opnieuw uitvoeren
            </Button>
          </form>
          {!showReview ? (
            <form action={reprocessDocument.bind(null, doc.id, sourceId)}>
              <Button type="submit" variant="ghost" size="sm">
                Opnieuw verwerken
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}
