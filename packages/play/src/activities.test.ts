import { describe, expect, test } from "vitest";
import {
  activityType,
  longRest,
  runDowntime,
  shortRest,
  summaryLine,
  type QueuedActivity,
} from "./index";

const H = 3600;
const queued = (
  id: string,
  character: string,
  type: string,
  seconds: number,
  extra: Partial<QueuedActivity> = {},
): QueuedActivity => ({
  id,
  character,
  type,
  seconds,
  progress: 0,
  status: "approved",
  ...extra,
});

describe("running downtime", () => {
  test("each character's approved activities run in order; splittable ones keep progress", () => {
    const run = runDowntime(
      [
        queued("a", "carol", "note", 2 * H),
        queued("b", "carol", "short-rest", H),
        queued("c", "carol", "note", 3 * H),
        queued("p", "carol", "note", H, { status: "pending" }),
        queued("x", "bram", "long-rest", 8 * H),
      ],
      4 * H,
    );
    expect(run).toEqual([
      { id: "a", ran: 2 * H, at: 2 * H, state: "done" },
      { id: "b", ran: H, at: 3 * H, state: "done" },
      { id: "c", ran: H, at: 4 * H, state: "continues" },
      { id: "x", ran: 4 * H, at: 4 * H, state: "interrupted" },
    ]);
  });

  test("an activity that waits for another starts after it, or stays queued", () => {
    const run = runDowntime(
      [
        queued("craft", "bram", "note", 2 * H),
        queued("trade", "carol", "note", H, { waitsFor: "craft" }),
        queued("lost", "carol", "note", H, { waitsFor: "rejected-one" }),
      ],
      5 * H,
    );
    expect(run).toEqual([
      { id: "craft", ran: 2 * H, at: 2 * H, state: "done" },
      { id: "trade", ran: H, at: 3 * H, state: "done" },
      { id: "lost", ran: 0, at: 3 * H, state: "waiting" },
    ]);
  });

  test("the DM's summary of a character", () => {
    expect(
      summaryLine("Carol", [
        { type: "long-rest", seconds: 8 * H },
        { type: "note", seconds: 1800, note: "keep watch" },
      ]),
    ).toBe("Carol: Long Rest 8 h, Note 30 min (keep watch)");
  });
});

describe("rests", () => {
  const facts = {
    name: "Carol",
    hpCurrent: 40,
    hpMax: 95,
    pools: [
      { pool: "arcane-recovery", reset: "long rest" },
      { pool: "second-wind", reset: "short rest" },
    ],
  };
  const data = {
    hitPoints: { current: 40, temporary: 5 },
    resources: { used: { "arcane-recovery": 1, "second-wind": 1 } },
    spellcasting: { expended: { "3": 2 } },
    hitPointDice: { spent: { "6": 3 } },
    conditions: [{ id: "e", ref: "core/Conditions/Exhaustion", level: 2 }],
  };

  test("a Long Rest restores everything and lowers Exhaustion by one", () => {
    const out = longRest.finish(facts, data, 100);
    expect(out.data).toMatchObject({
      hitPoints: { current: 95, temporary: 5 },
      resources: { used: {} },
      spellcasting: { expended: {} },
      hitPointDice: { spent: {} },
      conditions: [{ id: "e", level: 1 }],
      lastLongRestEnd: 100,
    });
  });

  test("a Short Rest resets short-rest uses and opens Hit Point Dice", () => {
    const out = shortRest.finish(facts, data, 0);
    expect(out.data["resources"]).toEqual({ used: { "arcane-recovery": 1 } });
    expect(out.spendHitDice).toBe(true);
  });

  test("an interrupted Long Rest of an hour or more gives a Short Rest's benefits", () => {
    expect(longRest.unfinished?.(H - 1, facts, data, 0)).toBeUndefined();
    expect(longRest.unfinished?.(H, facts, data, 0)?.spendHitDice).toBe(true);
  });

  test("rest warnings: below 1 hit point, and less than 16 hours between Long Rests", () => {
    expect(
      longRest.warnings(
        { ...facts, hpCurrent: 0 },
        { lastLongRestEnd: 0 },
        10 * H,
      ),
    ).toHaveLength(2);
    expect(activityType("note")?.duration({ seconds: 600 })).toBe(600);
  });
});
