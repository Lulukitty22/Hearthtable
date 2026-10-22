import { expect, test } from "vitest";
import { makeId, nameKey, parseId, sameName } from "./ids";

test("capitalization and spaces versus underscores do not distinguish names", () => {
  expect(sameName("Moonlit Coast", "moonlit coast")).toBe(true);
  expect(sameName("Moonlit Coast", "Moonlit_Coast")).toBe(true);
  expect(sameName("Moonlit Coast", "Moonlit-Coast")).toBe(false);
  expect(nameKey("  Bag  of_Holding ")).toBe("bag_of_holding");
});

test("ids are readable and derived from the name", () => {
  const id = makeId("campaign", "Aetherlock");
  expect(id.ok && id.value).toBe("campaign:aetherlock");
});

test("names that cannot be stored are rejected", () => {
  expect(makeId("core", "Arrows/Bolts").ok).toBe(false);
  expect(makeId("core", "   ").ok).toBe(false);
  expect(makeId("Core", "Rope").ok).toBe(false);
});

test("parseId splits scope and key", () => {
  const parsed = parseId("core:potion_of_healing");
  expect(parsed.ok && parsed.value).toEqual({
    scope: "core",
    key: "potion_of_healing",
  });
  expect(parseId("nokey:").ok).toBe(false);
});
