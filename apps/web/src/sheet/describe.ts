// Plain-language lines for definition rules shown in an entry's detail panel.

import { parseGrants, type Grant } from "@hearthtable/kernel";

const label = (target: string) =>
  target
    .replace(/^abilities\.(\w+)\.score$/, (_, a: string) => a.toUpperCase())
    .replace(/^skills\./, "")
    .replace(/^saves\.(\w+)$/, (_, a: string) => `${a.toUpperCase()} saves`)
    .replace(/^tools\./, "")
    .replace(/^spellcasting\.attack$/, "spell attacks")
    .replace(/^spellcasting\.dc$/, "spell save DC")
    .replace(/^armor-class$/, "AC")
    .replace(/^attunement\.slots$/, "attunement slots")
    .replace(/-/g, " ");

function amount(a: Extract<Grant, { type: "bonus" }>["amount"]): string {
  if (typeof a === "number") return a >= 0 ? `+${a}` : String(a);
  const what =
    a.key === "proficiency.bonus"
      ? "proficiency bonus"
      : a.key.replace(
          /^abilities\.(\w+)\.modifier$/,
          (_, x: string) => `${x.toUpperCase()} modifier`,
        );
  return `+ ${a.times && a.times !== 1 ? `${a.times} × ` : ""}${what}`;
}

export function describeGrant(g: Grant): string {
  switch (g.type) {
    case "bonus":
      return `${amount(g.amount)} to ${label(g.target)}`;
    case "proficiency":
      return `${g.level === 2 ? "Expertise" : "Proficiency"} in ${label(g.target)}`;
    case "capability":
      return g.id.startsWith("spell-access:")
        ? `Can cast ${g.id.slice("spell-access:".length).split("/").pop()?.replace(/_/g, " ")}`
        : g.id.replace(/-/g, " ");
    case "resource":
      return `${g.pool.replace(/-/g, " ")}: ${typeof g.max === "number" ? g.max : amount(g.max).replace(/^\+ /, "")} per ${g.reset}`;
    case "base":
      return `AC base ${g.base} + ${g.add.map((k) => k.replace(/^abilities\.(\w+)\.modifier$/, (_, a: string) => a.toUpperCase())).join(" + ")} (${g.label})`;
  }
}

export function describeGrants(raw: unknown): readonly string[] {
  const parsed = parseGrants(raw, "grants");
  return parsed.ok
    ? parsed.value.map(describeGrant)
    : ["(these rules could not be read)"];
}
