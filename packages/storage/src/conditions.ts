// Applying and removing conditions at the table (Milestone 5 S5; Turns, Encounters and Time,
// "Conditions"). The DM changes a character's `conditions` directly, and each change is logged; a
// player asks through the sheet, like any edit of a campaign character.

import type { RecordId } from "@hearthtable/kernel";
import type { Moment } from "@hearthtable/play";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { CAMPAIGNS } from "./campaigns";
import type { Repository } from "./repository";

export interface ConditionEntry {
  readonly id: string;
  readonly ref: string;
  readonly level?: number;
  readonly source?: string;
  readonly endsAt?: Moment;
  readonly save?: { readonly ability: string; readonly dc: number };
  readonly note?: string;
}

/** Adds or removes condition entries on a character and logs `text`. */
export async function changeConditions(
  db: Firestore,
  repo: Repository,
  campaign: string,
  characterPath: string,
  change: {
    readonly add?: readonly ConditionEntry[];
    readonly remove?: readonly string[];
  },
  by: string,
  clock: number,
  text: string,
): Promise<string | undefined> {
  const found = await repo.get(characterPath as RecordId);
  if (!found.ok) return found.errors.map((e) => e.message).join("\n");
  if (!found.value) return "That character is no longer there.";
  const record = found.value;
  const data = record.data as Record<string, unknown>;
  const gone = new Set(change.remove ?? []);
  const list = (
    (data["conditions"] as ConditionEntry[] | undefined) ?? []
  ).filter((c) => !gone.has(c.id));
  const saved = await repo.save([
    {
      ...record,
      data: {
        ...data,
        conditions: [...list, ...(change.add ?? []).map((c) => ({ ...c }))],
      },
    },
  ]);
  if (!saved.ok) return saved.errors.map((e) => e.message).join("\n");
  try {
    await setDoc(doc(collection(db, CAMPAIGNS, campaign, "log")), {
      kind: "condition",
      by,
      clock,
      text,
      at: serverTimestamp(),
    });
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
