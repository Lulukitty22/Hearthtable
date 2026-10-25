import { expect, test } from "vitest";
import { applyDamage, applyHealing, damageTaken, NO_DEFENSES } from "./index";

test("immunity, resistance (rounded down), then vulnerability", () => {
  expect(
    damageTaken(15, "Fire", { ...NO_DEFENSES, immunities: ["Fire"] }).amount,
  ).toBe(0);
  expect(
    damageTaken(15, "Fire", { ...NO_DEFENSES, resistances: ["fire"] }).amount,
  ).toBe(7);
  expect(
    damageTaken(15, "Cold", { ...NO_DEFENSES, resistances: ["all"] }).amount,
  ).toBe(7);
  expect(
    damageTaken(15, "Fire", {
      ...NO_DEFENSES,
      resistances: ["Fire"],
      vulnerabilities: ["Fire"],
    }).amount,
  ).toBe(14);
  expect(damageTaken(15, "Fire", NO_DEFENSES)).toEqual({
    amount: 15,
    steps: [],
  });
});

test("Temporary Hit Points first; Vanilla+ goes below zero, the 2024 rules stop at 0", () => {
  expect(applyDamage({ current: 30, temporary: 5 }, 45, false)).toMatchObject({
    current: -10,
    temporary: 0,
  });
  expect(applyDamage({ current: 30, temporary: 0 }, 45, true).current).toBe(0);
});

test("healing adds from below zero and stops at the maximum", () => {
  expect(applyHealing(-30, 95, 10)).toBe(-20);
  expect(applyHealing(90, 95, 10)).toBe(95);
});
