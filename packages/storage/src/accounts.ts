// Accounts and their public Alias (Milestone 4, S1). `/accounts/{uid}` holds the Alias, the
// approval status and the administrator flag, and nothing from the Google account. Firestore
// cannot enforce a unique field, so `/accounts-by-alias/{normalized alias}` names the account
// that holds each Alias; both are written in one transaction and Security Rules check that they
// agree (Architecture and Hosting, Hosting: browser plus Firebase).
//
// Alias format (Campaigns and Shared Data, Guest viewing and accounts): 4–32 letters, digits,
// underscores and hyphens. Capitals do not distinguish Aliases and "_" equals "-"; the chosen
// display form is kept. An Alias is fixed once chosen.

import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

export const ACCOUNTS = "accounts";
export const ALIAS_INDEX = "accounts-by-alias";

export type ApprovalStatus = "pending" | "approved";

export interface Account {
  readonly uid: string;
  readonly alias: string;
  readonly status: ApprovalStatus;
  readonly admin: boolean;
}

/** Why an Alias cannot be used as typed, or undefined when its format is fine. */
export function aliasProblem(alias: string): string | undefined {
  if (alias.length < 4) return "An Alias needs at least 4 characters.";
  if (alias.length > 32) return "An Alias can have at most 32 characters.";
  if (!/^[A-Za-z0-9_-]+$/.test(alias))
    return "Use only letters, digits, underscores (_) and hyphens (-).";
  return undefined;
}

/** The form two Aliases share when they count as the same: lower case, "-" read as "_". */
export function normalizeAlias(alias: string): string {
  return alias.toLowerCase().replaceAll("-", "_");
}

/** The account stored at `/accounts/{uid}`, or undefined when the data is not an account. */
export function readAccount(
  uid: string,
  data: DocumentData | undefined,
): Account | undefined {
  const alias = data?.["alias"];
  const status = data?.["status"];
  if (typeof alias !== "string") return undefined;
  if (status !== "pending" && status !== "approved") return undefined;
  return { uid, alias, status, admin: data?.["admin"] === true };
}

export type ClaimResult =
  | { readonly ok: true; readonly account: Account }
  | {
      readonly ok: false;
      readonly reason: "invalid" | "taken" | "already-chosen" | "unavailable";
      readonly message: string;
    };

/**
 * Gives the signed-in account `uid` its Alias: creates `/accounts/{uid}` as pending, not an
 * administrator, and the Alias index entry, together or not at all.
 */
export async function claimAlias(
  db: Firestore,
  uid: string,
  alias: string,
): Promise<ClaimResult> {
  const problem = aliasProblem(alias);
  if (problem) return { ok: false, reason: "invalid", message: problem };
  const accountRef = doc(db, ACCOUNTS, uid);
  const indexRef = doc(db, ALIAS_INDEX, normalizeAlias(alias));
  try {
    return await runTransaction(db, async (tx): Promise<ClaimResult> => {
      const [account, index] = await Promise.all([
        tx.get(accountRef),
        tx.get(indexRef),
      ]);
      const existing = readAccount(uid, account.data());
      if (existing)
        return {
          ok: false,
          reason: "already-chosen",
          message: `This account already has the Alias ${existing.alias}.`,
        };
      if (index.exists())
        return {
          ok: false,
          reason: "taken",
          message: `${String(index.data()["alias"] ?? alias)} is already taken. Capitals do not count, and _ and - are the same.`,
        };
      tx.set(accountRef, {
        alias,
        status: "pending",
        admin: false,
        createdAt: serverTimestamp(),
      });
      tx.set(indexRef, { uid, alias });
      return {
        ok: true,
        account: { uid, alias, status: "pending", admin: false },
      };
    });
  } catch (error) {
    return {
      ok: false,
      reason: "unavailable",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Calls `onChange` with the account at `/accounts/{uid}` now and after every change. */
export function watchAccount(
  db: Firestore,
  uid: string,
  onChange: (account: Account | undefined) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, ACCOUNTS, uid),
    (snap) => onChange(readAccount(uid, snap.data())),
    (error) => onError(error.message),
  );
}
