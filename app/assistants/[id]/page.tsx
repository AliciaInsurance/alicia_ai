import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ChatPanel } from "@/components/chat-panel";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  setAssistantStatus,
  updateAssistant,
  updateWidgetConfig,
} from "@/lib/actions/assistants";
import {
  attachSourceToAssistant,
  detachSourceFromAssistant,
  processAllPending,
} from "@/lib/actions/knowledge";
import { getPublicAppUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Assistant, KnowledgeSource, WidgetConfig } from "@/lib/types/database";
import type { AssistantSource } from "@/lib/types/supabase-database";

export default async function AssistantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: assistantRow } = await supabase
    .from("assistants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const assistant = assistantRow as Assistant | null;

  if (!assistant) notFound();

  const [{ data: widgetRow }, { data: sourceLinks }, { data: allSources }] = await Promise.all([
    supabase.from("widget_configs").select("*").eq("assistant_id", id).maybeSingle(),
    supabase.from("assistant_sources").select("knowledge_source_id").eq("assistant_id", id),
    supabase.from("knowledge_sources").select("*").order("name"),
  ]);

  const attachedSourceIds = ((sourceLinks ?? []) as AssistantSource[]).map(
    (row) => row.knowledge_source_id
  );
  const { data: attachedSourcesData } =
    attachedSourceIds.length > 0
      ? await supabase.from("knowledge_sources").select("*").in("id", attachedSourceIds)
      : { data: [] as KnowledgeSource[] };

  const attachedSources = (attachedSourcesData ?? []) as KnowledgeSource[];

  for (const source of attachedSources) {
    await processAllPending(source.id).catch(() => undefined);
  }

  const widget = widgetRow as WidgetConfig | null;

  const appUrl = getPublicAppUrl().replace(/\/$/, "");
  const publicSlug = widget?.public_slug ?? assistant.slug;

  async function activate() {
    "use server";
    await setAssistantStatus(id, "active");
  }

  async function deactivate() {
    "use server";
    await setAssistantStatus(id, "inactive");
  }

  async function attachSource(formData: FormData) {
    "use server";
    const sourceId = String(formData.get("source_id") ?? "");
    if (sourceId) await attachSourceToAssistant(id, sourceId);
  }

  return (
    <AdminShell title={assistant.internal_name}>
      <p className="mb-6 text-sm text-slate-600">
        Customer-facing identity: <strong>{assistant.customer_display_name}</strong> · slug{" "}
        <code className="rounded bg-slate-100 px-1">{assistant.slug}</code>
      </p>

      <div className="mb-4 flex gap-2">
        <form action={activate}>
          <button type="submit" className="rounded-lg border bg-white px-4 py-2 text-sm">
            Activate
          </button>
        </form>
        <form action={deactivate}>
          <button type="submit" className="rounded-lg border bg-white px-4 py-2 text-sm">
            Deactivate
          </button>
        </form>
      </div>

      <div className="space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">1. General</h2>
          <form
            action={updateAssistant.bind(null, id)}
            className="mt-3 grid gap-3 md:grid-cols-2"
          >
            <input type="hidden" name="system_instructions" value={assistant.system_instructions} />
            <input
              type="hidden"
              name="personality_instructions"
              value={assistant.personality_instructions}
            />
            <label className="text-sm">
              Internal name
              <input
                name="internal_name"
                defaultValue={assistant.internal_name}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Slug
              <input
                name="slug"
                defaultValue={assistant.slug}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Status
              <select
                name="status"
                defaultValue={assistant.status}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            <label className="text-sm">
              Model
              <input
                name="model"
                defaultValue={assistant.model}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Greeting
              <textarea
                name="greeting"
                defaultValue={assistant.greeting}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Fallback message
              <textarea
                name="fallback_message"
                defaultValue={assistant.fallback_message}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">
                Save general
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">2. Personality & instructions</h2>
          <form action={updateAssistant.bind(null, id)} className="mt-3 space-y-3">
            <input type="hidden" name="internal_name" value={assistant.internal_name} />
            <input type="hidden" name="slug" value={assistant.slug} />
            <input type="hidden" name="status" value={assistant.status} />
            <input type="hidden" name="model" value={assistant.model} />
            <input type="hidden" name="greeting" value={assistant.greeting} />
            <input type="hidden" name="fallback_message" value={assistant.fallback_message} />
            <label className="block text-sm">
              System instructions
              <textarea
                name="system_instructions"
                defaultValue={assistant.system_instructions}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="block text-sm">
              Personality / tone
              <textarea
                name="personality_instructions"
                defaultValue={assistant.personality_instructions}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">
              Save instructions
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">3. Knowledge</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {attachedSources.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <Link href={`/knowledge-sources/${s.id}`} className="font-medium text-teal-800 hover:underline">
                  {s.name}
                </Link>
                <form action={detachSourceFromAssistant.bind(null, id, s.id)}>
                  <button type="submit" className="text-xs text-slate-600 hover:text-red-700">
                    Detach
                  </button>
                </form>
              </li>
            ))}
            {attachedSources.length === 0 ? (
              <li className="text-slate-500">No knowledge sources attached.</li>
            ) : null}
          </ul>

          <form className="mt-4 flex flex-wrap gap-2" action={attachSource}>
            <select name="source_id" className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Attach existing source…</option>
              {(allSources as KnowledgeSource[] | null)?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-lg border px-3 py-2 text-sm">
              Attach
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">4. Widget</h2>
          {widget ? (
            <form action={updateWidgetConfig.bind(null, id)} className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Public slug
                <input
                  name="public_slug"
                  defaultValue={widget.public_slug}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Primary colour
                <input
                  name="primary_color"
                  defaultValue={widget.primary_color ?? "#0f766e"}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                Position
                <input
                  name="position"
                  defaultValue={widget.position}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm md:mt-6">
                <input type="checkbox" name="is_enabled" defaultChecked={widget.is_enabled} />
                Enabled
              </label>
              <div className="md:col-span-2">
                <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white">
                  Save widget
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No widget config row yet.</p>
          )}

          <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`<script
  src="${appUrl}/widget.js"
  data-assistant="${publicSlug}">
</script>`}
          </pre>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">5. Test</h2>
          <p className="mt-1 text-sm text-slate-600">
            Uses the same <code>/api/chat</code> flow as the public widget (admin_test channel).
          </p>
          <div className="mt-3 h-[480px]">
            <ChatPanel
              assistantSlug={assistant.slug}
              channel="admin_test"
              displayName={assistant.customer_display_name}
              greeting={assistant.greeting}
              primaryColor={widget?.primary_color ?? "#0f766e"}
              showDevErrors
            />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
