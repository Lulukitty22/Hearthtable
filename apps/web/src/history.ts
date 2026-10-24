// A character's history record (Campaigns and Shared Data, Character placement: each save writes
// one record under the character's path listing what changed and an optional note). Written by
// the sheet's own saves and by a DM accepting a proposed change (S7).

import type {
  RecordEnvelope,
  RecordId,
  RecordOrigin,
} from "@hearthtable/kernel";

export const historyKey = (iso: string) => iso.replace(/[^0-9TZ]/g, "");

export function historyRecord(
  characterId: string,
  origin: RecordOrigin,
  changed: readonly string[],
  note: string,
  now: string,
): RecordEnvelope {
  return {
    id: `${characterId}/History/${historyKey(now)}` as RecordId,
    kind: "history",
    moduleId: "sheet",
    schemaVersion: 1,
    origin,
    source: { status: "homebrew" },
    revision: 0,
    updatedAt: now,
    data: {
      at: now,
      changed: [...changed],
      ...(note.trim() ? { note: note.trim() } : {}),
    },
    raw: {},
  };
}
