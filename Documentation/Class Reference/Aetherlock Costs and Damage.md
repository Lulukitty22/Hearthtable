# Aetherlock Costs and Damage

Updated 2026-10-19. This ledger owns current ammunition prices and derived comparisons; runtime implementation is deferred. Arcana modifies both scribing and mounting/removal, including level 1+ handling. [Weapon rules](Aetherlock%20Engineered%20Rounds.md) own actions; [Carol's sheet](../Character%20Sheets/Carol%20Elfnein.md#aetherlock-summary) owns stock; [scroll lifecycle](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md) owns eligibility and handling formulas. Rounding and the parked economy proposals remain open; these estimates do not debit existing gold, slots or stock.

## Inputs

| Input | Selected cost / status |
|---|---|
| Complete Basic Round | Purchased at 1 gp. No second identical casing fee. Raw manufacture is unspecified. |
| DIY casing | Proposed: 1 gp brass yields ten casings. Not selected as a complete Basic Round recipe. |
| Scroll | Use the [scribing requirements and baseline](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#scribing-mounting-and-removal) with the [selected Arcana multiplier](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#selected-arcana-multiplier). |
| Mounting/removal | Use the [canonical handling schedule](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#scribing-mounting-and-removal), including its distinct cantrip baseline. |
| Arcane enhancement | One Basic + 5 gp crystal dust + 5 gp runic ink; ten minutes, no slot. |
| HEDP batch | One 100 gp grenade + six Basic + 20 gp parts; one hour with Tinker's Tools produces six rounds. |
| Empty canister refill | Current: 12 gp reagents + one hour with Tinker's Tools + one first-level slot; fills 12 charges in an existing shell. Proposed 120 gp reagents remain unselected. |

## Scribing reference and multiplier

The tables below derive from the scroll design's [published scribing baseline](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#published-scribing-baseline), [Arcana formula and discount scope](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#selected-arcana-multiplier), and [mounting/removal schedule](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#scribing-mounting-and-removal). Eligibility, component requirements, workday length and precision policy are defined there. Displayed figures here are rounded comparisons pending the final rounding decision.

| Spell level | Carol's scribing materials at Arcana +16 | Carol's workdays |
|---|---:|---:|
| Cantrip | 1.34 gp | 0.08919 |
| 1 | 2.23 gp | 0.08919 |
| 2 | 8.92 gp | 0.26758 |
| 3 | 13.38 gp | 0.44597 |
| 4 | 89.19 gp | 0.89194 |
| 5 | 133.79 gp | 2.22984 |
| 6 | 891.94 gp | 3.56774 |
| 7 | 1,114.92 gp | 4.45968 |
| 8 | 1,337.90 gp | 5.35161 |
| 9 | 4,459.68 gp | 10.70322 |

These examples use Carol's accepted [Arcana modifier](../Character%20Sheets/Carol%20Elfnein.md#skills-and-tools). M denotes the applicable operator's multiplier from the linked rule. An eligible donor is needed for a spell Carol cannot cast. Select the table row using the scroll's [actual saved cast level](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#upcast-scroll-level), including eligible upcasts.

## Completed ammunition

The table uses purchased Basic Rounds and Carol's scribing/mounting where eligible. Full consumed components are additional unless specified. Damage/healing means precede accuracy, saves, resistance and immunity.

| Round | Recipe | Work | Ammo cost | Average effect |
|---|---|---|---:|---|
| Basic | Complete Basic | Manufacture unspecified | 1 gp | 2d10 +6 = 17 Piercing |
| Arcane | Basic + dust + ink | 10 minutes | 11 gp | 2d10 +6 +2d6 = 24 total |
| HEDP | Grenade + six Basic + parts → six | One hour/batch | 21 gp each | 5d6 = 17.5 Piercing; 20 ft radius, DC 15 DEX half |
| Cone of Cold 5 | Basic + Carol's fifth-level scroll +22.30 gp discounted mounting | 2.22984 workdays +0.89194 hours | 157.09 gp | 8d8 +6 = 42 Cold with eligible Evoker bonus; DC 19 CON half |
| Shield 1 | Basic + Carol's first-level scroll +4.46 gp discounted mounting | 0.08919 workday +0.17839 hours | 7.69 gp | +5 AC; selected rifle Reaction delivery |
| Cure Wounds 1 | Basic + Carol's first-level scroll +4.46 gp discounted mounting | 0.08919 workday +0.17839 hours | 7.69 gp | 2d8 +6 = 15 healing |
| Cantrip | Basic + new scroll + separate mount | Two ×0.08919 workday, about 85.63 minutes | 3.68 gp | Depends on spell and donor scaling |
| Revivify 3 — example only | Basic + donor scroll +300 gp consumed diamond + discounted mounting | 5 × scribe M workdays +6 × installer M hours | 301 gp +150 gp × scribe M +150 gp × installer M | Eligible dead creature returns with 1 HP; qualified donor needed |

For handling an existing scroll with Carol's Arcana, a fifth-level mounting/removal job starts from 250 gp/10 hours and costs about 22.30 gp and 53.52 minutes after the multiplier. Cantrip mounting/removal alone costs about 1.34 gp and 42.81 minutes; new scribing is a separate job.

Cone of Cold has no priced consumed component in this example. Shield/Cure Wounds have V/S and no material component. Revivify is not a new grant or stock selection; Carol cannot supply it. Do not apply her Arcana discount to another donor's work.

Assembly moves the same real scroll into its container, not a duplicate or second scribing. An owned scroll needs mounting only; a new scroll needs both jobs. Extracting it preserves identity and snapshot. Mechanical loading of completed ammunition remains free under the weapon rule; that is separate from hours-long mounting work.

For binder versus prepaid casting and preserved donor statistics, use the [single-scroll lifecycle](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#one-physical-scroll--selected-2026-10-17). Mounting/removal costs follow the linked handling schedule; they do not create another scroll.

## Firing power, separate from ammunition

A canister holds 12 charges. Basic/Arcane use one per projectile; Precision Basic/Arcane use four; every stored Spellround and HEDP uses two, including cantrip, healing and Shield. Current 12 gp refills allocate 1 gp reagents per charge; the unapproved 120 gp proposal would allocate 10 gp per charge.

| Shot | Ammo + power at current refill | If 120 gp proposal were approved |
|---|---:|---:|
| Basic | 2 gp | 11 gp |
| Arcane | 12 gp | 21 gp |
| HEDP | 23 gp | 41 gp |
| Cone of Cold 5 | 159.09 gp | 177.09 gp |
| Shield / Cure Wounds 1 | 9.69 gp | 27.69 gp |
| Cantrip Spellround | 5.68 gp | 23.68 gp |
| Revivify 3 example | 303 gp +150 gp × scribe M +150 gp × installer M | 321 gp +150 gp × scribe M +150 gp × installer M |
| Precision Basic / Arcane | 5 gp / 15 gp | 41 gp / 51 gp |

Allocated reagent value is not another at-fire fee. A full refill still costs one whole first-level slot and one hour; do not create usable fractional slots. A full canister supports 12 ordinary Basic/Arcane projectiles, six Spellround/HEDP or three Precision projectiles.

[Carol's sheet](../Character%20Sheets/Carol%20Elfnein.md#aetherlock-summary) owns inventory counts and their charge budget. Rests do not refill physical rounds or canisters.

Prior sources, recorded as verified 2026-10-17: [scribing](https://www.dndbeyond.com/sources/dnd/br-2024/equipment#ScribingSpellScrolls), [scrolls](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items-a-z#SpellScroll), and [Wizard copying](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#Wizard). Universal scroll access, enhanced donor snapshots, binder behavior, mounting and weapon recipes are campaign mechanics. This cleanup does not claim fresh source verification.
