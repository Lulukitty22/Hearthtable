// Hearthtable Vanilla+ Rules: data only. It turns systems on, picks their methods and sets
// their variables; it contains no code (Modules, Systems and Rulesets). Every value is owned by
// a decision document: Character Creation and Advancement (point buy, level cap, per-class
// slots, fixed-average HP) and Spell Containers and Consumable Sources (book readiness and
// capacity, accessible depth). Concentration capacity, scroll use and damage join this file
// when those systems exist; naming them now would be a visible compatibility error.

import type { Ruleset } from "@hearthtable/kernel";
import data from "./hearthtable-vanilla-plus.json";

export const hearthtableVanillaPlus: Ruleset = data;
