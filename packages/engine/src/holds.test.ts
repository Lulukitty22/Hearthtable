import { carolWithDefinitions, CAROL_ID } from "@hearthtable/content";
import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";
import { expect, test } from "vitest";
import { createEngine } from "./index";

// Milestone 5 S6: held resources are not usable, and a hold returned after a rest is discarded.
const engine = createEngine(hearthtableVanillaPlus);
const holds = (data: object): RecordEnvelope => ({
  id: "holds" as RecordId,
  kind: "holds",
  moduleId: "play",
  schemaVersion: 1,
  origin: { scope: "core" },
  source: { status: "homebrew" },
  revision: 0,
  updatedAt: "2026-10-25T00:00:00.000Z",
  data,
  raw: {},
});
const withExpended = (expended: Record<string, number>) =>
  carolWithDefinitions().map((r) =>
    r.id === CAROL_ID
      ? { ...r, data: { ...(r.data as object), spellcasting: { expended } } }
      : r,
  );
const level1 = (records: RecordEnvelope[]) => {
  const slots = engine.resolve(records).get<
    readonly {
      level: number;
      max: { value?: number };
      available: { value?: number };
    }[]
  >("spellcasting.slots");
  const row = slots.kind === "known" ? slots.value[0] : undefined;
  return { max: row?.max.value, available: row?.available.value };
};

test("a held slot cannot be used, and returns when the hold goes", () => {
  const max = level1(withExpended({})).max as number;
  expect(
    level1([...withExpended({}), holds({ slots: { "1": 1 } })]).available,
  ).toBe(max - 1);
  expect(level1(withExpended({})).available).toBe(max);
});

test("a rest while a slot is held restores the sheet; the returned hold is discarded", () => {
  const max = level1(withExpended({})).max as number;
  // The rest records the held slot as below zero, so everything is usable now…
  expect(
    level1([...withExpended({ "1": -1 }), holds({ slots: { "1": 1 } })])
      .available,
  ).toBe(max);
  // …and once the request is rejected, the usable slots stay at the maximum.
  expect(level1(withExpended({ "1": -1 })).available).toBe(max);
});
