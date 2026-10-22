// Rulesets are data: which systems are on, which method each slot uses, and variable values.
// Loading one checks every name it uses against the registry. Anything missing or renamed is a
// visible error where that part runs; the campaign keeps the ruleset it selected, and nothing
// falls back to another ruleset or a guessed value.

import type { Registry, RuleValue, RuleVariable } from "./registry";
import { known, unresolved, type Value } from "./value";
import { issue, type Issue } from "./validation";

export interface Ruleset {
  readonly id: string;
  readonly title: string;
  /** The game module, e.g. `dnd5e-2024`. */
  readonly game: string;
  /** Enabled system module ids. */
  readonly systems: readonly string[];
  /** Method choices keyed `<moduleId>.<slot>`. */
  readonly methods: Readonly<Record<string, string>>;
  /** Variable values keyed `<moduleId>.<name>`. */
  readonly variables: Readonly<Record<string, RuleValue>>;
}

export interface Settings {
  readonly ruleset: Ruleset;
  readonly issues: readonly Issue[];
  isEnabled(moduleId: string): boolean;
  method(key: string): Value<string>;
  variable<T extends RuleValue = RuleValue>(key: string): Value<T>;
}

export function checkRuleset(ruleset: Ruleset, registry: Registry): Settings {
  const issues: Issue[] = [];
  const slots = new Map<
    string,
    { options: readonly string[]; default?: string }
  >();
  const vars = new Map<string, RuleVariable>();
  for (const [id, m] of registry.modules) {
    for (const s of m.provides.methods ?? []) slots.set(`${id}.${s.slot}`, s);
    for (const v of m.provides.ruleVariables ?? [])
      vars.set(`${id}.${v.name}`, v);
  }
  const enabled = new Set(ruleset.systems);
  const ownerOf = (key: string) => key.slice(0, key.indexOf("."));

  if (!registry.hasModule(ruleset.game)) {
    issues.push(
      issue(
        "error",
        "ruleset.missing-game",
        `Game module "${ruleset.game}" is not registered.`,
        "game",
      ),
    );
  }
  for (const id of ruleset.systems) {
    if (!registry.hasModule(id))
      issues.push(
        issue(
          "error",
          "ruleset.missing-system",
          `System "${id}" is not registered.`,
          `systems.${id}`,
        ),
      );
  }
  for (const [key, choice] of Object.entries(ruleset.methods)) {
    const slot = slots.get(key);
    if (!slot)
      issues.push(
        issue(
          "error",
          "ruleset.unknown-method-slot",
          `No system offers a method slot "${key}".`,
          `methods.${key}`,
        ),
      );
    else if (!slot.options.includes(choice)) {
      issues.push(
        issue(
          "error",
          "ruleset.unknown-method",
          `"${choice}" is not a method of "${key}" (${slot.options.join(", ")}).`,
          `methods.${key}`,
        ),
      );
    } else if (!enabled.has(ownerOf(key))) {
      issues.push(
        issue(
          "warning",
          "ruleset.method-for-disabled-system",
          `"${key}" is set but "${ownerOf(key)}" is not enabled.`,
          `methods.${key}`,
        ),
      );
    }
  }
  for (const [key, value] of Object.entries(ruleset.variables)) {
    const v = vars.get(key);
    if (!v)
      issues.push(
        issue(
          "error",
          "ruleset.unknown-variable",
          `No system offers a variable "${key}".`,
          `variables.${key}`,
        ),
      );
    else if (!fits(v, value)) {
      issues.push(
        issue(
          "error",
          "ruleset.bad-variable",
          `"${key}" must be ${describe(v)}; got ${JSON.stringify(value)}.`,
          `variables.${key}`,
        ),
      );
    }
  }

  const broken = new Set(
    issues.filter((i) => i.severity === "error").map((i) => i.path),
  );
  return {
    ruleset,
    issues,
    isEnabled: (id) => enabled.has(id) && registry.hasModule(id),
    method(key) {
      if (broken.has(`methods.${key}`))
        return unresolved(
          `Ruleset "${ruleset.title}" names an unavailable method for ${key}.`,
        );
      const slot = slots.get(key);
      if (!slot) return unresolved(`No system offers method slot ${key}.`);
      const choice = ruleset.methods[key] ?? slot.default;
      return choice === undefined
        ? unresolved(
            `Ruleset "${ruleset.title}" does not choose a method for ${key}.`,
          )
        : known(choice, key, {
            note:
              ruleset.methods[key] === undefined
                ? "system default"
                : `set by ${ruleset.title}`,
          });
    },
    variable<T extends RuleValue>(key: string): Value<T> {
      if (broken.has(`variables.${key}`))
        return unresolved(
          `Ruleset "${ruleset.title}" sets ${key} to an invalid value.`,
        );
      const v = vars.get(key);
      if (!v) return unresolved(`No system offers variable ${key}.`);
      const value = ruleset.variables[key] ?? v.default;
      return value === undefined
        ? unresolved(`Ruleset "${ruleset.title}" does not set ${key}.`)
        : known(value as T, key, {
            note:
              ruleset.variables[key] === undefined
                ? "system default"
                : `set by ${ruleset.title}`,
          });
    },
  };
}

function fits(v: RuleVariable, value: RuleValue): boolean {
  if (value === "unlimited") return v.allowUnlimited === true;
  switch (v.type) {
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
  }
}

function describe(v: RuleVariable): string {
  return v.allowUnlimited ? `${v.type} or "unlimited"` : `a ${v.type}`;
}
