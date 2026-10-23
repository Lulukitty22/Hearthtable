// Test fixture: a character built like Carol's accepted sheet, plus the definitions she uses,
// to prove the Milestone 2 systems reproduce her documented numbers. Step F enters her real
// records; this fixture exists only for tests.

import { abilities } from "@hearthtable/system-abilities";
import { activeEffects } from "@hearthtable/system-active-effects";
import { armorClass } from "@hearthtable/system-armor-class";
import { attunement } from "@hearthtable/system-attunement";
import { containers } from "@hearthtable/system-containers";
import { features } from "@hearthtable/system-features";
import { hitPoints } from "@hearthtable/system-hit-points";
import { magazines } from "@hearthtable/system-magazines";
import { proficiency } from "@hearthtable/system-proficiency";
import { resources } from "@hearthtable/system-resources";
import { skillsAndSaves } from "@hearthtable/system-skills-and-saves";
import { spellbookReadiness } from "@hearthtable/system-spellbook-readiness";
import { spellcasting } from "@hearthtable/system-spellcasting";
import {
  buildRegistry,
  checkRuleset,
  newEnvelope,
  resolveCharacter,
  type RecordEnvelope,
  type RecordId,
  type ResolvedCharacter,
  type Ruleset,
} from "@hearthtable/kernel";
import { classRecords, dnd5e2024 } from "./index";

export const MODULES = [
  abilities,
  proficiency,
  skillsAndSaves,
  features,
  hitPoints,
  armorClass,
  activeEffects,
  resources,
  spellcasting,
  spellbookReadiness,
  containers,
  attunement,
  magazines,
  dnd5e2024,
];

export const TEST_RULESET: Ruleset = {
  id: "test-vanilla-plus",
  title: "Test Vanilla+",
  game: "dnd5e-2024",
  systems: MODULES.map((m) => m.manifest.id).filter(
    (id) => id !== "dnd5e-2024",
  ),
  methods: {
    "abilities.pointBuy": "extended",
    "proficiency.progression": "every-four-levels",
    "hit-points.max": "fixed-average",
    "spellcasting.combination": "add-per-class",
    "spellbook-readiness.readiness": "book-contents-ready",
  },
  variables: {
    "abilities.pointBudget": 27,
    "abilities.ordinaryMax": 20,
    "skills-and-saves.initiativeAbility": "dex",
    "hit-points.ability": "con",
    "containers.maxAccessibleDepth": 1,
    "attunement.maxSlots": 3,
    "spellbook-readiness.bookCapacity": 16,
    "dnd5e-2024.maxLevel": "unlimited",
  },
};

function record(id: string, kind: string, data: unknown): RecordEnvelope {
  return newEnvelope({
    id: id as RecordId,
    kind,
    moduleId: "test",
    schemaVersion: 1,
    origin: { scope: "core" },
    source: { status: "published" },
    revision: 0,
    updatedAt: "2026-10-22T00:00:00.000Z",
    data,
  });
}

const feature = (id: string, name: string, grants: unknown[]) =>
  record(id, "feature", { name, grants });
const item = (id: string, data: Record<string, unknown>) =>
  record(id, "item", data);
const spell = (
  id: string,
  name: string,
  level: number,
  classes: string[],
  whileActive?: unknown[],
) =>
  record(id, "spell", {
    name,
    level,
    classes,
    ...(whileActive ? { whileActive } : {}),
  });

export const DEFINITIONS: readonly RecordEnvelope[] = [
  ...classRecords,
  feature("core/sage_ability_scores", "Sage ability scores", [
    { type: "bonus", target: "abilities.int.score", amount: 2 },
    { type: "bonus", target: "abilities.con.score", amount: 1 },
  ]),
  feature("core/sage_proficiencies", "Sage", [
    { type: "proficiency", target: "skills.arcana", level: 1 },
    { type: "proficiency", target: "skills.history", level: 1 },
    { type: "proficiency", target: "tools.calligraphers-supplies", level: 1 },
  ]),
  feature("core/skill_choice", "Skill proficiency", [
    { type: "proficiency", target: "skills.{skill}", level: 1 },
  ]),
  feature("core/alert", "Alert", [
    {
      type: "bonus",
      target: "initiative",
      amount: { key: "proficiency.bonus" },
    },
  ]),
  feature("core/ability_score_improvement", "Ability Score Improvement", [
    { type: "bonus", target: "abilities.{ability}.score", amount: 2 },
  ]),
  feature("core/war_caster", "War Caster", [
    { type: "bonus", target: "abilities.{ability}.score", amount: 1 },
  ]),
  feature("core/skill_expert", "Skill Expert", [
    { type: "bonus", target: "abilities.{ability}.score", amount: 1 },
    { type: "proficiency", target: "skills.{proficiency}", level: 1 },
    { type: "proficiency", target: "skills.{expertise}", level: 2 },
  ]),
  feature("core/scholar", "Scholar", [
    { type: "proficiency", target: "skills.{skill}", level: 2 },
  ]),
  feature("core/arcane_recovery", "Arcane Recovery", [
    { type: "resource", pool: "arcane-recovery", max: 1, reset: "long rest" },
  ]),
  feature("core/tinkers_magic", "Tinker's Magic", [
    {
      type: "resource",
      pool: "tinkers-magic",
      max: { key: "abilities.int.modifier" },
      reset: "long rest",
    },
  ]),
  feature("core/alchemist_spells", "Alchemist Spells", [
    { type: "capability", id: "spell-access:core/healing_word" },
    { type: "capability", id: "spell-access:core/ray_of_sickness" },
  ]),
  item("core/indomitable", {
    name: "Indomitable",
    grants: [{ type: "bonus", target: "abilities.int.score", amount: 2 }],
    grantsWhen: "owned",
  }),
  item("core/wand_of_the_war_mage_1", {
    name: "Wand of the War Mage +1",
    weight: 1,
    attunement: { required: true },
    grants: [{ type: "bonus", target: "spellcasting.attack", amount: 1 }],
    grantsWhen: "attuned-and-held",
  }),
  item("core/backpack", {
    name: "Backpack",
    weight: 5,
    volume: 1,
    container: { maxWeight: 30, maxVolume: 1, contentsAddWeight: true },
  }),
  item("core/bag_of_holding", {
    name: "Bag of Holding",
    weight: 5,
    container: { maxWeight: 500, maxVolume: 64, contentsAddWeight: false },
  }),
  item("core/potion_of_healing", { name: "Potion of Healing", weight: 0.5 }),
  item("core/enduring_spellbook", { name: "Enduring Spellbook", weight: 3 }),
  item("campaign/test/aetherlock", {
    name: "Aetherlock",
    attunement: { required: true, requiresClass: "core/Artificer" },
    magazine: { chambers: 6 },
  }),
  item("campaign/test/charge_canister", {
    name: "Charge canister",
    canister: { charges: 12 },
  }),
  item("campaign/test/basic_round", { name: "Basic Round" }),
  spell(
    "core/mage_armor",
    "Mage Armor",
    1,
    ["core/Wizard"],
    [
      {
        type: "base",
        target: "armor-class",
        id: "mage-armor",
        label: "Mage Armor",
        base: 13,
        add: ["abilities.dex.modifier"],
      },
    ],
  ),
  spell(
    "core/shield",
    "Shield",
    1,
    ["core/Wizard"],
    [{ type: "bonus", target: "armor-class", amount: 5 }],
  ),
  spell("core/fireball", "Fireball", 3, ["core/Wizard"]),
  spell("core/healing_word", "Healing Word", 1, ["core/bard"]),
  spell("core/wish", "Wish", 9, ["core/Wizard"]),
];

export interface CharacterOptions {
  classLevels?: string[];
  activeEffects?: unknown[];
  armorClass?: unknown;
  wandHeld?: boolean;
  extraFeatures?: unknown[];
  extraLines?: unknown[];
  bookEntries?: unknown[];
  prepared?: string[];
}

export function carolRecords(options: CharacterOptions = {}): RecordEnvelope[] {
  const character = record("account/test/carol", "character", {
    name: "Carol Elfnein",
    classLevels: options.classLevels ?? [
      ...Array<string>(12).fill("core/Wizard"),
      ...Array<string>(3).fill("core/Artificer"),
    ],
    abilities: {
      base: { str: 8, dex: 15, con: 13, int: 15, wis: 10, cha: 10 },
    },
    features: [
      { ref: "core/sage_ability_scores", from: "Sage" },
      { ref: "core/sage_proficiencies", from: "Sage" },
      { ref: "core/alert", from: "Human (Versatile)" },
      {
        ref: "core/skill_choice",
        from: "Human (Skillful)",
        choices: { skill: "medicine" },
      },
      {
        ref: "core/skill_choice",
        from: "Wizard 1",
        choices: { skill: "investigation" },
      },
      {
        ref: "core/skill_choice",
        from: "Wizard 1",
        choices: { skill: "insight" },
      },
      { ref: "core/scholar", from: "Wizard 2", choices: { skill: "arcana" } },
      {
        ref: "core/ability_score_improvement",
        from: "Wizard 4",
        choices: { ability: "int" },
      },
      { ref: "core/war_caster", from: "Wizard 8", choices: { ability: "int" } },
      {
        ref: "core/skill_expert",
        from: "Wizard 12",
        choices: {
          ability: "dex",
          proficiency: "perception",
          expertise: "investigation",
        },
      },
      {
        ref: "core/skill_choice",
        from: "Artificer (multiclass)",
        choices: { skill: "nature" },
      },
      { ref: "core/arcane_recovery", from: "Wizard 1" },
      { ref: "core/tinkers_magic", from: "Artificer 1" },
      ...(options.extraFeatures ?? []),
    ],
    hitPoints: { current: 95 },
    activeEffects: options.activeEffects ?? [],
    ...(options.armorClass === undefined
      ? {}
      : { armorClass: options.armorClass }),
    resources: { used: { "arcane-recovery": 0 } },
    spellcasting: { expended: {} },
    ...(options.prepared ? { spellbook: { prepared: options.prepared } } : {}),
  });
  const inventory = record("account/test/carol.inventory", "inventory", {
    lines: [
      { id: "indomitable", ref: "core/indomitable", quantity: 1 },
      {
        id: "wand",
        ref: "core/wand_of_the_war_mage_1",
        quantity: 1,
        held: options.wandHeld ?? false,
        attunedTo: "account/test/carol",
        attunedSlot: 1,
      },
      {
        id: "aetherlock",
        ref: "campaign/test/aetherlock",
        quantity: 1,
        attunedTo: "account/test/carol",
        attunedSlot: 2,
        magazine: {
          chambers: ["round-1", "round-2", null],
          canister: "canister-1",
        },
      },
      {
        id: "canister-1",
        ref: "campaign/test/charge_canister",
        quantity: 1,
        charges: 12,
      },
      { id: "round-1", ref: "campaign/test/basic_round", quantity: 1 },
      { id: "round-2", ref: "campaign/test/basic_round", quantity: 1 },
      { id: "backpack", ref: "core/backpack", quantity: 1 },
      {
        id: "combat-book",
        ref: "core/enduring_spellbook",
        quantity: 1,
        parent: "backpack",
      },
      {
        id: "bag",
        ref: "core/bag_of_holding",
        quantity: 1,
        parent: "backpack",
      },
      {
        id: "deep-potion",
        ref: "core/potion_of_healing",
        quantity: 2,
        parent: "bag",
      },
      {
        id: "deep-book",
        ref: "core/enduring_spellbook",
        quantity: 1,
        parent: "bag",
      },
      ...(options.extraLines ?? []),
    ],
  });
  const combatBook = record("account/test/carol.book.combat", "spellbook", {
    book: "combat-book",
    entries: options.bookEntries ?? [
      { id: "e1", ref: "core/mage_armor" },
      { id: "e2", ref: "core/shield" },
      { id: "e3", ref: "core/fireball" },
      { id: "e4", ref: "core/healing_word" },
      { id: "e5", ref: "core/wish" },
    ],
  });
  const deepBook = record("account/test/carol.book.deep", "spellbook", {
    book: "deep-book",
    entries: [{ id: "d1", ref: "core/fireball" }],
  });
  return [...DEFINITIONS, character, inventory, combatBook, deepBook];
}

export function resolveWith(
  records: readonly RecordEnvelope[],
  ruleset: Ruleset = TEST_RULESET,
): ResolvedCharacter {
  const registry = buildRegistry(MODULES);
  if (!registry.ok) throw new Error(JSON.stringify(registry.issues, null, 2));
  const settings = checkRuleset(ruleset, registry.value);
  if (settings.issues.length > 0)
    throw new Error(JSON.stringify(settings.issues, null, 2));
  return resolveCharacter({ records, settings, registry: registry.value });
}

/** The known value at `key`, failing the test with the reason if it is unresolved. */
export function valueOf<T>(resolved: ResolvedCharacter, key: string): T {
  const v = resolved.get<T>(key);
  if (v.kind === "unresolved")
    throw new Error(`${key} is unresolved: ${v.reason}`);
  return v.value;
}
