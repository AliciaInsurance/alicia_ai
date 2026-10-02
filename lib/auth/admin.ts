import { redirect } from "next/navigation";
import { auth, isAuthConfigured, isAuthRequired } from "@/lib/auth/auth";
import { isAllowedEmail } from "@/lib/auth/auth-policy";
import { loginErrorMessage } from "@/lib/auth/login-error";

export async function requireAdminUser() {
  if (!isAuthRequired()) {
    return { email: "demo@alicia.insure", id: "demo", name: "Demo" };
  }

  if (!isAuthConfigured()) {
    redirect("/login?error=Configuration");
  }

  let session = null;
  try {
    session = await auth();
  } catch (error) {
    console.error("[auth] requireAdminUser", error);
    redirect("/login?error=Configuration");
  }

  if (!session?.user?.email || !isAllowedEmail(session.user.email)) {
    redirect("/login?callbackUrl=/assistants");
  }

  return session.user;
}

export function formatLoginError(
  searchParams: {
    error?: string;
    hint?: string;
    reason?: string;
  },
  origin: string,
) {
  return loginErrorMessage(searchParams.error, origin, searchParams.hint, searchParams.reason);
}
