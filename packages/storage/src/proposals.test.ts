import { describe, expect, it } from "vitest";
import { differences } from "./proposals";

describe("differences for review", () => {
  it("lists changed fields by path, with before and after", () => {
    expect(
      differences(
        { hitPoints: { current: 95, temporary: 0 }, name: "Carol" },
        { hitPoints: { current: 80, temporary: 0 }, name: "Carol" },
      ),
    ).toEqual(["hitPoints.current: 95 → 80"]);
  });

  it("shows added and removed fields, and compares lists whole", () => {
    expect(differences({ a: 1 }, { b: 2 })).toEqual([
      "a: 1 → (none)",
      "b: (none) → 2",
    ]);
    expect(differences({ l: [1, 2] }, { l: [1, 3] })).toEqual([
      "l: [1,2] → [1,3]",
    ]);
    expect(differences({ x: 1 }, { x: 1 })).toEqual([]);
  });
});
