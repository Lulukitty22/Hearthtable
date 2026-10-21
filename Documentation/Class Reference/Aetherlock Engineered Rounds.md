# Aetherlock Engineered Rounds

Updated 2026-10-18. This document owns the selected campaign mechanics for Carol's granted custom rifle; [Carol's sheet](../Character%20Sheets/Carol%20Elfnein.md) owns her build and [Costs and Damage](Aetherlock%20Costs%20and%20Damage.md) owns the ledger. Runtime implementation is deferred. Remaining questions concern unusual payloads, critical/Potent Cantrip mapping and manufacturing details listed below; settled firing, charge and scroll rules remain usable.

## Rifle and actions

| Rule | Selected value |
|---|---|
| Attunement | Requires an Artificer. Aetherlock, permanent Wand and permanent Manifold use Carol's three slots. |
| Frame | Two-Handed rifle, no Light property. Weight remains open. |
| Capacity | Six unrestricted chambers, with any available mix. Physical rounds do not refill on rests. |
| Range | 80/240 ft. Attack rolls have Disadvantage beyond 80 ft; no delivery beyond 240 ft. This replaces compatible payload casting range, including Touch; other area/target restrictions remain except explicit Self/cone changes. |
| Aim | d20 +11: INT +6 and proficiency bonus +5 under the proficient INT-guidance campaign rule. Wand does not boost gun aim. |
| Basic damage | 2d10 +6 Piercing, mean 17. Spellround and HE-FRAG replace this damage entirely. |
| Discharge | Each permitted attack fires 1–3 Basic/Arcane projectiles, or one Spellround/HE-FRAG. No burst containing Spellround/HE-FRAG. Each projectile consumes its round and charges and receives applicable resolution. |
| Handling | Chamber selection and fuze programming are part of firing. Loading existing completed rounds has no separate action cost. This creates no new ammunition. |
| Guise | Two attack opportunities in its Attack action: up to six Basic/Arcane projectiles, or two Spellround/HE-FRAG. No class Extra Attack outside Guise. |
| True Strike | A fresh Magic action with one weapon attack and one enhanced projectile. It is not a free cantrip added to Guise attacks or a burst-wide rider. |

Charge-canister replacement has a separate Bonus Action and readiness delay below. Six chambers and 12 charges are different limits.

## Fuzes and delivery

- **Impact:** release at first contact. On a miss, the DM determines collision; the round is consumed and the payload follows its valid-target rules there. A wall is not a creature. Misses do not guarantee perfect area placement.
- **Airburst:** release at a selected point along flight, unless earlier contact intervenes. Flight descriptions are flavor; there is no velocity simulation, penetration, depth delay or next-turn timer.
- **Self:** affect the holder without a projectile. A personal Self spell may instead transfer to a hit target using Impact under the selected campaign exception. Choose at firing on the same round; no blank recipe. This does not admit arbitrary longer-duration payloads.
- Compatible cones originate at release, with direction chosen at firing, including downward. Keep normal area, donor DC and saves.

Use normal spell attack/save/automatic resolution. Attack payloads use gun aim versus AC; save-only payloads use individual saves against stored DC without another AC gate. Healing has no invented attack roll. Shield's delivery exception is below. A precise noncombat point may use AC 10 when the DM calls for it; this is not a second gate for area victims or homing through obstructions.

Scorching Ray retains its separate ray attacks: one successful aim does not make every ray hit. One round supplies the paid spell, not one round per ray. Ray rolls are not extra weapon discharges; no secondary-range bypass or per-ray True Strike is granted.

## Ammunition and manufacture

The 1 gp Basic Round is the complete physical base. Crafting an enhanced round consumes that base and creates one completed variant; it does not retain a free base or stack all payload types. No extra identical casing fee applies.

| Type | Selected recipe / result |
|---|---|
| Basic | Purchased unit 1 gp. Raw manufacture remains unspecified. Damage 2d10 + INT Piercing. |
| Arcane | One Basic + 5 gp crystal dust + 5 gp runic ink; 10 minutes enchanting, no slot. Damage 2d10 + INT Piercing + 2d6 Force; mean 24 for Carol. |
| Spellround | One actual crafted scroll mounted into one Basic Round. Pay scribing and specific consumed components once, then the selected mounting job. No additional payload slot payment. |
| HE-FRAG / HEDP | One complete 100 gp grenade + six Basic Rounds + 20 gp parts; one hour with Tinker's Tools/proficiency produces six rounds, 126 gp/batch or 21 gp each. |

### Spellrounds and snapshots

Eligible duration is instantaneous or one round, subject to recipe compatibility; Shield is an explicit Reaction exception. No blanket longer concentration-buff or reaction-spell access is granted. A qualified scribe makes the scroll under the recorded published prerequisites. Anyone may use its one-shot cast under the campaign exception.

The scroll saves donor identity, cast level/DC, applicable modifiers, scaling and chosen options as **formulas**, rolled on use. Later level/equipment/stat changes do not rewrite it. Eligible Empowered Evocation is saved once: Carol's +6 applies to one qualifying Wizard Evocation damage roll, not every spell or ray. Never add it again at release. Stored areas have no Sculpt Spells safe pockets; direct casting retains normal Sculpt.

There is no concentration merely while stored. Carol maintains required concentration after release under the current weapon rule, with one normal concentration. Storage does not make concentration invulnerable.

The same physical scroll can be removed intact before use; mounting never duplicates it. Use the canonical [scribing, mounting and removal schedule](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#scribing-mounting-and-removal) and [Arcana multiplier](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#selected-arcana-multiplier) for those separate operations. The [cost ledger](Aetherlock%20Costs%20and%20Damage.md#completed-ammunition) supplies worked ammunition prices.

Firing pays no new payload slot. Guise activation does use a slot; retain the recorded 2024 one-slot-cast-per-turn restriction for another slot-funded cast that turn. Ordinary attacks and cantrips remain separate options. Rests do not restore expended rounds; new stock requires manufacture or acquisition. No expiration or stock cap has been selected.

### True Strike examples

Fresh True Strike uses the current wielder's cast, outside the round snapshot and fuze. At Carol's total level 15, its selected +2d6 Radiant applies to the directly hit creature for compatible damaging shots, not the whole area or each ray. It does not turn all payload damage Radiant. Support shots omit it.

Basic + True Strike averages 24 (2d10 +6 +2d6). Arcane + True Strike averages 31. A first-level Ray of Sickness round plus the fresh rider averages 16 (2d8 Poison +2d6 Radiant), without Basic damage. Cure Wounds 1 averages 15 healing (2d8 +6), without True Strike. Critical-hit and Potent Cantrip mapping remain open; do not double or halve unrelated stored area damage automatically.

### Shield delivery

When Carol or a visible willing ally is hit, Carol may spend her Reaction to discharge a loaded Shield round from an already-held, ready rifle. No reload is included. Self delivery needs no aim roll. Ally delivery uses gun aim d20 +11 against fixed DC 10, with normal gun attack/range rules, and deals no bullet damage.

A failed delivery consumes the round, Reaction and applicable charges. Successful delivery adds +5 AC against the triggering hit before damage and grants normal Magic Missile protection, until the start of **Carol's** next turn. It competes with her other Reactions. There is no proactive alternative, general offensive reaction fire or blanket unwilling-target rule. Readiness lockout below also blocks rifle Shield; ordinary directly cast Shield follows its own rules.

### HE-FRAG / HEDP

Each round deals 5d6 Piercing in a 20 ft-radius sphere, DC 15 DEX half; mean 17.5 before defenses. It uses Impact/Airburst, replaces Basic damage, has friendly fire, and gains no slot or Evoker bonus. HEDP is the selected name, not an additional armor-piercing mechanic.

The 100 gp grenade price and conversion allowance are campaign selections, not published price claims. This does not manufacture a free grenade or add free rounds to Carol's existing stock. Allocated power reagents add 2 gp per normal shot at the current refill price; full-canister slot/work costs remain separate.

## Charges, Precision and replacement

A reusable canister holds **12 charges**. Physical ammunition and magical power are distinct owned supplies.

| Mode | Charges per projectile | Example |
|---|---:|---|
| Basic/Arcane | 1 | Triple burst costs 3; two Guise triple bursts cost 6. |
| Any stored Spellround, including cantrip/healing/Shield | 2 | Two Guise shots cost 4. |
| HE-FRAG | 2 | Two Guise shots cost 4. |
| Precision Basic/Arcane | 4 total, including +3 surcharge | One/two/three precise projectiles cost 4/8/12; each gets Advantage. |

Precision has no additional range, numeric attack bonus or DC increase. Rifle range remains 80/240 ft; normal Advantage/Disadvantage interactions apply. No Precision benefit is granted to save-only payloads. Any application beyond Basic/Arcane needs an explicitly selected rule.

Replacing a canister costs a **Bonus Action**, allowed after firing on the same turn. Replacement immediately locks the rifle for the rest of that turn, intervening off-turn use, and the entire next own turn. It becomes ready at the start of the second subsequent own turn: replace on N, blocked through N+1, ready N+2.

Example: fire and replace on turn 1; rifle unavailable throughout turn 2; ready at the start of turn 3. Other actions and casting remain available. The delay starts at actual replacement, not depletion. If Guise activation used the Bonus Action on turn 1, replacement must wait; replacing on turn 2 means blocked turn 3, ready turn 4. Guise's ongoing second attack itself does not use a Bonus Action.

### Canister economy

Refilling an empty reusable canister currently consumes **12 gp magical reagents, one first-level slot and one hour using Tinker's Tools/proficiency**. The proposed 120 gp reagent cost is not selected. The recipe fills an existing shell; new-shell pricing and partial refills remain open. Rests do not refill charges, though recovered slots can fund paid work. Reagent flavor does not create another recipe or free refill.

Character quantities belong to the sheet, not this reusable weapon definition. Existing filled canisters do not debit current gold/slots.

## Character loadout

[Carol's sheet](../Character%20Sheets/Carol%20Elfnein.md#aetherlock-summary) owns selected ammunition, filled canisters, donor-specific payload values and the worked charge budget. This weapon definition governs how those resources are used; it does not duplicate the inventory. Initial chamber order remains unspecified.

## Open work

Open: unusual payloads, critical/Potent Cantrip mapping, unwilling Self recipients, manufacturing tools/workspace and donor participation, raw Basic/casing supply, rifle weight, initial chamber order, new canister shells and partial refills. The 120 gp refill and DIY casing proposal are parked. These minor choices do not block current [campaign architecture](../Systems/Campaigns%20and%20Shared%20Data.md); implementation remains deferred.

Prior research sources: [2024 weapons/actions](https://www.dndbeyond.com/sources/dnd/br-2024/equipment), [casting](https://www.dndbeyond.com/sources/dnd/br-2024/spells), [Evoker](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#Evoker), [grenade](https://roll20.net/compendium/dnd5e/Items%3AFragmentation%20Grenade?expansion=33359), [Scorching Ray](https://roll20.net/compendium/dnd5e/Spells%3AScorching%20Ray?expansion=32231), [True Strike](https://www.dndbeyond.com/spells/2619204-true-strike), and [Booming Blade errata](https://media.wizards.com/2020/dnd/downloads/SCAG-Errata.pdf). Booming Blade remains melee within 5 ft, not a ranged bullet effect. This cleanup does not claim fresh source verification.
