import { describe, expect, it } from "vitest";
import { aliasProblem, normalizeAlias, readAccount } from "./accounts";

describe("Alias format", () => {
  it("accepts 4–32 letters, digits, underscores and hyphens", () => {
    for (const alias of ["VR_Lulu", "abcd", "a-b_c9", "x".repeat(32)])
      expect(aliasProblem(alias)).toBeUndefined();
  });

  it("refuses short, long and other characters", () => {
    expect(aliasProblem("abc")).toMatch(/at least 4/);
    expect(aliasProblem("x".repeat(33))).toMatch(/at most 32/);
    for (const alias of ["VR Lulu", "VR.Lulu", "Lulu!", "Lülu"])
      expect(aliasProblem(alias)).toMatch(/only letters/);
  });

  it("treats capitals and _ versus - as the same Alias", () => {
    expect(normalizeAlias("VR_Lulu")).toBe("vr_lulu");
    expect(normalizeAlias("vr-lulu")).toBe("vr_lulu");
    expect(normalizeAlias("VRLulu")).not.toBe(normalizeAlias("VR_Lulu"));
  });
});

describe("readAccount", () => {
  it("reads an account and defaults the administrator flag to false", () => {
    expect(readAccount("u1", { alias: "VR_Lulu", status: "pending" })).toEqual({
      uid: "u1",
      alias: "VR_Lulu",
      status: "pending",
      admin: false,
    });
  });

  it("is undefined for missing or malformed data", () => {
    expect(readAccount("u1", undefined)).toBeUndefined();
    expect(readAccount("u1", { alias: "VR_Lulu", status: "maybe" })).toBe(
      undefined,
    );
  });
});
