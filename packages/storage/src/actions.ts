// Requests (Milestone 5 S6; Spell Effects and Active State, "Casting workflow" and "Competing
// submissions and request revisions"). One document per request, `/campaigns/{id}/actions/
// {request}`: who acts, what (a request kind and its input), Instant or Next Turn, the costs it
// holds, its revision and its status. While a request is `queued` its holds are out of the
// character's usable resources; cancelling or rejecting it returns them, by the status change
// alone, so it happens exactly once. A revision edits the request in place: it keeps its
// submission time and so its place in the queue, and its holds switch over in the same write.
// Approval resolves the request in one transaction (S7, `resolveAction`).

import type { BudgetKind, Holds, Timing } from "@hearthtable/play";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { CAMPAIGNS } from "./campaigns";
import type { RecordEnvelope } from "@hearthtable/kernel";
import {
  documentIdFor,
  recordRef,
  storedRecord,
  storedRevision,
} from "./firestore";

export type ActionStatus = "queued" | "cancelled" | "rejected" | "resolved";

export interface ActionRequest {
  readonly id: string;
  readonly kind: string;
  readonly character: string;
  readonly by: string;
  readonly timing: Timing;
  readonly input: Readonly<Record<string, unknown>>;
  readonly holds: Holds;
  readonly budget?: BudgetKind;
  readonly summary: string;
  readonly revision: number;
  readonly status: ActionStatus;
  /** A response: the action whose poll it answers (S9). */
  readonly respondsTo?: string;
  /** When it was first submitted; its place in the queue. */
  readonly at?: Date;
}

const failed = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function watchActions(
  db: Firestore,
  campaign: string,
  onList: (list: readonly ActionRequest[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, CAMPAIGNS, campaign, "actions"), orderBy("at")),
    (snap) =>
      onList(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: "estimate" });
          return {
            id: d.id,
            kind: String(x["kind"]),
            character: String(x["character"]),
            by: String(x["by"] ?? ""),
            timing: x["timing"] === "next-turn" ? "next-turn" : "instant",
            input: (x["input"] ?? {}) as Record<string, unknown>,
            holds: (x["holds"] ?? {}) as Holds,
            ...(typeof x["budget"] === "string"
              ? { budget: x["budget"] as BudgetKind }
              : {}),
            summary: String(x["summary"] ?? ""),
            ...(typeof x["respondsTo"] === "string"
              ? { respondsTo: x["respondsTo"] }
              : {}),
            revision: Number(x["revision"] ?? 1),
            status: x["status"] as ActionStatus,
            ...(x["at"]?.toDate ? { at: x["at"].toDate() as Date } : {}),
          };
        }),
      ),
    (e) => onError(failed(e)),
  );
}

function log(
  batch: WriteBatch,
  db: Firestore,
  campaign: string,
  by: string,
  clock: number,
  text: string,
) {
  batch.set(doc(collection(db, CAMPAIGNS, campaign, "log")), {
    kind: "request",
    by,
    clock,
    text,
    at: serverTimestamp(),
  });
}

async function commit(db: Firestore, build: (batch: WriteBatch) => void) {
  try {
    const batch = writeBatch(db);
    build(batch);
    await batch.commit();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

export interface ActionDraft {
  readonly kind: string;
  readonly character: string;
  readonly timing: Timing;
  readonly input: Readonly<Record<string, unknown>>;
  readonly holds: Holds;
  readonly budget?: BudgetKind;
  readonly summary: string;
  /** A response to another action's poll (S9). */
  readonly respondsTo?: string;
}

/** Confirming: the request is queued and holds its costs at once. Logged. */
export function submitAction(
  db: Firestore,
  campaign: string,
  draft: ActionDraft,
  by: string,
  clock: number,
  text: string,
) {
  return commit(db, (batch) => {
    batch.set(doc(collection(db, CAMPAIGNS, campaign, "actions")), {
      ...draft,
      by,
      control: documentIdFor(draft.character),
      revision: 1,
      status: "queued",
      at: serverTimestamp(),
    });
    log(batch, db, campaign, by, clock, text);
  });
}

/** A new revision of a queued request, in place: same position, its holds switched over. */
export function reviseAction(
  db: Firestore,
  campaign: string,
  request: ActionRequest,
  draft: Omit<ActionDraft, "kind" | "character">,
  by: string,
  clock: number,
  text: string,
) {
  return commit(db, (batch) => {
    batch.update(doc(db, CAMPAIGNS, campaign, "actions", request.id), {
      timing: draft.timing,
      input: { ...draft.input },
      holds: { ...draft.holds },
      ...(draft.budget ? { budget: draft.budget } : {}),
      summary: draft.summary,
      revision: request.revision + 1,
    });
    log(batch, db, campaign, by, clock, text);
  });
}

/** Cancelling (its controller) or rejecting (a DM) a queued request returns its holds. */
export function endAction(
  db: Firestore,
  campaign: string,
  request: ActionRequest,
  status: "cancelled" | "rejected",
  by: string,
  clock: number,
  text: string,
) {
  return commit(db, (batch) => {
    batch.update(doc(db, CAMPAIGNS, campaign, "actions", request.id), {
      status,
    });
    log(batch, db, campaign, by, clock, text);
  });
}

/**
 * The DM approves an eligible request and it resolves, all in one transaction (Milestone 5 S7;
 * "one action identity"): the request must still be queued at the revision the DM reviewed,
 * every changed record must still be at the revision it was read at, and then the records are
 * written (held costs consumed, effects, conditions, damage and healing), the request becomes
 * `resolved`, and the log entries carry the request's id. Retrying cannot apply it twice.
 */
export async function resolveAction(
  db: Firestore,
  campaign: string,
  request: ActionRequest,
  outcome: {
    readonly records: readonly RecordEnvelope[];
    readonly result: string;
    readonly logs: readonly string[];
  },
  by: string,
  clock: number,
): Promise<string | undefined> {
  const now = new Date().toISOString();
  const actionRef = doc(db, CAMPAIGNS, campaign, "actions", request.id);
  try {
    return await runTransaction(db, async (tx) => {
      const current = await tx.get(actionRef);
      const d = current.data();
      if (d?.["status"] !== "queued")
        return "This request is no longer queued.";
      if (d["revision"] !== request.revision)
        return "This request was revised; review it again.";
      const snaps = await Promise.all(
        outcome.records.map((r) => tx.get(recordRef(db, r.id))),
      );
      const stale = outcome.records.filter(
        (r, i) => storedRevision(snaps[i]?.data()) !== r.revision,
      );
      if (stale.length)
        return `${stale.map((r) => r.id).join(", ")} changed meanwhile; review it again.`;
      for (const r of outcome.records)
        tx.set(recordRef(db, r.id), storedRecord(r, now));
      tx.update(actionRef, { status: "resolved", result: outcome.result });
      outcome.logs.forEach((text, n) =>
        tx.set(doc(collection(db, CAMPAIGNS, campaign, "log")), {
          kind: "request",
          by,
          clock,
          text,
          at: serverTimestamp(),
          n,
          action: request.id,
        }),
      );
      return undefined;
    });
  } catch (error) {
    return failed(error);
  }
}
