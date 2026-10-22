// Hit points. Maximum HP uses the `fixed-average` method (Vanilla+ decision, 2026-10-22): the
// first character level takes the die's maximum, every later level the published fixed value
// (half the die plus one), and every level adds the constitution-type ability modifier. Bonus
// grants aimed at `hit-points.max` add on top. A typed-in maximum overrides all of this through
// the kernel's authored values. The game module supplies `character.hitDice`.

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
  type Value,
} from "@hearthtable/kernel";
import { z } from "zod";

/** One entry per character level, in the order taken. */
export interface HitDieLevel {
  readonly label: string;
  readonly die: number;
}

const HitPointState = z.looseObject({
  current: z.number().int(),
  temporary: z.number().int().min(0).optional(),
});

const derivations: Derivation[] = [
  {
    key: "hit-points.max",
    compute: (ctx) => {
      const method = ctx.settings.method("hit-points.max");
      if (method.kind === "unresolved") return method;
      const dice = ctx.get<readonly HitDieLevel[]>("character.hitDice");
      if (dice.kind === "unresolved") return dice;
      const ability = ctx.settings.variable<string>("hit-points.ability");
      if (ability.kind === "unresolved") return ability;
      const first = dice.value[0];
      if (!first) return unresolved("The character has no levels.");
      const modifier = ctx.get<number>(`abilities.${ability.value}.modifier`);

      // Group later levels by class label for a readable explanation.
      const later = new Map<string, { die: number; count: number }>();
      for (const level of dice.value.slice(1)) {
        const key = `${level.label} d${level.die}`;
        const entry = later.get(key) ?? { die: level.die, count: 0 };
        later.set(key, { die: entry.die, count: entry.count + 1 });
      }
      const parts: Value<number>[] = [
        known(first.die, `${first.label} level 1 (d${first.die} maximum)`),
        ...[...later].map(([key, { die, count }]) =>
          known(count * (die / 2 + 1), `${key} ×${count} at ${die / 2 + 1}`),
        ),
        modifier.kind === "unresolved"
          ? modifier
          : known(
              modifier.value * dice.value.length,
              `${ability.value.toUpperCase()} ${modifier.value >= 0 ? "+" : ""}${modifier.value} ×${dice.value.length}`,
            ),
        ...grantsOf(ctx, "bonus", "hit-points.max").map((g) =>
          amountValue(ctx, g.grant.amount, g.source.label, g.source.note),
        ),
      ];
      return sum("HP maximum", parts);
    },
  },
  {
    key: "hit-points.state",
    compute: (ctx) => {
      const state = readField(ctx, "character", "hitPoints", HitPointState)[0];
      if (!state) return unresolved("Current HP is not recorded.");
      return known(
        { current: state.value.current, temporary: state.value.temporary ?? 0 },
        "Current HP",
      );
    },
  },
];

export const hitPoints: KernelModule = {
  manifest: {
    id: "hit-points",
    version: "1.0.0",
    requires: [{ id: "abilities", range: "^1.0.0" }],
    extends: [DERIVATIONS_POINT],
    provides: {
      methods: [{ slot: "max", options: ["fixed-average"] }],
      ruleVariables: [{ name: "ability", type: "string" }],
    },
  },
  setup: (ctx) => derivations.forEach((d) => ctx.extend(DERIVATIONS_POINT, d)),
};
