// The campaign's current game moment for sheets and the table (Milestone 5 S4): from the play
// state's clock and, during an encounter, its round and step. Resolution reads it from a
// `game-time` record that is never stored, so effects whose time is up stop counting.

import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { momentNow, sceneKindOf, type Moment } from "@hearthtable/play";
import {
  campaignIdFor,
  watchEncounter,
  watchPlayState,
  type EncounterState,
  type PlayState,
} from "@hearthtable/storage";
import { useEffect, useState } from "react";
import { db } from "../firebase";

/** The record that tells resolution what time it is. */
export function gameTimeRecord(now: Moment): RecordEnvelope {
  return {
    id: "game-time" as RecordId,
    kind: "game-time",
    moduleId: "active-effects",
    schemaVersion: 1,
    origin: { scope: "core" },
    source: { status: "homebrew" },
    revision: 0,
    updatedAt: new Date(0).toISOString(),
    data: { now: { ...now } },
    raw: {},
  };
}

export function momentOf(
  state: PlayState | null | undefined,
  encounter: EncounterState | undefined,
): Moment | undefined {
  if (!state) return undefined;
  return momentNow(
    state.clock,
    encounter && encounter.scene === state.scene && !encounter.ended
      ? encounter
      : undefined,
  );
}

/** The current moment in a campaign, or undefined outside one (or before its table opens). */
export function useGameNow(campaignSegment: string | undefined) {
  const [state, setState] = useState<PlayState | null | undefined>();
  const [encounter, setEncounter] = useState<EncounterState | undefined>();
  const id = campaignSegment ? campaignIdFor(campaignSegment) : undefined;
  useEffect(() => {
    if (!id) return;
    return watchPlayState(
      db,
      id,
      (s) => setState(s ?? null),
      () => {},
    );
  }, [id]);
  const scene = state?.scene;
  useEffect(() => {
    if (!id || !scene || sceneKindOf(scene) !== "encounter") return;
    const stop = watchEncounter(db, id, scene, setEncounter, () => {});
    return () => {
      stop();
      setEncounter(undefined);
    };
  }, [id, scene]);
  return momentOf(state, encounter);
}
