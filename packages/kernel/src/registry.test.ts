import { describe, expect, test } from "vitest";
import {
  buildRegistry,
  type KernelModule,
  type ModuleManifest,
} from "./registry";

function module(
  manifest: Partial<ModuleManifest> & { id: string },
  setup?: KernelModule["setup"],
): KernelModule {
  const full: ModuleManifest = {
    version: "1.0.0",
    requires: [],
    extends: [],
    provides: {},
    ...manifest,
  };
  return setup ? { manifest: full, setup } : { manifest: full };
}

const damage = module({
  id: "damage",
  provides: { extensionPoints: ["damage.mitigationSteps"] },
});

const codes = (result: ReturnType<typeof buildRegistry>) =>
  result.issues.map((i) => i.code);

describe("module registry", () => {
  test("rejects a module that uses an undeclared dependency", () => {
    const ballistics = module({
      id: "ballistics",
      extends: ["damage.mitigationSteps"],
    });
    const result = buildRegistry([damage, ballistics]);
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain("registry.undeclared-dependency");
  });

  test("accepts the same module once it declares the dependency", () => {
    const ballistics = module(
      {
        id: "ballistics",
        requires: [{ id: "damage", range: "^1.0.0" }],
        extends: ["damage.mitigationSteps"],
      },
      (ctx) => ctx.extend("damage.mitigationSteps", "penetration"),
    );
    const result = buildRegistry([ballistics, damage]);
    expect(result.ok).toBe(true);
    expect(
      result.ok && result.value.contributions("damage.mitigationSteps"),
    ).toEqual(["penetration"]);
  });

  test("rejects contributing to a point not listed in extends", () => {
    const sneaky = module(
      { id: "sneaky", requires: [{ id: "damage", range: "*" }] },
      (ctx) => ctx.extend("damage.mitigationSteps", "x"),
    );
    expect(codes(buildRegistry([damage, sneaky]))).toContain(
      "registry.undeclared-extension",
    );
  });

  test("reports missing dependencies, version mismatches and unknown points", () => {
    const a = module({ id: "a", requires: [{ id: "missing", range: "*" }] });
    const b = module({
      id: "b",
      requires: [{ id: "damage", range: "^2.0.0" }],
    });
    const c = module({ id: "c", extends: ["nowhere.point"] });
    expect(codes(buildRegistry([damage, a, b, c]))).toEqual(
      expect.arrayContaining([
        "registry.missing-dependency",
        "registry.version-mismatch",
        "registry.unknown-point",
      ]),
    );
  });

  test("reports dependency cycles and duplicate modules", () => {
    const a = module({ id: "a", requires: [{ id: "b", range: "*" }] });
    const b = module({ id: "b", requires: [{ id: "a", range: "*" }] });
    expect(codes(buildRegistry([a, b]))).toContain("registry.cycle");
    expect(codes(buildRegistry([damage, damage]))).toContain(
      "registry.duplicate-module",
    );
  });

  test("orders contributions by rank, then dependency order", () => {
    const first = module(
      {
        id: "first",
        requires: [{ id: "damage", range: "*" }],
        extends: ["damage.mitigationSteps"],
      },
      (ctx) => {
        ctx.extend("damage.mitigationSteps", "late", 10);
        ctx.extend("damage.mitigationSteps", "early");
      },
    );
    const result = buildRegistry([first, damage]);
    expect(
      result.ok && result.value.contributions("damage.mitigationSteps"),
    ).toEqual(["early", "late"]);
  });

  test("anyone may contribute derivations to the kernel without requiring it", () => {
    const abilities = module(
      { id: "abilities", extends: ["kernel.derivations"] },
      (ctx) => ctx.extend("kernel.derivations", { key: "x" }),
    );
    expect(buildRegistry([abilities]).ok).toBe(true);
  });
});
