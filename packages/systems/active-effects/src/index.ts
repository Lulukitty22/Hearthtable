// Which effects are currently active on the character, and the grants they give while active.
// Owning or knowing a spell never activates it: only an entry in the character's active effects
// does. Each entry points at a definition whose `whileActive` grants apply, such as Mage Armor's
// AC base or Shield's +5. Repeated activations of the same definition do not stack; the newest
// one counts. Milestone 2 has no game clock or expiry: entries stay until removed.

import {
  DERIVATIONS_POINT,
  GRANT_SOURCES_POINT,
  issue,
  known,
  parseGrants,
  readDefinition,
  readField,
  type GrantSource,
  type KernelModule,
  type ResolveContext,
  type SourcedGrant,
} from "@hearthtable/kernel";
import { z } from "zod";

const ActiveEntry = z.looseObject({
  id: z.string(),
  ref: z.string(),
  activatedAt: z.string(),
});

const EffectDefinition = z.looseObject({
  name: z.string(),
  whileActive: z.unknown().optional(),
});

export interface ActiveEffectRow {
  readonly id: string;
  readonly ref: string;
  readonly name: string;
  readonly activatedAt: string;
  readonly status: "active" | "duplicate" | "unresolved";
  readonly reason?: string;
  readonly grants: readonly SourcedGrant[];
}

function rows(ctx: ResolveContext): readonly ActiveEffectRow[] {
  const entries = readField(
    ctx,
    "character",
    "activeEffects",
    z.array(ActiveEntry).optional(),
  ).flatMap((f) => f.value ?? []);
  const newest = new Map<string, string>();
  for (const e of entries) {
    const seen = newest.get(e.ref);
    if (seen === undefined || Date.parse(e.activatedAt) > Date.parse(seen))
      newest.set(e.ref, e.activatedAt);
  }
  return entries.map((e): ActiveEffectRow => {
    const base = { id: e.id, ref: e.ref, activatedAt: e.activatedAt };
    // Definitions of any kind may carry `whileActive` (spells, items, features).
    const record = ctx.record(e.ref);
    const def = record
      ? readDefinition(ctx, e.ref, record.kind, EffectDefinition)
      : ({ ok: false, reason: `Reference not found: ${e.ref}` } as const);
    if (!def.ok) {
      ctx.report(issue("error", "active-effects.unresolved", def.reason, e.id));
      return {
        ...base,
        name: e.ref,
        status: "unresolved",
        reason: def.reason,
        grants: [],
      };
    }
    const name = def.value.name;
    if (newest.get(e.ref) !== e.activatedAt) {
      return {
        ...base,
        name,
        status: "duplicate",
        reason: `Another ${name} is active; repeats do not stack.`,
        grants: [],
      };
    }
    const grants = parseGrants(def.value.whileActive, `${e.ref}.whileActive`);
    if (!grants.ok) {
      grants.issues.forEach((i) => ctx.report(i));
      return {
        ...base,
        name,
        status: "unresolved",
        reason: grants.issues.map((i) => i.message).join("; "),
        grants: [],
      };
    }
    return {
      ...base,
      name,
      status: "active",
      grants: grants.value.map((grant) => ({
        grant,
        source: {
          id: e.id,
          label: name,
          note: "active",
          activatedAt: e.activatedAt,
        },
      })),
    };
  });
}

const source: GrantSource = (ctx) => {
  const list = ctx.get<readonly ActiveEffectRow[]>("active-effects.list");
  return list.kind === "known" ? list.value.flatMap((r) => r.grants) : [];
};

export const activeEffects: KernelModule = {
  manifest: {
    id: "active-effects",
    version: "1.0.0",
    requires: [],
    extends: [DERIVATIONS_POINT, GRANT_SOURCES_POINT],
    provides: {},
  },
  setup: (ctx) => {
    ctx.extend(DERIVATIONS_POINT, {
      key: "active-effects.list",
      compute: (rc: ResolveContext) => known(rows(rc), "Active effects"),
    });
    ctx.extend(GRANT_SOURCES_POINT, source);
  },
};
