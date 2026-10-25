import { describe, expect, test } from "vitest";
import { after, isOver, LATE, remaining, spellDuration } from "./index";

describe("moments", () => {
  test("a 1-round effect ends at the same step of the next round", () => {
    const cast = { clock: 106, step: 3 }; // round 2, just after Goblin 1's attack
    const end = after(cast, 6);
    expect(isOver(end, { clock: 112, step: 2 })).toBe(false);
    expect(isOver(end, { clock: 112, step: 3 })).toBe(true);
    // Once the fight is over, the late step of that second ends it.
    expect(isOver(end, { clock: 112, step: LATE })).toBe(true);
    expect(isOver(undefined, { clock: 999, step: 0 })).toBe(false);
  });

  test("durations as written", () => {
    expect(spellDuration("1 round")).toEqual({
      seconds: 6,
      concentration: false,
      instantaneous: false,
    });
    expect(
      spellDuration("Concentration, up to 10 minutes", true),
    ).toMatchObject({
      seconds: 600,
      concentration: true,
    });
    expect(spellDuration("8 hours").seconds).toBe(28800);
    expect(spellDuration("Until dispelled").seconds).toBeUndefined();
    expect(spellDuration("Instantaneous").instantaneous).toBe(true);
  });

  test("time left", () => {
    expect(remaining({ clock: 112, step: 3 }, { clock: 106, step: 3 })).toBe(
      "1 round",
    );
    expect(remaining({ clock: 3600, step: 0 }, { clock: 0, step: 0 })).toBe(
      "1 h",
    );
    expect(remaining({ clock: 600, step: 0 }, { clock: 48, step: 0 })).toBe(
      "9 min 12 s",
    );
  });
});
