export function loginErrorMessage(
  error: string | undefined,
  hint?: string,
  reason?: string
): string | null {
  if (!error) return null;

  switch (error) {
    case "AccessDenied":
      if (reason === "allowlist") {
        return "Your account is not on the Alicia AI admin allowlist.";
      }
      return "Only verified @alicia.insure Google accounts can sign in.";
    case "Configuration":
      if (hint === "missing_pkce_cookie") {
        return "Sign-in cookie mismatch. Use https://ask.alicia.insure and check AUTH_URL.";
      }
      return "Authentication is not configured correctly.";
    case "OAuthCallback":
    case "Callback":
      return "Google sign-in could not be completed. Please try again.";
    default:
      return "Sign-in failed. Please try again.";
  }
}
