// Downtime activities (Turns, Encounters and Time, "Downtime", selected 2026-10-24; Milestone 5
// S5). The downtime machinery knows nothing about any activity: each activity type is a module
// registered here that brings its own logic (how long it takes, whether it can be split, what it
// warns about, what finishing it does, and what an unfinished one still gives). Milestone 5 has
// Short Rest, Long Rest and the note with a duration; crafting, scribing and trading come later
// as further modules, with no change to the machinery.
//
// Running time: when the DM ends a downtime scene by entering the time that passed, each
// character's approved activities run in the order they were submitted. One that waits for
// another starts only after that one finishes; if it never does, the waiting one stays queued.
// A splittable activity keeps its progress; a rest that runs out of time gives only what its
// module says (an interrupted Long Rest of at least an hour gives a Short Rest's benefits).

/** What an activity module may know about a character, from its resolved sheet. */
export interface CharacterFacts {
  readonly name: string;
  readonly hpCurrent: number;
  readonly hpMax: number | undefined;
  /** Resource pools and how they reset ("short rest", "long rest"). */
  readonly pools: readonly { readonly pool: string; readonly reset: string }[];
  /**
   * What queued requests hold (Milestone 5 S6). A rest restores the sheet in full; recording
   * the held amounts below zero keeps them out of use while held, and discards them if returned.
   */
  readonly held?: {
    readonly slots: Readonly<Record<string, number>>;
    readonly pools: Readonly<Record<string, number>>;
  };
}

export type CharacterData = Readonly<Record<string, unknown>>;

export interface Outcome {
  readonly data: CharacterData;
  /** For the log: what happened, e.g. "hit points restored". */
  readonly summary: string;
  /** The character may now spend Hit Point Dice (after a Short Rest). */
  readonly spendHitDice?: boolean;
}

export interface ActivityInput {
  /** Seconds, for activities the player times (a note). */
  readonly seconds?: number;
  readonly note?: string;
}

export interface ActivityType {
  readonly id: string;
  readonly name: string;
  /** How long it takes, or undefined when the input lacks a length. */
  duration(input: ActivityInput): number | undefined;
  /** Can it pause and continue in a later downtime, keeping its progress? */
  readonly splittable: boolean;
  /** Does the player describe it in a note? */
  readonly needsNote: boolean;
  /** Rules that only warn when it is submitted or starts. */
  warnings(facts: CharacterFacts, data: CharacterData, clock: number): string[];
  /** What finishing it does. */
  finish(facts: CharacterFacts, data: CharacterData, clock: number): Outcome;
  /** What it still gives when it stops after `ran` seconds without finishing. */
  unfinished?(
    ran: number,
    facts: CharacterFacts,
    data: CharacterData,
    clock: number,
  ): Outcome | undefined;
}

const registry = new Map<string, ActivityType>();

/** Adds an activity type; a module calls this once. */
export function registerActivityType(type: ActivityType) {
  registry.set(type.id, type);
}

export function activityType(id: string): ActivityType | undefined {
  return registry.get(id);
}

export function activityTypes(): readonly ActivityType[] {
  return [...registry.values()];
}

export type ActivityStatus =
  "pending" | "approved" | "rejected" | "cancelled" | "done" | "interrupted";

/** One submitted activity, as the run needs it. */
export interface QueuedActivity {
  readonly id: string;
  readonly character: string;
  readonly type: string;
  /** Total seconds it takes. */
  readonly seconds: number;
  /** Seconds already done in earlier downtimes. */
  readonly progress: number;
  readonly status: ActivityStatus;
  readonly waitsFor?: string;
}

export interface RunResult {
  readonly id: string;
  /** Seconds it ran in this downtime. */
  readonly ran: number;
  /** Seconds into the downtime when it stopped or finished. */
  readonly at: number;
  readonly state:
    "done" | "continues" | "interrupted" | "not-started" | "waiting";
}

/**
 * Runs approved activities for `elapsed` seconds, in submission order (the list's order), each
 * character one activity at a time.
 */
export function runDowntime(
  queue: readonly QueuedActivity[],
  elapsed: number,
): RunResult[] {
  const cursor = new Map<string, number>();
  const finishedAt = new Map<string, number>();
  for (const a of queue) if (a.status === "done") finishedAt.set(a.id, 0);
  const results: RunResult[] = [];
  for (const a of queue) {
    if (a.status !== "approved") continue;
    const type = activityType(a.type);
    let start = cursor.get(a.character) ?? 0;
    if (a.waitsFor !== undefined) {
      const ready = finishedAt.get(a.waitsFor);
      if (ready === undefined) {
        results.push({ id: a.id, ran: 0, at: start, state: "waiting" });
        continue;
      }
      start = Math.max(start, ready);
    }
    const left = Math.max(0, a.seconds - a.progress);
    const available = Math.max(0, elapsed - start);
    if (available >= left) {
      const at = start + left;
      cursor.set(a.character, at);
      finishedAt.set(a.id, at);
      results.push({ id: a.id, ran: left, at, state: "done" });
    } else if (available === 0) {
      results.push({ id: a.id, ran: 0, at: start, state: "not-started" });
    } else {
      cursor.set(a.character, elapsed);
      results.push({
        id: a.id,
        ran: available,
        at: elapsed,
        state: type?.splittable === false ? "interrupted" : "continues",
      });
    }
  }
  return results;
}

/** "Carol: Long Rest 8 h, note 2 h (keep watch)": a character's activities for the DM. */
export function summaryLine(
  name: string,
  activities: readonly {
    readonly type: string;
    readonly seconds: number;
    readonly note?: string;
  }[],
): string {
  const items = activities.map((a) => {
    const t = activityType(a.type);
    const hours = a.seconds / 3600;
    const length =
      hours >= 1
        ? `${Number(hours.toFixed(2))} h`
        : `${Math.round(a.seconds / 60)} min`;
    return `${t?.name ?? a.type} ${length}${a.note ? ` (${a.note})` : ""}`;
  });
  return `${name}: ${items.length ? items.join(", ") : "nothing yet"}`;
}
