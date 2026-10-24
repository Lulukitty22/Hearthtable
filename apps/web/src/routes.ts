// Web addresses (Campaigns and Shared Data, Account organization and address design, selected
// 2026-10-24): an address names its scope first, like the record path, so
// /Accounts/VR_Lulu/Characters/Carol_Elfnein shows account/VR_Lulu/Characters/Carol_Elfnein and
// /Campaigns/Moonlit shows campaign/Moonlit. A last segment Edit or DM names the view, and
// /Admin is the administrators' page. No address starts with an Alias, so none can clash.

export type View = "default" | "edit" | "dm";

export type Route =
  | { readonly kind: "home" }
  | { readonly kind: "admin" }
  | { readonly kind: "record"; readonly path: string; readonly view: View }
  | { readonly kind: "unknown" };

const SCOPES: Record<string, { record: string; web: string }> = {
  accounts: { record: "account", web: "Accounts" },
  campaigns: { record: "campaign", web: "Campaigns" },
};

const VIEWS: Record<string, View> = { edit: "edit", dm: "dm" };

/**
 * Every word an address uses for a page, scope or view. No character, folder, campaign or custom
 * entry may take one as its name, ignoring capitals (user decision, 2026-10-24); a new view or
 * page adds its word here.
 */
export const ADDRESS_WORDS: readonly string[] = [
  "Accounts",
  "Campaigns",
  "Admin",
  "Edit",
  "DM",
];
const VIEW_SEGMENT: Record<View, string | undefined> = {
  default: undefined,
  edit: "Edit",
  dm: "DM",
};

export function parseRoute(pathname: string): Route {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => decodeURIComponent(s));
  const [first, ...rest] = segments;
  if (first === undefined) return { kind: "home" };
  if (first.toLowerCase() === "admin" && rest.length === 0)
    return { kind: "admin" };
  const scope = SCOPES[first.toLowerCase()];
  if (!scope) return { kind: "unknown" };
  const last = rest.at(-1)?.toLowerCase();
  const view = last !== undefined ? VIEWS[last] : undefined;
  const parts = view ? rest.slice(0, -1) : rest;
  if (parts.length === 0) return { kind: "unknown" };
  return {
    kind: "record",
    path: [scope.record, ...parts].join("/"),
    view: view ?? "default",
  };
}

/** Web address for a record path, optionally in a view. */
export function webPathFor(recordPath: string, view: View = "default"): string {
  const [scope, ...rest] = recordPath.split("/");
  const web = Object.values(SCOPES).find((s) => s.record === scope)?.web;
  const segment = VIEW_SEGMENT[view];
  const segments = [web ?? scope ?? "", ...rest, ...(segment ? [segment] : [])];
  return "/" + segments.map(encodeURIComponent).join("/");
}
