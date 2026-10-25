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
    expect(value(r, "spellcasting.classes.core/Classes/Wizard.attack")).toBe(
      11,
    );
    expect(value(r, "spellcasting.classes.core/Classes/Wizard.dc")).toBe(19);
  });

  test("spellbooks hold 16/10/6 entries, all ready, plus the overflow test book", () => {
    const all = value<readonly BookView[]>(
      carol(),
      "spellbook-readiness.books",
    );
    expect(all.map((b) => b.entries.length)).toEqual([16, 10, 6, 9]);
    const books = all.slice(0, 3); // the accepted sheet's books
    const notReady = books.flatMap((b) =>
      b.entries
        .filter((e) => !e.ready)
        .map((e) => `${e.name}: ${e.reasons.join("; ")}`),
    );
    expect(notReady).toEqual([]);
  });

  test("every item is reachable; only coins and the scrolls in books and Spellrounds are packed", () => {
    const lines = value<readonly LineRow[]>(carol(), "containers.lines");
    expect(lines.every((l) => l.accessible && l.status === "resolved")).toBe(
      true,
    );
    const packed = lines.filter((l) => l.depth !== 0);
    expect(
      packed.filter((l) => !("scroll" in l.line)).map((l) => l.line.id),
    ).toEqual(["coins-pp", "coins-gp", "coins-ep", "coins-sp", "coins-cp"]);
    // Each spell in a book, and each Spellround's payload, is a scroll line inside it.
    expect(packed.filter((l) => "scroll" in l.line)).toHaveLength(41 + 7);
    expect(new Set(packed.map((l) => l.depth))).toEqual(new Set([1]));
  });

  test("each Spellround is a casing holding one installed scroll", () => {
    const lines = value<readonly LineRow[]>(carol(), "containers.lines");
    const casings = lines.filter((l) => l.name === "Spellround");
    expect(casings).toHaveLength(7);
    for (const casing of casings) {
      const inside = lines.filter((l) => l.line.parent === casing.line.id);
      expect(inside.map((l) => l.name)).toEqual(["Spell Scroll"]);
    }
    const installed = value<
      readonly import("@hearthtable/system-scrolls").ScrollView[]
    >(carol(), "scrolls.list").filter((s) => s.place.kind === "installed");
    expect(installed.map((s) => s.name).sort()).toEqual([
      "Cone of Cold",
      "Cone of Cold",
      "Cone of Cold",
      "Cure Wounds",
      "Cure Wounds",
      "Shield",
      "Shield",
    ]);
  });

  test("every spell in her books is a mounted scroll at its own level", () => {
    const books = value<readonly BookView[]>(
      carol(),
      "spellbook-readiness.books",
    );
    const entries = books.flatMap((b) => b.entries);
    expect(entries.length).toBe(41);
    expect(entries.every((e) => e.scroll?.castLevel === e.level)).toBe(true);
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
      ref: "core/Spells/Mage_Armor",
      activatedAt: "2026-10-22T21:00:00.000Z",
    };
    const shield = {
      id: "effect-2",
      ref: "core/Spells/Shield",
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
    expect(value(r, "spellcasting.classes.core/Classes/Wizard.attack")).toBe(
      12,
    );
    expect(value(r, "spellcasting.classes.core/Classes/Wizard.dc")).toBe(19);
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
              ? { ...l, attunedTo: "account/VR_Lulu/Characters/Someone_Else" }
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
          ref: "campaign/Riverbed_of_Strings/Items/Basic_Round",
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
          ref: "core/Items/Potion_of_Healing",
          quantity: 1,
          attunedTo: null,
          parent: "aetherlock",
          slot: "top-right",
        },
        {
          id: "two-a",
          ref: "campaign/Riverbed_of_Strings/Items/Basic_Round",
          quantity: 1,
          attunedTo: null,
          parent: "aetherlock",
          slot: "top-left",
        },
        {
          id: "two-b",
          ref: "account/VR_Lulu/Items/Arcane_Round",
          quantity: 1,
          attunedTo: null,
          parent: "aetherlock",
          slot: "top-left",
        },
        {
          id: "stack",
          ref: "campaign/Riverbed_of_Strings/Items/Basic_Round",
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
      (r) => r.id !== "core/Spells/Fireball",
    );
    const r = engine.resolve(records);
    const combat = value<readonly BookView[]>(
      r,
      "spellbook-readiness.books",
    )[0];
    const fireball = combat?.entries.find(
      (e) => e.ref === "core/Spells/Fireball",
    );
    expect(fireball).toMatchObject({
      status: "unresolved",
      ready: false,
      reasons: ["Reference not found: core/Spells/Fireball"],
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
      active(
        "core/Spells/Mage_Armor",
        "core/Spells/Tasha's_Otherworldly_Guise",
      ),
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
      active("core/Spells/Tasha's_Otherworldly_Guise", "core/Spells/Web"),
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
              { id: "a", ref: "core/Spells/Web", activatedAt: at(0) },
              { id: "b", ref: "core/Spells/Detect_Magic", activatedAt: at(1) },
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
    expect(spells.length).toBe(41);
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
    expect(spell("core/Spells/Fireball").srd?.paragraphs[0]).toMatch(
      /^A bright streak/,
    );
    expect(spell("core/Spells/Fireball").srd?.credit).toMatch(
      /CC-BY|Creative Commons/,
    );
    expect(spell("core/Spells/Mind_Sliver").srd).toBeUndefined();
    expect(spell("core/Spells/Tasha's_Otherworldly_Guise").srd).toBeUndefined();
  });

  test("rituals and costly consumed components are read from the header", () => {
    expect(spell("core/Spells/Find_Familiar")).toMatchObject({
      ritual: true,
      castingTime: "1 hour",
      components: { costGp: 10, consumed: true },
    });
    expect(spell("core/Spells/Identify")).toMatchObject({
      ritual: true,
      components: { costGp: 100, consumed: false },
    });
    expect(spell("core/Spells/Teleportation_Circle")).toMatchObject({
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
    const scrolls = list(carol()).filter((s) => s.place.kind === "loose");
    expect(
      scrolls.map((s) => [s.name, s.castLevel, s.spent, s.place.kind]),
    ).toEqual([
      ["Fireball", 3, false, "loose"],
      ["Cone of Cold", 6, false, "loose"],
      ["Misty Step", 2, true, "loose"],
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

  test("a scroll moved into a book is bound there with the same id; spent ones are not ready", () => {
    const records = carolWithDefinitions().map((r): RecordEnvelope => {
      if (r.id !== `${CAROL_ID}/Inventory`) return r;
      const d = r.data as { lines: { id: string }[] };
      return {
        ...r,
        data: {
          ...d,
          lines: d.lines.map((l) =>
            l.id === "scroll-fireball" || l.id === "scroll-misty-step"
              ? { ...l, parent: "overflow-book" }
              : l,
          ),
        },
      };
    });
    const r = engine.resolve(records);
    const overflow = value<readonly BookView[]>(
      r,
      "spellbook-readiness.books",
    )[3] as BookView;
    expect(overflow.entries.length).toBe(11);
    const byId = new Map(overflow.entries.map((e) => [e.id, e]));
    expect(byId.get("scroll-fireball")).toMatchObject({
      ready: true,
      scroll: { castLevel: 3 },
    });
    expect(byId.get("scroll-misty-step")?.ready).toBe(false);
    expect(byId.get("scroll-misty-step")?.reasons).toContain(
      "the scroll is spent",
    );
    expect(
      list(r)
        .filter(
          (s) => s.id === "scroll-fireball" || s.id === "scroll-misty-step",
        )
        .map((s) => [s.id, s.place.kind]),
    ).toEqual([
      ["scroll-fireball", "bound"],
      ["scroll-misty-step", "bound"],
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

// Milestone 3, S6: coins as inventory items and the wallet total.
test("Carol's test purse: wallet total and coin weight", () => {
  const wallet = value<{ totalCp: number; purse: Record<string, number> }>(
    carol(),
    "currency.wallet",
  );
  expect(wallet.purse).toEqual({ cp: 37, sp: 14, ep: 2, gp: 25, pp: 3 });
  expect(wallet.totalCp).toBe(5777);
  const coins = 37 + 14 + 2 + 25 + 3;
  const without = value<{ pounds: number }>(
    engine.resolve(
      edited({
        inventory: (d) => ({
          ...d,
          lines: (d["lines"] as { id: string }[]).filter(
            (l) => !l.id.startsWith("coins-"),
          ),
        }),
      }),
    ),
    "containers.carriedWeight",
  ).pounds;
  expect(
    value<{ pounds: number }>(carol(), "containers.carriedWeight").pounds -
      without,
  ).toBeCloseTo(coins / 50, 6);
});

// Milestone 3, S7: lost or destroyed items (Spell Containers, "Item lifecycle").
describe("lost and destroyed items", () => {
  const mark = (changes: Record<string, Record<string, unknown>>) =>
    engine.resolve(
      edited({
        inventory: (d) => ({
          ...d,
          lines: (d["lines"] as { id: string }[]).map((l) =>
            changes[l.id] ? { ...l, ...changes[l.id] } : l,
          ),
        }),
      }),
    );

  test("a lost Wand grants nothing but keeps its attunement slot", () => {
    const held = mark({ wand: { held: true } });
    expect(value(held, "spellcasting.classes.core/Classes/Wizard.attack")).toBe(
      12,
    );
    const lost = mark({ wand: { held: true, lost: "lost" } });
    expect(value(lost, "spellcasting.classes.core/Classes/Wizard.attack")).toBe(
      11,
    );
    expect(value<readonly string[]>(lost, "attunement.order")).toContain(
      "wand",
    );
  });

  test("a lost bag takes its contents: no weight, out of reach, coins leave the wallet", () => {
    const base = value<{ pounds: number }>(
      carol(),
      "containers.carriedWeight",
    ).pounds;
    const r = mark({
      "coins-gp": { parent: "bag-of-holding-1" },
      "bag-of-holding-1": { lost: "destroyed" },
    });
    const rows = value<readonly LineRow[]>(r, "containers.lines");
    const gp = rows.find((x) => x.line.id === "coins-gp");
    expect(gp?.lost).toBe("destroyed");
    expect(gp?.accessible).toBe(false);
    expect(value<{ totalCp: number }>(r, "currency.wallet").totalCp).toBe(
      5777 - 2500,
    );
    // The bag's fixed 5 lb and the 25 gold pieces' half pound are gone.
    expect(
      base - value<{ pounds: number }>(r, "containers.carriedWeight").pounds,
    ).toBeCloseTo(5.5, 6);
  });

  test("an item that cannot be lost warns when marked lost", () => {
    const r = mark({ indomitable: { lost: "lost" } });
    expect(r.issues.map((i) => i.code)).toContain("containers.cannot-be-lost");
  });
});
