import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { visibleAppsForSwitcher } from "@/lib/alicia/apps";
import { CURRENT_ALICIA_APP_ID } from "@/lib/alicia/current-app";
import { fetchAliciaDirectoryAccess } from "@/lib/alicia/directory";

export async function GET() {
  let email: string | undefined;
  let name: string | null | undefined;
  let image: string | null | undefined;
  try {
    const session = await auth();
    email = session?.user?.email ?? undefined;
    name = session?.user?.name;
    image = session?.user?.image;
  } catch (error) {
    console.error("[alicia-platform]", error);
  }

  const access = email ? await fetchAliciaDirectoryAccess(email) : null;
  const apps = visibleAppsForSwitcher(access, CURRENT_ALICIA_APP_ID);

  return NextResponse.json({
    apps,
    user: email ? { email, name: name ?? null, image: image ?? null } : null,
  });
}
