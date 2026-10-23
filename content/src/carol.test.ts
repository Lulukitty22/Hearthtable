// Milestone 2 acceptance, "Expected values": Carol's hand-entered records resolve, under the
// real Vanilla+ ruleset, to the numbers on her accepted sheet.

import { createEngine } from "@hearthtable/engine";
import type { RecordEnvelope, ResolvedCharacter } from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import type { AttunedSlot } from "@hearthtable/system-attunement";
import type { LineRow } from "@hearthtable/system-containers";
import type { WeaponView } from "@hearthtable/system-magazines";
import type { ResourcePool } from "@hearthtable/system-resources";
import type {
  MountingCost,
  ScribingCost,
} from "@hearthtable/system-scroll-crafting";
import type { SlotLevel } from "@hearthtable/system-spellcasting";
import type { BookView } from "@hearthtable/system-spellbook-readiness";
import { describe, expect, test } from "vitest";
import { CAROL_ID, carolWithDefinitions } from "./index";

const engine = createEngine(hearthtableVanillaPlus);

/** Carol's records with her character or inventory data changed, as an edit would. */
function edited(patch: {
  character?: Record<string, unknown>;
  inventory?: (data: Record<string, unknown>) => Record<string, unknown>;
}) {
  return carolWithDefinitions().map((r): RecordEnvelope => {
    if (r.id === CAROL_ID && patch.character)
      return { ...r, data: { ...(r.data as object), ...patch.character } };
    if (r.id === `${CAROL_ID}/Inventory` && patch.inventory)
      return { ...r, data: patch.inventory(r.data as Record<string, unknown>) };
    return r;
  });
}

function value<T>(r: ResolvedCharacter, key: string): T {
  const v = r.get<T>(key);
  if (v.kind === "unresolved")
    throw new Error(`${key} is unresolved: ${v.reason}`);
  return v.value;
}

const carol = () => engine.resolve(carolWithDefinitions());

describe("Carol Elfnein under Hearthtable Vanilla+", () => {
  test("the ruleset loads cleanly and her records raise no errors or warnings", () => {
    expect(engine.issues).toEqual([]);
    const problems = carol().issues.filter((i) => i.severity !== "info");
    expect(problems).toEqual([]);
  });

  test("ability scores and modifiers", () => {
    const r = carol();
    const row = (a: string) =>
      `${value<number>(r, `abilities.${a}.score`)}/${value<number>(r, `abilities.${a}.modifier`)}`;
    expect(["str", "dex", "con", "int", "wis", "cha"].map(row)).toEqual([
      "8/-1",
      "16/3",
      "14/2",
      "22/6",
      "10/0",
      "10/0",
    ]);
  });

  test("proficiency +5, HP 95, initiative +8", () => {
    const r = carol();
    expect(value(r, "proficiency.bonus")).toBe(5);
    expect(value(r, "hit-points.max")).toBe(95);
    expect(value(r, "hit-points.state")).toEqual({ current: 95, temporary: 0 });
    expect(value(r, "initiative.total")).toBe(8);
  });

  test("saving throws", () => {
    const r = carol();
    expect(
      ["str", "dex", "con", "int", "wis", "cha"].map((a) =>
        value<number>(r, `saves.${a}.total`),
      ),
    ).toEqual([-1, 3, 2, 11, 5, 0]);
  });

  test("skills from her sheet", () => {
    const r = carol();
    const skills = [
      "arcana",
      "history",
      "investigation",
      "persuasion",
      "perception",
      "insight",
      "medicine",
      "nature",
    ];
    expect(
      Object.fromEntries(
        skills.map((s) => [s, value<number>(r, `skills.${s}.total`)]),
      ),
    ).toEqual({
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

  test("tool proficiencies: Calligrapher's, Tinker's, Alchemist's and Herbalism", () => {
    const tools = value<readonly { id: string }[]>(
      carol(),
      "tools.proficiencies",
    ).map((t) => t.id);
    expect([...tools].sort()).toEqual([
      "alchemists-supplies",
      "calligraphers-supplies",
      "herbalism-kit",
      "tinkers-tools",
    ]);
  });

  test("spell slots 7/3/3/3/2/1, attack +11 and DC 19", () => {
    const r = carol();
    const slots = value<readonly SlotLevel[]>(r, "spellcasting.slots");
    expect(
      slots.map((s) => (s.max.kind === "known" ? s.max.value : null)),
    ).toEqual([7, 3, 3, 3, 2, 1]);
    expect(value(r, "spellcasting.classes.core/Wizard.attack")).toBe(11);
    expect(value(r, "spellcasting.classes.core/Wizard.dc")).toBe(19);
  });

  test("spellbooks hold 16/10/6 entries, all ready, plus the overflow test book", () => {
    const all = value<readonly BookView[]>(
      carol(),
      "spellbook-readiness.books",
    );
    expect(all.map((b) => b.entries.length)).toEqual([16, 10, 6, 8]);
    const books = all.slice(0, 3); // the accepted sheet's books
    const notReady = books.flatMap((b) =>
      b.entries
        .filter((e) => !e.ready)
        .map((e) => `${e.name}: ${e.reasons.join("; ")}`),
    );
    expect(notReady).toEqual([]);
  });

  test("every item is at the top level and reachable", () => {
    const lines = value<readonly LineRow[]>(carol(), "containers.lines");
    expect(
      lines.every(
        (l) => l.depth === 0 && l.accessible && l.status === "resolved",
      ),
    ).toBe(true);
  });

  test("container depth decides accessibility once items are packed", () => {
    const packed = edited({
      inventory: (data) => ({
        ...data,
        lines: (data["lines"] as Record<string, unknown>[]).map((l) =>
          l["id"] === "bag-of-holding-1"
            ? { ...l, parent: "bag-of-holding-2" }
            : l["id"] === "potions"
              ? { ...l, parent: "bag-of-holding-1" }
              : l["id"] === "workshop-book"
                ? { ...l, parent: "bag-of-holding-2" }
                : l,
        ),
      }),
    });
    const r = engine.resolve(packed);
    const access = Object.fromEntries(
      value<readonly LineRow[]>(r, "containers.lines").map((l) => [
        l.line.id,
        l.accessible,
      ]),
    );
    expect(access).toMatchObject({
      "bag-of-holding-2": true,
      "workshop-book": true,
      "bag-of-holding-1": true,
      potions: false,
    });
  });

  test("AC is 13 with nothing active, 16 with Mage Armor, 21 with Shield too", () => {
    const mageArmor = {
      id: "effect-1",
      ref: "core/Mage_Armor",
      activatedAt: "2026-10-22T21:00:00.000Z",
    };
    const shield = {
      id: "effect-2",
      ref: "core/Shield",
      activatedAt: "2026-10-22T21:01:00.000Z",
    };
    const ac = (activeEffects: unknown[]) =>
      value<number>(
        engine.resolve(edited({ character: { activeEffects } })),
        "armor-class.total",
      );
    expect([ac([]), ac([mageArmor]), ac([mageArmor, shield])]).toEqual([
      13, 16, 21,
    ]);
  });

  test("the Wand gives +12 only while attuned and held, and never changes DC 19", () => {
    const hold = edited({
      inventory: (data) => ({
        ...data,
        lines: (data["lines"] as Record<string, unknown>[]).map((l) =>
          l["id"] === "wand" ? { ...l, held: true } : l,
        ),
      }),
    });
    const r = engine.resolve(hold);
    expect(value(r, "spellcasting.classes.core/Wizard.attack")).toBe(12);
    expect(value(r, "spellcasting.classes.core/Wizard.dc")).toBe(19);
    const [rifle] = value<readonly WeaponView[]>(r, "magazines.weapons");
    expect(rifle?.aim).toMatchObject({ kind: "known", value: 11 });
  });

  test("attunement: Indomitable adds a slot, so four items fill four slots in order", () => {
    const att = value<{
      used: number;
      max: number;
      slots: readonly AttunedSlot[];
    }>(carol(), "attunement.slots");
    expect(att.used).toBe(4);
    expect(att.max).toBe(4);
    expect(att.slots.map((s) => s.name)).toEqual([
      "Aetherlock",
      "Wand of the War Mage +1",
      "Manifold Tool",
      "Indomitable (INT)",
    ]);
  });

  test("an item attuned to another character grants this one nothing", () => {
    const r = engine.resolve(
      edited({
        inventory: (data) => ({
          ...data,
          lines: (data["lines"] as Record<string, unknown>[]).map((l) =>
            l["id"] === "indomitable"
              ? { ...l, attunedTo: "account/VRLulu/Characters/Someone_Else" }
              : l,
          ),
        }),
      }),
    );
    expect(value(r, "abilities.int.score")).toBe(20);
    expect(r.issues.map((i) => i.code)).toContain("attunement.other-character");
  });

  test("unattuning Indomitable removes its +2 INT and its slot", () => {
    const r = engine.resolve(
      edited({
        inventory: (data) => ({
          ...data,
          lines: (data["lines"] as Record<string, unknown>[]).map((l) =>
            l["id"] === "indomitable" ? { ...l, attunedTo: null } : l,
          ),
        }),
      }),
    );
    expect(value(r, "abilities.int.score")).toBe(20);
    expect(value(r, "attunement.slots")).toMatchObject({ used: 3, max: 3 });
  });

  test("attuning a fifth item flags the last one in her order", () => {
    const r = engine.resolve(
      edited({
        inventory: (data) => ({
          ...data,
          lines: (data["lines"] as Record<string, unknown>[]).map((l) =>
            l["id"] === "goggles"
              ? { ...l, attunedTo: CAROL_ID, attunedSlot: 5 }
              : l,
          ),
        }),
      }),
    );
    const att = value<{ slots: readonly AttunedSlot[] }>(r, "attunement.slots");
    expect(att.slots.filter((s) => s.overLimit).map((s) => s.lineId)).toEqual([
      "goggles",
    ]);
    expect(r.issues.map((i) => i.code)).toContain("attunement.over-limit");
  });

  test("resources: Arcane Recovery 1, Tinker's Magic 6, Heroic Inspiration 1, Magic Initiate 1", () => {
    const pools = value<readonly ResourcePool[]>(carol(), "resources.pools");
    const max = Object.fromEntries(
      pools.map((p) => [p.pool, p.max.kind === "known" ? p.max.value : null]),
    );
    expect(max).toEqual({
      "heroic-inspiration": 1,
      "magic-initiate-free-cast": 1,
      "arcane-recovery": 1,
      "tinkers-magic": 6,
    });
  });

  test("the Aetherlock has six empty chambers in a hexagonal ring and a 12/12 canister", () => {
    const [rifle] = value<readonly WeaponView[]>(carol(), "magazines.weapons");
    expect(rifle).toMatchObject({
      name: "Aetherlock",
      loaded: 0,
      canister: { charges: 12, max: 12 },
    });
    expect(rifle?.chambers.map((c) => [c.slot.x, c.slot.y])).toEqual([
      [-1, 2],
      [1, 2],
      [-2, 0],
      [2, 0],
      [-1, -2],
      [1, -2],
    ]);
  });

  type Line = Record<string, unknown>;
  const withLines = (extra: Line[]) =>
    edited({
      inventory: (data) => ({
        ...data,
        lines: [...(data["lines"] as Line[]), ...extra],
      }),
    });

  test("a round placed in a chamber is loaded", () => {
    const r = engine.resolve(
      withLines([
        {
          id: "loaded-1",
          ref: "account/VRLulu/Items/Basic_Round",
          quantity: 1,
          attunedTo: null,
          parent: "aetherlock",
          slot: "top-left",
        },
      ]),
    );
    const [rifle] = value<readonly WeaponView[]>(r, "magazines.weapons");
    expect(rifle?.loaded).toBe(1);
    expect(rifle?.chambers[0]?.round?.name).toBe("Basic Round");
    expect(r.issues.filter((i) => i.severity !== "info")).toEqual([]);
  });

  test("wrong kinds, shared chambers and stacked chambers are kept but warned", () => {
    const r = engine.resolve(
      withLines([
        {
          id: "potion-in-gun",
          ref: "core/Potion_of_Healing",
          quantity: 1,
          attunedTo: null,
          parent: "aetherlock",
          slot: "top-right",
        },
        {
          id: "two-a",
          ref: "account/VRLulu/Items/Basic_Round",
          quantity: 1,
          attunedTo: null,
          parent: "aetherlock",
          slot: "top-left",
        },
        {
          id: "two-b",
          ref: "account/VRLulu/Items/Arcane_Round",
          quantity: 1,
          attunedTo: null,
          parent: "aetherlock",
          slot: "top-left",
        },
        {
          id: "stack",
          ref: "account/VRLulu/Items/Basic_Round",
          quantity: 3,
          attunedTo: null,
          parent: "aetherlock",
          slot: "middle-left",
        },
      ]),
    );
    const codes = r.issues.map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        "containers.wrong-kind",
        "containers.slot-taken",
        "containers.slot-over",
      ]),
    );
    const lines = value<readonly LineRow[]>(r, "containers.lines");
    expect(lines.find((l) => l.line.id === "stack")?.line.quantity).toBe(3);
  });

  test("carried weight counts known weights and says how many are unknown", () => {
    const w = value<{ pounds: number; unknown: number }>(
      carol(),
      "containers.carriedWeight",
    );
    expect(w.unknown).toBeGreaterThan(0);
    expect(w.pounds).toBeGreaterThan(0);
  });

  test("a deliberately missing definition renders as unresolved, never as a usable default", () => {
    const records = carolWithDefinitions().filter(
      (r) => r.id !== "core/Fireball",
    );
    const r = engine.resolve(records);
    const combat = value<readonly BookView[]>(
      r,
      "spellbook-readiness.books",
    )[0];
    const fireball = combat?.entries.find((e) => e.ref === "core/Fireball");
    expect(fireball).toMatchObject({
      status: "unresolved",
      ready: false,
      reasons: ["Reference not found: core/Fireball"],
    });
  });
});

describe("one resolved state", () => {
  test("every view's list agrees with the single values, and each value is computed once", () => {
    const r = carol();
    const abilities = value<
      readonly { id: string; score: { value: number } }[]
    >(r, "abilities.all");
    for (const a of abilities)
      expect(a.score.value).toBe(value(r, `abilities.${a.id}.score`));
    const skills = value<readonly { id: string; total: { value: number } }[]>(
      r,
      "skills.all",
    );
    for (const s of skills)
      expect(s.total.value).toBe(value(r, `skills.${s.id}.total`));
    const profiles = value<
      readonly { id: string; attack: { value: number } }[]
    >(r, "spellcasting.profiles");
    for (const p of profiles)
      expect(p.attack.value).toBe(
        value(r, `spellcasting.classes.${p.id}.attack`),
      );
    // Reading again returns the very same resolved value, not a recomputation.
    for (const key of [
      "hit-points.max",
      "armor-class.total",
      "initiative.total",
      "spellcasting.slots",
    ]) {
      expect(r.get(key)).toBe(r.get(key));
    }
  });
});

describe("concentration capacity", () => {
  const at = (minute: number) =>
    `2026-10-23T08:${String(minute).padStart(2, "0")}:00.000Z`;
  const active = (...refs: string[]) =>
    edited({
      character: {
        activeEffects: refs.map((ref, i) => ({
          id: `e${i}`,
          ref,
          activatedAt: at(i),
        })),
      },
    });

  test("Carol maintains one concentration; non-concentration effects do not count", () => {
    const r = engine.resolve(
      active("core/Mage_Armor", "core/Tasha's_Otherworldly_Guise"),
    );
    expect(value(r, "concentration.capacity")).toBe(1);
    const held = value<readonly { name: string; overLimit: boolean }[]>(
      r,
      "concentration.maintained",
    );
    expect(held.map((h) => [h.name, h.overLimit])).toEqual([
      ["Tasha's Otherworldly Guise", false],
    ]);
    expect(r.issues.map((i) => i.code)).not.toContain(
      "concentration.over-capacity",
    );
  });

  test("a second concentration is over the limit and warned, newest first to go", () => {
    const r = engine.resolve(
      active("core/Tasha's_Otherworldly_Guise", "core/Web"),
    );
    const held = value<readonly { name: string; overLimit: boolean }[]>(
      r,
      "concentration.maintained",
    );
    expect(held.map((h) => [h.name, h.overLimit])).toEqual([
      ["Tasha's Otherworldly Guise", false],
      ["Web", true],
    ]);
    expect(r.issues.map((i) => i.code)).toContain(
      "concentration.over-capacity",
    );
  });

  test("an authored grant can raise capacity, as Capella's does", () => {
    const records = carolWithDefinitions().map((r): RecordEnvelope => {
      if (r.id === CAROL_ID) {
        const data = r.data as { features: unknown[] };
        return {
          ...r,
          data: {
            ...data,
            features: [
              ...data.features,
              { ref: "core/Test_Second_Concentration" },
            ],
            activeEffects: [
              { id: "a", ref: "core/Web", activatedAt: at(0) },
              { id: "b", ref: "core/Detect_Magic", activatedAt: at(1) },
            ],
          },
        };
      }
      return r;
    });
    const grant = {
      ...(records.find((r) => r.kind === "feature") as RecordEnvelope),
      id: "core/Test_Second_Concentration" as RecordEnvelope["id"],
      data: {
        name: "Second concentration",
        grants: [
          { type: "bonus", target: "concentration.capacity", amount: 1 },
        ],
      },
      raw: {},
    };
    const r = engine.resolve([...records, grant]);
    expect(value(r, "concentration.capacity")).toBe(2);
    expect(r.issues.map((i) => i.code)).not.toContain(
      "concentration.over-capacity",
    );
  });
});

// Spell Containers and Consumable Sources, "Scribing, mounting and removal", with the worked
// examples from Aetherlock Costs and Damage (Carol's Arcana +16).
describe("scroll crafting costs", () => {
  const known = <T>(v: { kind: string; value?: T }): T => {
    if (v.kind !== "known") throw new Error("unresolved");
    return v.value as T;
  };

  test("Carol's Arcana multiplier", () => {
    expect(value(carol(), "skills.arcana.total")).toBe(16);
    expect(value<number>(carol(), "scroll-crafting.multiplier")).toBeCloseTo(
      0.08919350686224783,
      15,
    );
  });

  test("a sixth-level scroll: about 891.94 gp and 3.56774 workdays", () => {
    const rows = value<readonly ScribingCost[]>(
      carol(),
      "scroll-crafting.scribing",
    );
    expect(rows.map((row) => row.level)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    const sixth = rows.find((row) => row.level === 6) as ScribingCost;
    expect(known(sixth.materialsGp)).toBeCloseTo(891.93507, 4);
    expect(known(sixth.workdays)).toBeCloseTo(3.56774, 5);
  });

  test("mounting: fifth level about 22.30 gp and 53.52 minutes; cantrip 2.23 gp and 5.35 minutes", () => {
    const rows = value<readonly MountingCost[]>(
      carol(),
      "scroll-crafting.mounting",
    );
    const fifth = rows.find((row) => row.level === 5) as MountingCost;
    expect(known(fifth.feeGp)).toBeCloseTo(22.2984, 3);
    expect(known(fifth.hours) * 60).toBeCloseTo(53.52, 2);
    const cantrip = rows.find((row) => row.level === 0) as MountingCost;
    expect(known(cantrip.feeGp)).toBeCloseTo(2.2298, 3);
    expect(known(cantrip.hours) * 60).toBeCloseTo(5.35, 2);
  });

  test("Carol may scribe: Arcana and Calligrapher's Supplies proficiency", () => {
    const r = carol();
    expect(value(r, "scroll-crafting.eligible")).toBe(true);
    const v = r.get("scroll-crafting.eligible");
    expect(v.kind === "known" && v.explain.note).toMatch(/proficient:/);
  });
});

// Spell Effects and Active State, "Spell details and display": SRD 5.2.1 text and header facts.
describe("spell details", () => {
  const spell = (id: string) =>
    carolWithDefinitions().find((r) => r.id === id)?.data as Record<
      string,
      unknown
    > & { srd?: { paragraphs: string[]; credit: string } };

  test("every spell has a summary and its header facts", () => {
    const spells = carolWithDefinitions().filter((r) => r.kind === "spell");
    expect(spells.length).toBe(40);
    for (const r of spells) {
      const d = r.data as Record<string, unknown>;
      for (const k of [
        "summary",
        "castingTime",
        "range",
        "duration",
        "components",
      ])
        expect(d[k], `${r.id} ${k}`).toBeDefined();
    }
  });

  test("SRD spells carry the credited text; others do not", () => {
    expect(spell("core/Fireball").srd?.paragraphs[0]).toMatch(
      /^A bright streak/,
    );
    expect(spell("core/Fireball").srd?.credit).toMatch(
      /CC-BY|Creative Commons/,
    );
    expect(spell("core/Mind_Sliver").srd).toBeUndefined();
    expect(spell("core/Tasha's_Otherworldly_Guise").srd).toBeUndefined();
  });

  test("rituals and costly consumed components are read from the header", () => {
    expect(spell("core/Find_Familiar")).toMatchObject({
      ritual: true,
      castingTime: "1 hour",
      components: { costGp: 10, consumed: true },
    });
    expect(spell("core/Identify")).toMatchObject({
      ritual: true,
      components: { costGp: 100, consumed: false },
    });
    expect(spell("core/Teleportation_Circle")).toMatchObject({
      ritual: false,
      components: { somatic: false, costGp: 50, consumed: true },
    });
  });

  test("the overflow book: which test spells Carol can ready", () => {
    const overflow = value<readonly BookView[]>(
      carol(),
      "spellbook-readiness.books",
    )[3] as BookView;
    expect(overflow.entries.filter((e) => !e.ready).map((e) => e.name)).toEqual(
      ["Revivify"],
    );
  });
});

// Milestone 3, S4: scrolls as items (Spell Containers, "Binders and spent scrolls").
describe("scrolls", () => {
  type Scroll = import("@hearthtable/system-scrolls").ScrollView;
  const list = (r: ResolvedCharacter) =>
    value<readonly Scroll[]>(r, "scrolls.list");

  test("Carol's test scrolls are listed loose, with mounting cost at their own level", () => {
    const scrolls = list(carol());
    expect(
      scrolls.map((s) => [s.name, s.castLevel, s.spent, s.place.kind]),
    ).toEqual([
      ["Fireball", 3, false, "inventory"],
      ["Cone of Cold", 6, false, "inventory"],
      ["Misty Step", 2, true, "inventory"],
    ]);
    const cone = scrolls[1] as Scroll;
    expect(cone.mounting.kind === "known" && cone.mounting.value.level).toBe(6);
    const fee =
      cone.mounting.kind === "known" ? cone.mounting.value.feeGp : undefined;
    expect(fee?.kind === "known" && fee.value).toBeCloseTo(
      300 * 0.08919350686224783,
      6,
    );
  });

  test("a mounted scroll is a book entry with the same id; spent ones are not ready", () => {
    const records = carolWithDefinitions().map((r): RecordEnvelope => {
      if (r.id === `${CAROL_ID}/Inventory`) {
        const d = r.data as { lines: { id: string }[] };
        return {
          ...r,
          data: {
            ...d,
            lines: d.lines.filter((l) => !l.id.startsWith("scroll-")),
          },
        };
      }
      if (r.id === `${CAROL_ID}/Books/Overflow`) {
        const d = r.data as { entries: unknown[] };
        return {
          ...r,
          data: {
            ...d,
            entries: [
              ...d.entries,
              {
                id: "scroll-fireball",
                ref: "core/Fireball",
                item: "core/Spell_Scroll",
                scroll: { spell: "core/Fireball", castLevel: 3 },
              },
              {
                id: "scroll-misty-step",
                ref: "core/Misty_Step",
                item: "core/Spell_Scroll",
                scroll: { spell: "core/Misty_Step", castLevel: 2, spent: true },
              },
            ],
          },
        };
      }
      return r;
    });
    const r = engine.resolve(records);
    const overflow = value<readonly BookView[]>(
      r,
      "spellbook-readiness.books",
    )[3] as BookView;
    expect(overflow.entries.length).toBe(10);
    const byId = new Map(overflow.entries.map((e) => [e.id, e]));
    expect(byId.get("scroll-fireball")).toMatchObject({
      ready: true,
      scroll: { castLevel: 3 },
    });
    expect(byId.get("scroll-misty-step")?.ready).toBe(false);
    expect(byId.get("scroll-misty-step")?.reasons).toContain(
      "the scroll is spent",
    );
    expect(list(r).map((s) => [s.id, s.place.kind])).toEqual([
      ["scroll-fireball", "book"],
      ["scroll-misty-step", "book"],
    ]);
  });

  test("loose scrolls weigh 0.1 lb each", () => {
    const withScrolls = value<{ pounds: number }>(
      carol(),
      "containers.carriedWeight",
    ).pounds;
    const without = value<{ pounds: number }>(
      engine.resolve(
        edited({
          inventory: (d) => ({
            ...d,
            lines: (d["lines"] as { id: string }[]).filter(
              (l) => !l.id.startsWith("scroll-"),
            ),
          }),
        }),
      ),
      "containers.carriedWeight",
    ).pounds;
    expect(withScrolls - without).toBeCloseTo(0.3, 6);
  });
});

// Milestone 3, S5: canister charges as counters (Aetherlock Engineered Rounds).
test("each canister is a counter, with the installed one named", () => {
  type Canister = import("@hearthtable/system-magazines").CanisterView;
  const list = value<readonly Canister[]>(carol(), "magazines.canisters");
  expect(
    list.map((c) => [c.lineId, c.charges, c.max, c.installedIn?.name]),
  ).toEqual([
    ["canister-1", 12, 12, "Aetherlock"],
    ["canister-2", 12, 12, undefined],
    ["canister-3", 12, 12, undefined],
    ["canister-4", 12, 12, undefined],
    ["canister-5", 12, 12, undefined],
  ]);
});
