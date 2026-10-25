// Clearing effects from a character in a campaign (Milestone 5 S4; Spell Effects and Active
// State, "Active effects, game time and early ending"). An effect whose time is up already gives
// nothing; clearing removes its entry from the character and logs it. The DM also ends effects
// early this way. Each effect's ending is logged once: the entry has a fixed id, and the Rules
// never let a log entry be written twice.

import type { RecordId } from "@hearthtable/kernel";
import {
  doc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { CAMPAIGNS } from "./campaigns";
import type { Repository } from "./repository";

export interface EndedEffect {
  readonly id: string;
  readonly name: string;
}

/**
 * Removes `effects` from the character's active effects and logs each ending, `why` being
 * "expired" (its time was up), "early" (the DM ended it) or "concentration" (a condition such as
 * Incapacitated broke it).
 */
export async function endEffects(
  db: Firestore,
  repo: Repository,
  campaign: string,
  characterPath: string,
  characterName: string,
  effects: readonly EndedEffect[],
  why: "expired" | "early" | "concentration",
  by: string,
  clock: number,
): Promise<string | undefined> {
  const found = await repo.get(characterPath as RecordId);
  if (!found.ok) return found.errors.map((e) => e.message).join("\n");
  if (!found.value) return `${characterName} is no longer there.`;
  const record = found.value;
  const data = record.data as Record<string, unknown>;
  const ids = new Set(effects.map((e) => e.id));
  const list = (data["activeEffects"] as { id: string }[] | undefined) ?? [];
  const keep = list.filter((e) => !ids.has(e.id));
  if (keep.length !== list.length) {
    const saved = await repo.save([
      { ...record, data: { ...data, activeEffects: keep } },
    ]);
    if (!saved.ok) return saved.errors.map((e) => e.message).join("\n");
  }
  for (const e of effects) {
    try {
      await setDoc(doc(db, CAMPAIGNS, campaign, "log", `ended-${e.id}`), {
        kind: "effect",
        by,
        clock,
        text:
          why === "expired"
            ? `${e.name} on ${characterName} ended.`
            : why === "concentration"
              ? `${characterName} lost concentration on ${e.name}.`
              : `The DM ended ${e.name} on ${characterName} early.`,
        at: serverTimestamp(),
      });
    } catch {
      // Already logged by someone else: an ending is recorded once.
    }
  }
  return undefined;
}
