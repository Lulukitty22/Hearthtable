// Conditions (Turns, Encounters and Time, "Conditions" and "Hit points, damage and going down";
// Milestone 5 S5). A condition is a definition (`core/Conditions/<Name>`, with its SRD text) and
// an entry on the character (`data.conditions`): which condition, its Exhaustion level, the
// effect that caused it, when it ends on the game clock, and a repeat save to remind about.
//
// Each definition declares what the app automates, as data: the conditions it includes
// (Unconscious includes Incapacitated and Prone), grants while it applies (Exhaustion's penalty
// to every D20 Test, automatically failed Strength and Dexterity saves), and whether it breaks
// Concentration. Everything else in its text is shown and applied by hand. Adding a condition
// is adding a definition; nothing here names one, except the derived ones below.
//
// Derived conditions: a character at 0 hit points or below is Unconscious (in Hearthtable
// Vanilla+ until it has 1 or more again). With the `negative-hit-points` method, Exhaustion level
// 6 is also Unconscious instead of death (user decision, 2026-10-24); the `death-saves` method
// keeps the 2024 rule and only reports it.
//
// A condition ends when its source effect is no longer on the character, when the game moment
// reaches its end, or when it is removed. The rules only warn: acting while Incapacitated is
// shown, never refused.

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

const Entry = z.looseObject({
  id: z.string(),
  ref: z.string(),
  level: z.number().int().min(1).optional(),
  /** The active effect that applied it; it ends with that effect. */
  source: z.string().optional(),
  endsAt: Moment.optional(),
  /** A repeat save, shown as a reminder at the end of the character's turns. */
  save: z.object({ ability: z.string(), dc: z.number().int() }).optional(),
  note: z.string().optional(),
});

const Definition = z.looseObject({
  name: z.string(),
  includes: z.array(z.string()).optional(),
  whileApplied: z.unknown().optional(),
  breaksConcentration: z.boolean().optional(),
  levels: z.boolean().optional(),
  srd: z.looseObject({ text: z.array(z.string()) }).optional(),
});

export const UNCONSCIOUS = "core/Conditions/Unconscious";
export const EXHAUSTION = "core/Conditions/Exhaustion";

export interface ConditionRow {
  /** The entry's id, or for a derived or included condition, where it came from. */
  readonly id: string;
  readonly ref: string;
  readonly name: string;
  /** Applied to the character, included by another condition, or from going down. */
  readonly origin: "applied" | "included" | "down";
  /** For included and derived conditions: why, e.g. "Unconscious" or "0 hit points". */
  readonly because?: string;
  readonly level?: number;
  readonly endsAt?: z.infer<typeof Moment>;
  readonly save?: { readonly ability: string; readonly dc: number };
  readonly note?: string;
  /** The active effect that applied it, when one did. */
  readonly source?: string;
  readonly breaksConcentration: boolean;
  /** The SRD rules text, shown for everything applied by hand. */
  readonly text: readonly string[];
}

type Def = z.infer<typeof Definition>;

function definition(ctx: ResolveContext, ref: string): Def | undefined {
  const record = ctx.record(ref);
  if (!record) return undefined;
  const d = readDefinition(ctx, ref, record.kind, Definition);
  return d.ok ? d.value : undefined;
}

function list(ctx: ResolveContext): readonly ConditionRow[] {
  const entries = readField(
    ctx,
    "character",
    "conditions",
    z.array(Entry).optional(),
  ).flatMap((f) => f.value ?? []);
  const now = readField(ctx, "game-time", "now", Moment.optional())[0]?.value;
  // Effects still on the character (read directly, so this never depends on active effects).
  const effects = new Set(
    readField(
      ctx,
      "character",
      "activeEffects",
      z
        .array(z.looseObject({ id: z.string(), endsAt: Moment.optional() }))
        .optional(),
    )
      .flatMap((f) => f.value ?? [])
      .filter((e) => !isOver(e.endsAt, now))
      .map((e) => e.id),
  );

  const rows: ConditionRow[] = [];
  const seen = new Set<string>();
  const add = (
    ref: string,
    origin: ConditionRow["origin"],
    extra: Partial<ConditionRow> & { id: string },
  ) => {
    if (seen.has(ref)) return;
    const def = definition(ctx, ref);
    if (!def) {
      ctx.report(
        issue(
          "error",
          "conditions.unresolved",
          `Condition not found: ${ref}`,
          extra.id,
        ),
      );
      return;
    }
    seen.add(ref);
    rows.push({
      ref,
      name: def.name,
      origin,
      breaksConcentration: def.breaksConcentration === true,
      text: def.srd?.text ?? [],
      ...extra,
    });
    for (const inner of def.includes ?? [])
      add(inner, "included", { id: `${extra.id}:${inner}`, because: def.name });
  };

  const live = entries.filter(
    (e) => !isOver(e.endsAt, now) && (!e.source || effects.has(e.source)),
  );
  // Exhaustion levels add up across entries.
  const exhaustion = live
    .filter((e) => e.ref === EXHAUSTION)
    .reduce((n, e) => n + (e.level ?? 1), 0);
  for (const e of live) {
    if (e.ref === EXHAUSTION && seen.has(EXHAUSTION)) continue;
    add(e.ref, "applied", {
      id: e.id,
      ...(e.ref === EXHAUSTION ? { level: exhaustion } : {}),
      ...(e.endsAt ? { endsAt: e.endsAt } : {}),
      ...(e.save ? { save: e.save } : {}),
      ...(e.note ? { note: e.note } : {}),
      ...(e.source ? { source: e.source } : {}),
    });
  }

  const hp = readField(
    ctx,
    "character",
    "hitPoints",
    z.looseObject({ current: z.number() }).optional(),
  )[0]?.value;
  if (hp && hp.current <= 0)
    add(UNCONSCIOUS, "down", {
      id: "down:hit-points",
      because: `${hp.current} hit points`,
    });
  if (exhaustion >= 6) {
    const method = ctx.settings.method("conditions.goingDown");
    if (method.kind === "known" && method.value === "negative-hit-points")
      add(UNCONSCIOUS, "down", {
        id: "down:exhaustion",
        because: "Exhaustion level 6",
      });
    else
      ctx.report(
        issue(
          "warning",
          "conditions.exhaustion-death",
          "Exhaustion level 6: by the 2024 rules the character dies.",
          "conditions",
        ),
      );
  }
  return rows;
}

const source: GrantSource = (ctx) => {
  const rows = ctx.get<readonly ConditionRow[]>("conditions.list");
  if (rows.kind !== "known") return [];
  return rows.value.flatMap((row): SourcedGrant[] => {
    const def = definition(ctx, row.ref);
    if (def?.whileApplied === undefined) return [];
    const grants = parseGrants(def.whileApplied, `${row.ref}.whileApplied`);
    if (!grants.ok) {
      grants.issues.forEach((i) => ctx.report(i));
      return [];
    }
    return grants.value.map((grant) => ({
      grant,
      source: { id: row.id, label: row.name, note: "condition" },
    }));
  });
};

export const conditions: KernelModule = {
  manifest: {
    id: "conditions",
    version: "1.0.0",
    requires: [],
    extends: [DERIVATIONS_POINT, GRANT_SOURCES_POINT],
    provides: {
      methods: [
        {
          slot: "goingDown",
          options: ["negative-hit-points", "death-saves"],
          default: "death-saves",
        },
      ],
    },
  },
  setup: (ctx) => {
    ctx.extend(DERIVATIONS_POINT, {
      key: "conditions.list",
      compute: (rc: ResolveContext) => known(list(rc), "Conditions"),
    });
    ctx.extend(DERIVATIONS_POINT, {
      key: "conditions.exhaustion.level",
      compute: (rc: ResolveContext) => {
        const rows = rc.get<readonly ConditionRow[]>("conditions.list");
        if (rows.kind === "unresolved") return rows;
        const level = rows.value.find((r) => r.ref === EXHAUSTION)?.level ?? 0;
        return known(level, "Exhaustion level");
      },
    });
    ctx.extend(DERIVATIONS_POINT, {
      key: "conditions.incapacitated",
      compute: (rc: ResolveContext) => {
        const rows = rc.get<readonly ConditionRow[]>("conditions.list");
        if (rows.kind === "unresolved") return rows;
        const why = rows.value.find((r) => r.breaksConcentration);
        return known(!!why, why ? why.name : "Not incapacitated");
      },
    });
    ctx.extend(GRANT_SOURCES_POINT, source);
  },
};
