// The DM review queue (Milestone 4, S7): every change a DM approves outside gameplay waits as a
// proposal at `/campaigns/{id}/proposals/{auto}` until a DM accepts or rejects it (Campaigns and
// Shared Data, Publication and approval). Character insertions keep their own requests (S6).
//
// A proposal is the change itself, so a DM accepts exactly what was proposed and nothing depends
// on what today's forms can fill in:
// - `writes`: records to save, each at the revision it was proposed from (0 for a new record), so
//   accepting a proposal that something else has changed since is refused as a conflict;
// - `deletes`: records to delete, each at the revision it was proposed from.
//
// Kinds: `edit` (an owner's or delegate's changes to a campaign character), `delete` and
// `replace` (the owner's), and `entry` (a new or imported library entry).

import {
  parseEnvelope,
  serializeEnvelope,
  type RecordEnvelope,
  type RecordId,
} from "@hearthtable/kernel";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { CAMPAIGNS } from "./campaigns";
import { documentIdFor } from "./firestore";

export type ProposalKind = "edit" | "delete" | "replace" | "entry";

export interface Proposal {
  readonly id: string;
  readonly kind: ProposalKind;
  readonly by: string;
  /** The character or entry the proposal is about. */
  readonly target: string;
  readonly note: string;
  readonly writes: readonly RecordEnvelope[];
  readonly deletes: readonly {
    readonly id: RecordId;
    readonly revision: number;
  }[];
  readonly at?: string;
}

const KINDS: readonly string[] = ["edit", "delete", "replace", "entry"];

export function readProposal(
  id: string,
  data: DocumentData | undefined,
): Proposal | undefined {
  const kind = data?.["kind"];
  if (typeof kind !== "string" || !KINDS.includes(kind)) return undefined;
  if (typeof data?.["by"] !== "string" || typeof data["target"] !== "string")
    return undefined;
  const writes: RecordEnvelope[] = [];
  for (const raw of (data["writes"] as unknown[] | undefined) ?? []) {
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) return undefined;
    writes.push(parsed.value);
  }
  const deletes = ((data["deletes"] as unknown[] | undefined) ?? []).flatMap(
    (d) => {
      const item = d as { id?: unknown; revision?: unknown };
      return typeof item.id === "string" && typeof item.revision === "number"
        ? [{ id: item.id as RecordId, revision: item.revision }]
        : [];
    },
  );
  const at = (data["at"] as { toDate?: () => Date } | undefined)
    ?.toDate?.()
    .toISOString();
  return {
    id,
    kind: kind as ProposalKind,
    by: data["by"],
    target: data["target"],
    note: String(data["note"] ?? ""),
    writes,
    deletes,
    ...(at ? { at } : {}),
  };
}

/** Sends a proposal; returns an error message, or undefined when it was sent. */
export async function propose(
  db: Firestore,
  campaign: string,
  proposal: Omit<Proposal, "id" | "at">,
): Promise<string | undefined> {
  try {
    await setDoc(doc(collection(db, CAMPAIGNS, campaign, "proposals")), {
      kind: proposal.kind,
      by: proposal.by,
      target: proposal.target,
      // Rules check a delegate against the character's control document, named by this id.
      control: documentIdFor(proposal.target),
      note: proposal.note,
      writes: proposal.writes.map((r) => serializeEnvelope(r)),
      deletes: proposal.deletes.map((d) => ({
        id: d.id,
        revision: d.revision,
      })),
      at: serverTimestamp(),
    });
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The proposals waiting: all of them for a DM, only your own otherwise; oldest first. */
export function watchProposals(
  db: Firestore,
  campaign: string,
  uid: string,
  dm: boolean,
  onChange: (proposals: readonly Proposal[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  const all = collection(db, CAMPAIGNS, campaign, "proposals");
  return onSnapshot(
    dm ? all : query(all, where("by", "==", uid)),
    (snap) =>
      onChange(
        snap.docs
          .flatMap((d) => readProposal(d.id, d.data()) ?? [])
          .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "")),
      ),
    (error) => onError(error.message),
  );
}

/** Withdrawing your own proposal, or a DM rejecting it (or clearing it after accepting). */
export async function removeProposal(
  db: Firestore,
  campaign: string,
  id: string,
): Promise<string | undefined> {
  try {
    await deleteDoc(doc(db, CAMPAIGNS, campaign, "proposals", id));
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

type Plain = Record<string, unknown>;

/**
 * Field-by-field differences between two records' data, for a DM reviewing a proposal:
 * "hitPoints.current: 95 → 80". Lists are compared whole.
 */
export function differences(
  before: unknown,
  after: unknown,
  path = "",
): string[] {
  const plain = (v: unknown): v is Plain =>
    typeof v === "object" && v !== null && !Array.isArray(v);
  if (plain(before) && plain(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.flatMap((k) =>
      differences(before[k], after[k], path ? `${path}.${k}` : k),
    );
  }
  const a = JSON.stringify(before);
  const b = JSON.stringify(after);
  if (a === b) return [];
  const short = (s: string | undefined) =>
    s === undefined ? "(none)" : s.length > 60 ? `${s.slice(0, 57)}…` : s;
  return [`${path || "(whole value)"}: ${short(a)} → ${short(b)}`];
}
