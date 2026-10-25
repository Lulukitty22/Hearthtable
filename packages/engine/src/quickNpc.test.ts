import { coreContent } from "@hearthtable/content";
import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import { expect, test } from "vitest";
import { createEngine } from "./index";

// A quick NPC template (Milestone 5 S3): a character with no class levels whose HP maximum,
// Armor Class and initiative bonus are typed in on the record.
const sentry: RecordEnvelope = {
  id: "campaign/Test/NPCs/Harbor_Sentry" as RecordId,
  kind: "character",
  moduleId: "dnd5e-2024",
  schemaVersion: 1,
  origin: { scope: "campaign", ownerId: "Test" },
  source: { status: "homebrew" },
  revision: 0,
  updatedAt: "2026-10-25T00:00:00.000Z",
  data: {
    name: "Harbor Sentry",
    classLevels: [],
    abilities: {
      base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    },
    features: [],
    hitPoints: { current: 22, temporary: 0 },
    activeEffects: [],
    authored: {
      "hit-points.max": 22,
      "armor-class.total": 14,
      "initiative.total": 2,
    },
  },
  raw: {},
};

test("a quick NPC resolves from its typed-in numbers, and says so", () => {
  const sheet = createEngine(hearthtableVanillaPlus).resolve([
    ...coreContent,
    sentry,
  ]);
  const max = sheet.get<number>("hit-points.max");
  expect(max).toMatchObject({ kind: "known", value: 22 });
  expect(max.kind === "known" && max.explain.label).toBe(
    "Typed in: HP maximum",
  );
  expect(sheet.get("armor-class.total")).toMatchObject({
    kind: "known",
    value: 14,
  });
  expect(sheet.get("initiative.total")).toMatchObject({
    kind: "known",
    value: 2,
  });
  expect(sheet.get("saves.dex.total")).toMatchObject({
    kind: "known",
    value: 0,
  });
});
