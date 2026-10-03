import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addManualTextItem,
  addWebItem,
  uploadDocumentItem,
  uploadStructuredDataItem,
} from "@/lib/actions/knowledge";

function MetaFields() {
  return (
    <>
      <Input name="category" placeholder="Categorie (optioneel)" />
      <Input name="owner" placeholder="Eigenaar / bron (optioneel)" />
      <Input name="version_label" placeholder="Versie (optioneel)" />
      <Input name="product" placeholder="Product (optioneel)" />
      <Input name="document_type" placeholder="Documenttype: Voorwaarden, IPID, FAQ" />
      <Input
        name="authority_rank"
        type="number"
        min={1}
        max={100}
        placeholder="Prioriteit (1=hoogst, leeg=auto uit type)"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="valid_from" type="date" placeholder="Geldig vanaf" />
        <Input name="valid_until" type="date" placeholder="Geldig tot" />
      </div>
    </>
  );
}

export function AddKnowledgePanel({ sourceId }: { sourceId: string }) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold text-ink">Kennis toevoegen</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink/5 p-4">
          <h3 className="font-semibold text-ink">Tekst</h3>
          <p className="mt-1 text-xs text-stone">FAQ, uitleg of handmatige kennis</p>
          <form action={addManualTextItem.bind(null, sourceId)} className="mt-3 space-y-2">
            <Input name="title" placeholder="Titel" required />
            <Textarea name="text" rows={5} placeholder="Inhoud…" required />
            <MetaFields />
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" name="save_as_draft" />
              Opslaan als concept (nog niet verwerken)
            </label>
            <Button type="submit" size="sm">
              Opslaan
            </Button>
          </form>
        </div>

        <div className="rounded-2xl border border-ink/5 p-4">
          <h3 className="font-semibold text-ink">Bestand</h3>
          <p className="mt-1 text-xs text-stone">PDF, TXT of MD</p>
          <form action={uploadDocumentItem.bind(null, sourceId)} className="mt-3 space-y-2">
            <Input name="title" placeholder="Titel (optioneel)" />
            <input
              name="file"
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              className="text-sm text-muted"
              required
            />
            <MetaFields />
            <Button type="submit" size="sm">
              Uploaden & verwerken
            </Button>
          </form>
        </div>

        <div className="rounded-2xl border border-ink/5 p-4">
          <h3 className="font-semibold text-ink">Link</h3>
          <p className="mt-1 text-xs text-stone">Openbare webpagina of document-URL</p>
          <form action={addWebItem.bind(null, sourceId)} className="mt-3 space-y-2">
            <Input name="title" placeholder="Titel (optioneel)" />
            <Input name="url" type="url" placeholder="https://…" required />
            <MetaFields />
            <Button type="submit" size="sm">
              Ophalen & verwerken
            </Button>
          </form>
        </div>

        <div className="rounded-2xl border border-ink/5 p-4">
          <h3 className="font-semibold text-ink">Data</h3>
          <p className="mt-1 text-xs text-stone">CSV / gestructureerde lijst</p>
          <form action={uploadStructuredDataItem.bind(null, sourceId)} className="mt-3 space-y-2">
            <Input name="title" placeholder="Titel (optioneel)" />
            <input
              name="file"
              type="file"
              accept=".csv,.json,text/csv,application/json"
              className="text-sm text-muted"
              required
            />
            <MetaFields />
            <Button type="submit" size="sm">
              Uploaden & verwerken
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
