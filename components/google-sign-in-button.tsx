"use client";

import { useEffect, useState } from "react";

export function GoogleSignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data: { csrfToken?: string }) => {
        if (!cancelled && data.csrfToken) setCsrfToken(data.csrfToken);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <form method="POST" action="/api/auth/signin/google">
      <input type="hidden" name="csrfToken" value={csrfToken} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <button
        type="submit"
        disabled={!csrfToken}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
      >
        <GoogleIcon />
        Sign in with Google
      </button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.203 36 24 36c-5.522 0-10-4.478-10-10s4.478-10 10-10c2.426 0 4.652.867 6.375 2.301l5.975-5.975C33.648 9.167 29.028 7 24 7 13.507 7 5 15.507 5 26s8.507 19 19 19 19-8.507 19-19c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c2.426 0 4.652.867 6.375 2.301l5.975-5.975C33.648 9.167 29.028 7 24 7c-7.682 0-14.344 4.337-17.657 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 45c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 36.091 26.715 37 24 37c-5.177 0-9.593-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 45 24 45z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 45 30.604 45 26c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
