// Hand-entered records, rebuilt from the accepted sheets rather than migrated from old JSON
// (Lessons from Character Manager). Every file holds stored record envelopes exactly as they
// will be saved; loading checks each one and fails loudly rather than skipping bad records.

import { classRecords } from "@hearthtable/game-dnd5e-2024";
import { parseEnvelope, type RecordEnvelope } from "@hearthtable/kernel";
import riverbedCarol from "../campaign/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein.json";
import riverbedItems_ from "../campaign/Riverbed_of_Strings/Items.json";
import coreConditions from "../core/conditions.json";
import coreFeatures from "../core/features.json";
import coreItems from "../core/items.json";
import coreNpcsJson from "../core/npcs.json";
import coreSpells from "../core/spells.json";

function load(file: string, records: readonly unknown[]): RecordEnvelope[] {
  return records.map((raw, index) => {
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) {
      throw new Error(
        `${file}[${index}] is not a valid record: ${parsed.issues.map((i) => i.message).join("; ")}`,
      );
    }
    return parsed.value;
  });
}

/** Published definitions: classes (from the game module), features, spells, items and conditions. */
export const coreContent: readonly RecordEnvelope[] = [
  ...classRecords,
  ...load("core/features.json", coreFeatures),
  ...load("core/spells.json", coreSpells),
  ...load("core/items.json", coreItems),
  ...load("core/conditions.json", coreConditions),
];

/**
 * Core NPC templates (Milestone 5 S10): the SRD 5.2.1 Goblin Warrior, Bandit and Skeleton, each a
 * character with its inventory. Kept apart from `coreContent`, which every sheet resolves with.
 */
export const coreNpcs: readonly RecordEnvelope[] = load(
  "core/npcs.json",
  coreNpcsJson,
);

/**
 * Riverbed of Strings' items (the user's campaign): the Aetherlock, its rounds and canisters, and
 * Indomitable. They were VR_Lulu's account items until the user moved them, with Carol, into the
 * campaign (2026-10-24).
 */
export const riverbedItems: readonly RecordEnvelope[] = load(
  "campaign/Riverbed_of_Strings/Items.json",
  riverbedItems_,
);

/** Carol's sheet: the character (stats tab) and her inventory, books included. */
export const carolElfnein: readonly RecordEnvelope[] = load(
  "campaign/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein.json",
  riverbedCarol,
);

export const CAROL_ID =
  "campaign/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein";

/** Everything needed to resolve Carol's sheet. */
export function carolWithDefinitions(): readonly RecordEnvelope[] {
  return [...coreContent, ...riverbedItems, ...carolElfnein];
}
