// Requests (Milestone 5 S6; Spell Effects and Active State, "Casting workflow" and "Competing
// submissions and request revisions"). One document per request, `/campaigns/{id}/actions/
// {request}`: who acts, what (a request kind and its input), Instant or Next Turn, the costs it
// holds, its revision and its status. While a request is `queued` its holds are out of the
// character's usable resources; cancelling or rejecting it returns them, by the status change
// alone, so it happens exactly once. A revision edits the request in place: it keeps its
// submission time and so its place in the queue, and its holds switch over in the same write.
// Approval and resolution come in S7.

import type { BudgetKind, Holds, Timing } from "@hearthtable/play";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { CAMPAIGNS } from "./campaigns";
import { documentIdFor } from "./firestore";

export type ActionStatus = "queued" | "cancelled" | "rejected";

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
