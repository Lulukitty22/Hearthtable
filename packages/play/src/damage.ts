// Damage and healing (Turns, Encounters and Time, "Hit points, damage and going down"; Milestone 5
// S7). The 2024 arithmetic, applied automatically: immunity ignores a damage type, resistance
// halves it (rounded down), vulnerability doubles it, in that order; Temporary Hit Points absorb
// damage first. Under Hearthtable Vanilla+ hit points have no floor; under the 2024 rules they
// stop at 0. Healing adds to the number, from below zero too, and never passes the maximum.

export interface Defenses {
  readonly resistances: readonly string[];
  readonly vulnerabilities: readonly string[];
  readonly immunities: readonly string[];
}

export const NO_DEFENSES: Defenses = {
  resistances: [],
  vulnerabilities: [],
  immunities: [],
};

const has = (list: readonly string[], type: string) =>
  list.some((t) => t === "all" || t.toLowerCase() === type.toLowerCase());

/** How much of `amount` damage of `type` a creature takes, with each step explained. */
export function damageTaken(
  amount: number,
  type: string | undefined,
  defenses: Defenses,
): { readonly amount: number; readonly steps: readonly string[] } {
  const steps: string[] = [];
  let n = Math.max(0, Math.floor(amount));
  if (type && has(defenses.immunities, type)) {
    steps.push(`immune to ${type}: 0`);
    return { amount: 0, steps };
  }
  if (type && has(defenses.resistances, type)) {
    n = Math.floor(n / 2);
    steps.push(`resistant to ${type}: halved to ${n}`);
  }
  if (type && has(defenses.vulnerabilities, type)) {
    n *= 2;
    steps.push(`vulnerable to ${type}: doubled to ${n}`);
  }
  return { amount: n, steps };
}

export interface HitPoints {
  readonly current: number;
  readonly temporary: number;
}

/** Damage after defenses, taken from Temporary Hit Points first. */
export function applyDamage(
  hp: HitPoints,
  amount: number,
  floorAtZero: boolean,
): HitPoints & { readonly steps: readonly string[] } {
  const steps: string[] = [];
  const absorbed = Math.min(hp.temporary, amount);
  if (absorbed > 0) steps.push(`${absorbed} absorbed by Temporary Hit Points`);
  const rest = amount - absorbed;
  const current = floorAtZero
    ? Math.max(0, hp.current - rest)
    : hp.current - rest;
  return { current, temporary: hp.temporary - absorbed, steps };
}

/** Healing: added to current hit points (from below zero too), never above the maximum. */
export function applyHealing(
  current: number,
  max: number | undefined,
  amount: number,
): number {
  const healed = current + Math.max(0, Math.floor(amount));
  return max === undefined ? healed : Math.min(max, healed);
}
