"use client";

import { useEffect } from "react";

export function LoginErrorBanner({ message }: { message: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ["error", "reason", "hint"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  return (
    <p
      role="alert"
      className="site-fade-up mt-6 rounded-2xl bg-danger-bg px-4 py-3 text-left text-sm leading-relaxed text-danger"
    >
      {message}
    </p>
  );
}
