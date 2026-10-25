// Encounters in progress (Milestone 5, S3; Turns, Encounters and Time). Alongside the play state:
//
// - `/campaigns/{id}/encounters/{scene name}`: the turn state of one encounter: its scene path,
//   the clock when it started, who takes part, who was surprised, the round (0 while initiative
//   is entered), the current participant, the order the DM kept (once round 1 begins), `seq` (a
//   count of turn changes) and when each participant's latest turn began. DMs change anything;
//   whoever controls the current participant may only pass the turn on.
// - `/campaigns/{id}/encounters/{scene name}/participants/{encoded path}`: one participant's
//   initiative and action-budget ticks, written by its controller or a DM.
//
// The encounter's record (`campaign/<C>/Encounters/<Scene>`) and its NPC instances under it are
// records. When the encounter ends its record gets the final order and initiatives and becomes
// read-only history, and a downtime scene starts. Nothing here is deleted.

import { type RecordEnvelope, type RecordId } from "@hearthtable/kernel";
import {
  encounterLength,
  formatDuration,
  newScenePath,
  sceneLabel,
  type InitiativeEntry,
  type Use,
} from "@hearthtable/play";
import {
  collection,
  doc,
  increment,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Unsubscribe,
  type WriteBatch,
} from "firebase/firestore";
import { CAMPAIGNS } from "./campaigns";
import { documentIdFor } from "./firestore";
import type { Repository } from "./repository";
import type { PlayState } from "./table";

export interface EncounterState {
  readonly id: string;
  readonly scene: string;
  readonly startClock: number;
  readonly participants: readonly string[];
  readonly surprised: readonly string[];
  /** 0 while initiative is being entered. */
  readonly round: number;
  readonly current?: string;
  /** The order kept since round 1 began, with the DM's moves. */
  readonly order?: readonly string[];
  readonly seq: number;
  /** Steps of 1/40 s into the current round: each turn start and each action or reaction. */
  readonly step: number;
  /** `seq` when each participant's latest turn began, by encoded path. */
  readonly turnStarts: Readonly<Record<string, number>>;
  readonly ended: boolean;
}

export interface ParticipantState {
  readonly path: string;
  readonly initiative?: InitiativeEntry & { readonly detail: string };
  readonly used: Partial<Record<"action" | "bonus" | "reaction", Use>>;
}

const failed = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const errors = (r: { errors: readonly { message: string }[] }) =>
  r.errors.map((e) => e.message).join("\n");

/** The encounter document's id: the scene's own name, such as Day_1_Encounter_1. */
export const encounterIdFor = (scene: string) =>
  scene.split("/").at(-1) as string;

/** A record's data as an object, to copy or extend. */
const dataOf = (r: RecordEnvelope) => r.data as Record<string, unknown>;

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export function watchEncounter(
  db: Firestore,
  campaign: string,
  scene: string,
  onState: (state: EncounterState | undefined) => void,
  onError: (message: string) => void,
): Unsubscribe {
  const id = encounterIdFor(scene);
  return onSnapshot(
    doc(db, CAMPAIGNS, campaign, "encounters", id),
    (snap) => {
      const d = snap.data();
      if (!d) return onState(undefined);
      onState({
        id,
        scene: String(d["scene"]),
        startClock: Number(d["startClock"] ?? 0),
        participants: strings(d["participants"]),
        surprised: strings(d["surprised"]),
        round: Number(d["round"] ?? 0),
        ...(typeof d["current"] === "string" ? { current: d["current"] } : {}),
        ...(Array.isArray(d["order"]) ? { order: strings(d["order"]) } : {}),
        seq: Number(d["seq"] ?? 0),
        step: Number(d["step"] ?? 0),
        turnStarts: (d["turnStarts"] ?? {}) as Record<string, number>,
        ended: d["ended"] === true,
      });
    },
    (e) => onError(failed(e)),
  );
}

export function watchParticipants(
  db: Firestore,
  campaign: string,
  scene: string,
  onParticipants: (list: readonly ParticipantState[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    collection(
      db,
      CAMPAIGNS,
      campaign,
      "encounters",
      encounterIdFor(scene),
      "participants",
    ),
    (snap) =>
      onParticipants(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: "estimate" });
          const i = x["initiative"];
          return {
            path: String(x["path"]),
            ...(i && typeof i.value === "number"
              ? {
                  initiative: {
                    value: i.value,
                    at: i.at?.toMillis ? i.at.toMillis() : Date.now(),
                    detail: String(i.detail ?? ""),
                  },
                }
              : {}),
            used: (x["used"] ?? {}) as ParticipantState["used"],
          };
        }),
      ),
    (e) => onError(failed(e)),
  );
}

const encounterRef = (db: Firestore, campaign: string, scene: string) =>
  doc(db, CAMPAIGNS, campaign, "encounters", encounterIdFor(scene));
const participantRef = (
  db: Firestore,
  campaign: string,
  scene: string,
  path: string,
) =>
  doc(encounterRef(db, campaign, scene), "participants", documentIdFor(path));

/** How many log entries each batch has written, so entries written together keep their order. */
const written = new WeakMap<WriteBatch, number>();

function log(
  batch: WriteBatch,
  db: Firestore,
  campaign: string,
  kind: string,
  by: string,
  clock: number,
  text: string,
) {
  const n = written.get(batch) ?? 0;
  written.set(batch, n + 1);
  batch.set(doc(collection(db, CAMPAIGNS, campaign, "log")), {
    kind,
    by,
    clock,
    text,
    at: serverTimestamp(),
    n,
  });
}

async function commit(build: (batch: WriteBatch) => void, db: Firestore) {
  try {
    const batch = writeBatch(db);
    build(batch);
    await batch.commit();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

function sceneRecord(
  path: string,
  kind: "encounter" | "downtime",
  data: Record<string, unknown>,
): RecordEnvelope {
  return {
    id: path as RecordId,
    kind,
    moduleId: "play",
    schemaVersion: 1,
    origin: { scope: "campaign", ownerId: path.split("/")[1] as string },
    source: { status: "homebrew" },
    revision: 0,
    updatedAt: new Date().toISOString(),
    data,
    raw: {},
  };
}

/** An NPC deployed from a template: its records copied under the scene, and its roll. */
export interface Deployment {
  /** The template's records: the character and everything under it. */
  readonly template: readonly RecordEnvelope[];
  /** Instance names, such as Goblin 1, Goblin 2. */
  readonly names: readonly string[];
  /** One automatic initiative roll per instance, in the same order. */
  readonly rolls: readonly {
    readonly total: number;
    readonly detail: string;
  }[];
  /** Whether these instances start the encounter surprised. */
  readonly surprised?: boolean;
}

const segment = (name: string) => name.trim().replace(/\s+/g, "_");

/** Copies template records to an instance path, as an NPC with no creator. */
function instanceRecords(
  template: readonly RecordEnvelope[],
  scene: string,
  name: string,
): RecordEnvelope[] {
  const root = template.find((r) => r.kind === "character");
  if (!root) return [];
  const path = `${scene}/${segment(name)}`;
  return template.map((r) => ({
    ...r,
    id: (path + r.id.slice(root.id.length)) as RecordId,
    origin: { scope: "campaign", ownerId: scene.split("/")[1] as string },
    revision: 0,
    updatedAt: new Date().toISOString(),
    data:
      r.id === root.id
        ? { ...dataOf(r), name, template: root.id }
        : { ...dataOf(r) },
    raw: {},
  }));
}

function deployed(scene: string, deployments: readonly Deployment[]) {
  const records: RecordEnvelope[] = [];
  const rolls: { path: string; total: number; detail: string }[] = [];
  const surprised: string[] = [];
  for (const d of deployments)
    d.names.forEach((name, i) => {
      const path = `${scene}/${segment(name)}`;
      records.push(...instanceRecords(d.template, scene, name));
      const roll = d.rolls[i];
      if (roll) rolls.push({ path, ...roll });
      if (d.surprised) surprised.push(path);
    });
  return { records, rolls, surprised };
}

/**
 * The DM starts an encounter. The downtime scene in progress ends after `elapsed` seconds (the
 * same step, as decided), the encounter scene starts with the chosen characters and deployed NPC
 * instances, and NPC initiative is entered from their automatic rolls.
 */
export async function startEncounter(
  db: Firestore,
  repo: Repository,
  options: {
    readonly campaign: string;
    readonly campaignPath: string;
    readonly uid: string;
    readonly state: PlayState;
    readonly downtime: RecordEnvelope;
    readonly elapsed: number;
    readonly characters: readonly string[];
    readonly deployments: readonly Deployment[];
    readonly surprised: readonly string[];
    /** Names shown in the log, by path. */
    readonly names: ReadonlyMap<string, string>;
  },
): Promise<string | undefined> {
  const o = options;
  const start = o.state.clock + Math.max(0, Math.floor(o.elapsed));
  const existing = await repo.listUnder(`${o.campaignPath}/Encounters`);
  if (!existing.ok) return errors(existing);
  const scene = newScenePath(
    o.campaignPath,
    "encounter",
    start,
    existing.value.map((r) => r.id),
  );
  const npcs = deployed(scene, o.deployments);
  const participants = [
    ...o.characters,
    ...npcs.records.filter((r) => r.kind === "character").map((r) => r.id),
  ];
  const saved = await repo.save([
    { ...o.downtime, data: { ...dataOf(o.downtime), endedAt: start } },
    sceneRecord(scene, "encounter", { startedAt: start, participants }),
    ...npcs.records,
  ]);
  if (!saved.ok) return errors(saved);
  const name = (p: string) =>
    o.names.get(p) ?? (p.split("/").at(-1) as string).replaceAll("_", " ");
  return commit((batch) => {
    batch.set(doc(db, CAMPAIGNS, o.campaign, "play", "state"), {
      clock: start,
      scene,
    });
    batch.set(encounterRef(db, o.campaign, scene), {
      scene,
      startClock: start,
      participants,
      surprised: [...o.surprised, ...npcs.surprised],
      round: 0,
      seq: 0,
      step: 0,
      turnStarts: {},
      ended: false,
    });
    for (const r of npcs.rolls)
      batch.set(participantRef(db, o.campaign, scene, r.path), {
        path: r.path,
        initiative: { value: r.total, detail: r.detail, at: serverTimestamp() },
        used: {},
      });
    log(
      batch,
      db,
      o.campaign,
      "scene",
      o.uid,
      start,
      `${sceneLabel(o.downtime.id)} ended after ${formatDuration(start - o.state.clock)}.`,
    );
    log(
      batch,
      db,
      o.campaign,
      "scene",
      o.uid,
      start,
      `${sceneLabel(scene)} began: ${participants.map(name).join(", ")}.`,
    );
  }, db);
}

/** A participant's controller or a DM enters its initiative, rolled or typed. */
export function enterInitiative(
  db: Firestore,
  campaign: string,
  scene: string,
  path: string,
  value: number,
  detail: string,
  by: string,
  clock: number,
  name: string,
) {
  return commit((batch) => {
    batch.set(
      participantRef(db, campaign, scene, path),
      {
        path,
        initiative: { value, detail, at: serverTimestamp() },
        control: documentIdFor(path),
      },
      { merge: true },
    );
    log(
      batch,
      db,
      campaign,
      "initiative",
      by,
      clock,
      `${name}: initiative ${value}${detail ? ` (${detail})` : ""}.`,
    );
  }, db);
}

/** Ticks or unticks an Action, Bonus Action or Reaction. */
export function setUse(
  db: Firestore,
  campaign: string,
  scene: string,
  path: string,
  kind: "action" | "bonus" | "reaction",
  use: Use,
) {
  return commit((batch) => {
    batch.set(
      participantRef(db, campaign, scene, path),
      { path, used: { [kind]: { ...use } }, control: documentIdFor(path) },
      { merge: true },
    );
  }, db);
}

/** The DM begins round 1 with the order as it stands. */
export function beginRound1(
  db: Firestore,
  campaign: string,
  encounter: EncounterState,
  order: readonly string[],
  uid: string,
) {
  const first = order[0];
  if (!first) return Promise.resolve("Nobody is in the encounter.");
  return commit((batch) => {
    batch.update(encounterRef(db, campaign, encounter.scene), {
      round: 1,
      seq: 1,
      step: 1,
      current: first,
      order: [...order],
      turnStarts: { [documentIdFor(first)]: 1 },
    });
    log(
      batch,
      db,
      campaign,
      "turn",
      uid,
      encounter.startClock,
      "Round 1 began.",
    );
  }, db);
}

/** Passes the turn on: by whoever controls the current participant, or a DM. */
export function passTurn(
  db: Firestore,
  campaign: string,
  encounter: EncounterState,
  next: { readonly round: number; readonly current: string },
  uid: string,
  clock: number,
  text: string,
) {
  const seq = encounter.seq + 1;
  return commit((batch) => {
    batch.update(encounterRef(db, campaign, encounter.scene), {
      round: next.round,
      current: next.current,
      seq,
      // A turn starting is a step; a new round starts again from its first turn.
      step: next.round > encounter.round ? 1 : encounter.step + 1,
      [`turnStarts.${documentIdFor(next.current)}`]: seq,
      ...(encounter.current
        ? { controlOf: documentIdFor(encounter.current) }
        : {}),
    });
    log(batch, db, campaign, "turn", uid, clock, text);
  }, db);
}

/** An action or reaction was taken: the encounter's time moves on one step (1/40 s). */
export function takeStep(
  db: Firestore,
  campaign: string,
  encounter: EncounterState,
) {
  return commit((batch) => {
    // An increment, so two quick actions both count.
    batch.update(encounterRef(db, campaign, encounter.scene), {
      step: increment(1),
    });
  }, db);
}

/** The DM keeps a new order (moving someone), adds or removes participants. Logged. */
export function changeParticipants(
  db: Firestore,
  campaign: string,
  encounter: EncounterState,
  change: {
    readonly participants?: readonly string[];
    readonly order?: readonly string[];
  },
  uid: string,
  clock: number,
  text: string,
) {
  return commit((batch) => {
    batch.update(encounterRef(db, campaign, encounter.scene), {
      ...(change.participants
        ? { participants: [...change.participants] }
        : {}),
      ...(change.order ? { order: [...change.order] } : {}),
    });
    log(batch, db, campaign, "order", uid, clock, text);
  }, db);
}

/** The DM deploys more NPC instances or adds characters mid-encounter. */
export async function addToEncounter(
  db: Firestore,
  repo: Repository,
  campaign: string,
  encounter: EncounterState,
  characters: readonly string[],
  deployments: readonly Deployment[],
  uid: string,
  clock: number,
  text: string,
): Promise<string | undefined> {
  const npcs = deployed(encounter.scene, deployments);
  if (npcs.records.length) {
    const saved = await repo.save(npcs.records);
    if (!saved.ok) return errors(saved);
  }
  const added = [
    ...characters,
    ...npcs.records.filter((r) => r.kind === "character").map((r) => r.id),
  ];
  return commit((batch) => {
    batch.update(encounterRef(db, campaign, encounter.scene), {
      participants: [...encounter.participants, ...added],
    });
    for (const r of npcs.rolls)
      batch.set(participantRef(db, campaign, encounter.scene, r.path), {
        path: r.path,
        initiative: { value: r.total, detail: r.detail, at: serverTimestamp() },
        used: {},
      });
    log(batch, db, campaign, "order", uid, clock, text);
  }, db);
}

/**
 * The DM ends the encounter: its record keeps the final order and initiatives and becomes
 * read-only history, the clock moves to the end of the round in progress, and a downtime scene
 * starts by itself.
 */
export async function endEncounter(
  db: Firestore,
  repo: Repository,
  options: {
    readonly campaign: string;
    readonly campaignPath: string;
    readonly uid: string;
    readonly encounter: EncounterState;
    readonly record: RecordEnvelope;
    readonly order: readonly string[];
    readonly initiative: ReadonlyMap<string, number>;
  },
): Promise<string | undefined> {
  const o = options;
  const end = o.encounter.startClock + encounterLength(o.encounter.round);
  const existing = await repo.listUnder(`${o.campaignPath}/Downtime`);
  if (!existing.ok) return errors(existing);
  const downtime = newScenePath(
    o.campaignPath,
    "downtime",
    end,
    existing.value.map((r) => r.id),
  );
  const saved = await repo.save([
    {
      ...o.record,
      data: {
        ...dataOf(o.record),
        endedAt: end,
        rounds: o.encounter.round,
        order: o.order.map((path) => ({
          path,
          ...(o.initiative.has(path)
            ? { initiative: o.initiative.get(path) }
            : {}),
        })),
      },
    },
    sceneRecord(downtime, "downtime", { startedAt: end }),
  ]);
  if (!saved.ok) return errors(saved);
  return commit((batch) => {
    batch.update(encounterRef(db, o.campaign, o.encounter.scene), {
      ended: true,
    });
    batch.set(doc(db, CAMPAIGNS, o.campaign, "play", "state"), {
      clock: end,
      scene: downtime,
    });
    log(
      batch,
      db,
      o.campaign,
      "scene",
      o.uid,
      end,
      `${sceneLabel(o.encounter.scene, dataOf(o.record)["title"] as string | undefined)} ended after ${o.encounter.round} round${o.encounter.round === 1 ? "" : "s"}.`,
    );
    log(
      batch,
      db,
      o.campaign,
      "scene",
      o.uid,
      end,
      `${sceneLabel(downtime)} began.`,
    );
  }, db);
}

/**
 * The DM lets time pass without an encounter: the downtime scene ends after `elapsed` seconds
 * (its activities having run) and a new downtime scene begins at the new time.
 */
export async function passTime(
  db: Firestore,
  repo: Repository,
  options: {
    readonly campaign: string;
    readonly campaignPath: string;
    readonly uid: string;
    readonly state: PlayState;
    readonly downtime: RecordEnvelope;
    readonly elapsed: number;
  },
): Promise<string | undefined> {
  const o = options;
  const end = o.state.clock + Math.max(0, Math.floor(o.elapsed));
  const existing = await repo.listUnder(`${o.campaignPath}/Downtime`);
  if (!existing.ok) return errors(existing);
  const next = newScenePath(
    o.campaignPath,
    "downtime",
    end,
    existing.value.map((r) => r.id),
  );
  const saved = await repo.save([
    { ...o.downtime, data: { ...dataOf(o.downtime), endedAt: end } },
    sceneRecord(next, "downtime", { startedAt: end }),
  ]);
  if (!saved.ok) return errors(saved);
  return commit((batch) => {
    batch.set(doc(db, CAMPAIGNS, o.campaign, "play", "state"), {
      clock: end,
      scene: next,
    });
    log(
      batch,
      db,
      o.campaign,
      "scene",
      o.uid,
      end,
      `${sceneLabel(o.downtime.id, dataOf(o.downtime)["title"] as string | undefined)} ended after ${formatDuration(end - o.state.clock)}.`,
    );
    log(
      batch,
      db,
      o.campaign,
      "scene",
      o.uid,
      end,
      `${sceneLabel(next)} began.`,
    );
  }, db);
}
