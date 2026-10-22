# Spell Containers and Consumable Sources

This document owns container access, capacity, spellbook readiness and the single-scroll lifecycle, including crafting and saved casting formulas. These are selected design requirements, not implemented behavior. Remaining design questions are listed at the end.

Books and bags are owned inventory containers with nested spell entries or items. Keep reusable definitions, owned instances and casting/effect state separate. Preserve unknown and nested data through save/reload/import/export before choosing a migration schema.

## Accessibility — selected 2026-10-17

Carried items at physical depth 0 or 1 are accessible. At depth 2 or deeper, they remain inaccessible for use until moved shallower. This replaces the earlier unrestricted-access proposal.

| Example | Physical depth | Accessible |
|---|---:|---|
| Potion or book loose in carried inventory | 0 | Yes |
| Potion or book inside a backpack | 1 | Yes |
| Potion inside a directly carried Bag of Holding | 1 | Yes |
| Potion inside a Bag of Holding inside a backpack | 2 | No |
| Book inside a pouch inside a backpack | 2 | No |

Count enclosing physical containers from the character inventory root. UI tabs, spell data and stored casting configurations do not add physical layers. Spells inherit their book's accessibility: a book in a backpack is accessible; one in a bag inside a backpack is not.

Access is separate from ownership, carried status, attunement, equipment, class eligibility, charges and activation costs. Opening a tab neither equips an item nor consumes contents. Left-behind, lost or transferred items are not automatically carried. Access does not grant free retrieval or safe extradimensional nesting.

## Attunement — selected 2026-10-22 at 1:42 pm PDT (America/Los_Angeles)

Attunement is an ordered list of slots, like concentration capacity. The inventory records which lines are attuned, in the owner's chosen order. The number of slots is the ruleset's base (3 in Vanilla+) plus any grants that add slots, such as Indomitable. If more items are attuned than there are slots, the items at the end of the order are flagged as over the limit and a warning names them; nothing is unattuned automatically. An item that requires a class (the Aetherlock requires an Artificer) warns when attuned without it. Items say when their grants apply: while owned, equipped, held, attuned, or attuned and held.

## Movement, removal and deletion

Proposed movement behavior: moving a container preserves descendant identities and contents, then recalculates access at the new depth. Packed items remain viewable/editable, with use controls explaining inaccessibility. These are UX proposals, not new combat action-cost rules.

**Selected deletion rule:** block deletion until the container is empty. The user must remove or move contents first. No automatic unpacking, movement to root, or recursive child deletion. Spell entries count as book contents. An empty child container remains an item in its parent until removed.

This deletion rule applies to editor and sheet deletion controls. Gameplay dropping, selling, transferring and destruction still need lifecycle rules. Prevent self-containment, cycles, duplicate ownership, lost contents and double-counted weight. Moving/retrieving inner containers and handling their action costs remain open.

## Books and spell readiness

- Every spell, including cantrips, has a book/container entry. Opening a spellbook opens its contents in viewer and editor, like opening a bag or chest.
- Books have editable names and user-controlled saved tab order. Each book record stores its `title` and `order` (implemented 2026-10-22 at 2:26 pm PDT (America/Los_Angeles)); books without an order come last.
- A normal campaign book holds 16 spell entries. Every contained eligible spell is ready. Multiple books add capacity without another global preparation cap; they do not grant class cantrips, new spell tiers or extra slots.
- Cantrips use normal spaces. There is no special cantrip container subtype or capacity exemption.
- All classes store spells in book items. The character's applicable class/level ability to cast a spell establishes eligibility without another learning step; physical acquisition, scribing and mounting remain distinct operations with their selected costs.
- Readiness derives from accessible eligible contents without a hidden global preparation filter or secondary-book penalty. Preserve normal casting time, components, range, concentration, saves, effects and stacking unless explicitly changed.
- [Carol's sheet](../Character%20Sheets/Carol%20Elfnein.md#spell-resources-and-books) owns her Enduring book inventory and contents. Protection does not increase capacity or consume active-replica allowances.

The 16-entry/all-ready system is a campaign rule, not published preparation. Books do not grant class spell access; higher shared slots support eligible upcasts rather than new class spell tiers. Ritual and source questions remain below. The [published class rules](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes) provide the comparison, with explicit campaign exceptions taking precedence.

## Capacities — published defaults selected 2026-10-17

Warn clearly when a known count, mass or volume limit is exceeded, and allow an **explicit override**. Preserve contents and keep the warning visible. An override permits retaining the overfull state; it does not change the published capacity. Do not auto-unpack, delete items or simulate destruction during editor validation. Imports retain data.

Unknown measurements are not zero or verified fit. Exact incomplete-data messaging, volume estimates, override controls and audit representation remain open.

| Container | Contents limit | Distinction |
|---|---|---|
| Bag of Holding | 500 lb and 64 cubic feet | Fixed carried weight of 5 lb; both internal limits apply. |
| Backpack | 30 lb and 1 cubic foot | Contents contribute to carried weight. |
| Sack | 30 lb and 1 cubic foot | Separate owned container. |
| Pouch | 6 lb and 0.2 cubic foot | Physical capacity, not arbitrary item slots. |
| Basket | 40 lb and 2 cubic feet | Both limits apply. |
| Chest | 12 cubic feet | Do not add the legacy 300 lb limit silently. |
| Barrel | 40 gallons liquid or 4 cubic feet dry goods | Alternative modes, not combined allowances. |
| Quiver | 20 arrows | Count and permitted content type. |
| Campaign spellbook | 16 spell entries, including cantrips | Selected house rule, not a generic container limit. |

The prior research recorded these sources as verified on 2026-10-17: [2024 equipment](https://www.dndbeyond.com/sources/dnd/br-2024/equipment) and [Bag of Holding](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items-a-z#BagofHolding). This editorial cleanup does not claim a new rules verification.

Store applicable count/type, mass, volume and carried-weight behavior separately, with source and version. Ordinary nested contents count once. A Bag of Holding contributes its fixed 5 lb to an outer mundane container, not its contents' total mass; its external volume is distinct from its interior. An unspecified limit is not verified infinite storage.

Bag retrieval uses the published Utilize action. Published overloading/tearing and extradimensional nesting hazards remain gameplay rules, separate from data nesting and editor validation. They must not automatically erase records. Actual destruction/transfer handling needs design.

## One physical scroll — selected 2026-10-17

A scroll is one owned item that can be scribed, acquired, mounted, removed, transferred and consumed. Moving it changes parentage and use context; it never creates a duplicate. Preserve its identity and original scribe snapshot throughout. This replaces the proposed separate reusable-formula and charged-scroll types.

| Use | Payment and statistics | Result |
|---|---|---|
| Loose, one-shot cast | Prepaid; no new user slot/material payment. Use original scribe snapshot. | Scroll disintegrates after completed casting; normal interruption does not consume it. |
| Mounted in a book/binder | Current caster meets casting requirements and pays their normal resources. Use their current statistics and applicable bonuses. | Same scroll stays intact; original snapshot remains unchanged. |
| Installed in a Spellround | Prepaid snapshot supplies the spell; rifle charges and delivery rules still apply. | Scroll is consumed on payload release; projectile loss and failed delivery follow weapon rules. |

Anyone may use a one-shot scroll regardless of class or spell-tier access: this is an explicit campaign exception. Binder casting does not inherit that exemption. It uses the current caster's eligibility, DC, attack, scaling and applicable bonuses. Do not add donor and current-caster modifiers or choose the better value. For example, donor +8/current caster +4 uses +4; donor +2/current caster +4 also uses +4, where the feature applies.

Extracting a scroll restores access to its original paid snapshot, not an enhanced version generated by briefly mounting it. Buying an existing scroll avoids scribing work, but not the selected mounting operation.

## Snapshot contents and casting provenance

Save the scribe identity, spell and cast level, DC, attack bonus, ability/cantrip scaling, applicable enhancements, chosen options and resulting damage formulas/modifiers. **Save formulas, not rolled outcomes.** Carol's qualifying Evocation may preserve 8d8 + 6; its mean of 42 is not a saved roll.

Later changes to the scribe's level, statistics or equipment do not rewrite completed scrolls. Track feature provenance and scope; INT is not a universal damage bonus. Conditional and target-dependent choices need representation. Stored rounds do not gain Sculpt Spells protection. Concentration after release remains distinct from the absent scribe.

Separate three data layers:

1. Reusable definition: identity, source/version, timing, range, components, targets, duration and formulas.
2. Stored casting snapshot: supplying caster, actual paid cast level, applicable statistics/options and upcast formulas. Gun aim remains separate.
3. Owned instance: identity, parentage, contents, quantity/uses, consumed state and crafting provenance.

Fresh True Strike belongs to the current wielder's firing-time casting. It is not part of the scroll snapshot or fuze. Fuze selection changes delivery within approved rules, not the paid spell. See [Aetherlock](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md) for actions, Shield delivery, ammunition and charge timing.

## Scribing, mounting and removal

Scribing makes a **new scroll**. Under the recorded published baseline, Arcana or Calligrapher proficiency qualifies; the spell must be prepared each inscription day and required components available. Consumed components are spent on completion. Published scribing imposes no additional slot payment. Campaign one-shot eligibility and snapshot exceptions remain separate from that baseline.

Mounting secures an **existing scroll** in a binder or one-scroll Spellround. The selected baseline for levels 1–9 is 50 gp and two hours per spell level, multiplied by the operator's Arcana multiplier M. Mounting and removal use the same schedule for binders and Spellrounds. See the [completed-ammunition ledger](../Class%20Reference/Aetherlock%20Costs%20and%20Damage.md#completed-ammunition) for Carol's discounted fifth-level mounting example. This 2026-10-18 clarification supersedes the earlier undiscounted level 1+ handling rule. Moving an existing scroll does not charge for scribing a new one.

Cantrip mounting and removal each use a baseline of 15 gp and one eight-hour workday, multiplied by the operator's selected Arcana multiplier. This replaces the 25 gp/one-hour proposal. Creating a new cantrip scroll is a separate scribing operation with its own cost. Level 1+ mounting/removal also uses M under the latest clarification, with its distinct baseline of 50 gp/two hours per level.

No cheaper own-book backup rate or extra mounting Arcana check has been selected. Ordinary chamber loading of completed ammunition is free under the weapon rule; it is not the hours-long job of installing/removing its scroll.

### Upcast scroll level

Selected 2026-10-19: an eligible upcast scroll is saved and scribed at its actual cast level, not the spell's base level. For example, a fourth-level spell scribed as a sixth-level cast is a sixth-level scroll: use the sixth-level scribing baseline and retain its sixth-level formulas in the snapshot. This does not grant the scribe spell access they otherwise lack. Apply the normal Arcana multiplier and component requirements to that selected tier.

### Published scribing baseline

These are reference costs **before** the selected multiplier and specific consumed components. They are not Carol's final crafting prices or universal shop prices.

| Spell level | Materials | Eight-hour workdays |
|---|---:|---:|
| Cantrip | 15 gp | 1 |
| 1 | 25 gp | 1 |
| 2 | 100 gp | 3 |
| 3 | 150 gp | 5 |
| 4 | 1,000 gp | 10 |
| 5 | 1,500 gp | 25 |
| 6 | 10,000 gp | 40 |
| 7 | 12,500 gp | 50 |
| 8 | 15,000 gp | 60 |
| 9 | 50,000 gp | 120 |

Published Wizard transcription uses 50 gp/two hours per level for a new spell, or 10 gp/one hour per level for a known own-book copy. Published copying from a scroll requires an Arcana check and destroys it. Campaign physical mounting preserves the same scroll and must not be described as published transcription or a way to create cheap charged duplicates.

Prior sources, recorded as verified 2026-10-17: [scribing](https://www.dndbeyond.com/sources/dnd/br-2024/equipment#ScribingSpellScrolls), [scroll use/copying](https://www.dndbeyond.com/sources/dnd/br-2024/magic-items-a-z#SpellScroll), and [Wizard transcription](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes#Wizard). Published scroll rules provide the researched one-use analogue; that research question is closed. They do not establish every campaign exception above.

The estimated 0.1 lb/page and 1.6 lb/16 pages are not settled total book weights; cover/frame weight remains separate.

### Selected Arcana multiplier

Use **M = 3^((5 − A)/5)**, where A is the total Arcana modifier, not a d20 result. Only Arcana affects this multiplier. Calligrapher proficiency can qualify a scribe but does not supply an alternative score or an extra stacked tool bonus.

Multiply baseline scribing materials and work time by the scribe's M. Multiply mounting/removal fees and time by the operator's M, for both leveled spells and cantrips. Specific consumed components remain full price and required reusable components remain required. Purchases, other ammunition recipes and canister refills are unaffected.

| Total Arcana | Multiplier | Sixth-level example: 10,000 gp / 40 days |
|---|---:|---|
| 0 | 3 | 30,000 gp / 120 days |
| +5 | 1 | 10,000 gp / 40 days |
| +10 | 1/3 | 3,333.33 gp / 13.33333 days |
| +15 | 1/9 | 1,111.11 gp / 4.44444 days |
| +16, Carol | 0.08919350686224783 | 891.93507 gp / 3.56774 days |
| +20 | 1/27 | 370.37 gp / 1.48148 days |

Each +5 divides cost/time by three. The curve is positive and approaches zero. Evaluate the expression rather than a rounded decay constant. Preserve computational precision; display rounding must not turn positive costs into free work. One workday is eight hours; fractional-day estimates are allowed. Currency/work rounding, job-start score and temporary buff treatment remain open.

Arcana 0 or a negative score does not bypass proficiency eligibility. The +5 normalization is a house rule, not a published minimum.

Carol's derived scroll costs and work times belong in the [scribing ledger](../Class%20Reference/Aetherlock%20Costs%20and%20Damage.md#scribing-reference-and-multiplier); assembled-round totals and handling examples belong in [completed ammunition](../Class%20Reference/Aetherlock%20Costs%20and%20Damage.md#completed-ammunition). These examples do not debit existing stock or gold.

See [Costs and Damage](../Class%20Reference/Aetherlock%20Costs%20and%20Damage.md) for the complete ledger. The Basic Round is the complete 1 gp physical base, not an additional fee on top of an identical casing. Proposed DIY casings and the proposed 120 gp canister refill remain separate unresolved economics. Scroll extraction does not establish projectile recovery after firing.

## Remaining design work

- Movement/retrieval action costs and gameplay transfer, sale, loss or destruction of nonempty containers.
- Instance identities, cycle prevention, incomplete measurements, volume estimates and override UX.
- Conditional snapshot options. Upcast scroll tier/pricing is selected above; Spellround removal uses the same discounted schedule as binder removal.
- Rituals, duplicate spell identities/casting sources and class-granted spells when a book is lost.
- Crafting score/buff timing and display rounding.
- Lossless editor harvesting, definition conversion and migration; actual viewer/editor verification.

Implementation remains deferred while rules and architecture are discussed. Weapon-specific details belong in Aetherlock, not appended as another competing rules section here.

Related: [Campaigns and Shared Data](Campaigns%20and%20Shared%20Data.md), [Spell Effects and Active State](Spell%20Effects%20and%20Active%20State.md), and [Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md).
