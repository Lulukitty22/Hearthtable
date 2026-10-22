import { describe, expect, test } from "vitest";
import { buildRegistry, DERIVATIONS_POINT } from "./registry";
import { resolveCharacter, type Derivation } from "./resolve";
import { checkRuleset } from "./ruleset";
import { formatExplanation, known, sum, type Value } from "./value";

function setup(derivations: Derivation[]) {
  const registry = buildRegistry([
    {
      manifest: {
        id: "dnd5e-2024",
        version: "1.0.0",
        requires: [],
        extends: [],
        provides: {},
      },
    },
    {
      manifest: {
        id: "test-system",
        version: "1.0.0",
        requires: [],
        extends: [DERIVATIONS_POINT],
        provides: {},
      },
      setup: (ctx) =>
        derivations.forEach((d) => ctx.extend(DERIVATIONS_POINT, d)),
    },
  ]);
  if (!registry.ok) throw new Error(JSON.stringify(registry.issues));
  const settings = checkRuleset(
    {
      id: "t",
      title: "Test",
      game: "dnd5e-2024",
      systems: ["test-system"],
      methods: {},
      variables: {},
    },
    registry.value,
  );
  return { registry: registry.value, settings, records: [] };
}

const dex: Derivation = {
  key: "abilities.dex.modifier",
  compute: () => known(3, "DEX", { note: "from 16" }),
};
const ac: Derivation = {
  key: "armor-class.total",
  compute: (ctx) =>
    sum("AC", [
      known(13, "Mage Armor"),
      ctx.get<number>("abilities.dex.modifier"),
    ]),
};

describe("resolved-state pipeline", () => {
  test("every number carries its explanation", () => {
    const resolved = resolveCharacter(setup([ac, dex]));
    const value = resolved.get<number>("armor-class.total");
    expect(value).toMatchObject({ kind: "known", value: 16 });
    expect(value.kind === "known" && formatExplanation(value.explain)).toBe(
      "AC 16 = Mage Armor 13 + DEX 3 (from 16)",
    );
  });

  test("each derivation runs once, however many values read it", () => {
    let runs = 0;
    const counted: Derivation = {
      key: "abilities.dex.modifier",
      compute: () => (runs++, known(3, "DEX")),
    };
    const reader = (key: string): Derivation => ({
      key,
      compute: (ctx) => ctx.get("abilities.dex.modifier") as Value<unknown>,
    });
    resolveCharacter(setup([counted, reader("a"), reader("b"), reader("c")]));
    expect(runs).toBe(1);
  });

  test("an authored value stays authoritative", () => {
    const resolved = resolveCharacter({
      ...setup([ac, dex]),
      authored: new Map([
        ["armor-class.total", { value: 18, label: "Stats tab: AC" }],
      ]),
    });
    expect(resolved.get("armor-class.total")).toMatchObject({
      kind: "known",
      value: 18,
      explain: { note: "authored" },
    });
  });

  test("a missing input makes dependants visibly unresolved", () => {
    const resolved = resolveCharacter(setup([ac]));
    expect(resolved.get("armor-class.total").kind).toBe("unresolved");
    expect(resolved.get("nothing.here").kind).toBe("unresolved");
  });

  test("cycles and failing derivations are unresolved and reported, not thrown", () => {
    const a: Derivation = {
      key: "a",
      compute: (ctx) => ctx.get("b") as Value<unknown>,
    };
    const b: Derivation = {
      key: "b",
      compute: (ctx) => ctx.get("a") as Value<unknown>,
    };
    const boom: Derivation = {
      key: "boom",
      compute: () => {
        throw new Error("bad data");
      },
    };
    const resolved = resolveCharacter(setup([a, b, boom]));
    expect(resolved.get("a").kind).toBe("unresolved");
    expect(resolved.get("b").kind).toBe("unresolved");
    expect(resolved.get("boom")).toMatchObject({
      kind: "unresolved",
      reason: "Computing boom failed: bad data",
    });
    expect(resolved.issues.map((i) => i.code)).toEqual([
      "resolve.derivation-failed",
    ]);
  });

  test("two derivations for one value are an error", () => {
    const resolved = resolveCharacter(setup([dex, dex]));
    expect(resolved.issues.map((i) => i.code)).toEqual([
      "resolve.duplicate-derivation",
    ]);
  });
});
