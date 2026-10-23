# Carol Elfnein

Purpose: Carol's accepted playable tabletop baseline, updated 2026-10-18; slots and Indomitable revised 2026-10-21. Status: tabletop sheet; Hearthtable has no runtime character data yet, and the previous application's older JSON is not imported. Supporting rules and provenance live in the [build reference](../Class%20Reference/Carol%20Build%20Reference.md).

Decisions: Human/Sage, the Wizard/Alchemist build, skill choices and starting spell package below are selected. Questions: remaining equipment bookkeeping and unusual weapon interactions are listed at the end; minor unresolved fields do not block current systems design. See [Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md#old-character-data).

## Identity and core statistics

Human (2024), Sage; Evoker Wizard 12 / Alchemist Artificer 3, total level 15. Wizard was the starting class. Human supplies Alert; Sage supplies Magic Initiate (Wizard). Wizard feat choices are +2 INT, War Caster (+1 INT) and Skill Expert (+1 DEX).

| STR | DEX | CON | INT | WIS | CHA |
|---|---|---|---|---|---|
| 8 / −1 | 16 / +3 | 14 / +2 | 22 / +6 | 10 / +0 | 10 / +0 |

INT 22 is base INT 20 plus the DM-earned Indomitable item (+2 INT), listed under Equipment. Decided 2026-10-21 at 3:46 am PDT (America/Los_Angeles): DM grants are inventory items under [Character Creation and Advancement](../Systems/Character%20Creation%20and%20Advancement.md#selected-decisions), so Indomitable is not part of the score ledger and applies once, through the item. Above-20 scores are permitted. The Sage 27-point reconstruction is 8/15/13/15/10/10, then background +2 INT/+1 CON and class choices, giving base INT 20. This reconstructs the accepted values rather than asserting a complete historical ledger.

| Statistic | Value |
|---|---|
| Proficiency | +5, from total level 15 |
| HP / Hit Dice | 95 fixed average; 12d6 +3d8 |
| Initiative / speed | +8 (DEX +3, Alert +5) / 30 ft |
| Saves | STR −1, DEX +3, CON +2, INT +11, WIS +5, CHA +0 |
| Concentration | CON +2 with War Caster Advantage; 87.75% success against DC 10 |
| AC | 13 unarmored; 16 with Mage Armor; 21 while Shield applies |
| Base spell attack / DC | +11 = INT +6 + proficiency bonus +5; DC 19 = 8 +6 +5, before item effects |

Human grants daily Heroic Inspiration and Medicine proficiency. Alert also permits its willing-ally initiative exchange. War Caster does not waive costly materials; tool/skill proficiency does not add to spell attacks.

## Skills and tools

| Skill | Total | Source |
|---|---:|---|
| Arcana | +16 | Sage; Wizard Scholar Expertise |
| History | +11 | Sage |
| Investigation | +16 | Wizard; Skill Expert Expertise |
| Persuasion | +0 | Untrained |
| Perception | +5 | Skill Expert |
| Insight | +5 | Selected Wizard proficiency |
| Medicine | +5 | Selected Human proficiency |
| Nature | +11 | Selected revised-Artificer multiclass proficiency |

Native tools: Calligrapher's Supplies from Sage; Tinker's Tools from the revised multiclass transcription; Alchemist's Supplies and Herbalism Kit from Alchemist. Attuned Manifold supplies artisan forms/proficiency while used, without extra proficiency bonus. Physical kits and proficiency are distinct. See [tools and crafting](../Class%20Reference/Carol%20Build%20Reference.md#tools-and-crafting).

## Spell resources and books

Slots add up per class under [Character Creation and Advancement](../Systems/Character%20Creation%20and%20Advancement.md#selected-decisions) (changed 2026-10-21 from the published merged multiclass table): Wizard 12 gives 4/3/3/3/2/1 and Artificer 3 gives three first-level slots (user-verified 2026-10-21 at 3:46 am PDT, America/Los_Angeles). Slots by level 1–6 are **7/3/3/3/2/1**; she has no seventh-level slot. A Long Rest restores expended slots. Actual access is Wizard through level 6 and Artificer through level 1.

Arcane Recovery restores up to six combined slot levels after a Short Rest, once per Long Rest, excluding level 6+ slots.

Campaign books hold 16 entries each, including cantrips; eligible contents are ready. More books add capacity, not slots or class cantrip choices. All three are permanent Enduring Spellbooks, protecting the books and writing from fire, water and aging, with no attunement or additional capacity. Total selected entries: **22 leveled spells +10 cantrips = 32**.

Magic Initiate gives the existing Mage Armor entry one free level 1 cast per Long Rest; extra casts use slots. Normal duration and components remain. This adds a casting source, not another entry or slot pool.

| Combat book — 16/16 | Spell level |
|---|---:|
| Mage Armor; Shield | 1 |
| Scorching Ray; Mirror Image; Misty Step; Web | 2 |
| Fireball; Counterspell; Dispel Magic | 3 |
| Fabricate | 4 |
| Cone of Cold; Wall of Force; Animate Objects | 5 |
| Chain Lightning; Disintegrate; Tasha's Otherworldly Guise | 6 |

Cantrips book, 10/16: Wizard Fire Bolt, Ray of Frost, Minor Illusion, Mind Sliver and Shocking Grasp; Magic Initiate (Wizard, INT) Mage Hand and Prestidigitation; Artificer Message and True Strike; granted Mending. Sage supplies the existing utility cantrips so the two newly selected offensive cantrips fit the five Wizard selections.

At total level 15, Mind Sliver deals 3d6 Psychic on a failed INT save and subtracts 1d4 from the next save within its timing window. Shocking Grasp deals 3d8 Lightning plus applicable Empowered Evocation +6, and on hit prevents Opportunity Attacks until the target's next turn.

Workshop/Alchemy, 6/16: Cure Wounds, Faerie Fire, Identify, Detect Magic, Healing Word and Ray of Sickness. The Alchemist grant pair is supported by the later final-book-labelled transcription, with secondary-source confidence. Use revised spell definitions. Detect Magic is selected as an Artificer level 1 entry; party overlap does not exclude it. Its normal concentration and ritual rules apply.

Prepared rituals can use the recorded 2024 ritual option: ten extra minutes without a slot. Identify takes eleven minutes that way and still needs its pearl. Wizard Ritual Adept additionally permits eligible book rituals without preparation. See [ritual rules](https://www.dndbeyond.com/sources/dnd/br-2024/spells) and [spell operation](../Class%20Reference/Carol%20Build%20Reference.md#spell-operation).

## Features in use

Evoker Potent Cantrip supplies half damage on the applicable failed damaging-cantrip attack/successful target save, without extra effects. Sculpt Spells protects selected visible creatures against applicable Evocation saves/damage. Empowered Evocation adds INT +6 to one damage roll per qualifying Wizard Evocation casting, without a daily pool. Overchannel needs Wizard 14 and is unavailable.

Evocation Savant's acquisition benefits and Memorize Spell's preparation swap are partly superseded or redundant under the campaign book policy. Scholar, book rituals and Arcane Recovery remain.

Artificer grants Mending and temporary mundane creation through Tinker's Magic, six uses per Long Rest at INT +6. Respect tool-in-hand casting requirements; a component pouch alone does not replace them. Known plans are Wand +1, Manifold, Goggles of Night and Alchemy Jug. Usual replicas are Goggles/Jug; permanent Wand/Manifold do not consume those two allowances. Alchemist halves potion crafting time. See [creations and elixirs](../Class%20Reference/Carol%20Build%20Reference.md#artificer-creations-and-elixirs) for elixir rules and provenance.

## Faust / Otherworldly Guise

Faust is the appearance of Tasha's Otherworldly Guise. Casting uses a Bonus Action, concentration up to one minute (ten rounds), and a reusable 500 gp engraved planar object, which is owned; cosmetic form is open.

The spell grants 40 ft flight, +2 AC, magical weapon attacks using casting ability, and two attacks in the Attack action. Choose Lower Planes for fire/poison damage immunity and Poisoned immunity, or Upper Planes for radiant/necrotic damage immunity and Charmed immunity. Spellcasting remains possible. Mage Armor plus Guise is AC 18, or 23 while Shield applies. The source is a community Tasha transcription, not a claimed revised replacement.

## Equipment

| Category | Selected equipment |
|---|---|
| Attuned, 4/4 | In order: Gifted Aetherlock; permanent Wand of the War Mage +1; permanent Manifold Tool; Indomitable (its own +1 slot makes four) |
| DM grants | Indomitable: requires attunement; while attuned, +2 INT and +1 attunement slot (selected 2026-10-22 at 1:42 pm PDT (America/Los_Angeles)). Weightless (0 lb) and cannot be lost (selected 2026-10-22 at 11:45 pm PDT (America/Los_Angeles)) |
| Usual replicas | Goggles of Night; Alchemy Jug |
| Books | Three permanent Enduring Spellbooks, 16/10/6 entries |
| Physical tools | Alchemist, Herbalism, Tinker and Calligrapher kits |
| Components | Component pouch; reusable 100 gp Identify pearl; reusable 500 gp Guise planar object |
| Consumables | Four ordinary Potions of Healing; ammunition below; five reusable canisters initially 12/12 each, one installed and four spare |
| Writing/travel | Robes, ink/paper, rope, bedroll, waterskin, seven days' rations |
| Containers | Two separate Bags of Holding; contents/placement unassigned, no assumed nesting |

Held attuned Wand gives applicable spell attacks +12, without changing base DC 19 or gun aim +11. Manifold grants its applicable artisan form/proficiency while used, not an entire workshop or stacked proficiency. Goggles give 60 ft Darkvision; Jug produces listed liquids within daily limits. Neither needs attunement. Review hand-use before applying held-item bonuses during rifle use.

Past purchase/crafting details and gold are unspecified; do not invent debits. Daily elixirs are separate from permanent potions. Optional shopping candidates are not grants. See [item handling and candidates](../Class%20Reference/Carol%20Build%20Reference.md#item-handling-and-optional-equipment).

## Aetherlock summary

Custom Artificer-attuned Two-Handed rifle, no Light property, range 80/240 ft, six unrestricted chambers. Proficient INT aim is +11; Basic damage is 2d10 +6 Piercing. Each permitted attack fires 1–3 Basic/Arcane projectiles or one Spellround/HE-FRAG. Guise provides two attack opportunities; fresh True Strike instead uses its normal Magic action for one enhanced projectile. There is no free True Strike added to a Guise burst.

Physical loading and chamber/fuze selection have no separate action cost. Replacing a charge canister costs a Bonus Action and immediately locks the rifle through the entire next own turn; it is ready at the start of the second subsequent own turn. This also blocks rifle Shield reactions. The rifle weighs 8 lb (selected 2026-10-22 at 11:45 pm PDT (America/Los_Angeles)). Its initial loaded order remains pending; rounds are loaded in the app by dragging them into the chambers.

Scroll payloads preserve donor formulas and use no fresh payload slot at firing. Current binder casting instead uses the current caster's resources and statistics. Fuzes, valid targets, friendly fire, Shield delivery and charge costs follow the [weapon rules](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md); [the ledger](../Class%20Reference/Aetherlock%20Costs%20and%20Damage.md) owns crafting and firing-power prices. Scribing a new scroll and installing/removing an existing one are separate operations under the selected [scroll lifecycle](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md).
| Starting rounds | Carried | Spell level |
|---|---:|---|
| Basic | 18 | — |
| Arcane | 6 | — |
| Cone of Cold | 3 | 5 |
| HE-FRAG | 3 | — |
| Shield | 2 | 1 |
| Cure Wounds | 2 | 1 |

Total 34, at most six loaded. Arcane damage is 2d10 +6 Piercing +2d6 Force, mean 24. Carol's Cone of Cold snapshot is 8d8 +6 Cold, DC 19 CON half; Cure Wounds 1 is 2d8 +6 healing. Existing stock does not debit current gold/slots.

The five owned filled canisters in Equipment provide 60 charges. Expending the listed stock normally uses 18 +6 +(3 ×2) +(7 ×2) = 44 charges; Precision changes that budget. Rests do not refill ammunition or canisters.

See the weapon and ledger for activation, consumption, refill and cost rules.

## Remaining bookkeeping / later verification

- Future idea, 2026-10-20: the [Oblex's memory-based impersonations](https://www.dndbeyond.com/posts/235-meet-d-ds-new-scariest-monster-in-mordenkainens) may provide a reference if Autoscorers are revisited. This is an unselected possibility, not a restored feature or current equipment.
- Genuine unusual payload/critical/Potent Cantrip interactions, unwilling recipients and manufacture-workspace/donor details; most ordinary cases already follow normal spell rules.
- Starting state and placement, selected 2026-10-22 at 1:42 pm PDT (America/Los_Angeles): she starts fresh (HP 95/95, nothing spent, nothing active), and every item sits at the top level of her inventory until it is arranged in the editor. Weights use the 2024 equipment table where an item is published; spellbooks, replicas and custom items stay unknown.
- Starting loaded chambers, ongoing grenade/casing/Basic Round supply/prices, remaining minor components/hand-use/provenance checks.
- Continue [systems design](../Systems/Campaigns%20and%20Shared%20Data.md) from the accepted baseline; [Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md) lists failure modes to avoid. Implement later; rebuild from this sheet rather than migrating old JSON.

## Sources

[2024 Wizard/Evoker](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#Wizard); [official2025 Artificer overview](https://www.dndbeyond.com/posts/2106-whats-new-with-the-artificer-in-eberron-forge-of); [Artificer transcription](https://dnd2024.wikidot.com/artificer:main); [Alchemist transcription](https://dnd2024.wikidot.com/artificer:alchemist); [Guise transcription](https://dnd5e.wikidot.com/spell:tashas-otherworldly-guise); [Enduring Spellbook](https://roll20.net/compendium/dnd5e/Items%3AEnduring%20Spellbook?expansion=33359). Exact Artificer details retain secondary-source status where the official full chapter was gated. No claimed revised Guise replacement.
