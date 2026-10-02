import type { DbHealth } from "@/lib/supabase/status";

export function DatabaseNotice({ health }: { health: DbHealth }) {
  if (health.reachable && !health.hint) return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-2xl border border-danger/20 bg-danger-bg px-5 py-4 text-[15px] leading-relaxed text-danger"
    >
      <p className="font-semibold text-ink">Database / testdata</p>
      {health.message ? <p className="mt-2">{health.message}</p> : null}
      {health.code ? (
        <p className="mt-1 font-mono text-xs text-stone">code: {health.code}</p>
      ) : null}
      {health.hint ? <p className="mt-3 text-ink">{health.hint}</p> : null}
      <p className="mt-3 text-sm text-muted">
        Verify in Supabase SQL:{" "}
        <code className="text-ink">SELECT slug, status FROM alicia_ai.assistants;</code>
      </p>
    </div>
  );
}
