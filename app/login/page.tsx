export const dynamic = "force-dynamic";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LoginScreen } from "@/components/login/login-screen";
import { isAuthConfigured, isAuthRequired } from "@/lib/auth/auth";
import { formatLoginError } from "@/lib/auth/admin";
import { nl } from "@/lib/i18n/nl";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Inloggen",
};

function requestOrigin(headerStore: Awaited<ReturnType<typeof headers>>) {
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "ask.alicia.insure";
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    next?: string;
    error?: string;
    hint?: string;
    reason?: string;
  }>;
}) {
  const params = await searchParams;

  if (!isAuthRequired()) {
    redirect("/assistants");
  }

  if (!isAuthConfigured()) {
    return <LoginScreen errorMessage={nl.login.notConfigured}>{null}</LoginScreen>;
  }

  const origin = requestOrigin(await headers());
  const callbackUrl =
    firstParam(params.callbackUrl) ?? firstParam(params.next) ?? "/assistants";
  const errorMessage = formatLoginError(
    {
      error: firstParam(params.error),
      hint: firstParam(params.hint),
      reason: firstParam(params.reason),
    },
    origin,
  );

  return (
    <LoginScreen errorMessage={errorMessage}>
      <GoogleSignInButton callbackUrl={callbackUrl} />
    </LoginScreen>
  );
}
