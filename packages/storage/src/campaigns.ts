// Campaigns and their membership (Milestone 4, S5). Campaign storage is its own scope
// (Campaigns and Shared Data, Account organization): `/campaigns/{id}` holds the name and the DM
// and player lists, where the id is the name's path segment in lower case, so two campaigns
// whose names differ only in capitals cannot both exist. There is no owner; every DM is equal.
//
// - `/campaigns/{id}/requests/{uid}`: a join request, made with the invite code.
// - `/campaigns/{id}/private/invite`: the current invite code, readable by DMs only.
// - `/invites/{code}`: which campaign a code joins; anyone signed in may look up a code they
//   know, but codes cannot be listed.
//
// Security Rules check who may change what (firestore.rules); these functions only write.

import {
  parseEnvelope,
  serializeEnvelope,
  type RecordEnvelope,
} from "@hearthtable/kernel";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { documentIdFor } from "./firestore";

export const CAMPAIGNS = "campaigns";
export const INVITES = "invites";

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly dms: readonly string[];
  readonly players: readonly string[];
}

export interface JoinRequest {
  readonly uid: string;
  readonly at?: string;
}

/** The storage id of a campaign whose path segment is `segment` (e.g. Moonlit_Coast). */
export function campaignIdFor(segment: string): string {
  return encodeURIComponent(segment).toLowerCase();
}

/** An invite code: 8 letters and digits that are hard to mistake for each other. */
export function newInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function readCampaign(
  id: string,
  data: DocumentData | undefined,
): Campaign | undefined {
  if (typeof data?.["name"] !== "string") return undefined;
  return {
    id,
    name: data["name"],
    dms: strings(data["dms"]),
    players: strings(data["players"]),
  };
}

const failed = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Runs a write, returning its error message, or undefined when it succeeded. */
async function attempt(write: () => Promise<unknown>) {
  try {
    await write();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

/**
 * Creates a campaign with `uid` as its first DM and a first invite code. Refused when a campaign
 * with the same name (ignoring capitals) already exists.
 */
export async function createCampaign(
  db: Firestore,
  uid: string,
  segment: string,
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const id = campaignIdFor(segment);
  const ref = doc(db, CAMPAIGNS, id);
  try {
    if ((await getDoc(ref)).exists())
      return {
        ok: false,
        message: `A campaign called ${name} already exists. Capitals do not count, and spaces and underscores are the same.`,
      };
    const code = newInviteCode();
    const batch = writeBatch(db);
    batch.set(ref, {
      name,
      dms: [uid],
      players: [],
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, CAMPAIGNS, id, "private", "invite"), { code });
    batch.set(doc(db, INVITES, code), { campaign: id, name });
    await batch.commit();
    return { ok: true, id };
  } catch (error) {
    return { ok: false, message: failed(error) };
  }
}

export function watchCampaign(
  db: Firestore,
  id: string,
  onChange: (campaign: Campaign | undefined) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, CAMPAIGNS, id),
    (snap) => onChange(readCampaign(id, snap.data())),
    (error) => onError(error.message),
  );
}

/** For DMs: the join requests waiting, oldest first. */
export function watchJoinRequests(
  db: Firestore,
  id: string,
  onChange: (requests: readonly JoinRequest[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, CAMPAIGNS, id, "requests"),
    (snap) =>
      onChange(
        snap.docs
          .map((d) => {
            const at = (d.data()["at"] as { toDate?: () => Date } | undefined)
              ?.toDate?.()
              .toISOString();
            return at ? { uid: d.id, at } : { uid: d.id };
          })
          .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "")),
      ),
    (error) => onError(error.message),
  );
}

/** For the person asking: whether their own join request is waiting. */
export function watchOwnRequest(
  db: Firestore,
  id: string,
  uid: string,
  onChange: (waiting: boolean) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, CAMPAIGNS, id, "requests", uid),
    (snap) => onChange(snap.exists()),
    (error) => onError(error.message),
  );
}

/** For DMs: the current invite code. */
export function watchInviteCode(
  db: Firestore,
  id: string,
  onChange: (code: string | undefined) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, CAMPAIGNS, id, "private", "invite"),
    (snap) => onChange(snap.data()?.["code"] as string | undefined),
    (error) => onError(error.message),
  );
}

/** The campaign an invite code joins, or undefined when the code is unknown. */
export async function lookUpInvite(
  db: Firestore,
  code: string,
): Promise<{ campaign: string; name: string } | undefined> {
  const snap = await getDoc(doc(db, INVITES, code.trim().toUpperCase()));
  const data = snap.data();
  return typeof data?.["campaign"] === "string"
    ? { campaign: data["campaign"], name: String(data["name"] ?? "") }
    : undefined;
}

/** A DM replaces the invite code; the old one stops working. */
export function replaceInviteCode(
  db: Firestore,
  id: string,
  name: string,
  oldCode: string | undefined,
) {
  return attempt(async () => {
    const code = newInviteCode();
    const batch = writeBatch(db);
    if (oldCode) batch.delete(doc(db, INVITES, oldCode));
    batch.set(doc(db, INVITES, code), { campaign: id, name });
    batch.set(doc(db, CAMPAIGNS, id, "private", "invite"), { code });
    await batch.commit();
  });
}

export function requestToJoin(
  db: Firestore,
  id: string,
  uid: string,
  code: string,
) {
  return attempt(() =>
    setDoc(doc(db, CAMPAIGNS, id, "requests", uid), {
      code: code.trim().toUpperCase(),
      at: serverTimestamp(),
    }),
  );
}

/** Withdrawing your own request, or a DM declining it. */
export function cancelJoinRequest(db: Firestore, id: string, uid: string) {
  return attempt(() => deleteDoc(doc(db, CAMPAIGNS, id, "requests", uid)));
}

/** A DM approves a join request: the person becomes a player. */
export function approveJoinRequest(db: Firestore, id: string, uid: string) {
  return attempt(async () => {
    const batch = writeBatch(db);
    batch.update(doc(db, CAMPAIGNS, id), { players: arrayUnion(uid) });
    batch.delete(doc(db, CAMPAIGNS, id, "requests", uid));
    await batch.commit();
  });
}

/** Removes a member (a DM removing a player, or anyone leaving). */
export function removeMember(db: Firestore, id: string, uid: string) {
  return attempt(async () => {
    const batch = writeBatch(db);
    batch.update(doc(db, CAMPAIGNS, id), {
      players: arrayRemove(uid),
      dms: arrayRemove(uid),
    });
    await batch.commit();
  });
}

/** A DM grants DM to a player, or revokes it (the member stays as a player). */
export function setDm(db: Firestore, id: string, uid: string, dm: boolean) {
  return attempt(async () => {
    const batch = writeBatch(db);
    batch.update(
      doc(db, CAMPAIGNS, id),
      dm
        ? { dms: arrayUnion(uid), players: arrayRemove(uid) }
        : { dms: arrayRemove(uid), players: arrayUnion(uid) },
    );
    await batch.commit();
  });
}

// S6: characters in campaigns. A member asks to add a copy of one of their characters; the
// request holds the copy itself (`records`, at its campaign path), so the DM approves exactly
// what was asked, and the DM's approval writes those records (Campaigns and Shared Data,
// Character placement: copy only). Delegated control lives at
// `/campaigns/{id}/control/{record document id}`: the delegates the character's owner chose.

export interface Insertion {
  readonly id: string;
  readonly by: string;
  readonly name: string;
  /** Where the copy goes: campaign/<campaign>/Characters/<Alias>/<name>. */
  readonly path: string;
  readonly records: readonly RecordEnvelope[];
  readonly at?: string;
}

export function readInsertion(
  id: string,
  data: DocumentData | undefined,
): Insertion | undefined {
  if (typeof data?.["path"] !== "string" || typeof data["by"] !== "string")
    return undefined;
  const records: RecordEnvelope[] = [];
  for (const raw of (data["records"] as unknown[] | undefined) ?? []) {
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) return undefined;
    records.push(parsed.value);
  }
  const at = (data["at"] as { toDate?: () => Date } | undefined)
    ?.toDate?.()
    .toISOString();
  return {
    id,
    by: data["by"],
    name: String(data["name"] ?? ""),
    path: data["path"],
    records,
    ...(at ? { at } : {}),
  };
}

/** A member asks to add `records` (already at their campaign path) to the campaign. */
export function requestInsertion(
  db: Firestore,
  campaign: string,
  uid: string,
  name: string,
  path: string,
  records: readonly RecordEnvelope[],
) {
  return attempt(() =>
    setDoc(doc(collection(db, CAMPAIGNS, campaign, "insertions")), {
      by: uid,
      name,
      path,
      records: records.map((r) => serializeEnvelope(r)),
      at: serverTimestamp(),
    }),
  );
}

/** The insertions waiting: all of them for a DM, only your own otherwise. */
export function watchInsertions(
  db: Firestore,
  campaign: string,
  uid: string,
  dm: boolean,
  onChange: (insertions: readonly Insertion[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  const all = collection(db, CAMPAIGNS, campaign, "insertions");
  return onSnapshot(
    dm ? all : query(all, where("by", "==", uid)),
    (snap) =>
      onChange(
        snap.docs
          .flatMap((d) => readInsertion(d.id, d.data()) ?? [])
          .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "")),
      ),
    (error) => onError(error.message),
  );
}

/** Withdrawing your own insertion request, or a DM declining it (after approving, too). */
export function removeInsertion(db: Firestore, campaign: string, id: string) {
  return attempt(() =>
    deleteDoc(doc(db, CAMPAIGNS, campaign, "insertions", id)),
  );
}

/** Who may control a campaign character besides its owner. */
export function watchDelegates(
  db: Firestore,
  campaign: string,
  characterPath: string,
  onChange: (delegates: readonly string[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, CAMPAIGNS, campaign, "control", documentIdFor(characterPath)),
    (snap) => onChange(strings(snap.data()?.["delegates"])),
    (error) => onError(error.message),
  );
}

/** The owner grants or revokes control of their campaign character. */
export function setDelegates(
  db: Firestore,
  campaign: string,
  characterPath: string,
  delegates: readonly string[],
) {
  return attempt(() =>
    setDoc(
      doc(db, CAMPAIGNS, campaign, "control", documentIdFor(characterPath)),
      { delegates: [...delegates] },
    ),
  );
}

/** The campaigns `uid` belongs to, as DM or player, by name. */
export async function campaignsOf(
  db: Firestore,
  uid: string,
): Promise<readonly Campaign[]> {
  const all = collection(db, CAMPAIGNS);
  const [asDm, asPlayer] = await Promise.all([
    getDocs(query(all, where("dms", "array-contains", uid))),
    getDocs(query(all, where("players", "array-contains", uid))),
  ]);
  const found = new Map<string, Campaign>();
  for (const d of [...asDm.docs, ...asPlayer.docs]) {
    const c = readCampaign(d.id, d.data());
    if (c) found.set(c.id, c);
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
