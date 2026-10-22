// The resolved-state pipeline. It runs once per character and every view renders from its
// result, so the header, stats and tabs can never disagree. Systems contribute derivations to
// `kernel.derivations`; each computes one named value from records, settings and other values.
// Authored values win over derived ones until someone explicitly changes them.

import type { RecordEnvelope } from "./envelope";
import { GRANTS_KEY, type GrantSource } from "./grants";
import type { Registry } from "./registry";
import { DERIVATIONS_POINT, GRANT_SOURCES_POINT } from "./registry";
import type { Settings } from "./ruleset";
import { issue, type Issue } from "./validation";
import { unresolved, type Explanation, type Value } from "./value";

export interface ResolveContext {
  readonly records: readonly RecordEnvelope[];
  readonly settings: Settings;
  readonly registry: Registry;
  get<T>(key: string): Value<T>;
  /** A record by identity, or undefined when it is not loaded. */
  record(id: string): RecordEnvelope | undefined;
  /** Every loaded record of a kind, e.g. `character` or `inventory`. */
  ofKind(kind: string): readonly RecordEnvelope[];
  /** Adds a warning or error to the resolved character, e.g. an over-full container. */
  report(found: Issue): void;
}

export interface Derivation {
  /**
   * The value's name, e.g. `armor-class.total`. A `*` segment matches any one segment, so
   * `abilities.*.score` computes every ability; the matched segments are passed to `compute`.
   * Pattern values are computed when first read.
   */
  readonly key: string;
  compute(ctx: ResolveContext, wildcards: readonly string[]): Value<unknown>;
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
  const grantSources =
    input.registry.contributions<GrantSource>(GRANT_SOURCES_POINT);
  derivations.set(GRANTS_KEY, {
    key: GRANTS_KEY,
    compute: (ctx) => ({
      kind: "known",
      value: grantSources.flatMap((source) => source(ctx)),
      explain: { label: "Grants in effect" },
    }),
  });
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

  const patterns = [...derivations.values()].filter((d) =>
    d.key.split(".").includes("*"),
  );
  const find = (
    key: string,
  ): { d: Derivation; wildcards: string[] } | undefined => {
    const exact = derivations.get(key);
    if (exact && !patterns.includes(exact)) return { d: exact, wildcards: [] };
    const parts = key.split(".");
    for (const d of patterns) {
      const pattern = d.key.split(".");
      if (pattern.length !== parts.length) continue;
      const wildcards: string[] = [];
      if (
        pattern.every((p, i) => {
          if (p === "*") wildcards.push(parts[i] as string);
          return p === "*" || p === parts[i];
        })
      ) {
        return { d, wildcards };
      }
    }
    return undefined;
  };

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
      const found = find(key);
      if (!found) {
        result = unresolved(`Nothing computes ${key}.`);
      } else {
        inProgress.add(key);
        try {
          result = found.d.compute(ctx, found.wildcards);
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

  const byId = new Map(input.records.map((r) => [r.id as string, r]));
  const ctx: ResolveContext = {
    records: input.records,
    settings: input.settings,
    registry: input.registry,
    get,
    record: (id) => byId.get(id),
    ofKind: (kind) => input.records.filter((r) => r.kind === kind),
    report: (found) => issues.push(found),
  };
  for (const d of derivations.values()) if (!patterns.includes(d)) get(d.key);
  for (const key of input.authored?.keys() ?? []) get(key);

  return {
    values,
    issues,
    // Reading after resolution computes pattern values on demand, still once each.
    get,
  };
}
