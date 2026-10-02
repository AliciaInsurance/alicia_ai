/** Shared Alicia internal apps — Alicia AI is intentionally not listed here yet. */
export type AliciaAppId =
  | "gardner"
  | "kalinda"
  | "gold"
  | "lockhart"
  | "elsbeth"
  | "alicia-ai";

export type AliciaDirectoryAccess = {
  gold_access: boolean;
  gardner: boolean;
  kalinda_access: boolean;
  lockhart_access: boolean;
  elsbeth_access: boolean;
};

export type AliciaAppDefinition = {
  id: Exclude<AliciaAppId, "alicia-ai">;
  name: string;
  description: string;
  url: string;
  permissionKey: keyof AliciaDirectoryAccess;
};

export function getAliciaAppDefinitions(): AliciaAppDefinition[] {
  return [
    {
      id: "gardner",
      name: "Gardner",
      description: "Taken & workflows",
      url: "https://gardner.alicia.insure",
      permissionKey: "gardner",
    },
    {
      id: "kalinda",
      name: "Kalinda",
      description: "Performance",
      url: "https://kalinda.alicia.insure",
      permissionKey: "kalinda_access",
    },
    {
      id: "gold",
      name: "Gold",
      description: "Sales",
      url: "https://gold.alicia.insure",
      permissionKey: "gold_access",
    },
    {
      id: "lockhart",
      name: "Lockhart",
      description: "Finance",
      url: "https://lockhart.alicia.insure",
      permissionKey: "lockhart_access",
    },
    {
      id: "elsbeth",
      name: "Elsbeth",
      description: "Content & marketing",
      url: "https://elsbeth.alicia.insure",
      permissionKey: "elsbeth_access",
    },
  ];
}

export function visibleAppsForSwitcher(
  access: AliciaDirectoryAccess | null,
  currentApp: AliciaAppId,
): AliciaAppDefinition[] {
  const apps = getAliciaAppDefinitions();
  return apps.filter((app) => {
    if (app.id === currentApp) return true;
    if (!access) return false;
    return access[app.permissionKey] === true;
  });
}
