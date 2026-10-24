import { describe, expect, it } from "vitest";
import { nameProblem, segmentFor } from "./names";

describe("entry names", () => {
  it("become path segments with spaces as underscores, keeping capitals", () => {
    expect(segmentFor("  Moonlit  Coast ")).toBe("Moonlit_Coast");
    expect(segmentFor("Carol's Wand")).toBe("Carol's_Wand");
  });

  it("are refused when the destination has the same name", () => {
    const taken = ["Carol_Elfnein", "Items"];
    expect(nameProblem("carol elfnein", taken)).toMatch(/already here/);
    expect(nameProblem("ITEMS", taken)).toMatch(/already here/);
    expect(nameProblem("Carol-Elfnein", taken)).toBeUndefined();
  });

  it("are refused when they are address words, ignoring capitals", () => {
    for (const word of ["Edit", "dm", "ACCOUNTS", "Campaigns", "admin"])
      expect(nameProblem(word, [])).toMatch(/web addresses/);
    expect(nameProblem("Editor", [])).toBeUndefined();
  });

  it("refuses empty names, slashes and dot-only names", () => {
    expect(nameProblem("   ", [])).toMatch(/Enter a name/);
    expect(nameProblem("a/b", [])).toMatch(/cannot contain/);
    expect(nameProblem("..", [])).toMatch(/dots/);
  });
});
