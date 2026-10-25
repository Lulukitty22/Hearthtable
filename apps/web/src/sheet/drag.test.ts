import { describe, expect, test } from "vitest";
import { emptyContainer, moveItem, refusal, type ItemRules } from "./drag";

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

describe("scrolls move in and out of books as the same line", () => {
  const scroll = { spell: "core/Spells/Fireball", castLevel: 3, spent: false };
  const book = {
    container: { accepts: ["scroll"], scrollUse: "bound" as const },
    tags: ["spellbook"],
  };
  const rules = (ref: string): ItemRules | undefined =>
    ref === "core/Items/Spell_Scroll"
      ? { tags: ["scroll"] }
      : ref === "book"
        ? book
        : rulesOf(ref);
  const lines = () => [
    { id: "bag", ref: "bag", quantity: 1 },
    { id: "book", ref: "book", quantity: 1 },
    { id: "other-book", ref: "book", quantity: 1 },
    {
      id: "s1",
      ref: "core/Items/Spell_Scroll",
      quantity: 1,
      attunedTo: null,
      scroll,
    },
    {
      id: "shield",
      ref: "core/Items/Spell_Scroll",
      quantity: 1,
      parent: "book",
      scroll: { spell: "core/Spells/Shield", castLevel: 1 },
    },
  ];

  test("mounting moves the line into the book, keeping its id and state", () => {
    const r = moveItem(
      lines(),
      "s1",
      { kind: "container", lineId: "book" },
      1,
      rules,
      newId,
    );
    expect(r.ok && r.lines.find((l) => l.id === "s1")).toEqual({
      id: "s1",
      ref: "core/Items/Spell_Scroll",
      quantity: 1,
      attunedTo: null,
      scroll,
      parent: "book",
    });
  });

  test("a book takes only scrolls, and not a spell it already holds", () => {
    expect(
      refusal(lines(), "bag", { kind: "container", lineId: "book" }, rules),
    ).toBe("It only holds scroll.");
    const twice = moveItem(
      lines(),
      "s1",
      { kind: "container", lineId: "book" },
      1,
      rules,
      newId,
    );
    if (!twice.ok) throw new Error(twice.reason);
    const copy = [
      ...twice.lines,
      { id: "s2", ref: "core/Items/Spell_Scroll", quantity: 1, scroll },
    ];
    expect(
      refusal(copy, "s2", { kind: "container", lineId: "book" }, rules),
    ).toBe("That book already holds this spell.");
  });

  test("taking a scroll out, or into another book, is the same move", () => {
    const out = moveItem(lines(), "shield", { kind: "root" }, 1, rules, newId);
    expect(
      out.ok && out.lines.find((l) => l.id === "shield")?.parent,
    ).toBeUndefined();
    const moved = moveItem(
      lines(),
      "shield",
      { kind: "container", lineId: "other-book" },
      1,
      rules,
      newId,
    );
    expect(moved.ok && moved.lines.find((l) => l.id === "shield")?.parent).toBe(
      "other-book",
    );
  });

  test("a scroll never merges into another stack", () => {
    const two = [
      ...lines(),
      {
        id: "s2",
        ref: "core/Items/Spell_Scroll",
        quantity: 1,
        attunedTo: null,
        scroll,
      },
    ];
    const r = moveItem(
      two,
      "s2",
      { kind: "container", lineId: "bag" },
      1,
      rules,
      newId,
    );
    const r2 = r.ok
      ? moveItem(
          r.lines,
          "s1",
          { kind: "container", lineId: "bag" },
          1,
          rules,
          newId,
        )
      : r;
    expect(r2.ok && r2.lines.filter((l) => l.parent === "bag").length).toBe(2);
  });
});

test("emptying a container leaves its contents where the container stands", () => {
  const lines = [
    { id: "outer", ref: "bag", quantity: 1 },
    { id: "inner", ref: "bag", quantity: 1, parent: "outer" },
    { id: "potion", ref: "potion", quantity: 2, parent: "inner" },
  ];
  expect(emptyContainer(lines, "inner")).toEqual([
    lines[0],
    lines[1],
    { id: "potion", ref: "potion", quantity: 2, parent: "outer" },
  ]);
});
