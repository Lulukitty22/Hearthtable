// Who may edit a record, as the app shows it; Security Rules enforce the same (S3, S5).
// - An account record (account/<Alias>/…) is edited by its owner: the signed-in, approved
//   account with that Alias.
// - A campaign record (campaign/<name>/…) is edited by the campaign's DMs, in DM mode
//   (Campaigns and Shared Data, Publication and approval). A player's own changes to their
//   campaign character go to the DM review queue (S7).

import { normalizeAlias, type Campaign } from "@hearthtable/storage";
import type { Viewer } from "./useViewer";

/** The Alias that owns an account record path, or undefined for other scopes. */
export function ownerAliasOf(recordPath: string): string | undefined {
  const [scope, alias] = recordPath.split("/");
  return scope === "account" ? alias : undefined;
}

/** The Alias whose character a campaign path is (campaign/<name>/Characters/<Alias>/<name>). */
export function campaignOwnerAliasOf(recordPath: string): string | undefined {
  const [scope, , folder, alias] = recordPath.split("/");
  return scope === "campaign" && folder === "Characters" ? alias : undefined;
}

export const isAlias = (viewer: Viewer, alias: string | undefined) =>
  viewer.status === "account" &&
  alias !== undefined &&
  normalizeAlias(alias) === normalizeAlias(viewer.account.alias);

export function canEditRecord(
  viewer: Viewer,
  recordPath: string,
  campaign?: Campaign,
): boolean {
  if (viewer.status !== "account" || viewer.account.status !== "approved")
    return false;
  if (recordPath.startsWith("campaign/"))
    return campaign?.dms.includes(viewer.account.uid) ?? false;
  return isAlias(viewer, ownerAliasOf(recordPath));
}
