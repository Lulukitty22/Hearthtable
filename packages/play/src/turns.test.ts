import { describe, expect, test } from "vitest";
import {
  changeUse,
  encounterClock,
  encounterLength,
  nextTurn,
  overBudget,
  rollInitiative,
  turnOrder,
  usesNow,
  type InitiativeEntry,
} from "./index";

const init = (entries: Record<string, [number, number]>) =>
  new Map<string, InitiativeEntry>(
    Object.entries(entries).map(([k, [value, at]]) => [k, { value, at }]),
  );

describe("the turn order", () => {
  test("higher goes first, ties to whoever entered first, missing last", () => {
    expect(
      turnOrder(
        ["a", "b", "c", "d"],
        init({ a: [12, 3], b: [17, 2], c: [12, 1] }),
      ),
    ).toEqual(["b", "c", "a", "d"]);
  });

  test("a kept order stays; latecomers are placed by initiative", () => {
    const kept = ["a", "b", "c"]; // the DM moved a to the front
    const i = init({
      a: [5, 1],
      b: [15, 2],
      c: [10, 3],
      late: [12, 9],
      tie: [10, 10],
    });
    expect(
      turnOrder(["a", "b", "c", "late", "tie", "nobody"], i, kept),
    ).toEqual(["a", "b", "late", "c", "tie", "nobody"]);
    expect(turnOrder(["a", "c"], i, kept)).toEqual(["a", "c"]);
  });
});

describe("turns and rounds", () => {
  test("next turn, and a new round after the last", () => {
    const order = ["a", "b"];
    expect(nextTurn(order, { round: 1, current: "a" })).toEqual({
      round: 1,
      current: "b",
    });
    expect(nextTurn(order, { round: 1, current: "b" })).toEqual({
      round: 2,
      current: "a",
    });
    expect(nextTurn([], { round: 1, current: "a" })).toBeUndefined();
  });

  test("each round adds six seconds", () => {
    expect(encounterClock(100, 1)).toBe(100);
    expect(encounterClock(100, 3)).toBe(112);
    expect(encounterLength(3)).toBe(18);
    expect(encounterLength(0)).toBe(0);
  });
});

describe("the action budget", () => {
  test("a use counts until the participant's next turn begins", () => {
    const used = changeUse(undefined, 4, 5, 1);
    expect(usesNow(used, 4)).toBe(1);
    expect(usesNow(changeUse(used, 4, 6, 1), 4)).toBe(2);
    expect(usesNow(used, 7)).toBe(0); // its next turn started at 7
    expect(overBudget("action", 2, "Carol")).toMatch(/2 × Action/);
    expect(overBudget("reaction", 1, "Carol")).toBeUndefined();
  });
});

test("initiative rolls d20, or the lower of two when surprised", () => {
  const dice = [14, 6];
  expect(rollInitiative(8, true, () => dice.shift() as number)).toEqual({
    total: 14,
    detail: "2d20, lower (surprised) (14, 6) + 8",
  });
  expect(rollInitiative(-1, false, () => 3)).toEqual({
    total: 2,
    detail: "d20 (3) − 1",
  });
});
