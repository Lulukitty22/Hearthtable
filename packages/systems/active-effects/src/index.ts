// Which effects are currently active on the character, and the grants they give while active.
// Owning or knowing a spell never activates it: only an entry in the character's active effects
// does. Each entry points at a definition whose `whileActive` grants apply, such as Mage Armor's
// AC base or Shield's +5. Repeated activations of the same definition do not stack; the newest
// one counts.
//
// Game time (Milestone 5 S4; Spell Effects and Active State, "Exact timing within a round"): an
// entry may record the moment it began (`startedAt`) and when it ends (`endsAt`), as game
// moments. The app supplies the campaign's current moment as a `game-time` record; once that
// moment reaches `endsAt` the effect has ended and gives nothing, even before the entry is
// cleared. Without a game time (a character outside any campaign) nothing ends on its own.
// A condition that breaks Concentration (Incapacitated, or one that includes it) ends every
// effect that needs concentration at once (Milestone 5 S5); the DM's view then clears them.

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
import { isOver } from "@hearthtable/play";
import { z } from "zod";

const Moment = z.object({ clock: z.number(), step: z.number() });

const ActiveEntry = z.looseObject({
  id: z.string(),
  ref: z.string(),
  activatedAt: z.string(),
  startedAt: Moment.optional(),
  endsAt: Moment.optional(),
});

/** The campaign's current game moment, when the character is in one. */
export const GAME_TIME_KIND = "game-time";

const EffectDefinition = z.looseObject({
  name: z.string(),
  whileActive: z.unknown().optional(),
  concentration: z.boolean().optional(),
});

export interface ActiveEffectRow {
  readonly id: string;
  readonly ref: string;
  readonly name: string;
  readonly activatedAt: string;
  readonly startedAt?: z.infer<typeof Moment>;
  readonly endsAt?: z.infer<typeof Moment>;
  /** `ended`: its time is up (the entry is cleared later). */
  readonly status: "active" | "duplicate" | "unresolved" | "ended";
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
  const now = readField(ctx, GAME_TIME_KIND, "now", Moment.optional())[0]
    ?.value;
  const ended = (e: z.infer<typeof ActiveEntry>) => isOver(e.endsAt, now);
  // Read only when the conditions system is there; it never reads active effects back.
  const broken = ctx.get<boolean>("conditions.incapacitated");
  const concentrationBroken =
    broken.kind === "known" && broken.value ? broken.explain.label : undefined;
  const newest = new Map<string, string>();
  for (const e of entries.filter((x) => !ended(x))) {
    const seen = newest.get(e.ref);
    if (seen === undefined || Date.parse(e.activatedAt) > Date.parse(seen))
      newest.set(e.ref, e.activatedAt);
  }
  return entries.map((e): ActiveEffectRow => {
    const base = {
      id: e.id,
      ref: e.ref,
      activatedAt: e.activatedAt,
      ...(e.startedAt ? { startedAt: e.startedAt } : {}),
      ...(e.endsAt ? { endsAt: e.endsAt } : {}),
    };
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
    if (ended(e))
      return {
        ...base,
        name,
        status: "ended",
        reason: "Its time is up.",
        grants: [],
      };
    if (concentrationBroken && def.value.concentration === true)
      return {
        ...base,
        name,
        status: "ended",
        reason: `Concentration broken (${concentrationBroken}).`,
        grants: [],
      };
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
