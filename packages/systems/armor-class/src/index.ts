// Armor Class: one selected base formula plus every applicable augment (Spell Effects and Active
// State). Bases come from the game module's defaults (`armor-class.defaultBases`, such as
// unarmored 10 + DEX) and from `base` grants aimed at `armor-class`, such as an active Mage
// Armor. Two bases never add together. Augments are `bonus` grants aimed at `armor-class`.
//
// Selection (user decision, 2026-10-22): when a base-granting effect becomes active its formula
// becomes the selected base; the player can switch back. So the newest of the player's own
// choice and the activation times of available bases wins. With neither, the first default base
// is used. A choice whose base is no longer available is ignored.

import {
  DERIVATIONS_POINT,
  amountValue,
  grantsOf,
  known,
  readField,
  sum,
  unresolved,
  type Derivation,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";
import { z } from "zod";

export const DEFAULT_BASES_POINT = "armor-class.defaultBases";

export interface BaseFormula {
  readonly id: string;
  readonly label: string;
  readonly base: number;
  /** Resolved values added to `base`, e.g. `abilities.dex.modifier`. */
  readonly add: readonly string[];
}

interface AvailableBase extends BaseFormula {
  readonly source: string;
  readonly activatedAt?: string;
}

const Selection = z.looseObject({
  selected: z.object({ base: z.string(), at: z.string() }).optional(),
});

function available(ctx: ResolveContext): readonly AvailableBase[] {
  const defaults = ctx.registry
    .contributions<readonly BaseFormula[]>(DEFAULT_BASES_POINT)
    .flat()
    .map((b): AvailableBase => ({ ...b, source: "default" }));
  const granted = grantsOf(ctx, "base", "armor-class").map(
    (g): AvailableBase => ({
      id: g.grant.id,
      label: g.grant.label,
      base: g.grant.base,
      add: g.grant.add,
      source: g.source.label,
      ...(g.source.activatedAt === undefined
        ? {}
        : { activatedAt: g.source.activatedAt }),
    }),
  );
  return [...defaults, ...granted];
}

function formulaValue(ctx: ResolveContext, b: BaseFormula): Value<number> {
  return sum(b.label, [
    known(b.base, "base"),
    ...b.add.map((key) => ctx.get<number>(key)),
  ]);
}

const derivations: Derivation[] = [
  {
    key: "armor-class.bases",
    compute: (ctx) =>
      known(
        available(ctx).map((b) => ({ ...b, value: formulaValue(ctx, b) })),
        "Available AC bases",
      ),
  },
  {
    key: "armor-class.selectedBase",
    compute: (ctx): Value<AvailableBase> => {
      const bases = available(ctx);
      if (bases.length === 0)
        return unresolved("No AC base formula is available.");
      const choice = readField(ctx, "character", "armorClass", Selection)[0]
        ?.value.selected;
      const candidates: { base: AvailableBase; at: string; why: string }[] = [];
      const chosen = choice && bases.find((b) => b.id === choice.base);
      if (choice && chosen)
        candidates.push({
          base: chosen,
          at: choice.at,
          why: "selected by player",
        });
      for (const b of bases) {
        if (b.activatedAt !== undefined) {
          candidates.push({
            base: b,
            at: b.activatedAt,
            why: `selected when ${b.source} became active`,
          });
        }
      }
      candidates.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      const winner = candidates[0];
      if (winner)
        return known(winner.base, winner.base.label, { note: winner.why });
      const fallback =
        bases.find((b) => b.source === "default") ??
        (bases[0] as AvailableBase);
      return known(fallback, fallback.label, { note: "default base" });
    },
  },
  {
    key: "armor-class.total",
    compute: (ctx) => {
      const selected = ctx.get<AvailableBase>("armor-class.selectedBase");
      if (selected.kind === "unresolved") return selected;
      const base = formulaValue(ctx, selected.value);
      const augments = grantsOf(ctx, "bonus", "armor-class").map((g) =>
        amountValue(ctx, g.grant.amount, g.source.label, g.source.note),
      );
      return sum("AC", [base, ...augments]);
    },
  },
];

export const armorClass: KernelModule = {
  manifest: {
    id: "armor-class",
    version: "1.0.0",
    requires: [],
    extends: [DERIVATIONS_POINT],
    provides: { extensionPoints: [DEFAULT_BASES_POINT] },
  },
  setup: (ctx) => derivations.forEach((d) => ctx.extend(DERIVATIONS_POINT, d)),
};
