// The table: a campaign's game in progress (Milestone 5, S2; Turns, Encounters and Time,
// "Scenes"). Alongside the campaign document:
//
// - `/campaigns/{id}/play/state`: the game clock (seconds since midnight before Day 1) and the
//   current scene's record path. Only the campaign's DMs write it.
// - `/campaigns/{id}/log/{entry}`: the campaign log, in order. Entries are only ever added: the
//   app writes what happens (scenes, clock changes), and the DM and players post text to it.
//
// Scenes themselves are records (`campaign/<C>/Encounters/…`, `campaign/<C>/Downtime/…`), so
// their NPC instances can sit under them. Security Rules check who may write (firestore.rules).

import { type RecordEnvelope, type RecordId } from "@hearthtable/kernel";
import {
  formatClock,
  newScenePath,
  sceneLabel,
  type SceneData,
  type SceneKind,
} from "@hearthtable/play";
import {
  collection,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { CAMPAIGNS } from "./campaigns";
import type { Repository } from "./repository";

export interface PlayState {
  readonly clock: number;
  /** Record path of the current scene. */
  readonly scene: string;
}

export type LogKind =
  | "post"
  | "scene"
  | "clock"
  | "title"
  | "turn"
  | "initiative"
  | "order"
  | "effect"
  | "condition"
  | "activity"
  | "request";

export interface LogEntry {
  readonly id: string;
  readonly kind: LogKind;
  readonly by: string;
  /** Game clock seconds when it happened. */
  readonly clock: number;
  readonly text: string;
  /** When it was written, once the server has stamped it. */
  readonly at?: Date;
}

/** Longest text one log entry may hold (also enforced by the Security Rules). */
export const LOG_TEXT_LIMIT = 2000;
/** How many of the latest entries the table shows. */
export const LOG_SHOWN = 300;

const failed = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function watchPlayState(
  db: Firestore,
  id: string,
  onState: (state: PlayState | undefined) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, CAMPAIGNS, id, "play", "state"),
    (snap) => {
      const d = snap.data();
      onState(
        typeof d?.["clock"] === "number" && typeof d["scene"] === "string"
          ? { clock: d["clock"], scene: d["scene"] }
          : undefined,
      );
    },
    (e) => onError(failed(e)),
  );
}

export function watchLog(
  db: Firestore,
  id: string,
  onEntries: (entries: readonly LogEntry[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    query(
      collection(db, CAMPAIGNS, id, "log"),
      orderBy("at"),
      limitToLast(LOG_SHOWN),
    ),
    (snap) =>
      onEntries(
        snap.docs
          .map((d) => {
            const x = d.data({ serverTimestamps: "estimate" });
            return {
              id: d.id,
              kind: x["kind"] as LogKind,
              by: String(x["by"] ?? ""),
              clock: Number(x["clock"] ?? 0),
              text: String(x["text"] ?? ""),
              n: Number(x["n"] ?? 0),
              ...(x["at"]?.toDate ? { at: x["at"].toDate() as Date } : {}),
            };
          })
          // Entries written together share a time; `n` keeps the order they were written in.
          .sort(
            (a, b) =>
              (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0) || a.n - b.n,
          )
          .map(({ n: _n, ...entry }) => entry),
      ),
    (e) => onError(failed(e)),
  );
}

function sceneRecord(
  path: string,
  data: SceneData,
  kind: SceneKind,
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
    data: { ...data },
    raw: {},
  };
}

const logEntry = (kind: LogKind, by: string, clock: number, text: string) => ({
  kind,
  by,
  clock,
  text: text.slice(0, LOG_TEXT_LIMIT),
  at: serverTimestamp(),
});

/**
 * Opens a campaign's table for the first time: a downtime scene at Day 1, 12:00 am (the DM then
 * sets the clock). Reuses a downtime scene left by an earlier attempt that did not finish.
 */
export async function openTable(
  db: Firestore,
  repo: Repository,
  campaignPath: string,
  uid: string,
): Promise<string | undefined> {
  const id = campaignPath.split("/")[1]?.toLowerCase() as string;
  const existing = await repo.listUnder(`${campaignPath}/Downtime`);
  if (!existing.ok) return existing.errors.map((e) => e.message).join("\n");
  let scene = existing.value.find((r) => r.kind === "downtime")?.id as
    string | undefined;
  if (!scene) {
    scene = newScenePath(campaignPath, "downtime", 0, []);
    const saved = await repo.save([
      sceneRecord(scene, { startedAt: 0 }, "downtime"),
    ]);
    if (!saved.ok) return saved.errors.map((e) => e.message).join("\n");
  }
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, CAMPAIGNS, id, "play", "state"), { clock: 0, scene });
    batch.set(
      doc(collection(db, CAMPAIGNS, id, "log")),
      logEntry("scene", uid, 0, `${sceneLabel(scene)} began.`),
    );
    await batch.commit();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

/** The DM sets the clock (the start, or a correction); logged with the old and new time. */
export async function setClock(
  db: Firestore,
  id: string,
  uid: string,
  state: PlayState,
  clock: number,
): Promise<string | undefined> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, CAMPAIGNS, id, "play", "state"), { ...state, clock });
    batch.set(
      doc(collection(db, CAMPAIGNS, id, "log")),
      logEntry(
        "clock",
        uid,
        clock,
        `The DM set the clock from ${formatClock(state.clock)} to ${formatClock(clock)}.`,
      ),
    );
    await batch.commit();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

/** A DM or player posts text to the log. */
export async function postToLog(
  db: Firestore,
  id: string,
  uid: string,
  clock: number,
  text: string,
): Promise<string | undefined> {
  const trimmed = text.trim();
  if (!trimmed) return "Nothing to post.";
  return postEntry(db, id, logEntry("post", uid, clock, trimmed));
}

/** The DM titles a scene; its path keeps the automatic name. Logged. */
export async function titleScene(
  db: Firestore,
  repo: Repository,
  id: string,
  uid: string,
  clock: number,
  scene: RecordEnvelope,
  title: string,
): Promise<string | undefined> {
  const shown = title.trim();
  const { title: _old, ...rest } = scene.data as SceneData &
    Record<string, unknown>;
  const saved = await repo.save([
    { ...scene, data: shown ? { ...rest, title: shown } : rest },
  ]);
  if (!saved.ok) return saved.errors.map((e) => e.message).join("\n");
  const name = sceneLabel(scene.id);
  return postEntry(
    db,
    id,
    logEntry(
      "title",
      uid,
      clock,
      shown
        ? `The DM titled ${name} “${shown}”.`
        : `The DM removed ${name}'s title.`,
    ),
  );
}

async function postEntry(db: Firestore, id: string, entry: object) {
  try {
    const batch = writeBatch(db);
    batch.set(doc(collection(db, CAMPAIGNS, id, "log")), entry);
    await batch.commit();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}
