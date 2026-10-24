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
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
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
  /** When the Alias was chosen, as an ISO time, once the server has set it. */
  readonly createdAt?: string;
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
  const created = data?.["createdAt"] as { toDate?: () => Date } | undefined;
  const createdAt = created?.toDate?.().toISOString();
  return {
    uid,
    alias,
    status,
    admin: data?.["admin"] === true,
    ...(createdAt ? { createdAt } : {}),
  };
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

/** Calls `onChange` with every account waiting for approval, oldest first, now and after changes. */
export function watchPendingAccounts(
  db: Firestore,
  onChange: (accounts: readonly Account[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, ACCOUNTS), where("status", "==", "pending")),
    (snap) =>
      onChange(
        snap.docs
          .flatMap((d) => readAccount(d.id, d.data()) ?? [])
          .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")),
      ),
    (error) => onError(error.message),
  );
}

/**
 * A site administrator (`adminUid`) approves a pending account. Rules allow only this change:
 * status to approved, with who approved it and when.
 */
export async function approveAccount(
  db: Firestore,
  adminUid: string,
  uid: string,
): Promise<string | undefined> {
  try {
    await updateDoc(doc(db, ACCOUNTS, uid), {
      status: "approved",
      approvedBy: adminUid,
      approvedAt: serverTimestamp(),
    });
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
