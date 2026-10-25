import { describe, expect, test } from "vitest";
import {
  clockFrom,
  formatClock,
  formatDuration,
  isInScene,
  newScenePath,
  sceneKindOf,
  sceneLabel,
  SECONDS_PER_ROUND,
} from "./index";

describe("the game clock", () => {
  test("reads as day and time", () => {
    expect(formatClock(0)).toBe("Day 1, 12:00 am");
    expect(formatClock(clockFrom(3, 14, 32) as number)).toBe("Day 3, 2:32 pm");
    expect(
      formatClock((clockFrom(1, 12, 0) as number) + 3 * SECONDS_PER_ROUND),
    ).toBe("Day 1, 12:00:18 pm");
  });
  test("refuses impossible times", () => {
    expect(clockFrom(0, 8, 0)).toBeUndefined();
    expect(clockFrom(1, 24, 0)).toBeUndefined();
    expect(clockFrom(1, 8, 60)).toBeUndefined();
  });
  test("durations", () => {
    expect(formatDuration(5400)).toBe("1 h 30 min");
    expect(formatDuration(18)).toBe("18 s");
    expect(formatDuration(0)).toBe("0 s");
  });
});

describe("scenes", () => {
  const C = "campaign/Riverbed_of_Strings";
  test("named from the clock and numbered within the day", () => {
    const day3 = clockFrom(3, 9, 0) as number;
    expect(newScenePath(C, "downtime", 0, [])).toBe(
      `${C}/Downtime/Day_1_Downtime`,
    );
    expect(
      newScenePath(C, "downtime", 60, [`${C}/Downtime/Day_1_Downtime`]),
    ).toBe(`${C}/Downtime/Day_1_Downtime_2`);
    expect(
      newScenePath(C, "encounter", day3, [`${C}/Encounters/Day_3_Encounter_1`]),
    ).toBe(`${C}/Encounters/Day_3_Encounter_2`);
  });
  test("labels, kinds and what is inside a scene", () => {
    expect(
      sceneLabel(`${C}/Encounters/Day_3_Encounter_2`, "Ambush at the ford"),
    ).toBe("Ambush at the ford (Day 3 Encounter 2)");
    expect(sceneKindOf(`${C}/Downtime/Day_1_Downtime`)).toBe("downtime");
    expect(isInScene(`${C}/Encounters/Day_3_Encounter_2/Goblin_2`)).toBe(true);
    expect(isInScene(`${C}/Items/Aetherlock`)).toBe(false);
  });
});
