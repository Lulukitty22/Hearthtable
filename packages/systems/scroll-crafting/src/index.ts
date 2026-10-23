// Scroll scribing and mounting costs (Spell Containers and Consumable Sources). The game module
// supplies the published scribing baseline through `scroll-crafting.baseline`: materials and
// eight-hour workdays by spell level. The ruleset picks how skill changes cost and time:
//
// - `arcana-power` (Vanilla+): M = 3^((5 − A)/5), where A is the total Arcana modifier. Scribing
//   materials and workdays are multiplied by the scribe's M; mounting and removal (50 gp and two
//   hours per spell level, cantrips 25 gp and one hour, half a level) by the operator's M. Values keep full
//   precision; rounding for display is still open.
// - `published`: no multiplier, and mounting is not a rule, so mounting values are unresolved.
//
// Eligibility to scribe: proficiency in Arcana or in Calligrapher's Supplies. This system only
// calculates and explains; running a crafting job and debiting materials come later.

import {
  DERIVATIONS_POINT,
  grantsOf,
  known,
  unresolved,
  type Derivation,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";

export const BASELINE_POINT = "scroll-crafting.baseline";

export interface ScribingBaseline {
  /** 0 for cantrips. */
  readonly level: number;
  readonly materialsGp: number;
  readonly workdays: number;
}

export interface ScribingCost {
  readonly level: number;
  readonly materialsGp: Value<number>;
  readonly workdays: Value<number>;
}

export interface MountingCost {
  readonly level: number;
  readonly feeGp: Value<number>;
  readonly hours: Value<number>;
}

function baseline(ctx: ResolveContext): readonly ScribingBaseline[] {
  return ctx.registry
    .contributions<readonly ScribingBaseline[]>(BASELINE_POINT)
    .flat()
    .sort((a, b) => a.level - b.level);
}

const levelName = (level: number) =>
  level === 0 ? "Cantrip" : `Level ${level}`;

function scaled(
  label: string,
  base: number,
  unit: string,
  m: Value<number>,
): Value<number> {
  if (m.kind === "unresolved") return m;
  return known(base * m.value, label, {
    parts: [{ label: "baseline", value: `${base} ${unit}` }, m.explain],
  });
}

const derivations: Derivation[] = [
  {
    key: "scroll-crafting.multiplier",
    compute: (ctx) => {
      const method = ctx.settings.method("scroll-crafting.multiplier");
      if (method.kind === "unresolved") return method;
      if (method.value === "published")
        return known(1, "Multiplier", {
          note: "published: no skill multiplier",
        });
      const arcana = ctx.get<number>("skills.arcana.total");
      if (arcana.kind === "unresolved") return arcana;
      const m = 3 ** ((5 - arcana.value) / 5);
      return known(m, "Arcana multiplier", {
        note: `3^((5 − ${arcana.value})/5)`,
        parts: [arcana.explain],
      });
    },
  },
  {
    key: "scroll-crafting.eligible",
    compute: (ctx) => {
      const sources = grantsOf(ctx, "proficiency").filter(
        (g) =>
          g.grant.level > 0 &&
          (g.grant.target === "skills.arcana" ||
            g.grant.target === "tools.calligraphers-supplies"),
      );
      return sources.length > 0
        ? known(true, "Can scribe scrolls", {
            note: `proficient: ${[...new Set(sources.map((s) => s.source.label))].join(", ")}`,
          })
        : known(false, "Can scribe scrolls", {
            note: "needs Arcana or Calligrapher's Supplies proficiency",
          });
    },
  },
  {
    key: "scroll-crafting.scribing",
    compute: (ctx) => {
      const rows = baseline(ctx);
      if (rows.length === 0)
        return unresolved("The game supplies no scribing baseline.");
      const m = ctx.get<number>("scroll-crafting.multiplier");
      return known(
        rows.map((b): ScribingCost => ({
          level: b.level,
          materialsGp: scaled(
            `${levelName(b.level)} scroll materials (gp)`,
            b.materialsGp,
            "gp",
            m,
          ),
          workdays: scaled(
            `${levelName(b.level)} scroll workdays`,
            b.workdays,
            "workdays",
            m,
          ),
        })),
        "Scribing costs",
      );
    },
  },
  {
    key: "scroll-crafting.mounting",
    compute: (ctx) => {
      const method = ctx.settings.method("scroll-crafting.multiplier");
      if (method.kind === "unresolved") return method;
      if (method.value === "published")
        return unresolved("Mounting scrolls is not a rule in this ruleset.");
      const m = ctx.get<number>("scroll-crafting.multiplier");
      const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      return known(
        levels.map((level): MountingCost => ({
          level,
          feeGp: scaled(
            `${levelName(level)} mounting fee (gp)`,
            level === 0 ? 25 : 50 * level,
            "gp",
            m,
          ),
          hours: scaled(
            `${levelName(level)} mounting hours`,
            level === 0 ? 1 : 2 * level,
            "hours",
            m,
          ),
        })),
        "Mounting and removal costs",
        { note: "same schedule for removal, binders and Spellrounds" },
      );
    },
  },
];

export const scrollCrafting: KernelModule = {
  manifest: {
    id: "scroll-crafting",
    version: "1.0.0",
    requires: [{ id: "skills-and-saves", range: "^1.0.0" }],
    extends: [DERIVATIONS_POINT],
    provides: {
      extensionPoints: [BASELINE_POINT],
      methods: [{ slot: "multiplier", options: ["arcana-power", "published"] }],
    },
  },
  setup: (ctx) => derivations.forEach((d) => ctx.extend(DERIVATIONS_POINT, d)),
};
