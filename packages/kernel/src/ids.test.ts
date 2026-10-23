import { expect, test } from "vitest";
import { makeId, nameKey, parseId, sameName, samePath } from "./ids";

test("capitalization and spaces versus underscores do not distinguish names", () => {
  expect(sameName("Moonlit Coast", "moonlit coast")).toBe(true);
  expect(sameName("Moonlit Coast", "Moonlit_Coast")).toBe(true);
  expect(sameName("Moonlit Coast", "Moonlit-Coast")).toBe(false);
  expect(nameKey("  Bag  of_Holding ")).toBe("bag_of_holding");
});

test("an id is the full path, keeping the chosen capitals", () => {
  const carol = makeId(["account", "VR_Lulu", "Characters"], "Carol Elfnein");
  expect(carol.ok && carol.value).toBe(
    "account/VR_Lulu/Characters/Carol_Elfnein",
  );
  const copy = makeId(
    ["campaign", "Moonlit Coast", "Characters", "VR_Lulu"],
    "Carol Elfnein",
  );
  expect(copy.ok && copy.value).toBe(
    "campaign/Moonlit_Coast/Characters/VR_Lulu/Carol_Elfnein",
  );
});

test("paths that differ only in capitals or underscores are the same record name", () => {
  expect(
    samePath(
      "account/VR_Lulu/Items/Aetherlock",
      "account/vr_lulu/items/aetherlock",
    ),
  ).toBe(true);
  expect(
    samePath(
      "account/VR_Lulu/Items/Aetherlock",
      "account/VR_Lulu/Items/Aetherlock_2",
    ),
  ).toBe(false);
});

test("names that cannot be stored are rejected", () => {
  expect(makeId(["core"], "Arrows/Bolts").ok).toBe(false);
  expect(makeId(["core"], "   ").ok).toBe(false);
  expect(makeId(["elsewhere"], "Rope").ok).toBe(false);
  expect(makeId(["account"], "Rope").ok).toBe(false);
});

test("parseId reads scope and name, and rejects spaces", () => {
  const parsed = parseId("core/Potion_of_Healing");
  expect(parsed.ok && parsed.value).toMatchObject({
    scope: "core",
    name: "Potion_of_Healing",
  });
  expect(parseId("core/Potion of Healing").ok).toBe(false);
  expect(parseId("core:fireball").ok).toBe(false);
});
