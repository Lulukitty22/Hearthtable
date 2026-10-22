// Prints Carol's resolved sheet in the terminal: `pnpm peek`. Every number shows how it was
// worked out. A preview until the sheet viewer arrives in Step H.

import { carolWithDefinitions } from "@hearthtable/content";
import { createEngine } from "@hearthtable/engine";
import { formatExplanation, type Value } from "@hearthtable/kernel";
import { hearthtableVanillaPlus } from "@hearthtable/ruleset-hearthtable-vanilla-plus";

const engine = createEngine(hearthtableVanillaPlus);
const sheet = engine.resolve(carolWithDefinitions());

const show = (v: Value<unknown>) =>
  v.kind === "known" ? formatExplanation(v.explain) : `UNRESOLVED: ${v.reason}`;
const line = (key: string) => console.log(`  ${show(sheet.get(key))}`);

console.log(`\nCarol Elfnein — ${hearthtableVanillaPlus.title}\n`);
console.log("Abilities");
for (const a of ["str", "dex", "con", "int", "wis", "cha"])
  line(`abilities.${a}.score`);
console.log("\nCore");
for (const k of [
  "character.level",
  "proficiency.bonus",
  "hit-points.max",
  "initiative.total",
  "armor-class.total",
])
  line(k);
console.log("\nSaves");
for (const a of ["str", "dex", "con", "int", "wis", "cha"])
  line(`saves.${a}.total`);
console.log("\nSkills");
for (const s of [
  "arcana",
  "history",
  "investigation",
  "insight",
  "medicine",
  "nature",
  "perception",
  "persuasion",
])
  line(`skills.${s}.total`);
console.log("\nSpellcasting");
line("spellcasting.classes.core/wizard.attack");
line("spellcasting.classes.core/wizard.dc");
const slots =
  sheet.get<readonly { max: Value<number> }[]>("spellcasting.slots");
if (slots.kind === "known")
  slots.value.forEach((s) => console.log(`  ${show(s.max)}`));
console.log("\nAttunement");
line("attunement.slots");
console.log("\nCarried weight");
line("containers.carriedWeight");

const notes = sheet.issues;
console.log(`\n${notes.length} note(s):`);
for (const i of notes) console.log(`  [${i.severity}] ${i.message}`);
console.log("");
