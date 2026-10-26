import { coreContent, coreNpcs } from "@hearthtable/content";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import { describe, expect, test } from "vitest";
import { createEngine } from "./index";

// Milestone 5 S10: the core SRD monsters resolve to their stat blocks.
const engine = createEngine(hearthtableVanillaPlus);
const monster = (name: string) => {
  const root = `core/NPCs/${name}`;
  return engine.resolve([
    ...coreContent,
    ...coreNpcs.filter((r) => r.id === root || r.id.startsWith(`${root}/`)),
  ]);
};
const value = (r: ReturnType<typeof monster>, key: string) => {
  const v = r.get<unknown>(key);
  return v.kind === "known" ? v.value : v.reason;
};

describe("core monsters", () => {
  test("Goblin Warrior, Bandit and Skeleton match their stat blocks", () => {
    const goblin = monster("Goblin_Warrior");
    expect([
      value(goblin, "hit-points.max"),
      value(goblin, "armor-class.total"),
      value(goblin, "initiative.total"),
      value(goblin, "saves.dex.total"),
      value(goblin, "skills.stealth.total"),
    ]).toEqual([10, 15, 2, 2, 6]);
    const bandit = monster("Bandit");
    expect([
      value(bandit, "hit-points.max"),
      value(bandit, "armor-class.total"),
    ]).toEqual([11, 12]);
    const skeleton = monster("Skeleton");
    expect(value(skeleton, "hit-points.defenses")).toMatchObject({
      vulnerabilities: ["Bludgeoning"],
      immunities: ["Poison"],
    });
    expect(value(skeleton, "saves.con.total")).toBe(2);
  });

  test("a Skeleton is never Poisoned", () => {
    const root = "core/NPCs/Skeleton";
    const records = coreNpcs
      .filter((r) => r.id === root || r.id.startsWith(`${root}/`))
      .map((r) =>
        r.id === root
          ? {
              ...r,
              data: {
                ...(r.data as object),
                conditions: [{ id: "c", ref: "core/Conditions/Poisoned" }],
              },
            }
          : r,
      );
    const list = engine
      .resolve([...coreContent, ...records])
      .get<readonly unknown[]>("conditions.list");
    expect(list.kind === "known" && list.value).toEqual([]);
  });
});
