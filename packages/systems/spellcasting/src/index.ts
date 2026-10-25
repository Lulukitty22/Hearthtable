// Spell slots, spell attack bonus, save DC and spell-tier access. The game module supplies each
// casting class through `character.casterClasses`. Under the `add-per-class` method (Vanilla+,
// Character Creation and Advancement) each class's own slot table row is summed into one shared
// pool that any eligible spell may use. Slot level never grants spell-tier access: access stays
// per class. Bonus grants aimed at `spellcasting.attack` or `spellcasting.dc` apply to every
// casting class, such as a held Wand of the War Mage.

import {
  DERIVATIONS_POINT,
  amountValue,
  d20TestBonuses,
  grantsOf,
  heldAmounts,
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

export interface CasterClass {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  /** Ability id used for attacks and DCs, e.g. `int`. */
  readonly ability: string;
  /** Slots by spell level at this class level; index 0 is level 1. */
  readonly slots: readonly number[];
  /** Highest spell level this class can cast at this class level. */
  readonly maxSpellLevel: number;
}

export interface SlotLevel {
  readonly level: number;
  readonly max: Value<number>;
  readonly expended: number;
  readonly available: Value<number>;
}

const SlotState = z.looseObject({
  // Below zero only after a rest while slots were held (see `spellcasting.slots`).
  expended: z.record(z.string(), z.number().int()).optional(),
});

function casters(ctx: ResolveContext): Value<readonly CasterClass[]> {
  return ctx.get<readonly CasterClass[]>("character.casterClasses");
}

function profile(
  ctx: ResolveContext,
  classId: string,
  what: "attack" | "dc",
): Value<number> {
  const list = casters(ctx);
  if (list.kind === "unresolved") return list;
  const c = list.value.find((x) => x.id === classId);
  if (!c)
    return unresolved(`${classId} is not a casting class of this character.`);
  const parts: Value<number>[] = [];
  if (what === "dc") parts.push(known(8, "base"));
  parts.push(
    ctx.get<number>(`abilities.${c.ability}.modifier`),
    ctx.get<number>("proficiency.bonus"),
  );
  for (const g of grantsOf(ctx, "bonus", `spellcasting.${what}`)) {
    parts.push(amountValue(ctx, g.grant.amount, g.source.label, g.source.note));
  }
  // A spell attack is a D20 Test; a save DC is not.
  if (what === "attack") parts.push(...d20TestBonuses(ctx));
  return sum(`${c.name} spell ${what === "dc" ? "save DC" : "attack"}`, parts);
}

const derivations: Derivation[] = [
  {
    key: "spellcasting.slots",
    compute: (ctx) => {
      const method = ctx.settings.method("spellcasting.combination");
      if (method.kind === "unresolved") return method;
      const list = casters(ctx);
      if (list.kind === "unresolved") return list;
      const expended =
        readField(ctx, "character", "spellcasting", SlotState.optional())[0]
          ?.value?.expended ?? {};
      // Slots held by queued requests count as used (Milestone 5 S6); a rest that restores the
      // sheet while a hold is out may leave `expended` below zero, and what is usable never
      // exceeds the maximum, so a hold returned later is discarded.
      const held = heldAmounts(ctx, "slots");
      const highest = Math.max(0, ...list.value.map((c) => c.slots.length));
      const levels: SlotLevel[] = [];
      for (let level = 1; level <= highest; level++) {
        const parts = list.value
          .filter((c) => (c.slots[level - 1] ?? 0) > 0)
          .map((c) =>
            known(c.slots[level - 1] as number, `${c.name} ${c.level}`),
          );
        const max = sum(`Level ${level} slots`, parts);
        const used = expended[String(level)] ?? 0;
        const hold = held[String(level)] ?? 0;
        const available: Value<number> =
          max.kind === "unresolved"
            ? max
            : known(
                Math.max(0, Math.min(max.value, max.value - used - hold)),
                `Level ${level} available`,
                {
                  note: `${Math.max(0, used)} expended${hold ? `, ${hold} held by requests` : ""}`,
                },
              );
        levels.push({ level, max, expended: used, available });
      }
      return known(levels, "Spell slots", { note: "added per class" });
    },
  },
  {
    key: "spellcasting.classes.*.attack",
    compute: (ctx, [id]) => profile(ctx, id as string, "attack"),
  },
  {
    key: "spellcasting.classes.*.dc",
    compute: (ctx, [id]) => profile(ctx, id as string, "dc"),
  },
  {
    key: "spellcasting.profiles",
    compute: (ctx) => {
      const list = casters(ctx);
      if (list.kind === "unresolved") return list;
      return known(
        list.value.map((c) => ({
          id: c.id,
          name: c.name,
          level: c.level,
          maxSpellLevel: c.maxSpellLevel,
          attack: ctx.get<number>(`spellcasting.classes.${c.id}.attack`),
          dc: ctx.get<number>(`spellcasting.classes.${c.id}.dc`),
        })),
        "Spellcasting",
      );
    },
  },
];

export const spellcasting: KernelModule = {
  manifest: {
    id: "spellcasting",
    version: "1.0.0",
    requires: [
      { id: "abilities", range: "^1.0.0" },
      { id: "proficiency", range: "^1.0.0" },
    ],
    extends: [DERIVATIONS_POINT],
    provides: {
      recordKinds: ["spell"],
      methods: [{ slot: "combination", options: ["add-per-class"] }],
    },
  },
  setup: (ctx) => derivations.forEach((d) => ctx.extend(DERIVATIONS_POINT, d)),
};
