// The D&D 2024 game module: its vocabulary (abilities, skills, the unarmored AC base), class
// records, and the values other systems read about class levels. The character records the full
// order of levels taken; the first class sets starting saving throws and level-1 HP
// (Character Creation and Advancement). No single class goes above 20; the total-level cap is
// the `maxLevel` variable, which Vanilla+ sets to `unlimited`. Exceeding a cap warns.

import {
  ABILITIES_LIST_POINT,
  type AbilityDefinition,
} from "@hearthtable/system-abilities";
import {
  DEFAULT_BASES_POINT,
  type BaseFormula,
} from "@hearthtable/system-armor-class";
import type { HitDieLevel } from "@hearthtable/system-hit-points";
import {
  SKILLS_POINT,
  type SkillDefinition,
} from "@hearthtable/system-skills-and-saves";
import type { CasterClass } from "@hearthtable/system-spellcasting";
import {
  DERIVATIONS_POINT,
  GRANT_SOURCES_POINT,
  issue,
  known,
  readDefinition,
  readField,
  unresolved,
  type Derivation,
  type GrantSource,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";
import { z } from "zod";

export { artificer, classRecords, wizard, type ClassData } from "./classes";

export const ABILITIES: readonly AbilityDefinition[] = [
  { id: "str", label: "STR" },
  { id: "dex", label: "DEX" },
  { id: "con", label: "CON" },
  { id: "int", label: "INT" },
  { id: "wis", label: "WIS" },
  { id: "cha", label: "CHA" },
];

export const SKILLS: readonly SkillDefinition[] = [
  { id: "acrobatics", label: "Acrobatics", ability: "dex" },
  { id: "animal-handling", label: "Animal Handling", ability: "wis" },
  { id: "arcana", label: "Arcana", ability: "int" },
  { id: "athletics", label: "Athletics", ability: "str" },
  { id: "deception", label: "Deception", ability: "cha" },
  { id: "history", label: "History", ability: "int" },
  { id: "insight", label: "Insight", ability: "wis" },
  { id: "intimidation", label: "Intimidation", ability: "cha" },
  { id: "investigation", label: "Investigation", ability: "int" },
  { id: "medicine", label: "Medicine", ability: "wis" },
  { id: "nature", label: "Nature", ability: "int" },
  { id: "perception", label: "Perception", ability: "wis" },
  { id: "performance", label: "Performance", ability: "cha" },
  { id: "persuasion", label: "Persuasion", ability: "cha" },
  { id: "religion", label: "Religion", ability: "int" },
  { id: "sleight-of-hand", label: "Sleight of Hand", ability: "dex" },
  { id: "stealth", label: "Stealth", ability: "dex" },
  { id: "survival", label: "Survival", ability: "wis" },
];

const UNARMORED: BaseFormula = {
  id: "unarmored",
  label: "Unarmored",
  base: 10,
  add: ["abilities.dex.modifier"],
};

const ClassDefinition = z.looseObject({
  name: z.string(),
  hitDie: z.number().int().min(1),
  savingThrows: z.array(z.string()),
  spellcasting: z
    .object({
      ability: z.string(),
      slots: z.array(z.array(z.number().int().min(0))).length(20),
      maxSpellLevel: z.array(z.number().int().min(0).max(9)).length(20),
    })
    .optional(),
});
type ClassDefinition = z.infer<typeof ClassDefinition>;

interface LevelRow {
  readonly classId: string;
  readonly definition: ClassDefinition;
}

const MAX_CLASS_LEVEL = 20;

function levelRows(ctx: ResolveContext): Value<readonly LevelRow[]> {
  const order = readField(
    ctx,
    "character",
    "classLevels",
    z.array(z.string()).min(1),
  )[0];
  if (!order) return unresolved("The order of class levels is not recorded.");
  const rows: LevelRow[] = [];
  for (const classId of order.value) {
    const def = readDefinition(ctx, classId, "class", ClassDefinition);
    if (!def.ok)
      return unresolved(`Class level ${rows.length + 1}: ${def.reason}`);
    rows.push({ classId, definition: def.value });
  }
  return known(rows, "Class levels");
}

interface ClassSummary {
  readonly id: string;
  readonly name: string;
  readonly level: number;
  readonly definition: ClassDefinition;
}

function summaries(rows: readonly LevelRow[]): readonly ClassSummary[] {
  const byClass = new Map<string, ClassSummary>();
  for (const r of rows) {
    const prev = byClass.get(r.classId);
    byClass.set(r.classId, {
      id: r.classId,
      name: r.definition.name,
      level: (prev?.level ?? 0) + 1,
      definition: r.definition,
    });
  }
  return [...byClass.values()];
}

const derivations: Derivation[] = [
  { key: "character.levelOrder", compute: levelRows },
  {
    key: "character.level",
    compute: (ctx) => {
      const rows = ctx.get<readonly LevelRow[]>("character.levelOrder");
      if (rows.kind === "unresolved") return rows;
      const total = rows.value.length;
      const cap = ctx.settings.variable<number | "unlimited">(
        "dnd5e-2024.maxLevel",
      );
      if (
        cap.kind === "known" &&
        cap.value !== "unlimited" &&
        total > cap.value
      ) {
        ctx.report(
          issue(
            "warning",
            "dnd5e.over-level-cap",
            `Total level ${total} is above this ruleset's cap of ${cap.value}.`,
            "classLevels",
          ),
        );
      }
      const classes = summaries(rows.value);
      return known(total, "Character level", {
        parts: classes.map((c) => ({ label: c.name, value: String(c.level) })),
      });
    },
  },
  {
    key: "character.classes",
    compute: (ctx) => {
      const rows = ctx.get<readonly LevelRow[]>("character.levelOrder");
      if (rows.kind === "unresolved") return rows;
      const classes = summaries(rows.value);
      for (const c of classes) {
        if (c.level > MAX_CLASS_LEVEL) {
          ctx.report(
            issue(
              "error",
              "dnd5e.class-above-20",
              `${c.name} ${c.level}: no class goes above level ${MAX_CLASS_LEVEL}.`,
              c.id,
            ),
          );
        }
      }
      return known(
        classes.map(({ id, name, level }) => ({ id, name, level })),
        "Classes",
        { note: rows.value[0] ? `${rows.value[0].definition.name} first` : "" },
      );
    },
  },
  {
    key: "character.hitDice",
    compute: (ctx) => {
      const rows = ctx.get<readonly LevelRow[]>("character.levelOrder");
      if (rows.kind === "unresolved") return rows;
      return known(
        rows.value.map((r): HitDieLevel => ({
          label: r.definition.name,
          die: r.definition.hitDie,
        })),
        "Hit dice",
      );
    },
  },
  {
    key: "character.casterClasses",
    compute: (ctx) => {
      const rows = ctx.get<readonly LevelRow[]>("character.levelOrder");
      if (rows.kind === "unresolved") return rows;
      const casters: CasterClass[] = [];
      for (const c of summaries(rows.value)) {
        const sc = c.definition.spellcasting;
        if (!sc) continue;
        const index = Math.min(c.level, MAX_CLASS_LEVEL) - 1;
        casters.push({
          id: c.id,
          name: c.name,
          level: c.level,
          ability: sc.ability,
          slots: sc.slots[index] ?? [],
          maxSpellLevel: sc.maxSpellLevel[index] ?? 0,
        });
      }
      return known(casters, "Casting classes");
    },
  },
];

/** Starting saving throws come from the first class only. */
const firstClassSaves: GrantSource = (ctx) => {
  const rows = ctx.get<readonly LevelRow[]>("character.levelOrder");
  const first = rows.kind === "known" ? rows.value[0] : undefined;
  if (!first) return [];
  return first.definition.savingThrows.map((ability) => ({
    grant: { type: "proficiency", target: `saves.${ability}`, level: 1 },
    source: {
      id: first.classId,
      label: `${first.definition.name} (first class)`,
    },
  }));
};

export const dnd5e2024: KernelModule = {
  manifest: {
    id: "dnd5e-2024",
    version: "1.0.0",
    requires: [
      { id: "abilities", range: "^1.0.0" },
      { id: "skills-and-saves", range: "^1.0.0" },
      { id: "armor-class", range: "^1.0.0" },
    ],
    extends: [
      DERIVATIONS_POINT,
      GRANT_SOURCES_POINT,
      ABILITIES_LIST_POINT,
      SKILLS_POINT,
      DEFAULT_BASES_POINT,
    ],
    provides: {
      recordKinds: ["character", "class"],
      ruleVariables: [
        {
          name: "maxLevel",
          type: "integer",
          allowUnlimited: true,
          default: 20,
        },
      ],
    },
  },
  setup: (ctx) => {
    ctx.extend(ABILITIES_LIST_POINT, ABILITIES);
    ctx.extend(SKILLS_POINT, SKILLS);
    ctx.extend(DEFAULT_BASES_POINT, [UNARMORED]);
    ctx.extend(GRANT_SOURCES_POINT, firstClassSaves);
    derivations.forEach((d) => ctx.extend(DERIVATIONS_POINT, d));
  },
};
