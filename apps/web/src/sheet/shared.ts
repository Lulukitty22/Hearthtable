// What every tab receives, plus small helpers for reading the sheet's own records.

import type {
  RecordEnvelope,
  ResolvedCharacter,
  Value,
} from "@hearthtable/kernel";
import type { SheetActions } from "../useSheet";

export interface TabProps {
  readonly characterId: string;
  readonly resolved: ResolvedCharacter;
  readonly records: ReadonlyMap<string, RecordEnvelope>;
  readonly edit: SheetActions["edit"];
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
