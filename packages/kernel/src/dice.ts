// Dice. Expressions such as `1d20+5`, `2d20kh1+7` (keep highest) or `8d8+1d6-2`. The app rolls
// with a fair random source; tests pass their own. Spell Effects and Active State owns the three
// roll input modes; a manual total records only the total and never invents faces.

import { fail, issue, ok, type Result } from "./validation";

/** Returns a whole number from 1 to `sides`. */
export type RandomSource = (sides: number) => number;

export const cryptoRandom: RandomSource = (sides) => {
  // Rejection sampling keeps every face equally likely.
  const limit = Math.floor(0x1_0000_0000 / sides) * sides;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const n = buffer[0] as number;
    if (n < limit) return (n % sides) + 1;
  }
};

export type DiceTerm =
  | {
      readonly type: "dice";
      readonly sign: 1 | -1;
      readonly count: number;
      readonly sides: number;
      readonly keep?: {
        readonly which: "highest" | "lowest";
        readonly count: number;
      };
    }
  | {
      readonly type: "constant";
      readonly sign: 1 | -1;
      readonly value: number;
    };

export interface DiceExpression {
  readonly source: string;
  readonly terms: readonly DiceTerm[];
}

const MAX_DICE = 1000;
const MAX_SIDES = 10000;
const TERM = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$|^(\d+)$/;

export function parseDice(source: string): Result<DiceExpression> {
  const text = source.replace(/\s+/g, "").toLowerCase();
  const bad = (message: string) =>
    fail<DiceExpression>([
      issue("error", "dice.invalid", `"${source}": ${message}`),
    ]);
  if (text === "") return bad("empty expression.");
  const pieces = text.match(/[+-]?[^+-]+/g);
  if (!pieces || pieces.join("") !== text)
    return bad("expected terms such as 2d6 or +3 joined by + or -.");

  const terms: DiceTerm[] = [];
  for (const piece of pieces) {
    const sign = piece.startsWith("-") ? -1 : 1;
    const m = TERM.exec(piece.replace(/^[+-]/, ""));
    if (!m) return bad(`"${piece}" is not a dice term or number.`);
    if (m[5] !== undefined) {
      terms.push({ type: "constant", sign, value: Number(m[5]) });
      continue;
    }
    const count = m[1] === "" ? 1 : Number(m[1]);
    const sides = Number(m[2]);
    if (count < 1 || count > MAX_DICE)
      return bad(`dice count must be 1–${MAX_DICE}.`);
    if (sides < 1 || sides > MAX_SIDES)
      return bad(`dice sides must be 1–${MAX_SIDES}.`);
    if (m[3] !== undefined) {
      const keepCount = Number(m[4]);
      if (keepCount < 1 || keepCount > count)
        return bad(`cannot keep ${keepCount} of ${count} dice.`);
      terms.push({
        type: "dice",
        sign,
        count,
        sides,
        keep: { which: m[3] === "kh" ? "highest" : "lowest", count: keepCount },
      });
    } else {
      terms.push({ type: "dice", sign, count, sides });
    }
  }
  return ok({ source, terms });
}

export interface RolledTerm {
  readonly term: DiceTerm;
  /** Every face rolled, in order; empty for constants. */
  readonly faces: readonly number[];
  /** Indexes into `faces` that count toward the total. */
  readonly kept: readonly number[];
  readonly subtotal: number;
}

export interface RollResult {
  readonly expression: DiceExpression;
  readonly terms: readonly RolledTerm[];
  readonly total: number;
}

export function roll(
  expression: DiceExpression,
  random: RandomSource = cryptoRandom,
): RollResult {
  const terms = expression.terms.map((term): RolledTerm => {
    if (term.type === "constant")
      return { term, faces: [], kept: [], subtotal: term.sign * term.value };
    const faces = Array.from({ length: term.count }, () => random(term.sides));
    let kept = faces.map((_, i) => i);
    if (term.keep) {
      const { which, count } = term.keep;
      kept = [...kept]
        .sort(
          (a, b) =>
            ((faces[a] as number) - (faces[b] as number)) *
              (which === "highest" ? -1 : 1) || a - b,
        )
        .slice(0, count)
        .sort((a, b) => a - b);
    }
    const subtotal =
      term.sign * kept.reduce((acc, i) => acc + (faces[i] as number), 0);
    return { term, faces, kept, subtotal };
  });
  return {
    expression,
    terms,
    total: terms.reduce((acc, t) => acc + t.subtotal, 0),
  };
}

/** A roll as it is logged, whichever way it was entered. */
export type RollRecord =
  | { readonly mode: "configured" | "expression"; readonly result: RollResult }
  | { readonly mode: "manual"; readonly total: number };

export function rollTotal(record: RollRecord): number {
  return record.mode === "manual" ? record.total : record.result.total;
}
