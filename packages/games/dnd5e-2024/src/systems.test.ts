import type { BookView } from "@hearthtable/system-spellbook-readiness";
import type { LineRow } from "@hearthtable/system-containers";
import type { ResourcePool } from "@hearthtable/system-resources";
import type { SlotLevel } from "@hearthtable/system-spellcasting";
import type { WeaponView } from "@hearthtable/system-magazines";
import {
  formatExplanation,
  hasCapability,
  type Value,
} from "@hearthtable/kernel";
import { describe, expect, test } from "vitest";
import {
  TEST_RULESET,
  carolRecords,
  resolveWith,
  valueOf,
} from "./fixture.test-helpers";

const carol = () => resolveWith(carolRecords());

describe("Carol's documented numbers come from the systems", () => {
  test("ability scores and modifiers, with INT 22 including the Indomitable item", () => {
    const r = carol();
    const scores = Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map((a) => [
        a,
        valueOf<number>(r, `abilities.${a}.score`),
      ]),
    );
    expect(scores).toEqual({
      str: 8,
      dex: 16,
      con: 14,
      int: 22,
      wis: 10,
      cha: 10,
    });
    expect(valueOf(r, "abilities.int.modifier")).toBe(6);
    const int = r.get<number>("abilities.int.score");
    expect(int.kind === "known" && formatExplanation(int.explain)).toBe(
      "INT 22 = point buy 15 + Sage ability scores 2 + Ability Score Improvement 2 + War Caster 1 + Indomitable 2 (while owned)",
    );
    expect(r.issues.map((i) => i.code)).toContain(
      "abilities.above-ordinary-limit",
    );
  });

  test("point buy spends exactly the 27-point budget", () => {
    expect(valueOf(carol(), "abilities.pointBuy")).toEqual({
      spent: 27,
      budget: 27,
      deficit: 0,
    });
  });

  test("proficiency, initiative, HP and saves", () => {
    const r = carol();
    expect(valueOf(r, "character.level")).toBe(15);
    expect(valueOf(r, "proficiency.bonus")).toBe(5);
    expect(valueOf(r, "initiative.total")).toBe(8);
    expect(valueOf(r, "hit-points.max")).toBe(95);
    const saves = Object.fromEntries(
      ["str", "dex", "con", "int", "wis", "cha"].map((a) => [
        a,
        valueOf<number>(r, `saves.${a}.total`),
      ]),
    );
    expect(saves).toEqual({ str: -1, dex: 3, con: 2, int: 11, wis: 5, cha: 0 });
  });

  test("skills, including Expertise in Arcana and Investigation", () => {
    const r = carol();
    const skill = (id: string) => valueOf<number>(r, `skills.${id}.total`);
    expect({
      arcana: skill("arcana"),
      history: skill("history"),
      investigation: skill("investigation"),
      persuasion: skill("persuasion"),
      perception: skill("perception"),
      insight: skill("insight"),
      medicine: skill("medicine"),
      nature: skill("nature"),
    }).toEqual({
      arcana: 16,
      history: 11,
      investigation: 16,
      persuasion: 0,
      perception: 5,
      insight: 5,
      medicine: 5,
      nature: 11,
    });
  });

  test("spell slots add per class to 7/3/3/3/2/1", () => {
    const slots = valueOf<readonly SlotLevel[]>(carol(), "spellcasting.slots");
    expect(
      slots.map((s) => (s.max.kind === "known" ? s.max.value : null)),
    ).toEqual([7, 3, 3, 3, 2, 1]);
    const first = slots[0]?.max;
    expect(first?.kind === "known" && formatExplanation(first.explain)).toBe(
      "Level 1 slots 7 = Wizard 12 4 + Artificer 3 3",
    );
  });

  test("the Wand adds +1 to spell attacks only while attuned and held, never to the DC", () => {
    const stowed = carol();
    expect(valueOf(stowed, "spellcasting.classes.core/Wizard.attack")).toBe(11);
    expect(valueOf(stowed, "spellcasting.classes.core/Wizard.dc")).toBe(19);
    const held = resolveWith(carolRecords({ wandHeld: true }));
    expect(valueOf(held, "spellcasting.classes.core/Wizard.attack")).toBe(12);
    expect(valueOf(held, "spellcasting.classes.core/Wizard.dc")).toBe(19);
  });

  test("resources come from features, with Tinker's Magic using INT", () => {
    const pools = valueOf<readonly ResourcePool[]>(carol(), "resources.pools");
    const tinker = pools.find((p) => p.pool === "tinkers-magic");
    expect(tinker?.max).toMatchObject({ kind: "known", value: 6 });
    expect(
      pools.find((p) => p.pool === "arcane-recovery")?.remaining,
    ).toMatchObject({ kind: "known", value: 1 });
  });
});

describe("AC from active state", () => {
  const ac = (options: Parameters<typeof carolRecords>[0]) =>
    valueOf<number>(resolveWith(carolRecords(options)), "armor-class.total");
  const mageArmor = {
    id: "a1",
    ref: "core/mage_armor",
    activatedAt: "2026-10-22T10:00:00.000Z",
  };
  const shield = {
    id: "a2",
    ref: "core/shield",
    activatedAt: "2026-10-22T10:05:00.000Z",
  };

  test("13 with nothing active, 16 with Mage Armor, 21 with Shield as well", () => {
    expect(ac({})).toBe(13);
    expect(ac({ activeEffects: [mageArmor] })).toBe(16);
    expect(ac({ activeEffects: [mageArmor, shield] })).toBe(21);
  });

  test("owning or knowing Mage Armor never changes AC", () => {
    // The fixture's combat book contains Mage Armor and Shield.
    expect(ac({})).toBe(13);
  });

  test("the player can switch back to unarmored after Mage Armor auto-selects", () => {
    const later = {
      selected: { base: "unarmored", at: "2026-10-22T11:00:00.000Z" },
    };
    expect(ac({ activeEffects: [mageArmor], armorClass: later })).toBe(13);
    const earlier = {
      selected: { base: "unarmored", at: "2026-10-22T09:00:00.000Z" },
    };
    expect(ac({ activeEffects: [mageArmor], armorClass: earlier })).toBe(16);
  });

  test("repeated casts of the same spell do not stack", () => {
    const again = {
      ...shield,
      id: "a3",
      activatedAt: "2026-10-22T10:06:00.000Z",
    };
    expect(ac({ activeEffects: [mageArmor, shield, again] })).toBe(21);
  });

  test("the explanation names the base and each augment", () => {
    const v = resolveWith(
      carolRecords({ activeEffects: [mageArmor, shield] }),
    ).get<number>("armor-class.total");
    expect(v.kind === "known" && formatExplanation(v.explain)).toBe(
      "AC 21 = Mage Armor 16 + Shield 5 (active)",
    );
  });
});

describe("inventory, books and readiness", () => {
  test("depth 0–1 is accessible; deeper is not", () => {
    const lines = valueOf<readonly LineRow[]>(carol(), "containers.lines");
    const access = Object.fromEntries(
      lines.map((l) => [l.line.id, l.accessible]),
    );
    expect(access).toMatchObject({
      backpack: true,
      "combat-book": true,
      bag: true,
      "deep-potion": false,
      "deep-book": false,
    });
  });

  test("carried weight counts a Bag of Holding as its fixed 5 lb and reports unknown weights", () => {
    const w = carol().get<{ pounds: number; unknown: number }>(
      "containers.carriedWeight",
    );
    // Wand 1 + backpack 5 + book 3 + bag 5; the bag's contents add nothing.
    expect(w).toMatchObject({ kind: "known", value: { pounds: 14 } });
    expect(w.kind === "known" && w.value.unknown).toBeGreaterThan(0);
  });

  test("book contents are ready when eligible and accessible", () => {
    const books = valueOf<readonly BookView[]>(
      carol(),
      "spellbook-readiness.books",
    );
    const combat = books.find((b) => b.lineId === "combat-book");
    const ready = Object.fromEntries(
      combat?.entries.map((e) => [e.ref, e.ready]) ?? [],
    );
    expect(ready).toEqual({
      "core/mage_armor": true,
      "core/shield": true,
      "core/fireball": true,
      "core/healing_word": false,
      "core/wish": false,
    });
    const deep = books.find((b) => b.lineId === "deep-book");
    expect(deep?.entries[0]?.ready).toBe(false);
  });

  test("a feature granting spell access makes an off-list spell eligible", () => {
    const r = resolveWith(
      carolRecords({
        extraFeatures: [{ ref: "core/alchemist_spells", from: "Alchemist 3" }],
      }),
    );
    const combat = valueOf<readonly BookView[]>(
      r,
      "spellbook-readiness.books",
    ).find((b) => b.lineId === "combat-book");
    expect(
      combat?.entries.find((e) => e.ref === "core/healing_word")?.ready,
    ).toBe(true);
  });

  test("switching the ruleset to published preparation changes readiness without editing a system", () => {
    const prepared = resolveWith(carolRecords({ prepared: ["core/shield"] }), {
      ...TEST_RULESET,
      methods: {
        ...TEST_RULESET.methods,
        "spellbook-readiness.readiness": "published-preparation",
      },
    });
    const combat = valueOf<readonly BookView[]>(
      prepared,
      "spellbook-readiness.books",
    ).find((b) => b.lineId === "combat-book");
    expect(combat?.entries.filter((e) => e.ready).map((e) => e.ref)).toEqual([
      "core/shield",
    ]);
  });

  test("an over-full book warns but keeps every entry", () => {
    const entries = Array.from({ length: 17 }, (_, i) => ({
      id: `x${i}`,
      ref: "core/fireball",
    }));
    const r = resolveWith(carolRecords({ bookEntries: entries }));
    expect(r.issues.map((i) => i.code)).toContain(
      "spellbook-readiness.over-capacity",
    );
    expect(
      valueOf<readonly BookView[]>(r, "spellbook-readiness.books")[0]?.entries,
    ).toHaveLength(17);
  });
});

describe("chambered weapons and attunement", () => {
  test("the Aetherlock shows six chambers, two loaded, and a 12/12 canister", () => {
    const [rifle] = valueOf<readonly WeaponView[]>(
      carol(),
      "magazines.weapons",
    );
    expect(rifle?.chambers).toHaveLength(6);
    expect(rifle?.loaded).toBe(2);
    expect(rifle?.canister).toMatchObject({ charges: 12, max: 12 });
  });

  test("attunement counts slots and warns when a class requirement is unmet", () => {
    const r = carol();
    expect(valueOf(r, "attunement.slots")).toMatchObject({ used: 2, max: 3 });
    expect(r.issues.map((i) => i.code)).not.toContain(
      "attunement.class-requirement",
    );
    const wizardOnly = resolveWith(
      carolRecords({ classLevels: Array<string>(15).fill("core/Wizard") }),
    );
    expect(wizardOnly.issues.map((i) => i.code)).toContain(
      "attunement.class-requirement",
    );
    expect(valueOf(wizardOnly, "attunement.slots")).toMatchObject({ used: 2 });
  });
});

describe("unresolved data stays visibly unresolved", () => {
  test("a missing item definition is unresolved, grants nothing and is reported", () => {
    const r = resolveWith(
      carolRecords({
        extraLines: [
          { id: "ghost", ref: "campaign/test/bluesteel", quantity: 4 },
        ],
      }),
    );
    const ghost = valueOf<readonly LineRow[]>(r, "containers.lines").find(
      (l) => l.line.id === "ghost",
    );
    expect(ghost).toMatchObject({
      status: "unresolved",
      reason: "Reference not found: campaign/test/bluesteel",
    });
    expect(ghost?.line.quantity).toBe(4);
  });

  test("a missing feature definition grants nothing and is listed as unresolved", () => {
    const r = resolveWith(
      carolRecords({ extraFeatures: [{ ref: "core/mystery_feat" }] }),
    );
    expect(r.issues.map((i) => i.code)).toContain("features.unresolved");
    expect(valueOf(r, "abilities.int.score")).toBe(22);
  });

  test("an unset ruleset variable leaves its values unresolved instead of guessing", () => {
    const { "hit-points.ability": _removed, ...variables } =
      TEST_RULESET.variables;
    const r = resolveWith(carolRecords(), { ...TEST_RULESET, variables });
    expect(r.get<number>("hit-points.max").kind).toBe("unresolved");
  });
});

describe("stacking rules", () => {
  test("capabilities are present once however many sources grant them; same-name pools add", () => {
    const records = carolRecords({
      extraFeatures: [
        { ref: "core/channel_divinity_cleric", from: "Cleric 2" },
        { ref: "core/channel_divinity_paladin", from: "Paladin 3" },
      ],
    });
    const extra = [
      ["core/channel_divinity_cleric", 2],
      ["core/channel_divinity_paladin", 2],
    ].map(([id, uses]) => ({
      ...records[0],
      id,
      kind: "feature",
      data: {
        name: String(id),
        grants: [
          {
            type: "resource",
            pool: "channel-divinity",
            max: uses,
            reset: "short rest",
          },
          { type: "capability", id: "extra-attack" },
        ],
      },
      raw: {},
    }));
    const r = resolveWith([...records, ...(extra as typeof records)]);
    const cd = valueOf<readonly ResourcePool[]>(r, "resources.pools").find(
      (p) => p.pool === "channel-divinity",
    );
    expect(cd?.max).toMatchObject({ kind: "known", value: 4 } satisfies Partial<
      Value<number>
    >);
  });

  test("a capability granted twice is present, and applies once", () => {
    const records = carolRecords({
      extraFeatures: [
        { ref: "core/extra_attack_fighter", from: "Fighter 5" },
        { ref: "core/extra_attack_paladin", from: "Paladin 5" },
      ],
    });
    const extra = [
      "core/extra_attack_fighter",
      "core/extra_attack_paladin",
    ].map((id) => ({
      ...records[0],
      id,
      kind: "feature",
      data: { name: id, grants: [{ type: "capability", id: "extra-attack" }] },
      raw: {},
    }));
    const r = resolveWith([...records, ...(extra as typeof records)]);
    const ctx = { get: r.get } as Parameters<typeof hasCapability>[0];
    expect(hasCapability(ctx, "extra-attack")).toBe(true);
    expect(hasCapability(ctx, "action-surge")).toBe(false);
  });
});
