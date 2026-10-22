// Hand-entered records, rebuilt from the accepted sheets rather than migrated from old JSON
// (Lessons from Character Manager). Every file holds stored record envelopes exactly as they
// will be saved; loading checks each one and fails loudly rather than skipping bad records.

import { classRecords } from "@hearthtable/game-dnd5e-2024";
import { parseEnvelope, type RecordEnvelope } from "@hearthtable/kernel";
import vrluluCarol from "../account/VRLulu/Characters/Carol_Elfnein.json";
import vrluluItems from "../account/VRLulu/Items.json";
import coreFeatures from "../core/features.json";
import coreItems from "../core/items.json";
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

/** Published definitions: classes (from the game module), features, spells and items. */
export const coreContent: readonly RecordEnvelope[] = [
  ...classRecords,
  ...load("core/features.json", coreFeatures),
  ...load("core/spells.json", coreSpells),
  ...load("core/items.json", coreItems),
];

/** VRLulu's account content: the Aetherlock, its rounds and canisters, and Indomitable. */
export const vrluluContent: readonly RecordEnvelope[] = load(
  "account/VRLulu/Items.json",
  vrluluItems,
);

/** Carol's sheet: the character (stats tab), her inventory and her three spellbooks. */
export const carolElfnein: readonly RecordEnvelope[] = load(
  "account/VRLulu/Characters/Carol_Elfnein.json",
  vrluluCarol,
);

export const CAROL_ID = "account/VRLulu/Characters/Carol_Elfnein";

/** Everything needed to resolve Carol's sheet. */
export function carolWithDefinitions(): readonly RecordEnvelope[] {
  return [...coreContent, ...vrluluContent, ...carolElfnein];
}
