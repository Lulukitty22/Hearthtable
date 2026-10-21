# Combat Calculations

Updated 2026-10-18. These supporting calculations illustrate Carol's selected spells, encounter resources and accuracy assumptions; they are not guaranteed damage or a global damage maximum. Carol's accepted build is recorded in [her sheet](../Character%20Sheets/Carol%20Elfnein.md); [Mechanics Reference](Mechanics%20Reference.md) explains rule boundaries and source confidence. Runtime implementation is deferred. Enemy statistics below are illustrative, not measured campaign values; no character choice is pending here.

## Common assumptions and direct spells

Unless stated otherwise: total level 15, INT 22 (+6), proficiency bonus +5, spell attack +11/DC 19; ordinary hits/failed saves, no resistance, vulnerability, magic weapon damage or extra feats. These spell examples exclude held Wand bonuses. Means are before accuracy/saves unless explicitly called expected damage. More area targets multiply per-target damage only when actually caught.

| Spell | Raw mean | Conditions |
|---|---:|---|
| Fireball 3 / sixth-slot upcast | 28 / 38.5 | 8d6 / 11d6, DEX half; eligible Evoker adds +6 |
| Cone of Cold 5 / 6 | 36 / 40.5 | 8d8 / 9d8, CON half; Evoker 42 / 46.5 per enemy |
| Scorching Ray, fifth slot | 42; Evoker 48 | Six independent 2d6 attacks; Evoker +6 on one roll |
| Chain Lightning 6 | 45; Evoker 51 | 10d8, up to four chosen targets, DEX half |
| Disintegrate 6 | 75 | 10d6+40, DEX success means zero; no Evoker bonus |
| Fire Bolt, character 15 | 16.5; Evoker 22.5 | 3d10; eligible Potent Cantrip affects misses |

Four failed Chain Lightning saves total 180 before Evoker versus 154 for four enemies failing sixth-slot Fireball saves. Fireball may catch more creatures and allies; this is not an unconditional ranking. Cone cannot be downcast below fifth.

## Sustained concentration examples

Revised 2024 Animate Objects uses casting modifier capacity (six here): Medium-or-smaller costs one, Large two, Huge three. Eligible actual nonmagical objects are required. Creatures have 30 ft speed, not an assumed flying swarm; they act immediately after the caster, with Bonus Action commands, surviving objects and reachable targets. It is concentration up to one minute and cannot coexist with self-maintained Guise.

| Objects | Fifth-slot all-hit mean per attacking round | Sixth-slot mean |
|---|---:|---:|
| Six Medium or smaller | 33 = 6×(1d4+3) | 48 = 6×(2d4+3) |
| Three Large | 48 = 3×(2d6+3+6) | 58.5 = 3×(3d6+3+6) |
| Two Huge | 44 = 2×(2d12+3+6) | 57 = 2×(3d12+3+6) |

Three Large leads these mixes but requires three suitable objects and positioning. No Evoker bonus applies to this Transmutation or its creatures. At fifth slot, six surviving all-hit rounds total 288; later actions can cast non-concentration spells while commanding. Objects5 + Evoker Cone5 totals 90 raw if attacks hit and save fails; objects5 + Disintegrate6 totals 123.

## Encounter and recovery budgets

For a six-turn encounter illustration, two Cone5 plus four Fire Bolt actions give 138 raw without Evoker and 174 with Evoker, against one enemy affected by every cast. It assumes all six actions are available and is not an optimized rotation; setup actions, concentration loss, target count and other spells change the result.

Wizard12/Artificer3 has four slots eligible for Cone of Cold: two fifth-level, one sixth-level and one seventh-level, with a fifth cast possible after Arcane Recovery. The seventh-level slot supports upcasting, not seventh-level Wizard access. Higher slots committed to Guise, Animate, crafting or another spell are unavailable for Cone; there are no parallel free pools. Cone at slots 5/6/7 averages 36/40.5/45, or Evoker 42/46.5/51. The selected split's four-slot budget totals 157.5/181.5 per enemy failing all saves, or 193.5/223.5 after recovering a fifth slot.

## Accuracy illustrations

Example enemy AC 18, attack +11, no Advantage/Disadvantage: 65% ordinary hit, 5% critical, 30% miss. Expected values count critical dice. Example save +6 against DC 19 fails 60%. Enemy statistics are illustrations, not campaign measurements.

| Package | Expected damage under those assumptions |
|---|---:|
| Animate5 / Animate6, three Large | 34.65 / 42.525 |
| Disintegrate6 | 45 |
| Cone5 / Evoker Cone5 | About 28.7 / 33.5, including half-damage rounding |
| Fire Bolt / Evoker Fire Bolt | 12.375 / 19.875, including eligible Potent Cantrip miss damage |
| Two Cone5 + four Fire Bolt actions | About 106.9 / 146.5, without/with Evoker |

## Prior sources

No fresh verification is claimed. [Animate Objects](https://www.dndbeyond.com/spells/2618855-animate-objects), [Scorching Ray](https://www.dndbeyond.com/spells/2619005-scorching-ray), [Cone](https://www.dndbeyond.com/spells/2619042-cone-of-cold), [Disintegrate](https://www.dndbeyond.com/spells/2619094-disintegrate), [Chain Lightning](https://www.dndbeyond.com/spells/2618960-chain-lightning), [Fireball](https://www.dndbeyond.com/spells/2618887-fireball), and [2024 classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes). Mechanics Reference preserves the edition and incomplete-source boundaries.
