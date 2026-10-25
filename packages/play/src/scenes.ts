// Scenes (Turns, Encounters and Time, "Scenes", selected 2026-10-24 at 10:22 pm PDT): play is
// always in an encounter or a downtime scene. Encounters live at
// campaign/<Campaign>/Encounters/<Scene> and downtime scenes at campaign/<Campaign>/Downtime/<Scene>.
// A scene is named from the clock when it starts ("Day 1 Downtime", "Day 3 Encounter 2"), and that
// name stays its path; the DM's title is shown with it.

import { clockParts } from "./clock";

export type SceneKind = "encounter" | "downtime";

export const SCENE_FOLDERS: Record<SceneKind, string> = {
  encounter: "Encounters",
  downtime: "Downtime",
};

/** What a scene record holds. NPC instances are records under its path. */
export interface SceneData {
  /** The DM's title, shown with the automatic name. */
  readonly title?: string;
  /** Game clock seconds when it started, and when it ended. */
  readonly startedAt: number;
  readonly endedAt?: number;
}

/** The record path of a new scene, named from the clock and numbered after others that day. */
export function newScenePath(
  campaignPath: string,
  kind: SceneKind,
  clock: number,
  existing: readonly string[],
): string {
  const { day } = clockParts(clock);
  const base = `Day_${day}_${kind === "encounter" ? "Encounter" : "Downtime"}`;
  const folder = `${campaignPath}/${SCENE_FOLDERS[kind]}/`;
  const taken = new Set(existing.map((p) => p.toLowerCase()));
  // Encounters are always numbered; a day's first downtime is not.
  for (let n = 1; ; n++) {
    const name = kind === "encounter" || n > 1 ? `${base}_${n}` : base;
    if (!taken.has((folder + name).toLowerCase())) return folder + name;
  }
}

export function sceneKindOf(path: string): SceneKind | undefined {
  const folder = path.split("/")[2];
  return folder === "Encounters"
    ? "encounter"
    : folder === "Downtime"
      ? "downtime"
      : undefined;
}

/** "Day 3 Encounter 2", or with the DM's title: "Ambush at the ford (Day 3 Encounter 2)". */
export function sceneLabel(path: string, title?: string): string {
  const name = (path.split("/").at(-1) ?? path).replaceAll("_", " ");
  return title ? `${title} (${name})` : name;
}

/** Whether a record path is a scene or something inside one, such as an NPC instance. */
export function isInScene(path: string): boolean {
  const folder = path.split("/")[2];
  return (
    path.startsWith("campaign/") &&
    (folder === "Encounters" || folder === "Downtime")
  );
}
