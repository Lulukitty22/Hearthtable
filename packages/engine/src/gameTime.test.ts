import { coreContent } from "@hearthtable/content";
import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import { expect, test } from "vitest";
import { createEngine } from "./index";

// Milestone 5 S4: an effect stops counting once the campaign's game moment reaches its end.
const envelope = (id: string, kind: string, data: object): RecordEnvelope => ({
  id: id as RecordId,
  kind,
  moduleId: "test",
  schemaVersion: 1,
  origin: { scope: "campaign", ownerId: "Test" },
  source: { status: "homebrew" },
  revision: 0,
  updatedAt: "2026-10-25T00:00:00.000Z",
  data,
  raw: {},
});
const guard = envelope("campaign/Test/NPCs/Guard", "character", {
  name: "Guard",
  classLevels: [],
  abilities: { base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
  features: [],
  hitPoints: { current: 11, temporary: 0 },
  activeEffects: [
    {
      id: "shield-1",
      ref: "core/Spells/Shield",
      activatedAt: "2026-10-25T00:00:00.000Z",
      startedAt: { clock: 106, step: 3 },
      endsAt: { clock: 112, step: 3 },
    },
  ],
});
const at = (clock: number, step: number) =>
  envelope("game-time", "game-time", { now: { clock, step } });
const engine = createEngine(hearthtableVanillaPlus);
const ac = (records: RecordEnvelope[]) =>
  engine
    .resolve([...coreContent, guard, ...records])
    .get<number>("armor-class.total");

test("Shield counts until the same step one round later", () => {
  expect(ac([at(112, 2)])).toMatchObject({ value: 15 });
  expect(ac([at(112, 3)])).toMatchObject({ value: 10 });
  // Outside a campaign there is no game time, so it never ends on its own.
  expect(ac([])).toMatchObject({ value: 15 });
  const list = engine
    .resolve([...coreContent, guard, at(200, 0)])
    .get<readonly { status: string }[]>("active-effects.list");
  expect(list.kind === "known" && list.value[0]?.status).toBe("ended");
});
