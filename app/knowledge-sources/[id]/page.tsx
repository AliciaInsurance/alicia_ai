import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  addManualDocument,
  processAllPending,
  reprocessDocument,
  uploadDocument,
} from "@/lib/actions/knowledge";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KnowledgeDocument, KnowledgeSource } from "@/lib/types/database";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

export default async function KnowledgeSourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: source } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", id)
    .maybeSingle<KnowledgeSource>();

  if (!source) notFound();

  await processAllPending(id).catch(() => undefined);

  const { data: documents } = await supabase
    .from("knowledge_documents")
    .select("*")
    .eq("knowledge_source_id", id)
    .order("created_at", { ascending: false });

  return (
    <AdminShell title={source.name}>
      {source.description ? (
        <p className="mb-4 text-sm text-slate-600">{source.description}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Add manual text</h2>
          <form action={addManualDocument.bind(null, id)} className="mt-3 space-y-3">
            <input
              name="title"
              placeholder="Title"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              name="text"
              required
              rows={8}
              placeholder="Paste FAQ or policy excerpt…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">
              Save & process
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Upload file</h2>
          <p className="mt-1 text-xs text-slate-500">PDF, .txt or .md — max 8MB</p>
          <form action={uploadDocument.bind(null, id)} className="mt-3 space-y-3">
            <input name="file" type="file" accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf" />
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">
              Upload & process
            </button>
          </form>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Documents</h2>
          <form action={processAllPending.bind(null, id)}>
            <button type="submit" className="text-sm text-teal-800 hover:underline">
              Process pending
            </button>
          </form>
        </div>
        <ul className="mt-3 divide-y divide-slate-100">
          {(documents as KnowledgeDocument[] | null)?.map((doc) => (
            <li key={doc.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{doc.title}</div>
                  <div className="text-xs text-slate-500">
                    {doc.source_type} · {STATUS_LABEL[doc.status] ?? doc.status}
                  </div>
                  {doc.error_message ? (
                    <div className="mt-1 text-xs text-red-600">{doc.error_message}</div>
                  ) : null}
                </div>
                <form action={reprocessDocument.bind(null, doc.id, id)}>
                  <button type="submit" className="text-xs text-slate-600 hover:text-teal-800">
                    Reprocess
                  </button>
                </form>
              </div>
            </li>
          ))}
          {!documents?.length ? (
            <li className="py-3 text-sm text-slate-500">No documents yet.</li>
          ) : null}
        </ul>
      </section>
    </AdminShell>
  );
}
