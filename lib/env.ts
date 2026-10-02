function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredServer(name: string): string {
  if (typeof window !== "undefined") {
    throw new Error(`${name} is only available on the server`);
  }
  return required(name);
}

export function getPublicAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey(): string {
  return requiredServer("SUPABASE_SERVICE_ROLE_KEY");
}

export function getOpenAIApiKey(): string {
  return requiredServer("OPENAI_API_KEY");
}

export function getAdminAllowlist(): string[] {
  const raw = process.env.ALICIA_AI_ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
