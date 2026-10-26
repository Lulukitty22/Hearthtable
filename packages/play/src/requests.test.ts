import { expect, test } from "vitest";
import {
  addHolds,
  budgetOfCastingTime,
  castSpell,
  describeHolds,
} from "./index";

const mageArmor = {
  spell: "core/Spells/Mage_Armor",
  name: "Mage Armor",
  level: 1,
  castLevel: 1,
  castingTime: "Action",
  source: { kind: "book" as const, title: "Combat" },
};

test("casting from a book holds a slot; a cantrip nothing; a scroll the scroll", () => {
  expect(castSpell.holds(mageArmor)).toEqual({ slots: { "1": 1 } });
  expect(castSpell.holds({ ...mageArmor, level: 0, castLevel: 0 })).toEqual({});
  expect(
    castSpell.holds({ ...mageArmor, source: { kind: "scroll", lineId: "s1" } }),
  ).toEqual({ lines: { s1: 1 } });
  expect(castSpell.describe({ ...mageArmor, castLevel: 2 })).toBe(
    "Cast Mage Armor at level 2 from Combat",
  );
});

test("the budget a casting time uses", () => {
  expect(budgetOfCastingTime("Action")).toBe("action");
  expect(budgetOfCastingTime("Bonus Action")).toBe("bonus");
  expect(budgetOfCastingTime("Reaction, which you take when you are hit")).toBe(
    "reaction",
  );
  expect(budgetOfCastingTime("1 minute")).toBe("action");
});

test("warnings: no slot left, or below the spell's level", () => {
  const facts = { name: "Carol", slots: { "1": 0, "2": 1 }, lines: {} };
  expect(castSpell.warnings(mageArmor, facts)).toEqual([
    "Carol has no level-1 spell slot left.",
  ]);
  expect(castSpell.warnings({ ...mageArmor, castLevel: 2 }, facts)).toEqual([]);
});

test("holds add up and read plainly", () => {
  const all = addHolds([
    { slots: { "1": 1 } },
    { slots: { "1": 1, "3": 1 }, lines: { s: 1 } },
  ]);
  expect(all).toEqual({
    slots: { "1": 2, "3": 1 },
    lines: { s: 1 },
    pools: {},
  });
  expect(
    describeHolds({ slots: { "3": 1 }, lines: { s: 1 } }, () => "the scroll"),
  ).toBe("one level-3 spell slot, the scroll");
});

test("a poll closes when every player has skipped its current round", async () => {
  const { everyoneSkipped, attack } = await import("./index");
  expect(everyoneSkipped(2, { a: 2, b: 2 }, ["a", "b"])).toBe(true);
  // A skip from an earlier round does not carry over after a response.
  expect(everyoneSkipped(2, { a: 2, b: 1 }, ["a", "b"])).toBe(false);
  expect(everyoneSkipped(1, {}, [])).toBe(true);
  expect(
    attack.describe({
      name: "Bandit Scout's scimitar",
      bonus: 4,
      dice: "1d6+2",
    }),
  ).toBe("Attack: Bandit Scout's scimitar");
});
