// Plain-language lines for definition rules shown in an entry's panel. A line may point at
// another entry (a spell a feature lets you cast), which the panel shows as a link.

import { parseGrants, type Grant } from "@hearthtable/kernel";

export interface Described {
  readonly text: string;
  /** Another record this line refers to, shown as a clickable entry. */
  readonly ref?: string;
}

const ability = (a: string) => a.toUpperCase();

export function targetLabel(target: string): string {
  return target
    .replace(/^abilities\.(\w+)\.score$/, (_, a: string) => ability(a))
    .replace(/^skills\./, "")
    .replace(/^saves\.(\w+)$/, (_, a: string) => `${ability(a)} saving throws`)
    .replace(/^tools\./, "")
    .replace(/^spellcasting\.attack$/, "spell attacks")
    .replace(/^spellcasting\.dc$/, "spell save DC")
    .replace(/^weapons\.aim$/, "weapon aim")
    .replace(/^armor-class$/, "AC")
    .replace(/^attunement\.slots$/, "attunement slots")
    .replace(/^initiative$/, "initiative")
    .replace(/-/g, " ");
}

function amount(a: Extract<Grant, { type: "bonus" }>["amount"]): string {
  if (typeof a === "number") return a >= 0 ? `+${a}` : String(a);
  const what =
    a.key === "proficiency.bonus"
      ? "your proficiency bonus"
      : a.key.replace(
          /^abilities\.(\w+)\.modifier$/,
          (_, x: string) => `your ${ability(x)} modifier`,
        );
  return `+ ${a.times && a.times !== 1 ? `${a.times} × ` : ""}${what}`;
}

export function describeGrant(
  g: Grant,
  nameOf: (id: string) => string,
): Described {
  switch (g.type) {
    case "bonus":
      return { text: `${amount(g.amount)} to ${targetLabel(g.target)}` };
    case "proficiency":
      return {
        text: `${g.level === 2 ? "Expertise" : "Proficiency"} in ${targetLabel(g.target)}`,
      };
    case "capability":
      if (g.id.startsWith("spell-access:")) {
        const ref = g.id.slice("spell-access:".length);
        return { text: `Can cast ${nameOf(ref)}`, ref };
      }
      return { text: g.id.replace(/-/g, " ") };
    case "resource":
      return {
        text: `${g.pool.replace(/-/g, " ")}: ${typeof g.max === "number" ? g.max : amount(g.max).replace(/^\+ /, "")} per ${g.reset}`,
      };
    case "base":
      return {
        text: `AC base ${g.base} + ${g.add.map((k) => k.replace(/^abilities\.(\w+)\.modifier$/, (_, a: string) => ability(a))).join(" + ")} (${g.label})`,
      };
    case "spell-formula": {
      const which = [
        g.when?.class ? nameOf(g.when.class) : undefined,
        g.when?.school,
      ]
        .filter(Boolean)
        .join(" ");
      return {
        text: `${amount(g.amount)} to ${g.once ? "one " : ""}${g.role} roll${g.once ? "" : "s"} of ${which ? `${which} ` : ""}spells${g.when?.damageType ? ` dealing ${g.when.damageType} damage` : ""}`,
      };
    }
  }
}

export function describeGrants(
  raw: unknown,
  nameOf: (id: string) => string,
): readonly Described[] {
  const parsed = parseGrants(raw, "grants");
  return parsed.ok
    ? parsed.value.map((g) => describeGrant(g, nameOf))
    : [{ text: "(these rules could not be read)" }];
}
