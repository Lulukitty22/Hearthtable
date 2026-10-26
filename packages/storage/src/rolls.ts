// Roll prompts (Milestone 5 S8; Spell Effects and Active State, "Roll ownership and input
// modes"). One document per roll asked, `/campaigns/{id}/rolls/{roll}`: whose roll it is (the
// character, so its controller is prompted), what it is for, the formula (`spec`), the request it
// belongs to, and what follows from it (`consequence`). It is answered once, by the controller or
// by the DM taking over: the answer is written in a transaction that requires the roll to still
// be open, so a player's reply and a DM takeover can never both count. Every answer is logged.

import type { RollAnswer, RollOutcome, RollSpec } from "@hearthtable/play";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { CAMPAIGNS } from "./campaigns";
import { documentIdFor } from "./firestore";

/** What happens once a roll is answered, applied by the DM's view. */
export type RollConsequence =
  /** A failed concentration check ends the character's concentration. */
  | { readonly kind: "concentration" }
  /** A successful repeat save ends that condition and the effect that caused it. */
  | {
      readonly kind: "repeat-save";
      readonly condition: string;
      readonly effect?: string;
    };

export interface RollPrompt {
  readonly id: string;
  readonly character: string;
  readonly purpose: string;
  readonly spec: RollSpec;
  readonly action?: string;
  /** Which target of the request it is for, when it belongs to one. */
  readonly target?: string;
  readonly consequence?: RollConsequence;
  readonly status: "open" | "answered" | "cancelled";
  readonly answer?: RollAnswer & {
    readonly by: string;
    readonly takeover: boolean;
    readonly outcome?: RollOutcome;
  };
  /** The DM's view has applied its consequence. */
  readonly applied?: boolean;
  readonly requestedBy: string;
  readonly at?: Date;
}

const failed = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function watchRolls(
  db: Firestore,
  campaign: string,
  onList: (list: readonly RollPrompt[]) => void,
  onError: (message: string) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, CAMPAIGNS, campaign, "rolls"), orderBy("at")),
    (snap) =>
      onList(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: "estimate" });
          return {
            id: d.id,
            character: String(x["character"]),
            purpose: String(x["purpose"] ?? ""),
            spec: (x["spec"] ?? { kind: "custom" }) as RollSpec,
            ...(typeof x["action"] === "string" ? { action: x["action"] } : {}),
            ...(typeof x["target"] === "string" ? { target: x["target"] } : {}),
            ...(x["consequence"]
              ? { consequence: x["consequence"] as RollConsequence }
              : {}),
            status: x["status"] as RollPrompt["status"],
            ...(x["answer"]
              ? { answer: x["answer"] as RollPrompt["answer"] }
              : {}),
            ...(x["applied"] === true ? { applied: true } : {}),
            requestedBy: String(x["requestedBy"] ?? ""),
            ...(x["at"]?.toDate ? { at: x["at"].toDate() as Date } : {}),
          } as RollPrompt;
        }),
      ),
    (e) => onError(failed(e)),
  );
}

export interface RollAsk {
  readonly character: string;
  readonly purpose: string;
  readonly spec: RollSpec;
  readonly action?: string;
  readonly target?: string;
  readonly consequence?: RollConsequence;
}

/** Asks for rolls (the DM, or whoever passes a turn with a repeat save due). Logged. */
export async function askRolls(
  db: Firestore,
  campaign: string,
  asks: readonly RollAsk[],
  by: string,
  clock: number,
  text: string,
): Promise<string | undefined> {
  if (asks.length === 0) return undefined;
  try {
    const batch = writeBatch(db);
    for (const a of asks)
      batch.set(doc(collection(db, CAMPAIGNS, campaign, "rolls")), {
        ...a,
        spec: { ...a.spec },
        status: "open",
        requestedBy: by,
        control: documentIdFor(a.character),
        at: serverTimestamp(),
      });
    batch.set(doc(collection(db, CAMPAIGNS, campaign, "log")), {
      kind: "roll",
      by,
      clock,
      text,
      at: serverTimestamp(),
    });
    await batch.commit();
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

/** Answers a roll once; refused when it was already answered (by the player or the DM). */
export async function answerRoll(
  db: Firestore,
  campaign: string,
  roll: RollPrompt,
  answer: RollAnswer,
  outcome: RollOutcome | undefined,
  by: string,
  takeover: boolean,
  clock: number,
  text: string,
): Promise<string | undefined> {
  const ref = doc(db, CAMPAIGNS, campaign, "rolls", roll.id);
  try {
    return await runTransaction(db, async (tx) => {
      const now = await tx.get(ref);
      if (now.data()?.["status"] !== "open")
        return "This roll was already answered.";
      tx.update(ref, {
        status: "answered",
        answer: { ...answer, by, takeover, ...(outcome ? { outcome } : {}) },
      });
      tx.set(doc(collection(db, CAMPAIGNS, campaign, "log")), {
        kind: "roll",
        by,
        clock,
        text,
        at: serverTimestamp(),
        ...(roll.action ? { action: roll.action } : {}),
      });
      return undefined;
    });
  } catch (error) {
    return failed(error);
  }
}

/** The DM's view marks a roll's consequence as applied. */
export async function markRollApplied(
  db: Firestore,
  campaign: string,
  id: string,
) {
  try {
    await updateDoc(doc(db, CAMPAIGNS, campaign, "rolls", id), {
      applied: true,
    });
    return undefined;
  } catch (error) {
    return failed(error);
  }
}

/** The DM withdraws a roll no longer needed. */
export async function cancelRoll(db: Firestore, campaign: string, id: string) {
  try {
    await updateDoc(doc(db, CAMPAIGNS, campaign, "rolls", id), {
      status: "cancelled",
    });
    return undefined;
  } catch (error) {
    return failed(error);
  }
}
