# Mechanics Reference

Updated 2026-10-18. This is a compact rules and source reference, not executable character data. Carol's selected Evoker Wizard 12 / Alchemist Artificer 3 build and grants live in [Carol Build Reference](Carol%20Build%20Reference.md#build-provenance) and [her sheet](../Character%20Sheets/Carol%20Elfnein.md); these general mechanics do not reopen those choices. Runtime implementation is deferred. Exact unverified published details remain source gaps, not permission to import playtest or older replacement rules.

## Levels, slots and spell access

Keep character total, individual class level, effective caster level and casting origin separate. Character total determines proficiency and ordinary cantrip scaling. Class level determines features, preparation allowances and eligible spell tiers. For these three classes, shared caster level is Wizard + Sorcerer + ceil(Artificer/2); a higher shared slot permits eligible upcasting without granting higher-tier spells or class features.

Wizard/Sorcerer spell tiers unlock at class levels 1/3/5/7/9/11/13/15/17. Artificer tiers 1–5 unlock at 1/5/9/13/17. Wizard 9 / Artificer 3, for example, has a sixth-level slot but only fifth-level Wizard and first-level Artificer spells. A class-tier column never grants every spell of that tier: spell membership, edition and subclass grants must be checked individually. Sorcerer does not inherit Wizard-only Fabricate, Wall of Force or book rituals merely by being a full caster.

Proficiency is +2 at total levels 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16 and +6 at 17–20. Expertise doubles proficiency only for the specified checks; multiple proficiency sources do not double weapon attack proficiency. INT 22 means modifier +6, not blanket +6 damage. Ordinary INT-guided weapon use needs a specific permission; Aetherlock's campaign rule does not extend to swords or whips.

## Class checkpoints

| Class | Distinct mechanics and limits |
|---|---|
| Wizard, 2024 | INT, d6; starting INT/WIS saves. Scholar at 2 grants one qualifying knowledge-skill Expertise. Subclass 3/6/10/14; feats 4/8/12/16; Epic Boon 19. Long Rest preparation and, from 5, one Short Rest prepared-spell swap. Spellbook rituals and acquiring spells are distinct from preparation. More books or higher INT do not automatically raise the published preparation counts. |
| Sorcerer, 2024 | CHA, d6; starting CON/CHA saves. Innate Sorcery at 1 affects eligible Sorcerer spells. Font/Metamagic at 2; points equal class level from 2. Restoration at 5 recovers floor(level/2) points on a Short Rest once per Long Rest. Incarnate at 7; more Metamagic at 10/17; subclass 3/6/14/18; Apotheosis at 20. Standard spell replacements occur on class-level gain, rather than Wizard rest preparation. INT casting would require a separate house rule. |
| Artificer, published 2025 | INT, d8; starting CON/INT saves. Tinker's Magic 1; Replicate Magic Item 2; specialty 3/5/9/15; Magic Item Tinker 6; Flash of Genius 7; Magic Item Adept 10; Spell-Storing Item 11; Advanced Artifice 14; Magic Item Master 18; revised Soul of Artifice 20. Item plans, active replicas and their resources are separate from granted custom equipment. |

Starting class supplies its saving-throw proficiencies; later multiclass levels do not grant another pair. Entry armor/tools/skills use multiclass grants, not the entire starting package. Wizard/Sorcerer have no core armor training; Artificer training does not override a particular spell/subclass's armor, shield or hand restrictions.

Wizard Arcane Recovery works after a Short Rest once per Long Rest: recover a total of ceil(Wizard level/2) slot levels, with no recovered slot above fifth. Wizard 12 can recover one fifth and one first, not a sixth. Spell Mastery at 18 uses eligible action-cast first/second-level spells; reaction Shield is not a 2024 pick. Signature Spells at 20 supply selected third-level free casts; ninth-level access already begins at 17. Wizard 17 / Artificer 3 therefore reaches ninth-level spells but loses Wizard 18–20 features.

Sorcerer conversion never creates a sixth-or-higher slot or bypasses the point-pool maximum. Slot conversion yields points equal to slot level; created slots expire on a Long Rest. Restricted feat points do not independently grant Font.

| Created slot | Point cost | Minimum Sorcerer level |
|---|---:|---:|
| 1 | 2 | 2 |
| 2 | 3 | 3 |
| 3 | 5 | 5 |
| 4 | 6 | 7 |
| 5 | 7 | 9 |

The 2025 Artificer replaces old Infuse Item with Replicate Magic Item and old Tool Expertise at 6 with Magic Item Tinker. Level 6 recharges/drains eligible replicated items and changes a plan; it does not recharge Aetherlock by resemblance. Level 11 can store an eligible Artificer spell up to third level, with its own restrictions. Advanced Artifice is not the old general item-requirement bypass. Older crafting discounts and prepared counts must not be combined automatically with the revised class.

## Subclasses and transformations

Evoker's Empowered Evocation adds INT to one damage roll of an eligible Wizard Evocation spell on every qualifying cast, without a rest counter. A shared area roll applies that result to each affected target; Scorching Ray receives the bonus on one ray. It does not boost spell attack accuracy, Disintegrate (Transmutation), Animate Objects' creature attacks or every damage roll. Potent Cantrip and Sculpt have their own conditions. Overchannel begins at Wizard 14, not 12; its first use per Long Rest is safe and repeated uses have escalating self-damage.

Abjurer's ward is a separate absorption pool, not AC, temporary HP or increased maximum HP. At Wizard 12/INT +6 its maximum is 30. Projected Ward uses the same pool and a Reaction; eligible Abjuration casting and the revised slot-funded recharge have their own conditions. Exact final trigger/action wording is required for implementation.

Alchemist's elixirs, spell grants and later Savant/healing benefits are separate features: Alchemist 3 does not grant level 5/9/15 benefits. Artillerist's Arcane Firearm applies to eligible Artificer spells cast through it, not every Wizard spell or gun hit. Battle Smith's weapon INT requires its feature conditions; its defender is not an automatic army. Armorer and Cartographer supply different equipment/travel packages, not free additions to Alchemist.

Tasha's Otherworldly Guise is sixth level, Bonus Action, Self, concentration up to one minute and permits spellcasting. Tenser's Transformation is a different sixth-level spell (Action, concentration up to ten minutes) and prohibits casting. Guise, Animate Objects, Conjure Minor Elementals, Fly, Haste and other concentration buffs are alternatives under one normal concentration. Polymorph's Beast form does not preserve ordinary casting; future Shapechange is ninth level.

## Spell and sheet safeguards

Prepared lists, Sorcery Points, Artificer Spell-Storing Item and a paid Aetherlock Spellround are different systems. [Weapon rules](Aetherlock%20Engineered%20Rounds.md) own custom delivery; [scroll lifecycle](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md) owns scribing/mounting. Fabricate and tool proficiency do not automatically create free permanent magic items. Full definitions retain components, concentration, target requirements, origin, edition and scaling.

HP uses the first character level's maximum hit die, later recorded rolls or fixed averages, CON per character level and explicit bonuses. Preserve actual campaign rolls. [AC formulas and augments](../Systems/Spell%20Effects%20and%20Active%20State.md#armor-class-formulas-and-augments) owns the distinction between one selected base and compatible bonuses. Speed and skills need actual grant sources. Tome of Clear Thought is a published +2 INT increase after study (48 hours within six days, maximum 30; book then loses magic for 100 years), not free point-buy or evidence of Carol owning it. Carol's actual INT source is recorded in Carol Build Reference.

Spell definitions must retain their correct level and source/version; Wall of Ice is sixth level. Spell slots, components and concentration remain distinct requirements.

## Sources and verification limits

This consolidation preserves prior research; it does not claim fresh verification. [2024 core classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes), [spell definitions](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions), [Wizard changes](https://www.dndbeyond.com/posts/1753-2024-wizard-vs-2014-wizard-whats-new), [Sorcerer changes](https://www.dndbeyond.com/posts/1769-2024-sorcerer-vs-2014-sorcerer-whats-new) and [Artificer multiclass guidance](https://www.dndbeyond.com/posts/1035-artificer-201-a-guide-to-multiclassing) support the general progression distinctions. [Replacement guidance](https://www.dndbeyond.com/posts/1810-updates-in-the-players-handbook-2024) does not authorize cumulative duplicate features.

[2025 Artificer overview](https://www.dndbeyond.com/posts/2106-whats-new-with-the-artificer-in-eberron-forge-of), [five specialties](https://www.dndbeyond.com/posts/2109-forge-your-story-with-5-inventive-artificer) and [2025 Realms subclasses](https://www.dndbeyond.com/posts/2082-weave-your-tale-in-the-forgotten-realms-with-8) verify described features, not every unquoted cap, cost or trigger. Prior official full-book routes were gated. Final-book-labelled secondary [Artificer](https://dnd2024.wikidot.com/artificer:main), [Alchemist](https://dnd2024.wikidot.com/artificer:alchemist) and [Guise](https://dnd5e.wikidot.com/spell:tashas-otherworldly-guise) transcriptions supplied working details; their confidence remains distinct from official full-text verification. See Carol Build Reference for selected grants and remaining gaps.

[2025 Artificer UA](https://media.dndbeyond.com/compendium-images/ua/eberron-updates/Lhg25Ggx5iY3rETH/UA2025-CartographerArtificer.pdf) is playtest evidence. [Guise](https://www.dndbeyond.com/spells/719961-tashas-otherworldly-guise), [Tenser](https://www.dndbeyond.com/spells/14612-tensers-transformation), [Tome](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items-a-z#TomeofClearThought) and [Sage Advice](https://www.dndbeyond.com/sources/dnd/sae/sage-advice-compendium) retain the prior spell/item/ward source pointers.
