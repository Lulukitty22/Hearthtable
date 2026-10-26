// Rolls (Spell Effects and Active State, "Roll ownership and input modes" and "Who rolls in a
// cast; critical hits"; Milestone 5 S8). A roll is asked of whoever controls a character, and the
// DM can roll it for them. Whoever rolls chooses one of three modes:
//
// - configured: the app rolls the character's formula (d20 plus the resolved bonus, with
//   Advantage or Disadvantage; or the damage dice), showing dice, modifiers and total;
// - custom: a dice expression such as 1d20+3 or 2d20kh1, rolled by the app as typed, adding no
//   bonus that is not in it;
// - manual: one typed total from physical dice; nothing is added and no faces are invented, so
//   the roller says themself when it was a natural 20.
//
// Saves and checks compare the total with a DC; attack rolls with Armor Class, where a natural 20
// is a Critical Hit and a natural 1 misses. A Critical Hit rolls the damage dice twice.

import {
  cryptoRandom,
  parseDice,
  roll,
  type RandomSource,
} from "@hearthtable/kernel";

export type RollKind = "save" | "check" | "attack" | "damage" | "custom";
export type Edge = "advantage" | "disadvantage";

/** What is asked: the formula the app uses for a configured roll. */
export interface RollSpec {
  readonly kind: RollKind;
  /** For d20 rolls: the resolved bonus key, e.g. `saves.dex.total`, and its value now. */
  readonly key?: string;
  readonly bonus?: number;
  readonly edge?: Edge;
  /** For damage and custom rolls: the dice expression, e.g. `8d6+6`. */
  readonly dice?: string;
  /** The number to reach: a DC, or an attack's target Armor Class. */
  readonly target?: number;
  /** A save the character fails automatically (Paralyzed and the like). */
  readonly autoFail?: boolean;
}

export type RollMode = "configured" | "custom" | "manual";

export interface RollAnswer {
  readonly mode: RollMode;
  /** The expression rolled, for configured and custom rolls. */
  readonly expression?: string;
  /** Every die face, for configured and custom rolls. */
  readonly faces?: readonly number[];
  /** The d20 that counted, when known (rolled, or ticked as a natural 20 or 1). */
  readonly natural?: number;
  readonly total: number;
  /** Fails automatically regardless of the dice. */
  readonly autoFail?: boolean;
}

const signed = (n: number) => (n < 0 ? `-${Math.abs(n)}` : `+${n}`);

/** The expression a configured roll uses: "1d20+7", "2d20kh1+7", or the damage dice. */
export function configuredExpression(spec: RollSpec): string {
  if (spec.kind === "damage" || spec.kind === "custom")
    return spec.dice ?? "1d20";
  const d20 =
    spec.edge === "advantage"
      ? "2d20kh1"
      : spec.edge === "disadvantage"
        ? "2d20kl1"
        : "1d20";
  return `${d20}${signed(spec.bonus ?? 0)}`;
}

/** Rolls an expression; the kept d20, if any, is the natural roll. */
export function rollExpression(
  expression: string,
  mode: "configured" | "custom",
  random: RandomSource = cryptoRandom,
): RollAnswer | string {
  const parsed = parseDice(expression);
  if (!parsed.ok) return parsed.issues.map((i) => i.message).join("; ");
  const r = roll(parsed.value, random);
  const d20 = r.terms.find(
    (t) => t.term.type === "dice" && t.term.sides === 20,
  );
  const natural =
    d20 && d20.kept.length === 1 ? d20.faces[d20.kept[0] as number] : undefined;
  return {
    mode,
    expression,
    faces: r.terms.flatMap((t) => t.faces),
    ...(natural !== undefined ? { natural } : {}),
    total: r.total,
  };
}

/** Doubles every die count: "8d6+6" becomes "16d6+6" (a Critical Hit, 2024). */
export function criticalDice(expression: string): string {
  return expression.replace(/(\d*)d(\d+)/g, (_m, n: string, s: string) => {
    const count = n === "" ? 1 : Number(n);
    return `${count * 2}d${s}`;
  });
}

export type RollOutcome = "success" | "failure" | "hit" | "miss" | "critical";

/** Against a DC or Armor Class, when the roll has one. */
export function outcomeOf(
  spec: RollSpec,
  answer: RollAnswer,
): RollOutcome | undefined {
  if (spec.kind === "attack") {
    if (answer.natural === 20) return "critical";
    if (answer.natural === 1) return "miss";
    return spec.target !== undefined && answer.total >= spec.target
      ? "hit"
      : "miss";
  }
  if (spec.autoFail || answer.autoFail) return "failure";
  if (spec.target === undefined) return undefined;
  return answer.total >= spec.target ? "success" : "failure";
}

/** "12 (2d20kh1+7: 5, 12)", "fails automatically", or a typed "15". */
export function describeAnswer(answer: RollAnswer): string {
  if (answer.autoFail) return "fails automatically";
  if (answer.mode === "manual")
    return `${answer.total} (typed${answer.natural === 20 ? ", natural 20" : answer.natural === 1 ? ", natural 1" : ""})`;
  return `${answer.total} (${answer.expression}: ${(answer.faces ?? []).join(", ")})`;
}
