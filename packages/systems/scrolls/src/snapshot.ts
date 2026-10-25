// The snapshot builder (Spell Containers and Consumable Sources, "Snapshot contents and casting
// provenance", selected 2026-10-24). When a scroll is scribed its numbers are fixed from the
// scribe: spell save DC and attack bonus from the best of the scribe's classes that list the spell,
// and one formula per damage or healing roll, built from the spell's structured `effect` facts at
// the scroll's level. What the scribe's features add arrives as `spell-formula` grants; the builder
// knows no feature by name. A bonus limited to a damage type the spell leaves to a choice stays
// conditional, since such choices are made when the scroll is used.

import type { SourcedGrant, SpellFormulaCondition } from "@hearthtable/kernel";
import { z } from "zod";

export interface FormulaBonus {
  readonly source: string;
  readonly value: number;
  /** Applies to one roll only, such as Empowered Evocation. */
  readonly once?: boolean;
  /** Applies only when the user picks this damage type. */
  readonly when?: { readonly damageType: string };
}

export interface SnapshotFormula {
  readonly role: "damage" | "healing";
  readonly dice: string;
  /** Damage type, or the choices as the spell words them. */
  readonly type?: string;
  /** How many of this roll, such as darts or rays, when the spell says. */
  readonly count?: number;
  readonly bonuses: readonly FormulaBonus[];
  /** Scaling the builder cannot express as dice, quoted from the spell. */
  readonly note?: string;
}

export interface ScrollSnapshot {
  /** The class whose numbers were used. */
  readonly casterClass?: string;
  readonly spellSaveDC?: number;
  readonly spellAttackBonus?: number;
  readonly formulas: readonly SnapshotFormula[];
}

export interface CasterProfile {
  readonly id: string;
  readonly name: string;
  readonly ability: string;
  readonly dc?: number;
  readonly attack?: number;
}

export interface SnapshotInput {
  readonly spell: Readonly<Record<string, unknown>>;
  readonly castLevel: number;
  readonly characterLevel: number;
  readonly casters: readonly CasterProfile[];
  readonly grants: readonly SourcedGrant[];
  /** A resolved number by key, such as `abilities.int.modifier`. */
  readonly number: (key: string) => number | undefined;
}

const Dice = z.string().regex(/^\d+d\d+$/);
const Effect = z.looseObject({
  damage: z
    .array(
      z.looseObject({
        dice: z.string(),
        type: z.string().optional(),
        count: z.number().optional(),
      }),
    )
    .optional(),
  healing: z
    .looseObject({ dice: z.string(), addsModifier: z.boolean().optional() })
    .optional(),
  scaling: z
    .looseObject({
      kind: z.enum(["slot", "cantrip"]),
      per: z.string().optional(),
      of: z.string().optional(),
      dice: z.array(z.string()).optional(),
      note: z.string().optional(),
    })
    .optional(),
});

/** Adds `times` of `per` to `dice`, joining like dice ("8d6" + 2×"1d6" = "10d6"). */
function addDice(dice: string, per: string, times: number): string {
  if (times <= 0) return dice;
  const a = Dice.safeParse(dice).success ? dice.split("d") : undefined;
  const b = per.split("d");
  if (a && Dice.safeParse(per).success && a[1] === b[1])
    return `${Number(a[0]) + Number(b[0]) * times}d${a[1]}`;
  return `${dice} + ${Number(b[0]) * times}d${b[1]}`;
}

function cantripTier(level: number): number {
  return level >= 17 ? 3 : level >= 11 ? 2 : level >= 5 ? 1 : 0;
}

/** Whether a declared condition holds, or holds only for one damage-type choice. */
function matches(
  when: SpellFormulaCondition | undefined,
  spell: Readonly<Record<string, unknown>>,
  casterClass: string | undefined,
  type: string | undefined,
): "yes" | "no" | "if-chosen" {
  if (!when) return "yes";
  if (when.school !== undefined && when.school !== spell["school"]) return "no";
  if (when.class !== undefined && when.class !== casterClass) return "no";
  if (when.damageType === undefined) return "yes";
  if (type === when.damageType) return "yes";
  return type?.split(/,\s*|\s+or\s+/).includes(when.damageType)
    ? "if-chosen"
    : "no";
}

export function buildSnapshot(input: SnapshotInput): ScrollSnapshot {
  const { spell, castLevel } = input;
  const listed = (spell["classes"] as readonly string[] | undefined) ?? [];
  // The best numbers among classes that list the spell; any caster class otherwise.
  const pool = input.casters.some((c) => listed.includes(c.id))
    ? input.casters.filter((c) => listed.includes(c.id))
    : input.casters;
  const caster = [...pool].sort((a, b) => (b.dc ?? 0) - (a.dc ?? 0))[0];
  const effect = Effect.safeParse(spell["effect"] ?? {}).data ?? {};
  const level = Number(spell["level"] ?? 0);
  const scaling = effect.scaling;

  const scaled = (role: "damage" | "healing", dice: string, first: boolean) => {
    if (!scaling || !first) return { dice };
    if (scaling.kind === "cantrip" && scaling.dice && scaling.of === undefined)
      return {
        dice: scaling.dice[cantripTier(input.characterLevel)] ?? dice,
      };
    if (scaling.kind === "slot" && scaling.per && scaling.of === role)
      return { dice: addDice(dice, scaling.per, castLevel - level) };
    return {};
  };
  const note =
    scaling?.note ??
    (scaling?.of && scaling.of !== "damage" && scaling.of !== "healing"
      ? `Scales with ${scaling.of}`
      : undefined);

  const bonusesFor = (
    role: "damage" | "healing",
    type: string | undefined,
  ): FormulaBonus[] =>
    input.grants.flatMap(({ grant, source }) => {
      if (grant.type !== "spell-formula" || grant.role !== role) return [];
      const fit = matches(grant.when, spell, caster?.id, type);
      if (fit === "no") return [];
      const value =
        typeof grant.amount === "number"
          ? grant.amount
          : (input.number(grant.amount.key) ?? 0) * (grant.amount.times ?? 1);
      return [
        {
          source: source.label,
          value,
          ...(grant.once ? { once: true } : {}),
          ...(fit === "if-chosen" && grant.when?.damageType
            ? { when: { damageType: grant.when.damageType } }
            : {}),
        },
      ];
    });

  const formulas: SnapshotFormula[] = [];
  (effect.damage ?? []).forEach((d, i) => {
    formulas.push({
      role: "damage",
      dice: d.dice,
      ...scaled("damage", d.dice, i === 0),
      ...(d.type ? { type: d.type } : {}),
      ...(d.count !== undefined ? { count: d.count } : {}),
      bonuses: bonusesFor("damage", d.type),
      ...(i === 0 && note ? { note } : {}),
    });
  });
  if (effect.healing) {
    const modifier = caster
      ? input.number(`abilities.${caster.ability}.modifier`)
      : undefined;
    formulas.push({
      role: "healing",
      dice: effect.healing.dice,
      ...scaled("healing", effect.healing.dice, true),
      bonuses: [
        ...(effect.healing.addsModifier && modifier !== undefined && caster
          ? [
              {
                source: `${caster.name} spellcasting modifier`,
                value: modifier,
              },
            ]
          : []),
        ...bonusesFor("healing", undefined),
      ],
    });
  }
  return {
    ...(caster ? { casterClass: caster.id } : {}),
    ...(caster?.dc !== undefined ? { spellSaveDC: caster.dc } : {}),
    ...(caster?.attack !== undefined
      ? { spellAttackBonus: caster.attack }
      : {}),
    formulas,
  };
}
