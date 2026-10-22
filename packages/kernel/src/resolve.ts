// The resolved-state pipeline. It runs once per character and every view renders from its
// result, so the header, stats and tabs can never disagree. Systems contribute derivations to
// `kernel.derivations`; each computes one named value from records, settings and other values.
// Authored values win over derived ones until someone explicitly changes them.

import type { RecordEnvelope } from "./envelope";
import type { Registry } from "./registry";
import { DERIVATIONS_POINT } from "./registry";
import type { Settings } from "./ruleset";
import { issue, type Issue } from "./validation";
import { unresolved, type Explanation, type Value } from "./value";

export interface ResolveContext {
  readonly records: readonly RecordEnvelope[];
  readonly settings: Settings;
  get<T>(key: string): Value<T>;
}

export interface Derivation {
  /** The value's name, e.g. `armor-class.total`. */
  readonly key: string;
  compute(ctx: ResolveContext): Value<unknown>;
}

export interface AuthoredValue {
  readonly value: unknown;
  /** Where it was authored, e.g. `Stats tab: HP maximum`. */
  readonly label: string;
}

export interface ResolveInput {
  readonly records: readonly RecordEnvelope[];
  readonly settings: Settings;
  readonly registry: Registry;
  /** Values typed in by a person, keyed like derivations. */
  readonly authored?: ReadonlyMap<string, AuthoredValue>;
}

export interface ResolvedCharacter {
  readonly values: ReadonlyMap<string, Value<unknown>>;
  readonly issues: readonly Issue[];
  get<T>(key: string): Value<T>;
}

export function resolveCharacter(input: ResolveInput): ResolvedCharacter {
  const issues: Issue[] = [];
  const derivations = new Map<string, Derivation>();
  for (const d of input.registry.contributions<Derivation>(DERIVATIONS_POINT)) {
    if (derivations.has(d.key)) {
      issues.push(
        issue(
          "error",
          "resolve.duplicate-derivation",
          `Two derivations both compute "${d.key}".`,
          d.key,
        ),
      );
    } else {
      derivations.set(d.key, d);
    }
  }

  const values = new Map<string, Value<unknown>>();
  const inProgress = new Set<string>();

  const get = <T>(key: string): Value<T> => {
    const cached = values.get(key);
    if (cached) return cached as Value<T>;
    let result: Value<unknown>;
    const authored = input.authored?.get(key);
    if (authored) {
      const explain: Explanation = {
        label: authored.label,
        value: String(authored.value),
        note: "authored",
      };
      result = { kind: "known", value: authored.value, explain };
    } else if (inProgress.has(key)) {
      // Not cached: the outer computation of `key` records the real result.
      return unresolved(`${key} depends on itself.`);
    } else {
      const d = derivations.get(key);
      if (!d) {
        result = unresolved(`Nothing computes ${key}.`);
      } else {
        inProgress.add(key);
        try {
          result = d.compute(ctx);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          issues.push(
            issue(
              "error",
              "resolve.derivation-failed",
              `Computing ${key} failed: ${message}`,
              key,
            ),
          );
          result = unresolved(`Computing ${key} failed: ${message}`);
        } finally {
          inProgress.delete(key);
        }
      }
    }
    values.set(key, result);
    return result as Value<T>;
  };

  const ctx: ResolveContext = {
    records: input.records,
    settings: input.settings,
    get,
  };
  for (const key of derivations.keys()) get(key);
  for (const key of input.authored?.keys() ?? []) get(key);

  return {
    values,
    issues,
    get: <T>(key: string) =>
      (values.get(key) as Value<T> | undefined) ??
      unresolved(`Nothing computes ${key}.`),
  };
}
