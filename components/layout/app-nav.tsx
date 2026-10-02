"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { AliciaAppSwitcher } from "@/components/alicia/AliciaAppSwitcher";
import { BrandLockup } from "@/components/brand/alicia-logo";
import type { AliciaAppDefinition } from "@/lib/alicia/apps";
import { CURRENT_ALICIA_APP_ID } from "@/lib/alicia/current-app";
import { nl } from "@/lib/i18n/nl";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/assistants", label: nl.nav.assistants },
  { href: "/knowledge-sources", label: nl.nav.knowledge },
];

type PlatformPayload = {
  apps: AliciaAppDefinition[];
  user: { email: string; name: string | null; image: string | null } | null;
};

function UserInitials({
  name,
  email,
  image,
}: {
  name: string | null;
  email: string;
  image: string | null;
}) {
  const label = name?.trim() || email;
  const initials = label
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className="h-8 w-8 rounded-full object-cover" />
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white">
      {initials || "A"}
    </span>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const [platform, setPlatform] = useState<PlatformPayload | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/alicia/platform", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setPlatform(json as PlatformPayload);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const apps = platform?.apps ?? [];
  const user = platform?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-ink/5 bg-cream/95 pt-[env(safe-area-inset-top)] shadow-[var(--shadow-header)] backdrop-blur-md">
      <div className="flex h-[3.75rem] w-full items-center justify-between gap-2 px-4 sm:h-[4.25rem] sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3 sm:gap-8 lg:gap-12">
          <BrandLockup size="nav" />

          <nav className="flex min-w-0 items-center overflow-x-auto">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative shrink-0 px-2.5 py-2 text-[13px] font-medium transition-colors sm:px-4 sm:text-[15px]",
                    active ? "text-ink nav-active" : "text-muted hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                type="button"
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <UserInitials name={user.name} email={user.email} image={user.image} />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-56 rounded-[14px] border border-ink/10 bg-white p-2 shadow-[var(--shadow-soft)]">
                  <p className="px-3 py-2 text-[13px] text-stone">{user.email}</p>
                  <button
                    type="button"
                    className="w-full rounded-xl px-3 py-2 text-left text-[15px] hover:bg-cream"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    {nl.nav.logout}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <AliciaAppSwitcher apps={apps} currentAppId={CURRENT_ALICIA_APP_ID} />
        </div>
      </div>
    </header>
  );
}
