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
    // Hit Point Dice by size: one per level, less those spent (Milestone 5 S5). A Short Rest
    // spends them; a Long Rest restores them all.
    key: "hit-points.dice",
    compute: (ctx) => {
      const dice = ctx.get<readonly HitDieLevel[]>("character.hitDice");
      if (dice.kind === "unresolved") return dice;
      const spent =
        readField(ctx, "character", "hitPointDice", SpentDice.optional())[0]
          ?.value?.spent ?? {};
      const sizes = new Map<number, number>();
      for (const d of dice.value) sizes.set(d.die, (sizes.get(d.die) ?? 0) + 1);
      return known(
        [...sizes]
          .sort(([a], [b]) => b - a)
          .map(([die, total]): HitPointDice => {
            const used = Math.min(total, spent[String(die)] ?? 0);
            return { die, total, spent: used, remaining: total - used };
          }),
        "Hit Point Dice",
      );
    },
  },
  {
    // Damage defenses (Milestone 5 S7): capabilities named `resistance:<type>`,
    // `vulnerability:<type>` and `immunity:<type>`, where the type may be `all`, granted by
    // features, items, effects and conditions (Petrified: resistance to all damage).
    key: "hit-points.defenses",
    compute: (ctx) => {
      const ids = grantsOf(ctx, "capability").map((g) => g.grant.id);
      // A creature's own, such as a monster's stat block (S10).
      const own =
        readField(ctx, "character", "defenses", Defenses.optional())[0]
          ?.value ?? {};
      const of = (kind: string, list: readonly string[] = []) => [
        ...ids
          .filter((id) => id.startsWith(`${kind}:`))
          .map((id) => id.slice(kind.length + 1)),
        ...list,
      ];
      return known(
        {
          resistances: of("resistance", own.resistances),
          vulnerabilities: of("vulnerability", own.vulnerabilities),
          immunities: of("immunity", own.immunities),
        },
        "Damage defenses",
      );
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

const Defenses = z.looseObject({
  resistances: z.array(z.string()).optional(),
  vulnerabilities: z.array(z.string()).optional(),
  immunities: z.array(z.string()).optional(),
});

const SpentDice = z.looseObject({
  spent: z.record(z.string(), z.number().int().min(0)).optional(),
});

export interface HitPointDice {
  readonly die: number;
  readonly total: number;
  readonly spent: number;
  readonly remaining: number;
}

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
