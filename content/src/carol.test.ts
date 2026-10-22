// Milestone 2 acceptance, "Expected values": Carol's hand-entered records resolve, under the
// real Vanilla+ ruleset, to the numbers on her accepted sheet.

import { createEngine } from "@hearthtable/engine";
import type { RecordEnvelope, ResolvedCharacter } from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import type { AttunedSlot } from "@hearthtable/system-attunement";
import type { LineRow } from "@hearthtable/system-containers";
import type { WeaponView } from "@hearthtable/system-magazines";
import type { ResourcePool } from "@hearthtable/system-resources";
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

  test("spellbooks hold 16/10/6 entries, all ready", () => {
    const books = value<readonly BookView[]>(
      carol(),
      "spellbook-readiness.books",
    );
    expect(books.map((b) => b.entries.length)).toEqual([16, 10, 6]);
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

  test("unattuning Indomitable removes its +2 INT and its slot", () => {
    const r = engine.resolve(
      edited({
        inventory: (data) => ({
          ...data,
          attuned: ["aetherlock", "wand", "manifold"],
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
          attuned: ["aetherlock", "wand", "manifold", "indomitable", "goggles"],
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

  test("the Aetherlock shows six chambers with loading not yet recorded, and a 12/12 canister", () => {
    const [rifle] = value<readonly WeaponView[]>(carol(), "magazines.weapons");
    expect(rifle).toMatchObject({
      name: "Aetherlock",
      chambersRecorded: false,
      loaded: 0,
      canister: { charges: 12, max: 12 },
    });
    expect(rifle?.chambers).toHaveLength(6);
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
