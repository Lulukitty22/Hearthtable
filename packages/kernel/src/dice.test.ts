import { describe, expect, test } from "vitest";
import {
  cryptoRandom,
  parseDice,
  roll,
  rollTotal,
  type DiceExpression,
  type RandomSource,
} from "./dice";

function parsed(source: string): DiceExpression {
  const result = parseDice(source);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

/** Returns the given faces in order. */
const sequence = (...faces: number[]): RandomSource => {
  let i = 0;
  return () => faces[i++] as number;
};

describe("dice", () => {
  test("parses dice, constants, signs and keep modifiers", () => {
    expect(parsed("d20").terms).toEqual([
      { type: "dice", sign: 1, count: 1, sides: 20 },
    ]);
    expect(parsed("2d20kh1 + 7").terms).toEqual([
      {
        type: "dice",
        sign: 1,
        count: 2,
        sides: 20,
        keep: { which: "highest", count: 1 },
      },
      { type: "constant", sign: 1, value: 7 },
    ]);
    expect(parsed("8d8+1d6-2").terms).toHaveLength(3);
  });

  test("rejects malformed expressions instead of guessing", () => {
    for (const bad of [
      "",
      "2d",
      "d0",
      "2d6kh3",
      "1d20++2",
      "fireball",
      "1001d6",
    ]) {
      expect(parseDice(bad).ok, bad).toBe(false);
    }
  });

  test("rolls with the given random source and records every face", () => {
    const result = roll(parsed("8d8+6"), sequence(1, 2, 3, 4, 5, 6, 7, 8));
    expect(result.total).toBe(42);
    expect(result.terms[0]?.faces).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("advantage keeps the highest, disadvantage the lowest", () => {
    expect(roll(parsed("2d20kh1+5"), sequence(4, 17)).total).toBe(22);
    expect(roll(parsed("2d20kl1+5"), sequence(4, 17)).total).toBe(9);
    expect(roll(parsed("2d20kh1"), sequence(4, 17)).terms[0]?.kept).toEqual([
      1,
    ]);
  });

  test("subtracted dice subtract", () => {
    expect(roll(parsed("1d20-1d4"), sequence(10, 3)).total).toBe(7);
  });

  test("a manual total is recorded as given, with no faces", () => {
    expect(rollTotal({ mode: "manual", total: 17 })).toBe(17);
  });

  test("the default random source stays within the die", () => {
    for (let i = 0; i < 1000; i++) {
      const face = cryptoRandom(6);
      expect(face).toBeGreaterThanOrEqual(1);
      expect(face).toBeLessThanOrEqual(6);
    }
  });
});
