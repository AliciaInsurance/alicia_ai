import { nl } from "@/lib/i18n/nl";

function hostFromOrigin(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return "ask.alicia.insure";
  }
}

export function loginErrorMessage(
  error: string | undefined,
  origin: string,
  hint?: string,
  reason?: string,
): string | null {
  if (!error) return null;

  switch (error) {
    case "AccessDenied":
      if (reason === "allowlist") return nl.login.allowlist;
      return nl.login.error;
    case "Configuration":
      if (hint === "missing_pkce_cookie") return nl.login.pkceError(hostFromOrigin(origin));
      if (hint === "token_exchange") return nl.login.tokenError;
      return nl.login.configError;
    case "OAuthCallback":
    case "Callback":
      return nl.login.callbackError(origin);
    case "OAuthSignIn":
    case "MissingCSRF":
      return `${nl.login.genericError} (${error})`;
    default:
      return error ? `${nl.login.genericError} (${error})` : nl.login.genericError;
  }
}
