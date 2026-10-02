"use client";

import type { AliciaAppDefinition, AliciaAppId } from "@/lib/alicia/apps";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export function AliciaAppSwitcher({
  apps,
  currentAppId,
}: {
  apps: AliciaAppDefinition[];
  currentAppId: AliciaAppId;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (apps.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink hover:border-forest/30 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Apps ▾
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-[14px] border border-ink/10 bg-white p-2 shadow-[var(--shadow-soft)]">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone">
            Apps
          </p>
          {apps.map((app) => {
            const active = app.id === currentAppId;
            return (
              <a
                key={app.id}
                href={app.url}
                className={cn(
                  "block rounded-xl px-3 py-2.5 hover:bg-cream",
                  active && "bg-cream ring-1 ring-forest/15",
                )}
                onClick={() => setOpen(false)}
              >
                <span className="block text-[14px] font-semibold text-ink">{app.name}</span>
                <span className="mt-0.5 block text-[12px] text-muted">{app.description}</span>
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
