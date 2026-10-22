// Skills, saving throws, tool proficiencies and initiative. The game module supplies the skill
// list (with each skill's ability) through `skills-and-saves.skills`; saves use the abilities
// list. A total is the ability modifier, plus proficiency bonus times the best proficiency level
// granted (1 proficient, 2 expertise; sources never stack), plus any bonus grants.

import {
  ABILITIES_LIST_POINT,
  type AbilityDefinition,
} from "@hearthtable/system-abilities";
import {
  DERIVATIONS_POINT,
  amountValue,
  grantsOf,
  known,
  sum,
  unresolved,
  type Derivation,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";

export const SKILLS_POINT = "skills-and-saves.skills";

export interface SkillDefinition {
  readonly id: string;
  readonly label: string;
  readonly ability: string;
}

function skillList(ctx: ResolveContext): readonly SkillDefinition[] {
  return ctx.registry
    .contributions<readonly SkillDefinition[]>(SKILLS_POINT)
    .flat();
}

function abilityList(ctx: ResolveContext): readonly AbilityDefinition[] {
  return ctx.registry
    .contributions<readonly AbilityDefinition[]>(ABILITIES_LIST_POINT)
    .flat();
}

/** Best proficiency level granted for `target`, with the sources that granted it. */
function proficiencyFor(ctx: ResolveContext, target: string) {
  const grants = grantsOf(ctx, "proficiency", target);
  const level = grants.reduce((best, g) => Math.max(best, g.grant.level), 0);
  return {
    level,
    sources: grants
      .filter((g) => g.grant.level === level)
      .map((g) => g.source.label),
  };
}

function check(
  ctx: ResolveContext,
  label: string,
  ability: string,
  target: string,
): Value<number> {
  const modifier = ctx.get<number>(`abilities.${ability}.modifier`);
  const { level, sources } = proficiencyFor(ctx, target);
  const parts: Value<number>[] = [modifier];
  if (level > 0) {
    const bonus = ctx.get<number>("proficiency.bonus");
    parts.push(
      bonus.kind === "unresolved"
        ? bonus
        : known(
            bonus.value * level,
            level === 2 ? "expertise" : "proficiency",
            {
              note: sources.join(", "),
            },
          ),
    );
  }
  for (const g of grantsOf(ctx, "bonus", target)) {
    parts.push(amountValue(ctx, g.grant.amount, g.source.label, g.source.note));
  }
  return sum(label, parts);
}

const derivations: Derivation[] = [
  {
    key: "skills.*.total",
    compute: (ctx, [id]) => {
      const skill = skillList(ctx).find((s) => s.id === id);
      if (!skill) return unresolved(`${id} is not a skill in this game.`);
      return check(ctx, skill.label, skill.ability, `skills.${skill.id}`);
    },
  },
  {
    key: "saves.*.total",
    compute: (ctx, [id]) => {
      const ability = abilityList(ctx).find((a) => a.id === id);
      if (!ability) return unresolved(`${id} is not an ability in this game.`);
      return check(
        ctx,
        `${ability.label} save`,
        ability.id,
        `saves.${ability.id}`,
      );
    },
  },
  {
    key: "skills.all",
    compute: (ctx) =>
      known(
        skillList(ctx).map((s) => ({
          ...s,
          proficiency: proficiencyFor(ctx, `skills.${s.id}`).level,
          total: ctx.get<number>(`skills.${s.id}.total`),
        })),
        "Skills",
      ),
  },
  {
    key: "saves.all",
    compute: (ctx) =>
      known(
        abilityList(ctx).map((a) => ({
          ...a,
          proficient: proficiencyFor(ctx, `saves.${a.id}`).level > 0,
          total: ctx.get<number>(`saves.${a.id}.total`),
        })),
        "Saving throws",
      ),
  },
  {
    key: "tools.proficiencies",
    compute: (ctx) => {
      const tools = new Map<string, string[]>();
      for (const g of grantsOf(ctx, "proficiency")) {
        if (!g.grant.target.startsWith("tools.")) continue;
        const id = g.grant.target.slice("tools.".length);
        tools.set(id, [...(tools.get(id) ?? []), g.source.label]);
      }
      return known(
        [...tools].map(([id, sources]) => ({ id, sources })),
        "Tool proficiencies",
      );
    },
  },
  {
    key: "initiative.total",
    compute: (ctx) => {
      const ability = ctx.settings.variable<string>(
        "skills-and-saves.initiativeAbility",
      );
      if (ability.kind === "unresolved") return ability;
      const parts: Value<number>[] = [
        ctx.get<number>(`abilities.${ability.value}.modifier`),
      ];
      for (const g of grantsOf(ctx, "bonus", "initiative")) {
        parts.push(
          amountValue(ctx, g.grant.amount, g.source.label, g.source.note),
        );
      }
      return sum("Initiative", parts);
    },
  },
];

export const skillsAndSaves: KernelModule = {
  manifest: {
    id: "skills-and-saves",
    version: "1.0.0",
    requires: [
      { id: "abilities", range: "^1.0.0" },
      { id: "proficiency", range: "^1.0.0" },
    ],
    extends: [DERIVATIONS_POINT],
    provides: {
      extensionPoints: [SKILLS_POINT],
      ruleVariables: [{ name: "initiativeAbility", type: "string" }],
    },
  },
  setup: (ctx) => derivations.forEach((d) => ctx.extend(DERIVATIONS_POINT, d)),
};
