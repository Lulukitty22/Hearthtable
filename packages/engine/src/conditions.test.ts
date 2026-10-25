import { coreContent } from "@hearthtable/content";
import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import { describe, expect, test } from "vitest";
import { createEngine } from "./index";

// Milestone 5 S5: conditions, their automated parts, and going down.
const engine = createEngine(hearthtableVanillaPlus);
const guard = (data: object): RecordEnvelope => ({
  id: "campaign/Test/NPCs/Guard" as RecordId,
  kind: "character",
  moduleId: "dnd5e-2024",
  schemaVersion: 1,
  origin: { scope: "campaign", ownerId: "Test" },
  source: { status: "homebrew" },
  revision: 0,
  updatedAt: "2026-10-25T00:00:00.000Z",
  data: {
    name: "Guard",
    classLevels: [],
    abilities: {
      base: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
    },
    features: [],
    hitPoints: { current: 11, temporary: 0 },
    activeEffects: [],
    authored: { "hit-points.max": 11 },
    ...data,
  },
  raw: {},
});
const resolve = (data: object) => engine.resolve([...coreContent, guard(data)]);
const names = (data: object) => {
  const v =
    resolve(data).get<readonly { name: string; origin: string }[]>(
      "conditions.list",
    );
  return v.kind === "known"
    ? v.value.map((c) => `${c.name} (${c.origin})`)
    : [];
};
const condition = (ref: string, extra: object = {}) => ({
  id: `c-${ref}`,
  ref: `core/Conditions/${ref}`,
  ...extra,
});

describe("conditions", () => {
  test("Paralyzed includes Incapacitated and fails Strength and Dexterity saves", () => {
    const sheet = resolve({ conditions: [condition("Paralyzed")] });
    expect(names({ conditions: [condition("Paralyzed")] })).toEqual([
      "Paralyzed (applied)",
      "Incapacitated (included)",
    ]);
    expect(sheet.get("saves.dex.autoFail")).toMatchObject({ value: true });
    expect(sheet.get("saves.wis.autoFail")).toMatchObject({ value: false });
    expect(sheet.get("conditions.incapacitated")).toMatchObject({
      value: true,
    });
  });

  test("Exhaustion levels add up and lower every D20 Test", () => {
    const sheet = resolve({
      conditions: [
        condition("Exhaustion", { level: 1 }),
        { ...condition("Exhaustion", { level: 1 }), id: "c-2" },
      ],
    });
    expect(sheet.get("conditions.exhaustion.level")).toMatchObject({
      value: 2,
    });
    expect(sheet.get("initiative.total")).toMatchObject({ value: 2 - 4 });
    expect(sheet.get("saves.str.total")).toMatchObject({ value: -4 });
  });

  test("going down: 0 hit points or below, or Exhaustion 6 in Vanilla+", () => {
    expect(names({ hitPoints: { current: -3, temporary: 0 } })).toEqual([
      "Unconscious (down)",
      "Incapacitated (included)",
      "Prone (included)",
    ]);
    expect(
      names({ conditions: [condition("Exhaustion", { level: 6 })] }),
    ).toContain("Unconscious (down)");
  });

  test("a condition ends with its source effect, and Incapacitated breaks concentration", () => {
    const guise = {
      id: "fx-guise",
      ref: "core/Spells/Tasha's_Otherworldly_Guise",
      activatedAt: "2026-10-25T00:00:00.000Z",
    };
    expect(
      names({ conditions: [condition("Poisoned", { source: "fx-gone" })] }),
    ).toEqual([]);
    const effects = resolve({
      activeEffects: [guise],
      conditions: [condition("Stunned")],
    }).get<readonly { status: string; reason?: string }[]>(
      "active-effects.list",
    );
    expect(effects.kind === "known" && effects.value[0]).toMatchObject({
      status: "ended",
      reason: "Concentration broken (Incapacitated).",
    });
  });
});
