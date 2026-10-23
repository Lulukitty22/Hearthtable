// The composition root: which modules exist, and resolving a character's records under a
// ruleset. Views, tests and scripts use this instead of assembling the registry themselves.

import { dnd5e2024 } from "@hearthtable/game-dnd5e-2024";
import {
  buildRegistry,
  checkRuleset,
  resolveCharacter,
  type AuthoredValue,
  type Issue,
  type KernelModule,
  type RecordEnvelope,
  type Registry,
  type ResolvedCharacter,
  type Ruleset,
  type Settings,
} from "@hearthtable/kernel";
import { abilities } from "@hearthtable/system-abilities";
import { activeEffects } from "@hearthtable/system-active-effects";
import { armorClass } from "@hearthtable/system-armor-class";
import { attunement } from "@hearthtable/system-attunement";
import { concentration } from "@hearthtable/system-concentration";
import { containers } from "@hearthtable/system-containers";
import { features } from "@hearthtable/system-features";
import { hitPoints } from "@hearthtable/system-hit-points";
import { magazines } from "@hearthtable/system-magazines";
import { proficiency } from "@hearthtable/system-proficiency";
import { resources } from "@hearthtable/system-resources";
import { scrollCrafting } from "@hearthtable/system-scroll-crafting";
import { scrolls } from "@hearthtable/system-scrolls";
import { skillsAndSaves } from "@hearthtable/system-skills-and-saves";
import { spellbookReadiness } from "@hearthtable/system-spellbook-readiness";
import { spellcasting } from "@hearthtable/system-spellcasting";

export const MODULES: readonly KernelModule[] = [
  abilities,
  proficiency,
  skillsAndSaves,
  features,
  hitPoints,
  armorClass,
  activeEffects,
  concentration,
  resources,
  spellcasting,
  spellbookReadiness,
  containers,
  attunement,
  magazines,
  scrollCrafting,
  scrolls,
  dnd5e2024,
];

export interface Engine {
  readonly registry: Registry;
  readonly settings: Settings;
  /** Ruleset problems, shown where they apply; the ruleset is never swapped for another. */
  readonly issues: readonly Issue[];
  resolve(
    records: readonly RecordEnvelope[],
    authored?: ReadonlyMap<string, AuthoredValue>,
  ): ResolvedCharacter;
}

export function createEngine(ruleset: Ruleset): Engine {
  const registry = buildRegistry(MODULES);
  if (!registry.ok) {
    // A broken module set is a programming error, not user data: fail loudly.
    throw new Error(
      `Module registry is invalid: ${registry.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const settings = checkRuleset(ruleset, registry.value);
  return {
    registry: registry.value,
    settings,
    issues: settings.issues,
    resolve: (records, authored) =>
      resolveCharacter({
        records,
        settings,
        registry: registry.value,
        ...(authored ? { authored } : {}),
      }),
  };
}
