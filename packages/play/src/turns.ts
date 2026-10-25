// Encounters, initiative and turns (Turns, Encounters and Time, "Initiative and turn order",
// "Rounds and the game clock" and "Action budget", selected 2026-10-24 and 2026-10-25). Pure
// rules; storage and the table pages call them.
//
// - Initiative is d20 plus the character's initiative bonus, with Disadvantage when surprised;
//   or a typed total. Higher goes first; ties go to whoever entered first.
// - Before round 1 the order follows initiative. When the DM begins round 1 the order is kept as
//   it stands, and the DM may still move anyone; a participant added later is placed by its
//   initiative among the others, and anyone without one goes last.
// - Each round adds six seconds: during an encounter the clock reads its start plus six seconds
//   for each round already finished.
// - The budget: one Action, one Bonus Action and one Reaction. A use counts until the start of
//   that participant's next turn, so Action and Bonus Action are fresh each turn and a Reaction
//   refreshes at the start of its own turn. Using more only warns.

import {
  cryptoRandom,
  parseDice,
  roll,
  type RandomSource,
} from "@hearthtable/kernel";
import { SECONDS_PER_ROUND } from "./clock";

export interface InitiativeEntry {
  readonly value: number;
  /** When it was entered (milliseconds), for ties. */
  readonly at: number;
}

/** The turn order: a kept order if the DM has one, with everyone else placed by initiative. */
export function turnOrder(
  participants: readonly string[],
  initiative: ReadonlyMap<string, InitiativeEntry>,
  kept?: readonly string[],
): string[] {
  const present = new Set(participants);
  const byInitiative = (a: string, b: string) => {
    const x = initiative.get(a) as InitiativeEntry;
    const y = initiative.get(b) as InitiativeEntry;
    return y.value - x.value || x.at - y.at;
  };
  const rolled = participants.filter((p) => initiative.has(p));
  const waiting = participants.filter((p) => !initiative.has(p));
  if (!kept) return [...rolled.sort(byInitiative), ...waiting];

  const order = kept.filter((p) => present.has(p));
  const placed = new Set(order);
  for (const p of rolled.filter((x) => !placed.has(x)).sort(byInitiative)) {
    const mine = initiative.get(p) as InitiativeEntry;
    // After the last one who goes before it (higher, or equal and entered earlier), so the
    // DM's moves elsewhere in the order are kept.
    const ahead = order.findLastIndex((q) => {
      const other = initiative.get(q);
      return (
        other !== undefined &&
        (other.value > mine.value ||
          (other.value === mine.value && other.at <= mine.at))
      );
    });
    order.splice(ahead + 1, 0, p);
    placed.add(p);
  }
  return [...order, ...waiting.filter((p) => !placed.has(p))];
}

export interface TurnPosition {
  readonly round: number;
  readonly current: string;
}

/** Who goes next; after the last in the order, a new round begins with the first. */
export function nextTurn(
  order: readonly string[],
  position: TurnPosition,
): TurnPosition | undefined {
  if (order.length === 0) return undefined;
  const i = order.indexOf(position.current);
  return i >= 0 && i + 1 < order.length
    ? { round: position.round, current: order[i + 1] as string }
    : { round: position.round + 1, current: order[0] as string };
}

/** The game clock during an encounter: its start plus six seconds per finished round. */
export function encounterClock(startClock: number, round: number): number {
  return startClock + Math.max(0, round - 1) * SECONDS_PER_ROUND;
}

/** Seconds an encounter took when it ends during `round` (the round in progress counts). */
export function encounterLength(round: number): number {
  return Math.max(0, round) * SECONDS_PER_ROUND;
}

export type BudgetKind = "action" | "bonus" | "reaction";
export const BUDGET_KINDS: readonly BudgetKind[] = [
  "action",
  "bonus",
  "reaction",
];
export const BUDGET: Readonly<Record<BudgetKind, number>> = {
  action: 1,
  bonus: 1,
  reaction: 1,
};
export const BUDGET_NAMES: Readonly<Record<BudgetKind, string>> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
};

/** How many times something was used, and the turn count (`seq`) when last changed. */
export interface Use {
  readonly count: number;
  readonly seq: number;
}

/** Uses since the start of this participant's latest turn (all of them before its first turn). */
export function usesNow(
  use: Use | undefined,
  turnStart: number | undefined,
): number {
  return use && use.seq >= (turnStart ?? 0) ? use.count : 0;
}

/** Ticking a box: one more use now, or one fewer. */
export function changeUse(
  use: Use | undefined,
  turnStart: number | undefined,
  seq: number,
  delta: 1 | -1,
): Use {
  return { count: Math.max(0, usesNow(use, turnStart) + delta), seq };
}

/** A warning when uses go over the budget, or undefined. */
export function overBudget(
  kind: BudgetKind,
  count: number,
  name: string,
): string | undefined {
  return count > BUDGET[kind]
    ? `${name} has used ${count} × ${BUDGET_NAMES[kind]} this turn; the budget is ${BUDGET[kind]}. The DM decides.`
    : undefined;
}

export interface InitiativeRoll {
  readonly total: number;
  /** "d20 (14) + 8", or when surprised "2d20, lower (surprised) (14, 6) + 8". */
  readonly detail: string;
}

/** Rolls initiative: d20 plus the bonus, with Disadvantage when surprised. */
export function rollInitiative(
  bonus: number,
  surprised: boolean,
  random: RandomSource = cryptoRandom,
): InitiativeRoll {
  const dice = surprised ? "2d20kl1" : "1d20";
  const sign = bonus < 0 ? "-" : "+";
  const parsed = parseDice(`${dice}${sign}${Math.abs(bonus)}`);
  if (!parsed.ok) throw new Error("Initiative dice did not parse.");
  const result = roll(parsed.value, random);
  const faces = result.terms[0]?.faces ?? [];
  return {
    total: result.total,
    detail: `${surprised ? "2d20, lower (surprised)" : "d20"} (${faces.join(", ")}) ${bonus < 0 ? "−" : "+"} ${Math.abs(bonus)}`,
  };
}
