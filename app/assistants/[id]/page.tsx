export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ChatPanel } from "@/components/chat-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/badge";
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
    <AdminShell
      eyebrow="Assistant"
      title={assistant.internal_name}
      description={`Klantidentiteit: ${assistant.customer_display_name} · slug ${assistant.slug}`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={assistant.status} />
        <form action={activate}>
          <Button type="submit" variant="secondary" size="sm">
            Activeren
          </Button>
        </form>
        <form action={deactivate}>
          <Button type="submit" variant="outline" size="sm">
            Deactiveren
          </Button>
        </form>
      </div>

      <div className="space-y-8">
        <section className="card-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">1. Algemeen</h2>
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
            <label className="block text-[15px] font-medium text-ink">
              Interne naam
              <Input name="internal_name" defaultValue={assistant.internal_name} className="mt-2" />
            </label>
            <label className="block text-[15px] font-medium text-ink">
              Slug
              <Input name="slug" defaultValue={assistant.slug} className="mt-2" />
            </label>
            <label className="block text-[15px] font-medium text-ink">
              Status
              <select
                name="status"
                defaultValue={assistant.status}
                className="mt-2 h-11 w-full rounded-2xl border border-input-border bg-cream px-4 text-[15px]"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
            <label className="block text-[15px] font-medium text-ink">
              Model
              <Input name="model" defaultValue={assistant.model} className="mt-2" />
            </label>
            <label className="block text-[15px] font-medium text-ink md:col-span-2">
              Begroeting
              <Textarea name="greeting" defaultValue={assistant.greeting} rows={2} className="mt-2" />
            </label>
            <label className="block text-[15px] font-medium text-ink md:col-span-2">
              Fallback-bericht
              <Textarea
                name="fallback_message"
                defaultValue={assistant.fallback_message}
                rows={2}
                className="mt-2"
              />
            </label>
            <div className="md:col-span-2">
              <Button type="submit">Opslaan</Button>
            </div>
          </form>
        </section>

        <section className="card-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">2. Instructies</h2>
          <form action={updateAssistant.bind(null, id)} className="mt-3 space-y-3">
            <input type="hidden" name="internal_name" value={assistant.internal_name} />
            <input type="hidden" name="slug" value={assistant.slug} />
            <input type="hidden" name="status" value={assistant.status} />
            <input type="hidden" name="model" value={assistant.model} />
            <input type="hidden" name="greeting" value={assistant.greeting} />
            <input type="hidden" name="fallback_message" value={assistant.fallback_message} />
            <label className="block text-[15px] font-medium text-ink">
              System instructions
              <Textarea
                name="system_instructions"
                defaultValue={assistant.system_instructions}
                rows={4}
                className="mt-2 font-mono text-xs"
              />
            </label>
            <label className="block text-[15px] font-medium text-ink">
              Personality / tone
              <Textarea
                name="personality_instructions"
                defaultValue={assistant.personality_instructions}
                rows={3}
                className="mt-2"
              />
            </label>
            <Button type="submit">Opslaan</Button>
          </form>
        </section>

        <section className="card-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">3. Kennis</h2>
          <ul className="mt-3 space-y-2 text-[15px]">
            {attachedSources.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/5"
              >
                <Link href={`/knowledge-sources/${s.id}`} className="font-semibold text-forest hover:underline">
                  {s.name}
                </Link>
                <form action={detachSourceFromAssistant.bind(null, id, s.id)}>
                  <Button type="submit" variant="ghost" size="sm" className="text-danger">
                    Loskoppelen
                  </Button>
                </form>
              </li>
            ))}
            {attachedSources.length === 0 ? (
              <li className="text-muted">Geen kennisbronnen gekoppeld.</li>
            ) : null}
          </ul>

          <form className="mt-4 flex flex-wrap gap-2" action={attachSource}>
            <select
              name="source_id"
              className="h-11 rounded-2xl border border-input-border bg-cream px-4 text-[15px]"
            >
              <option value="">Koppel bestaande bron…</option>
              {(allSources as KnowledgeSource[] | null)?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Koppelen
            </Button>
          </form>
        </section>

        <section className="card-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">4. Widget</h2>
          {widget ? (
            <form action={updateWidgetConfig.bind(null, id)} className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="block text-[15px] font-medium text-ink">
                Public slug
                <Input name="public_slug" defaultValue={widget.public_slug} className="mt-2" />
              </label>
              <label className="block text-[15px] font-medium text-ink">
                Primary colour
                <Input
                  name="primary_color"
                  defaultValue={widget.primary_color ?? "#2d4a3e"}
                  className="mt-2"
                />
              </label>
              <label className="block text-[15px] font-medium text-ink">
                Position
                <Input name="position" defaultValue={widget.position} className="mt-2" />
              </label>
              <label className="flex items-center gap-2 text-[15px] md:mt-8">
                <input type="checkbox" name="is_enabled" defaultChecked={widget.is_enabled} />
                Enabled
              </label>
              <div className="md:col-span-2">
                <Button type="submit">Opslaan</Button>
              </div>
            </form>
          ) : (
            <p className="mt-2 text-[15px] text-muted">Nog geen widget-configuratie.</p>
          )}

          <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink p-4 text-xs text-cream">
{`<script
  src="${appUrl}/widget.js"
  data-assistant="${publicSlug}">
</script>`}
          </pre>
        </section>

        <section className="card-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-ink">5. Test</h2>
          <p className="mt-1 text-[15px] text-muted">
            Zelfde <code className="text-ink">/api/chat</code> flow als de publieke widget (admin_test).
          </p>
          <div className="mt-3 h-[480px]">
            <ChatPanel
              assistantSlug={assistant.slug}
              channel="admin_test"
              displayName={assistant.customer_display_name}
              greeting={assistant.greeting}
              primaryColor={widget?.primary_color ?? "#2d4a3e"}
              showDevErrors
            />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
