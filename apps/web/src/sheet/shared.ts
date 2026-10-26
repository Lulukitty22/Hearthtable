// What every tab receives, plus small helpers for reading the sheet's own records.

import type {
  RecordEnvelope,
  ResolvedCharacter,
  Value,
} from "@hearthtable/kernel";
import type { Moment } from "@hearthtable/play";
import type { ActionRequest, EncounterState, Poll } from "@hearthtable/storage";
import type { SheetActions } from "../useSheet";

export interface TabProps {
  readonly characterId: string;
  readonly resolved: ResolvedCharacter;
  readonly records: ReadonlyMap<string, RecordEnvelope>;
  readonly edit: SheetActions["edit"];
  /** False on the view-only sheet: edit controls show as plain text and nothing can be dragged. */
  readonly canEdit: boolean;
  /** The campaign's current game moment, when the character is in a campaign whose table is open. */
  readonly now?: Moment;
  /** Acting in play (Milestone 5 S6): requests, for a viewer who may act for the character. */
  readonly play?: SheetPlay;
}

export interface SheetPlay {
  readonly campaign: string;
  readonly uid: string;
  /** The encounter in progress, when there is one (Next Turn is offered only then). */
  readonly encounter?: EncounterState;
  readonly clock: number;
  /** The current scene's record path, for who can be a target. */
  readonly scene?: string;
  /** This character's queued requests. */
  readonly requests: readonly ActionRequest[];
  /** Open response polls this character could answer (S9). */
  readonly polls: readonly Poll[];
}

export type Data = Record<string, unknown>;

/** The sheet record of a kind under this character, such as its inventory. */
export function sheetRecord(
  props: TabProps,
  kind: string,
): RecordEnvelope | undefined {
  return [...props.records.values()].find(
    (r) => r.kind === kind && r.id.startsWith(`${props.characterId}/`),
  );
}

export function sheetRecords(
  props: TabProps,
  kind: string,
): readonly RecordEnvelope[] {
  return [...props.records.values()].filter(
    (r) => r.kind === kind && r.id.startsWith(`${props.characterId}/`),
  );
}

export function known<T>(v: Value<T>): T | undefined {
  return v.kind === "known" ? v.value : undefined;
}

/** Display name of a definition, or its id when it cannot be found. */
export function nameOf(props: TabProps, id: string): string {
  const name = (props.records.get(id)?.data as { name?: unknown } | undefined)
    ?.name;
  return typeof name === "string" ? name : id;
}
