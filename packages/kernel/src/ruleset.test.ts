import { describe, expect, test } from "vitest";
import { buildRegistry, type Registry } from "./registry";
import { checkRuleset, type Ruleset } from "./ruleset";

function registry(): Registry {
  const result = buildRegistry([
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
        id: "containers",
        version: "1.0.0",
        requires: [],
        extends: [],
        provides: {
          ruleVariables: [
            {
              name: "maxAccessibleDepth",
              type: "integer",
              allowUnlimited: true,
            },
          ],
        },
      },
    },
    {
      manifest: {
        id: "spellbook-readiness",
        version: "1.0.0",
        requires: [],
        extends: [],
        provides: {
          methods: [
            {
              slot: "readiness",
              options: ["published-preparation", "book-contents-ready"],
            },
          ],
          ruleVariables: [
            { name: "bookCapacity", type: "integer", default: 16 },
          ],
        },
      },
    },
  ]);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

const vanillaPlus: Ruleset = {
  id: "hearthtable-vanilla-plus",
  title: "Hearthtable Vanilla+",
  game: "dnd5e-2024",
  systems: ["containers", "spellbook-readiness"],
  methods: { "spellbook-readiness.readiness": "book-contents-ready" },
  variables: { "containers.maxAccessibleDepth": 1 },
};

describe("ruleset compatibility check", () => {
  test("a valid ruleset resolves its methods and variables", () => {
    const settings = checkRuleset(vanillaPlus, registry());
    expect(settings.issues).toEqual([]);
    expect(settings.method("spellbook-readiness.readiness")).toMatchObject({
      kind: "known",
      value: "book-contents-ready",
    });
    expect(settings.variable("containers.maxAccessibleDepth")).toMatchObject({
      kind: "known",
      value: 1,
    });
    expect(settings.variable("spellbook-readiness.bookCapacity")).toMatchObject(
      { kind: "known", value: 16 },
    );
  });

  test("a missing method or variable is a visible error and the selected ruleset is kept", () => {
    const broken: Ruleset = {
      ...vanillaPlus,
      methods: { "spellbook-readiness.readiness": "renamed-method" },
      variables: { "containers.oldName": 1 },
    };
    const settings = checkRuleset(broken, registry());
    expect(settings.ruleset).toBe(broken);
    expect(settings.issues.map((i) => i.code)).toEqual([
      "ruleset.unknown-method",
      "ruleset.unknown-variable",
    ]);
    expect(settings.method("spellbook-readiness.readiness").kind).toBe(
      "unresolved",
    );
  });

  test("unlimited is an explicit value, accepted only where allowed", () => {
    const unlimited = checkRuleset(
      {
        ...vanillaPlus,
        variables: { "containers.maxAccessibleDepth": "unlimited" },
      },
      registry(),
    );
    expect(unlimited.variable("containers.maxAccessibleDepth")).toMatchObject({
      kind: "known",
      value: "unlimited",
    });
    const wrong = checkRuleset(
      {
        ...vanillaPlus,
        variables: { "spellbook-readiness.bookCapacity": "unlimited" },
      },
      registry(),
    );
    expect(wrong.issues.map((i) => i.code)).toEqual(["ruleset.bad-variable"]);
    expect(wrong.variable("spellbook-readiness.bookCapacity").kind).toBe(
      "unresolved",
    );
  });

  test("a variable with no default that the ruleset leaves unset is unresolved, not guessed", () => {
    const settings = checkRuleset(
      { ...vanillaPlus, variables: {} },
      registry(),
    );
    expect(settings.variable("containers.maxAccessibleDepth").kind).toBe(
      "unresolved",
    );
  });

  test("missing game and system modules are reported", () => {
    const settings = checkRuleset(
      {
        ...vanillaPlus,
        game: "pathfinder",
        systems: ["containers", "ballistics"],
      },
      registry(),
    );
    expect(settings.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "ruleset.missing-game",
        "ruleset.missing-system",
      ]),
    );
    expect(settings.isEnabled("ballistics")).toBe(false);
  });
});
