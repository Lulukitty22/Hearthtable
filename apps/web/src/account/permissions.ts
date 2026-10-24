// Who may edit a record, as the app shows it. Until campaigns (S5–S6) add DMs and delegates, an
// account record (account/<Alias>/…) is edited only by its owner: the signed-in, approved account
// with that Alias. Security Rules enforce the same from S3; the app only hides what Rules refuse.

import { normalizeAlias } from "@hearthtable/storage";
import type { Viewer } from "./useViewer";

/** The Alias that owns an account record path, or undefined for other scopes. */
export function ownerAliasOf(recordPath: string): string | undefined {
  const [scope, alias] = recordPath.split("/");
  return scope === "account" ? alias : undefined;
}

export function canEditRecord(viewer: Viewer, recordPath: string): boolean {
  if (viewer.status !== "account" || viewer.account.status !== "approved")
    return false;
  const owner = ownerAliasOf(recordPath);
  return (
    owner !== undefined &&
    normalizeAlias(owner) === normalizeAlias(viewer.account.alias)
  );
}
