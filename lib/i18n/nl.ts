export const nl = {
  app: {
    name: "Alicia AI",
    tagline: "Multi-assistant platform",
  },
  nav: {
    assistants: "Assistants",
    knowledge: "Kennisbronnen",
    logout: "Uitloggen",
  },
  login: {
    lead: "Meerdere assistenten. Eén Alicia voor de klant.",
    welcome: "Welkom",
    title: "Log in op Alicia AI",
    subtitle: "Intern beheer",
    restricted: "Alleen gebruikers met @alicia.insure toegang.",
    footer: "Intern",
    location: "Rotterdam",
    legal: "Alicia Insurance B.V.",
    error: "Toegang geweigerd. Alleen @alicia.insure accounts zijn toegestaan.",
    allowlist: "Je account staat niet op de Alicia AI-beheerderslijst.",
    configError:
      "Terug van Google, maar de callback faalde. AUTH_URL moet https://ask.alicia.insure zijn.",
    pkceError: (host: string) =>
      `Google-callback miste de PKCE-cookie. Sta cookies toe voor ${host}, sluit de tab, en probeer opnieuw vanaf /login.`,
    tokenError:
      "Google accepteerde de login, maar de token-wisseling faalde. Controleer GOOGLE_CLIENT_SECRET in Vercel.",
    callbackError: (origin: string) =>
      `Google OAuth mislukte. Voeg ${origin}/api/auth/callback/google toe als Authorized redirect URI in Google Cloud Console.`,
    genericError: "Inloggen mislukt. Probeer het opnieuw.",
    notConfigured:
      "Inloggen is verplicht, maar Google OAuth is niet geconfigureerd. Zet GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET en AUTH_SECRET.",
    signIn: "Doorgaan met Google",
  },
};
