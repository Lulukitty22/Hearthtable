// Grants: the one shape features, items and active effects use to change a character. A system
// that owns a value (abilities, skills, AC, resources …) reads the grants aimed at it, so every
// number can name each source. Systems publish grants by contributing a source function to
// `kernel.grantSources`; the kernel collects them once per resolution as `kernel.grants`.

import type { ResolveContext } from "./resolve";
import { fail, issue, ok, type Issue, type Result } from "./validation";
import { known, unresolved, type Value } from "./value";

/** A fixed number, or another resolved value such as `{ key: "proficiency.bonus" }`. */
export type Amount = number | { readonly key: string; readonly times?: number };

export type Grant =
  /** Adds to a numeric value, e.g. `abilities.int.score` +2 or `initiative` + proficiency. */
  | { readonly type: "bonus"; readonly target: string; readonly amount: Amount }
  /** Proficiency in a skill, save or tool: 1 proficient, 2 expertise. Sources do not stack. */
  | {
      readonly type: "proficiency";
      readonly target: string;
      readonly level: 1 | 2;
    }
  /** Something the character has or does not have, e.g. `extra-attack`. Having it twice is having it. */
  | { readonly type: "capability"; readonly id: string }
  /** A limited-use pool. Pools with the same name add their maximums together. */
  | {
      readonly type: "resource";
      readonly pool: string;
      readonly max: Amount;
      readonly reset: string;
    }
  /** A complete base formula for a value, e.g. Mage Armor's AC 13 + DEX. Bases never add together. */
  | {
      readonly type: "base";
      readonly target: string;
      readonly id: string;
      readonly label: string;
      readonly base: number;
      /** Resolved values added to `base`, e.g. `abilities.dex.modifier`. */
      readonly add: readonly string[];
    };

export interface GrantSourceInfo {
  /** The record or sheet line it came from. */
  readonly id: string;
  /** Shown in explanations, e.g. `War Caster` or `Wand of the War Mage +1`. */
  readonly label: string;
  /** Extra context, e.g. `while attuned and held`. */
  readonly note?: string;
  /** For bases: when the grant became active, so the newest active base is selected. */
  readonly activatedAt?: string;
}

export interface SourcedGrant {
  readonly grant: Grant;
  readonly source: GrantSourceInfo;
}

export type GrantSource = (ctx: ResolveContext) => readonly SourcedGrant[];

export const GRANTS_KEY = "kernel.grants";

/** All grants currently in effect, from every contributed source. */
export function allGrants(ctx: ResolveContext): readonly SourcedGrant[] {
  const value = ctx.get<readonly SourcedGrant[]>(GRANTS_KEY);
  return value.kind === "known" ? value.value : [];
}

export function grantsOf<T extends Grant["type"]>(
  ctx: ResolveContext,
  type: T,
  target?: string,
): readonly (SourcedGrant & { grant: Extract<Grant, { type: T }> })[] {
  return allGrants(ctx).filter(
    (g): g is SourcedGrant & { grant: Extract<Grant, { type: T }> } =>
      g.grant.type === type &&
      (target === undefined ||
        ("target" in g.grant && g.grant.target === target)),
  );
}

export function hasCapability(ctx: ResolveContext, id: string): boolean {
  return grantsOf(ctx, "capability").some((g) => g.grant.id === id);
}

/** Resolves an amount to a number, labelled with its source. */
export function amountValue(
  ctx: ResolveContext,
  amount: Amount,
  label: string,
  note?: string,
): Value<number> {
  const extra = note === undefined ? {} : { note };
  if (typeof amount === "number") return known(amount, label, extra);
  const v = ctx.get<number>(amount.key);
  if (v.kind === "unresolved") return unresolved(`${label}: ${v.reason}`);
  const times = amount.times ?? 1;
  return known(v.value * times, label, {
    ...extra,
    parts: [v.explain],
  });
}

/** Replaces `{name}` placeholders with the character's choices, e.g. `skills.{skill}`. */
export function applyChoices(
  grant: Grant,
  choices: Readonly<Record<string, string>>,
): Result<Grant> {
  const missing: Issue[] = [];
  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_, name: string) => {
      const chosen = choices[name];
      if (chosen === undefined) {
        missing.push(
          issue(
            "error",
            "grant.missing-choice",
            `Choice "${name}" is not made.`,
          ),
        );
        return `{${name}}`;
      }
      return chosen;
    });
  const filled: Grant =
    grant.type === "capability"
      ? { ...grant, id: fill(grant.id) }
      : grant.type === "resource"
        ? { ...grant, pool: fill(grant.pool) }
        : { ...grant, target: fill(grant.target) };
  return missing.length > 0 ? fail(missing) : ok(filled);
}

const isAmount = (v: unknown): v is Amount =>
  (typeof v === "number" && Number.isFinite(v)) ||
  (typeof v === "object" &&
    v !== null &&
    typeof (v as { key?: unknown }).key === "string" &&
    ((v as { times?: unknown }).times === undefined ||
      typeof (v as { times?: unknown }).times === "number"));

/** Reads a grant from stored data; anything malformed is an error, never a guess. */
export function parseGrant(input: unknown, path: string): Result<Grant> {
  const bad = (what: string) =>
    fail<Grant>([
      issue("error", "grant.invalid", `Grant at ${path}: ${what}.`, path),
    ]);
  if (typeof input !== "object" || input === null) return bad("not an object");
  const g = input as Record<string, unknown>;
  const str = (k: string) => typeof g[k] === "string" && g[k] !== "";
  switch (g["type"]) {
    case "bonus":
      return str("target") && isAmount(g["amount"])
        ? ok({
            type: "bonus",
            target: g["target"] as string,
            amount: g["amount"] as Amount,
          })
        : bad("bonus needs target and amount");
    case "proficiency":
      return str("target") && (g["level"] === 1 || g["level"] === 2)
        ? ok({
            type: "proficiency",
            target: g["target"] as string,
            level: g["level"],
          })
        : bad("proficiency needs target and level 1 or 2");
    case "capability":
      return str("id")
        ? ok({ type: "capability", id: g["id"] as string })
        : bad("capability needs id");
    case "resource":
      return str("pool") && isAmount(g["max"]) && str("reset")
        ? ok({
            type: "resource",
            pool: g["pool"] as string,
            max: g["max"] as Amount,
            reset: g["reset"] as string,
          })
        : bad("resource needs pool, max and reset");
    case "base":
      return str("target") &&
        str("id") &&
        str("label") &&
        typeof g["base"] === "number" &&
        Array.isArray(g["add"]) &&
        g["add"].every((a) => typeof a === "string")
        ? ok({
            type: "base",
            target: g["target"] as string,
            id: g["id"] as string,
            label: g["label"] as string,
            base: g["base"],
            add: g["add"] as string[],
          })
        : bad("base needs target, id, label, base and add");
    default:
      return bad(`unknown type ${JSON.stringify(g["type"])}`);
  }
}

/** Reads a list of grants, collecting every problem. */
export function parseGrants(
  input: unknown,
  path: string,
): Result<readonly Grant[]> {
  if (input === undefined) return ok([]);
  if (!Array.isArray(input))
    return fail([
      issue("error", "grant.invalid", `${path} must be a list.`, path),
    ]);
  const out: Grant[] = [];
  const issues: Issue[] = [];
  input.forEach((g, i) => {
    const r = parseGrant(g, `${path}[${i}]`);
    if (r.ok) out.push(r.value);
    else issues.push(...r.issues);
  });
  return issues.length > 0 ? fail(issues) : ok(out);
}
