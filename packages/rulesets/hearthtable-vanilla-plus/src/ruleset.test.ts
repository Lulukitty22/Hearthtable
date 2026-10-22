import {
  MODULES,
  carolRecords,
  resolveWith,
  valueOf,
} from "@hearthtable/game-dnd5e-2024/testing";
import { buildRegistry, checkRuleset } from "@hearthtable/kernel";
import { describe, expect, test } from "vitest";
import { hearthtableVanillaPlus } from "./index";

describe("Hearthtable Vanilla+ Rules", () => {
  test("every system, method and variable it names exists, with no warnings", () => {
    const registry = buildRegistry(MODULES);
    if (!registry.ok) throw new Error(JSON.stringify(registry.issues));
    expect(checkRuleset(hearthtableVanillaPlus, registry.value).issues).toEqual(
      [],
    );
  });

  test("it enables every Milestone 2 system", () => {
    const systems = MODULES.map((m) => m.manifest.id).filter(
      (id) => id !== hearthtableVanillaPlus.game,
    );
    expect([...hearthtableVanillaPlus.systems].sort()).toEqual(systems.sort());
  });

  test("Carol's test character resolves to her documented numbers under it", () => {
    const r = resolveWith(carolRecords(), hearthtableVanillaPlus);
    expect({
      level: valueOf(r, "character.level"),
      proficiency: valueOf(r, "proficiency.bonus"),
      hp: valueOf(r, "hit-points.max"),
      ac: valueOf(r, "armor-class.total"),
      initiative: valueOf(r, "initiative.total"),
      arcana: valueOf(r, "skills.arcana.total"),
      pointBuy: valueOf(r, "abilities.pointBuy"),
    }).toEqual({
      level: 15,
      proficiency: 5,
      hp: 95,
      ac: 13,
      initiative: 8,
      arcana: 16,
      pointBuy: { spent: 27, budget: 27, deficit: 0 },
    });
  });

  test("there is no level cap: a level-25 multiclass gets no cap warning and proficiency +8", () => {
    const levels = [
      ...Array<string>(20).fill("core:wizard"),
      ...Array<string>(5).fill("core:artificer"),
    ];
    const r = resolveWith(
      carolRecords({ classLevels: levels }),
      hearthtableVanillaPlus,
    );
    expect(valueOf(r, "proficiency.bonus")).toBe(8);
    expect(r.issues.map((i) => i.code)).not.toContain("dnd5e.over-level-cap");
  });
});
