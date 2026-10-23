import { describe, expect, test } from "vitest";
import { moveEntry, moveItem, refusal, type ItemRules } from "./drag";

const RULES: Record<string, ItemRules> = {
  rifle: {
    container: { slots: [{ id: "a" }, { id: "b" }], accepts: ["round"] },
  },
  bag: { container: {} },
  round: { tags: ["round"] },
  potion: {},
};
const rulesOf = (ref: string) => RULES[ref];
let n = 0;
const newId = () => `new-${++n}`;

const base = () => [
  {
    id: "rifle",
    ref: "rifle",
    quantity: 1,
    attunedTo: "account/X/Characters/C",
    attunedSlot: 1,
  },
  { id: "bag", ref: "bag", quantity: 1, attunedTo: null },
  { id: "inner", ref: "bag", quantity: 1, attunedTo: null, parent: "bag" },
  { id: "rounds", ref: "round", quantity: 18, attunedTo: null },
  { id: "potions", ref: "potion", quantity: 4, attunedTo: null },
];

describe("dragging items", () => {
  test("dragging a stack into a chamber splits off one", () => {
    const r = moveItem(
      base(),
      "rounds",
      { kind: "slot", lineId: "rifle", slot: "a" },
      1,
      rulesOf,
      newId,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lines.find((l) => l.id === "rounds")?.quantity).toBe(17);
    expect(r.lines.find((l) => l.slot === "a")).toMatchObject({
      ref: "round",
      quantity: 1,
      parent: "rifle",
    });
  });

  test("Shift can take several; they rejoin a matching stack on the way back", () => {
    const into = moveItem(
      base(),
      "potions",
      { kind: "container", lineId: "bag" },
      3,
      rulesOf,
      newId,
    );
    if (!into.ok) throw new Error(into.reason);
    const part = into.lines.find(
      (l) => l.parent === "bag" && l.ref === "potion",
    );
    expect(part?.quantity).toBe(3);
    const back = moveItem(
      into.lines,
      part?.id as string,
      { kind: "root" },
      3,
      rulesOf,
      newId,
    );
    if (!back.ok) throw new Error(back.reason);
    expect(back.lines.filter((l) => l.ref === "potion")).toEqual([
      expect.objectContaining({ id: "potions", quantity: 4 }),
    ]);
  });

  test("only rounds go in chambers, and only onto a slot", () => {
    expect(
      refusal(
        base(),
        "potions",
        { kind: "slot", lineId: "rifle", slot: "a" },
        rulesOf,
      ),
    ).toMatch(/only holds round/);
    expect(
      refusal(
        base(),
        "rounds",
        { kind: "container", lineId: "rifle" },
        rulesOf,
      ),
    ).toMatch(/slot/);
  });

  test("a container cannot go into itself or something it holds", () => {
    expect(
      refusal(base(), "bag", { kind: "container", lineId: "bag" }, rulesOf),
    ).toMatch(/itself/);
    expect(
      refusal(base(), "bag", { kind: "container", lineId: "inner" }, rulesOf),
    ).toMatch(/something it holds/);
  });

  test("non-containers refuse drops; items with their own state move whole", () => {
    expect(
      refusal(
        base(),
        "rounds",
        { kind: "container", lineId: "potions" },
        rulesOf,
      ),
    ).toMatch(/not a container/);
    const r = moveItem(
      base(),
      "rifle",
      { kind: "container", lineId: "bag" },
      1,
      rulesOf,
      newId,
    );
    expect(r.ok && r.lines.find((l) => l.id === "rifle")?.parent).toBe("bag");
  });

  test("an occupied chamber still accepts a round, as overfilling is only warned", () => {
    const once = moveItem(
      base(),
      "rounds",
      { kind: "slot", lineId: "rifle", slot: "a" },
      1,
      rulesOf,
      newId,
    );
    if (!once.ok) throw new Error(once.reason);
    const twice = moveItem(
      once.lines,
      "rounds",
      { kind: "slot", lineId: "rifle", slot: "a" },
      1,
      rulesOf,
      newId,
    );
    expect(twice.ok && twice.lines.filter((l) => l.slot === "a")).toHaveLength(
      2,
    );
  });
});

describe("moving spells", () => {
  test("a spell moves to another book, but not into one that already has it", () => {
    const a = [
      { id: "1", ref: "core/Fireball" },
      { id: "2", ref: "core/Shield" },
    ];
    const r = moveEntry(a, [{ id: "9", ref: "core/Web" }], "1");
    expect(r.ok && [r.from.map((e) => e.ref), r.to.map((e) => e.ref)]).toEqual([
      ["core/Shield"],
      ["core/Web", "core/Fireball"],
    ]);
    expect(moveEntry(a, [{ id: "9", ref: "core/Fireball" }], "1").ok).toBe(
      false,
    );
  });
});
