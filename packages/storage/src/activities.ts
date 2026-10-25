// Downtime activities (Milestone 5 S5; Turns, Encounters and Time, "Downtime"). One document per
// submitted activity, `/campaigns/{id}/activities/{activity}`, kept across downtime scenes: an
// activity not finished in one downtime continues in the next, and an encounter in between only
// pauses it. Anyone sees every activity as it arrives; a character's controller submits and
// cancels its own; DMs approve or reject them and run time. After a Short Rest the controller
// rolls Hit Point Dice into the activity (`rolls`), and the DM's view applies them to the sheet.

import {
  arrayUnion,
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
import type { ActivityStatus } from "@hearthtable/play";
import { CAMPAIGNS } from "./campaigns";
import { documentIdFor } from "./firestore";

export interface HitDieRoll {
  readonly die: number;
  readonly face: number;
  readonly con: number;
  /** Hit points regained: face plus Constitution modifier, at least 1. */
  readonly total: number;
}

export interface Activity {
  readonly id: string;
  readonly character: string;
  readonly type: string;
  readonly seconds: number;
  readonly progress: number;
  readonly status: ActivityStatus;
  readonly note?: string;
  readonly waitsFor?: string;
  readonly by: string;
  /** The downtime scene it was submitted in. */
  readonly scene: string;
  /** After a Short Rest: Hit Point Dice may be spent (`open`) until the player is `done`. */
  readonly spend?: "open" | "done";
  readonly rolls: readonly HitDieRoll[];
  /** How many rolls the DM's view has applied to the sheet. */
  readonly applied: number;
  readonly at?: Date;
}

const failed = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function watchActivities(
  db: Firestore,
  campaign: string,
  onList: (list: readonly Activity[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, CAMPAIGNS, campaign, "activities"), orderBy("at")),
    (snap) =>
      onList(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: "estimate" });
          return {
            id: d.id,
            character: String(x["character"]),
            type: String(x["type"]),
            seconds: Number(x["seconds"] ?? 0),
            progress: Number(x["progress"] ?? 0),
            status: x["status"] as ActivityStatus,
            ...(typeof x["note"] === "string" ? { note: x["note"] } : {}),
            ...(typeof x["waitsFor"] === "string"
              ? { waitsFor: x["waitsFor"] }
              : {}),
            by: String(x["by"] ?? ""),
            scene: String(x["scene"] ?? ""),
            ...(x["spend"] === "open" || x["spend"] === "done"
              ? { spend: x["spend"] }
              : {}),
            rolls: (x["rolls"] ?? []) as HitDieRoll[],
            applied: Number(x["applied"] ?? 0),
            ...(x["at"]?.toDate ? { at: x["at"].toDate() as Date } : {}),
          };
        }),
      ),
    (e) => onError(failed(e)),
  );
}

const activityRef = (db: Firestore, campaign: string, id: string) =>
  doc(db, CAMPAIGNS, campaign, "activities", id);

function log(
  batch: WriteBatch,
  db: Firestore,
  campaign: string,
  kind: string,
  by: string,
  clock: number,
  text: string,
  n = 0,
) {
  batch.set(doc(collection(db, CAMPAIGNS, campaign, "log")), {
    kind,
    by,
    clock,
    text,
    at: serverTimestamp(),
    n,
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

/** A character's controller (or a DM) submits an activity; it waits for the DM's approval. */
export function submitActivity(
  db: Firestore,
  campaign: string,
  activity: {
    readonly character: string;
    readonly type: string;
    readonly seconds: number;
    readonly note?: string;
    readonly waitsFor?: string;
    readonly scene: string;
  },
  by: string,
  clock: number,
  text: string,
) {
  return commit(db, (batch) => {
    batch.set(doc(collection(db, CAMPAIGNS, campaign, "activities")), {
      ...activity,
      progress: 0,
      status: "pending",
      by,
      control: documentIdFor(activity.character),
      at: serverTimestamp(),
    });
    log(batch, db, campaign, "activity", by, clock, text);
  });
}

/** The DM approves or rejects an activity, or its controller cancels it. Logged. */
export function setActivityStatus(
  db: Firestore,
  campaign: string,
  id: string,
  status: "approved" | "rejected" | "cancelled",
  by: string,
  clock: number,
  text: string,
) {
  return commit(db, (batch) => {
    batch.update(activityRef(db, campaign, id), { status });
    log(batch, db, campaign, "activity", by, clock, text);
  });
}

/** One Hit Point Die rolled after a Short Rest. */
export function rollHitDie(
  db: Firestore,
  campaign: string,
  id: string,
  roll: HitDieRoll,
  by: string,
  clock: number,
  text: string,
) {
  return commit(db, (batch) => {
    batch.update(activityRef(db, campaign, id), {
      rolls: arrayUnion({ ...roll, at: Date.now() }),
    });
    log(batch, db, campaign, "activity", by, clock, text);
  });
}

/** The player is done spending Hit Point Dice. */
export function doneSpending(db: Firestore, campaign: string, id: string) {
  return commit(db, (batch) => {
    batch.update(activityRef(db, campaign, id), { spend: "done" });
  });
}

/** The DM's view records changes after running time or applying rolls. */
export function updateActivities(
  db: Firestore,
  campaign: string,
  updates: readonly {
    readonly id: string;
    readonly change: Readonly<Record<string, unknown>>;
  }[],
  logs: readonly {
    readonly by: string;
    readonly clock: number;
    readonly text: string;
  }[] = [],
) {
  return commit(db, (batch) => {
    for (const u of updates)
      batch.update(activityRef(db, campaign, u.id), { ...u.change });
    logs.forEach((l, i) =>
      log(batch, db, campaign, "activity", l.by, l.clock, l.text, i),
    );
  });
}
