"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/login/google-icon";
import { nl } from "@/lib/i18n/nl";

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
      <Button
        type="submit"
        size="lg"
        className="h-14 w-full cursor-pointer gap-3 text-[15px] hover:-translate-y-px"
        disabled={!csrfToken}
      >
        <GoogleIcon className="h-5 w-5" />
        {nl.login.signIn}
      </Button>
    </form>
  );
}
