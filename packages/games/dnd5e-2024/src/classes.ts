// Published class records needed for Milestone 2: hit die, saving throws and each class's own
// spellcasting table. They are core content in the record envelope, so storage can seed them.
// Slots are keyed by class level ("1" to "20"); within a row, index 0 is spell level 1. A map
// rather than a list of lists, because Firestore cannot store a list inside a list.

import { newEnvelope, type RecordEnvelope } from "@hearthtable/kernel";

export interface ClassData {
  readonly name: string;
  readonly hitDie: number;
  readonly savingThrows: readonly string[];
  readonly spellcasting?: {
    readonly ability: string;
    readonly slots: Readonly<Record<string, readonly number[]>>;
    /** Highest castable spell level by class level. */
    readonly maxSpellLevel: readonly number[];
  };
}

const FULL_CASTER_SLOTS = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const ARTIFICER_SLOTS = [
  [2],
  [2],
  [3],
  [3],
  [4, 2],
  [4, 2],
  [4, 3],
  [4, 3],
  [4, 3, 2],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2],
];

const byLevel = (rows: readonly number[][]) =>
  Object.fromEntries(rows.map((row, i) => [String(i + 1), row]));

const updatedAt = "2026-10-22T00:00:00.000Z";

export const wizard: RecordEnvelope<ClassData> = newEnvelope({
  id: "core/Classes/Wizard",
  kind: "class",
  moduleId: "dnd5e-2024",
  schemaVersion: 1,
  origin: { scope: "core" },
  source: {
    status: "published",
    edition: "2024",
    reference: "Player's Handbook (2024), Wizard",
  },
  revision: 0,
  updatedAt,
  data: {
    name: "Wizard",
    hitDie: 6,
    savingThrows: ["int", "wis"],
    spellcasting: {
      ability: "int",
      slots: byLevel(FULL_CASTER_SLOTS),
      maxSpellLevel: [
        1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9,
      ],
    },
  },
});

export const artificer: RecordEnvelope<ClassData> = newEnvelope({
  id: "core/Classes/Artificer",
  kind: "class",
  moduleId: "dnd5e-2024",
  schemaVersion: 1,
  origin: { scope: "core" },
  source: {
    status: "published",
    edition: "2024",
    reference: "Eberron: Forge of the Artificer (2025), Artificer",
    confidence:
      "Level 3 (three level-1 slots) verified by the user 2026-10-21; other rows follow the earlier published Artificer table and are unverified against the 2025 book",
  },
  revision: 0,
  updatedAt,
  data: {
    name: "Artificer",
    hitDie: 8,
    savingThrows: ["con", "int"],
    spellcasting: {
      ability: "int",
      slots: byLevel(ARTIFICER_SLOTS),
      maxSpellLevel: [
        1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5,
      ],
    },
  },
});

export const classRecords: readonly RecordEnvelope<ClassData>[] = [
  wizard,
  artificer,
];
