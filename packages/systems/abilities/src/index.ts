// Ability scores, modifiers and point buy. The game module supplies which abilities exist
// through `abilities.list`. A score is the character's purchased base plus every bonus grant
// aimed at it, so DM grant items and feats each show as their own line. Scores above 20 are
// allowed; a ruleset with an ordinary limit (`ordinaryMax`) marks scores above it, and nothing is clamped (Character Creation and
// Advancement owns the policy and the point-buy prices).

import {
  DERIVATIONS_POINT,
  amountValue,
  grantsOf,
  issue,
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

export const ABILITIES_LIST_POINT = "abilities.list";

export interface AbilityDefinition {
  readonly id: string;
  readonly label: string;
}

const AbilityBlock = z.looseObject({
  base: z.record(z.string(), z.number().int()),
});

/** Total cost of buying a score, starting from 8 at 0 points; undefined outside the method. */
export function pointBuyCost(
  score: number,
  method: string,
): number | undefined {
  if (!Number.isInteger(score)) return undefined;
  if (method === "published") {
    const table: Record<number, number> = {
      8: 0,
      9: 1,
      10: 2,
      11: 3,
      12: 4,
      13: 5,
      14: 7,
      15: 9,
    };
    return table[score];
  }
  if (method === "extended") {
    // Floor 5; each step below 8 refunds 1; 9–13 cost 1 each; from 14 the step cost starts at 2
    // and rises by 1 every two scores.
    if (score < 5) return undefined;
    if (score <= 13) return score - 8;
    let total = 5;
    for (let s = 14; s <= score; s++) total += 2 + Math.floor((s - 14) / 2);
    return total;
  }
  return undefined;
}

function abilityList(ctx: ResolveContext): readonly AbilityDefinition[] {
  return ctx.registry
    .contributions<readonly AbilityDefinition[]>(ABILITIES_LIST_POINT)
    .flat();
}

const derivations: Derivation[] = [
  {
    key: "abilities.base",
    compute: (ctx) => {
      const found = readField(ctx, "character", "abilities", AbilityBlock);
      const first = found[0];
      if (!first) return unresolved("No ability scores are recorded.");
      return known(first.value.base, "Purchased ability scores");
    },
  },
  {
    key: "abilities.*.score",
    compute: (ctx, [id]) => {
      const ability = abilityList(ctx).find((a) => a.id === id);
      if (!ability) return unresolved(`${id} is not an ability in this game.`);
      const base = ctx.get<Record<string, number>>("abilities.base");
      if (base.kind === "unresolved") return base;
      const purchased = base.value[ability.id];
      if (purchased === undefined) {
        return unresolved(`No purchased ${ability.label} score is recorded.`);
      }
      const bonuses = grantsOf(
        ctx,
        "bonus",
        `abilities.${ability.id}.score`,
      ).map((g) =>
        amountValue(ctx, g.grant.amount, g.source.label, g.source.note),
      );
      const total = sum(ability.label, [
        known(purchased, "point buy"),
        ...bonuses,
      ]);
      // Rulesets with an ordinary limit mark scores above it; nothing is ever clamped.
      const limit = ctx.settings.variable<number | "unlimited">(
        "abilities.ordinaryMax",
      );
      if (
        total.kind === "known" &&
        limit.kind === "known" &&
        limit.value !== "unlimited" &&
        total.value > limit.value
      ) {
        ctx.report(
          issue(
            "info",
            "abilities.above-ordinary-limit",
            `${ability.label} ${total.value} is above this ruleset's ordinary limit of ${limit.value}; allowed.`,
            `abilities.${ability.id}`,
          ),
        );
      }
      return total;
    },
  },
  {
    key: "abilities.*.modifier",
    compute: (ctx, [id]) => {
      const score = ctx.get<number>(`abilities.${id}.score`);
      if (score.kind === "unresolved") return score;
      const label =
        abilityList(ctx).find((a) => a.id === id)?.label ?? String(id);
      const value = Math.floor((score.value - 10) / 2);
      return known(value, label, {
        note: `from ${score.value}`,
        parts: [score.explain],
      });
    },
  },
  {
    key: "abilities.all",
    compute: (ctx) => {
      const list = abilityList(ctx);
      if (list.length === 0)
        return unresolved("The game defines no abilities.");
      const rows = list.map((a) => ({
        ...a,
        score: ctx.get<number>(`abilities.${a.id}.score`),
        modifier: ctx.get<number>(`abilities.${a.id}.modifier`),
      }));
      return known(rows, "Abilities");
    },
  },
  {
    key: "abilities.pointBuy",
    compute: (
      ctx,
    ): Value<{ spent: number; budget: number; deficit: number }> => {
      const base = ctx.get<Record<string, number>>("abilities.base");
      if (base.kind === "unresolved") return base;
      const method = ctx.settings.method("abilities.pointBuy");
      const budget = ctx.settings.variable<number>("abilities.pointBudget");
      if (method.kind === "unresolved") return method;
      if (budget.kind === "unresolved") return budget;
      let spent = 0;
      for (const a of abilityList(ctx)) {
        const score = base.value[a.id];
        const cost =
          score === undefined ? undefined : pointBuyCost(score, method.value);
        if (cost === undefined) {
          return unresolved(
            `${a.label} ${score ?? "(missing)"} has no point-buy price under "${method.value}".`,
          );
        }
        spent += cost;
      }
      const deficit = Math.max(0, spent - budget.value);
      if (deficit > 0) {
        ctx.report(
          issue(
            "warning",
            "abilities.over-budget",
            `Point buy spends ${spent} of ${budget.value} points: ${deficit} over budget.`,
            "abilities.pointBuy",
          ),
        );
      }
      return known({ spent, budget: budget.value, deficit }, "Point buy", {
        note: `${spent} of ${budget.value} points`,
      });
    },
  },
];

export const abilities: KernelModule = {
  manifest: {
    id: "abilities",
    version: "1.0.0",
    requires: [],
    extends: [DERIVATIONS_POINT],
    provides: {
      uiTabs: ["stats"],
      extensionPoints: [ABILITIES_LIST_POINT],
      methods: [{ slot: "pointBuy", options: ["published", "extended"] }],
      ruleVariables: [
        { name: "pointBudget", type: "integer" },
        { name: "ordinaryMax", type: "integer", allowUnlimited: true },
      ],
    },
  },
  setup: (ctx) => derivations.forEach((d) => ctx.extend(DERIVATIONS_POINT, d)),
};
