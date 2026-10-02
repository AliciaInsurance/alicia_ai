export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/badge";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  addManualDocument,
  addUrlDocument,
  processAllPending,
  reprocessDocument,
  uploadDocument,
} from "@/lib/actions/knowledge";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KnowledgeDocument, KnowledgeSource } from "@/lib/types/database";

export default async function KnowledgeSourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const query = await searchParams;
  const flashError = query.error?.trim();
  const flashNotice = query.notice?.trim();
  const supabase = createAdminClient();

  const { data: sourceRow } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const source = sourceRow as KnowledgeSource | null;

  if (!source) notFound();

  const { data: documents } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("knowledge_source_id", id)
    .order("created_at", { ascending: false });

  return (
    <AdminShell
      eyebrow="Kennisbron"
      title={source.name}
      description={source.description ?? undefined}
    >
      {flashError ? (
        <p
          role="alert"
          className="mb-6 rounded-2xl bg-danger-bg px-5 py-4 text-[15px] text-danger"
        >
          {flashError}
        </p>
      ) : null}
      {flashNotice ? (
        <p className="mb-6 rounded-2xl bg-warn-bg px-5 py-4 text-[15px] text-warn">
          {flashNotice}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">Tekst toevoegen</h2>
          <form action={addManualDocument.bind(null, id)} className="mt-4 space-y-3">
            <Input name="title" placeholder="Titel" />
            <Textarea
              name="text"
              required
              rows={8}
              placeholder="Plak FAQ- of policy-tekst…"
            />
            <Button type="submit">Opslaan & verwerken</Button>
          </form>
        </section>

        <section className="card-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">Bestand uploaden</h2>
          <p className="mt-1 text-xs text-stone">PDF, .txt of .md — max 8MB</p>
          <form action={uploadDocument.bind(null, id)} className="mt-4 space-y-3">
            <input
              name="file"
              type="file"
              accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
              className="text-[15px] text-muted"
            />
            <Button type="submit">Upload & verwerken</Button>
          </form>
        </section>

        <section className="card-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">URL toevoegen</h2>
          <p className="mt-1 text-xs text-stone">
            Publieke link naar PDF/tekst, Google Doc of Google Sheet (iedereen met de link).
          </p>
          <form action={addUrlDocument.bind(null, id)} className="mt-4 space-y-3">
            <Input name="title" placeholder="Titel (optioneel)" />
            <Input
              name="url"
              type="url"
              required
              placeholder="https://…"
              autoComplete="url"
            />
            <Button type="submit">Ophalen & verwerken</Button>
          </form>
        </section>
      </div>

      <section className="card-surface mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink">Documenten</h2>
          <form action={processAllPending.bind(null, id)}>
            <Button type="submit" variant="secondary" size="sm">
              Verwerk pending
            </Button>
          </form>
        </div>
        <ul className="mt-4 divide-y divide-ink/5">
          {(documents as KnowledgeDocument[] | null)?.map((doc) => (
            <li key={doc.id} className="py-4 text-[15px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-ink">{doc.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone">
                    <span>{doc.source_type}</span>
                    <StatusBadge status={doc.status} />
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
                  ) : null}
                  {doc.error_message ? (
                    <div className="mt-1 text-xs text-danger">{doc.error_message}</div>
                  ) : null}
                </div>
                <form action={reprocessDocument.bind(null, doc.id, id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Opnieuw
                  </Button>
                </form>
              </div>
            </li>
          ))}
          {!documents?.length ? (
            <li className="py-4 text-muted">Nog geen documenten.</li>
          ) : null}
        </ul>
      </section>
    </AdminShell>
  );
}
