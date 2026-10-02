export const dynamic = "force-dynamic";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { isAuthConfigured, isAuthRequired } from "@/lib/auth/auth";
import { formatLoginError } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

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

  const callbackUrl =
    firstParam(params.callbackUrl) ?? firstParam(params.next) ?? "/assistants";
  const errorMessage = formatLoginError({
    error: firstParam(params.error),
    hint: firstParam(params.hint),
    reason: firstParam(params.reason),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Alicia AI Admin</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sign in with your Alicia Google Workspace account.
        </p>

        {!isAuthConfigured() ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Google OAuth is not configured. Set AUTH_SECRET, GOOGLE_CLIENT_ID and
            GOOGLE_CLIENT_SECRET.
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {isAuthConfigured() ? (
          <div className="mt-6">
            <GoogleSignInButton callbackUrl={callbackUrl} />
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs text-slate-500">
          Admin access is limited to <strong>@alicia.insure</strong> accounts.
        </p>
      </div>
    </div>
  );
}
