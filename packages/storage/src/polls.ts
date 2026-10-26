// Response polls (Milestone 5 S9; Spell Effects and Active State, "Scheduling and repeating
// response polls" and "Every action polls; who skips; force-skip"). One poll per action,
// `/campaigns/{id}/polls/{action}`: the event it pauses ("Bandit Scout's attack would hit Carol"),
// the players who must answer (those controlling a character in the scene), its round, and who
// has skipped which round. A response is an Instant request whose `respondsTo` names the action.
// Resolving a response opens a fresh round, so earlier skips no longer count. The poll closes
// when every player has skipped the current round, or when the DM force-skips, which rejects any
// response still waiting.

import {
  doc,
  onSnapshot,
  collection,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import type { ActionRequest } from "./actions";
import { CAMPAIGNS } from "./campaigns";

export interface Poll {
  /** The action it pauses; also the poll's id. */
  readonly action: string;
  readonly event: string;
  readonly players: readonly string[];
  readonly round: number;
  /** The round each player last skipped, by uid. */
  readonly skips: Readonly<Record<string, number>>;
  readonly status: "open" | "closed";
  readonly forced?: boolean;
}

const failed = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function watchPolls(
  db: Firestore,
  campaign: string,
  onList: (list: readonly Poll[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, CAMPAIGNS, campaign, "polls"),
    (snap) =>
      onList(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            action: d.id,
            event: String(x["event"] ?? ""),
            players: (x["players"] ?? []) as string[],
            round: Number(x["round"] ?? 1),
            skips: (x["skips"] ?? {}) as Record<string, number>,
            status: x["status"] === "closed" ? "closed" : "open",
            ...(x["forced"] === true ? { forced: true } : {}),
          };
        }),
      ),
    (e) => onError(failed(e)),
  );
}

const pollRef = (db: Firestore, campaign: string, action: string) =>
  doc(db, CAMPAIGNS, campaign, "polls", action);

function logEntry(by: string, clock: number, text: string, action: string) {
  return { kind: "poll", by, clock, text, at: serverTimestamp(), action };
}

/** The DM opens the poll for an action. Logged. */
export async function openPoll(
  db: Firestore,
  campaign: string,
  action: string,
  event: string,
  players: readonly string[],
  by: string,
  clock: number,
) {
  try {
    const batch = writeBatch(db);
    batch.set(pollRef(db, campaign, action), {
      event,
      players: [...players],
      round: 1,
      skips: {},
      status: "open",
    });
    batch.set(
      doc(collection(db, CAMPAIGNS, campaign, "log")),
      logEntry(by, clock, `Responses? ${event}.`, action),
    );
    await batch.commit();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

/** A player skips the current round. */
export async function skipPoll(
  db: Firestore,
  campaign: string,
  poll: Poll,
  uid: string,
) {
  try {
    await updateDoc(pollRef(db, campaign, poll.action), {
      [`skips.${uid}`]: poll.round,
    });
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

/** After a response resolves: a fresh round against the new state. Logged. */
export async function repoll(
  db: Firestore,
  campaign: string,
  poll: Poll,
  event: string,
  by: string,
  clock: number,
) {
  try {
    const batch = writeBatch(db);
    batch.update(pollRef(db, campaign, poll.action), {
      round: poll.round + 1,
      event,
    });
    batch.set(
      doc(collection(db, CAMPAIGNS, campaign, "log")),
      logEntry(by, clock, `Any more responses? ${event}.`, poll.action),
    );
    await batch.commit();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

/**
 * Closes a poll: everyone skipped, or the DM force-skips, rejecting responses still waiting
 * (their holds return). Logged.
 */
export async function closePoll(
  db: Firestore,
  campaign: string,
  poll: Poll,
  forced: boolean,
  waiting: readonly ActionRequest[],
  by: string,
  clock: number,
) {
  try {
    const batch = writeBatch(db);
    batch.update(pollRef(db, campaign, poll.action), {
      status: "closed",
      ...(forced ? { forced: true } : {}),
    });
    for (const r of waiting)
      batch.update(doc(db, CAMPAIGNS, campaign, "actions", r.id), {
        status: "rejected",
      });
    batch.set(
      doc(collection(db, CAMPAIGNS, campaign, "log")),
      logEntry(
        by,
        clock,
        forced
          ? `The DM closed the responses${waiting.length ? ` and rejected ${waiting.length} waiting` : ""}.`
          : "Everyone passed; no more responses.",
        poll.action,
      ),
    );
    await batch.commit();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}
