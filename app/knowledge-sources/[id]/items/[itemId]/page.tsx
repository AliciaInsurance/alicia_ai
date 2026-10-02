export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/badge";
import {
  approveKnowledgeItem,
  deleteKnowledgeItem,
  rejectKnowledgeItem,
  reprocessKnowledgeItem,
  updateKnowledgeItem,
} from "@/lib/actions/knowledge";
import { KNOWLEDGE_TYPE_LABELS } from "@/lib/knowledge/constants";
import { requireAdminUser } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KnowledgeItem } from "@/lib/types/database";

export default async function KnowledgeItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itemId: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  await requireAdminUser();
  const { id: sourceId, itemId } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();

  const [{ data: row }, { data: sourceRow }] = await Promise.all([
    supabase
      .from("knowledge_documents")
      .select("*")
      .eq("id", itemId)
      .eq("knowledge_source_id", sourceId)
      .maybeSingle(),
    supabase.from("knowledge_sources").select("name").eq("id", sourceId).maybeSingle(),
  ]);

  const item = row as KnowledgeItem | null;
  if (!item) notFound();
  const sourceName = (sourceRow as { name: string } | null)?.name ?? "kennisbron";

  const previewText = item.raw_text?.trim() ?? "";
  const structured = item.structured_data;

  return (
    <AdminShell
      eyebrow="Kennisitem"
      title={item.title}
      description={KNOWLEDGE_TYPE_LABELS[item.knowledge_type] ?? item.knowledge_type}
    >
      <p className="mb-4 text-sm">
        <Link href={`/knowledge-sources/${sourceId}`} className="text-forest hover:underline">
          ← Terug naar {sourceName}
        </Link>
      </p>

      {query.error ? (
        <p role="alert" className="mb-4 rounded-2xl bg-danger-bg px-5 py-4 text-[15px] text-danger">
          {query.error}
        </p>
      ) : null}
      {query.notice ? (
        <p className="mb-4 rounded-2xl bg-warn-bg px-5 py-4 text-[15px] text-warn">{query.notice}</p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={item.status} />
        <StatusBadge status={item.review_status} />
      </div>

      <section className="card-surface mb-6 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink">Metadata</h2>
        <form action={updateKnowledgeItem.bind(null, itemId, sourceId)} className="mt-4 space-y-3">
          <Input name="title" defaultValue={item.title} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="category" defaultValue={item.category ?? ""} placeholder="Categorie" />
            <Input name="owner" defaultValue={item.owner ?? ""} placeholder="Eigenaar" />
            <Input
              name="version_label"
              defaultValue={item.version_label ?? ""}
              placeholder="Versie"
            />
            <Input name="product" defaultValue={item.product ?? ""} placeholder="Product" />
            <Input
              name="document_type"
              defaultValue={item.document_type ?? ""}
              placeholder="Documenttype"
            />
            <Input
              name="valid_from"
              type="date"
              defaultValue={item.valid_from?.slice(0, 10) ?? ""}
            />
            <Input
              name="valid_until"
              type="date"
              defaultValue={item.valid_until?.slice(0, 10) ?? ""}
            />
          </div>
          {item.knowledge_type === "manual_text" ? (
            <Textarea name="text" rows={12} defaultValue={previewText} />
          ) : null}
          <Button type="submit" variant="secondary">
            Opslaan
          </Button>
        </form>
      </section>

      <section className="card-surface mb-6 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink">Bron & techniek</h2>
        <dl className="mt-3 space-y-2 text-sm text-muted">
          {item.source_url ? (
            <div>
              <dt className="text-stone">URL</dt>
              <dd>
                <a href={item.source_url} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                  {item.source_url}
                </a>
              </dd>
            </div>
          ) : null}
          {item.filename ? (
            <div>
              <dt className="text-stone">Bestand</dt>
              <dd>{item.filename}</dd>
            </div>
          ) : null}
          {item.content_type ? (
            <div>
              <dt className="text-stone">Content-Type</dt>
              <dd>{item.content_type}</dd>
            </div>
          ) : null}
          {item.fetched_at ? (
            <div>
              <dt className="text-stone">Ophalen</dt>
              <dd>{new Date(item.fetched_at).toLocaleString("nl-NL")}</dd>
            </div>
          ) : null}
          {item.error_message ? (
            <div>
              <dt className="text-stone">Fout</dt>
              <dd className="text-danger">{item.error_message}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="card-surface mb-6 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-ink">Preview</h2>
        {structured ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr>
                  {structured.headers.map((h) => (
                    <th key={h} className="border-b border-ink/10 px-2 py-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {structured.rows.slice(0, 20).map((row, idx) => (
                  <tr key={idx}>
                    {structured.headers.map((h) => (
                      <td key={h} className="border-b border-ink/5 px-2 py-1">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {structured.rows.length > 20 ? (
              <p className="mt-2 text-xs text-muted">
                … {structured.rows.length - 20} extra rijen
              </p>
            ) : null}
          </div>
        ) : previewText ? (
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-cream/60 p-4 text-xs leading-relaxed">
            {previewText.slice(0, 12000)}
            {previewText.length > 12000 ? "…" : ""}
          </pre>
        ) : (
          <p className="mt-3 text-muted text-sm">Geen preview beschikbaar.</p>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        <form action={approveKnowledgeItem.bind(null, itemId, sourceId)}>
          <Button type="submit">Goedkeuren</Button>
        </form>
        <form action={rejectKnowledgeItem.bind(null, itemId, sourceId)}>
          <Button type="submit" variant="secondary">
            Afkeuren
          </Button>
        </form>
        <form action={reprocessKnowledgeItem.bind(null, itemId, sourceId)}>
          <Button type="submit" variant="ghost">
            Opnieuw verwerken
          </Button>
        </form>
        <form action={deleteKnowledgeItem.bind(null, itemId, sourceId)}>
          <Button type="submit" variant="outline">
            Verwijderen
          </Button>
        </form>
      </section>
    </AdminShell>
  );
}
