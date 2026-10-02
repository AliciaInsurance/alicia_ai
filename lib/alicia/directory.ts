import "server-only";

import type { AliciaDirectoryAccess } from "@/lib/alicia/apps";
import { normalizeEmail } from "@/lib/auth/auth-policy";
import { createPublicDirectoryClient, isSupabaseConfigured } from "@/lib/supabase/directory";

type AccessRow = {
  gardner: boolean | null;
  gold_access: boolean | null;
  kalinda_access: boolean | null;
  lockhart_access: boolean | null;
  elsbeth_access: boolean | null;
};

export async function fetchAliciaDirectoryAccess(
  email: string | null | undefined,
): Promise<AliciaDirectoryAccess | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = createPublicDirectoryClient();
    const { data, error } = await supabase
      .from("users")
      .select("gardner, gold_access, kalinda_access, lockhart_access, elsbeth_access")
      .ilike("email", normalized)
      .maybeSingle<AccessRow>();

    if (error) {
      console.error("[alicia-directory] lookup failed", error.message);
      return null;
    }
    if (!data) return null;

    return {
      gold_access: data.gold_access === true,
      gardner: data.gardner === true,
      kalinda_access: data.kalinda_access === true,
      lockhart_access: data.lockhart_access === true,
      elsbeth_access: data.elsbeth_access === true,
    };
  } catch (error) {
    console.error("[alicia-directory] lookup failed", error);
    return null;
  }
}
