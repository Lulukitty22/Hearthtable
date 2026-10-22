import { expect, test } from "vitest";
import { makeId, nameKey, parseId, sameName } from "./ids";

test("capitalization and spaces versus underscores do not distinguish names", () => {
  expect(sameName("Moonlit Coast", "moonlit coast")).toBe(true);
  expect(sameName("Moonlit Coast", "Moonlit_Coast")).toBe(true);
  expect(sameName("Moonlit Coast", "Moonlit-Coast")).toBe(false);
  expect(nameKey("  Bag  of_Holding ")).toBe("bag_of_holding");
});

test("an id is the full normalized path", () => {
  const carol = makeId(["account", "VRLulu"], "Carol Elfnein");
  expect(carol.ok && carol.value).toBe("account/vrlulu/carol_elfnein");
  const copy = makeId(
    ["Campaign", "Moonlit Coast", "Characters", "VRLulu"],
    "Carol Elfnein",
  );
  expect(copy.ok && copy.value).toBe(
    "campaign/moonlit_coast/characters/vrlulu/carol_elfnein",
  );
});

test("names that cannot be stored are rejected", () => {
  expect(makeId(["core"], "Arrows/Bolts").ok).toBe(false);
  expect(makeId(["core"], "   ").ok).toBe(false);
  expect(makeId(["elsewhere"], "Rope").ok).toBe(false);
  expect(makeId(["account"], "Rope").ok).toBe(false);
});

test("parseId reads scope and name, and rejects unnormalized paths", () => {
  const parsed = parseId("core/potion_of_healing");
  expect(parsed.ok && parsed.value).toMatchObject({
    scope: "core",
    name: "potion_of_healing",
  });
  expect(parseId("core/Potion of Healing").ok).toBe(false);
  expect(parseId("core:fireball").ok).toBe(false);
});
