import { describe, expect, test } from "vitest";
import {
  configuredExpression,
  criticalDice,
  describeAnswer,
  outcomeOf,
  rollExpression,
} from "./index";

const faces =
  (...f: number[]) =>
  () =>
    f.shift() as number;

describe("rolls", () => {
  test("configured d20 rolls carry the bonus and Advantage", () => {
    expect(configuredExpression({ kind: "save", bonus: 7 })).toBe("1d20+7");
    expect(
      configuredExpression({ kind: "save", bonus: -1, edge: "advantage" }),
    ).toBe("2d20kh1-1");
    const r = rollExpression("2d20kh1+7", "configured", faces(5, 12));
    expect(r).toMatchObject({ total: 19, natural: 12, faces: [5, 12] });
  });

  test("saves and attacks against their target; natural 20 and 1", () => {
    const save = { kind: "save" as const, target: 15 };
    expect(outcomeOf(save, { mode: "manual", total: 15 })).toBe("success");
    expect(outcomeOf(save, { mode: "manual", total: 14 })).toBe("failure");
    expect(
      outcomeOf({ ...save, autoFail: true }, { mode: "manual", total: 30 }),
    ).toBe("failure");
    const attack = { kind: "attack" as const, target: 13 };
    expect(
      outcomeOf(attack, { mode: "configured", total: 25, natural: 20 }),
    ).toBe("critical");
    expect(
      outcomeOf(attack, { mode: "configured", total: 14, natural: 1 }),
    ).toBe("miss");
    expect(outcomeOf(attack, { mode: "manual", total: 13 })).toBe("hit");
  });

  test("a Critical Hit rolls the damage dice twice", () => {
    expect(criticalDice("8d6+6")).toBe("16d6+6");
    expect(criticalDice("d10+2d4")).toBe("2d10+4d4");
  });

  test("answers read plainly", () => {
    expect(describeAnswer({ mode: "manual", total: 17, natural: 20 })).toBe(
      "17 (typed, natural 20)",
    );
    expect(
      describeAnswer({
        mode: "custom",
        expression: "1d20+3",
        faces: [9],
        total: 12,
      }),
    ).toBe("12 (1d20+3: 9)");
  });

  test("a bad expression is refused, not guessed", () => {
    expect(typeof rollExpression("2x+", "custom")).toBe("string");
  });
});
