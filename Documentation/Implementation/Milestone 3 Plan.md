# Milestone 3 Plan

Purpose: the working plan for Milestone 3, the core systems for spells, inventory and economy, as [Milestones](Milestones.md) defines it. Status: drafted 2026-10-23 at 12:10 am PDT (America/Los_Angeles); the user answered topics A–F on 2026-10-23 at 1:24 am PDT (America/Los_Angeles). Decisions live in the documents linked below; this plan only orders the work. S1 and S2 are built; S3–S7 are next. Milestone 2 still awaits the user's acceptance.

Selected decisions: crafting jobs and every recipe moved to Milestone 5b ([Crafting Jobs](../Systems/Crafting%20Jobs.md)), so Milestone 3 no longer runs crafting. The other answers are recorded in their owning documents and summarised under [Questions and answers](#questions-and-answers).

Open questions: none block Milestone 3. Deferred ideas are recorded in [Currency and Trade](../Systems/Currency%20and%20Trade.md#open-design), [Crafting Jobs](../Systems/Crafting%20Jobs.md#open-design) and [Notes for Milestone 5](Milestones.md#notes-for-milestone-5). Turns, rests, the casting workflow and game-clock effects stay in Milestone 5; accounts, campaigns and trading stay in Milestone 4 or later.

## What is already settled

These rules are selected and owned elsewhere; Milestone 3 implements them rather than re-deciding them.

| Area | Settled rule | Owner |
|---|---|---|
| Spellbooks | Every spell, cantrips included, lives in a book; 16 entries; eligible accessible entries are ready | [Spell Containers](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#books-and-spell-readiness) (built in Milestone 2) |
| Scroll identity | One physical scroll item that is scribed, acquired, mounted, removed, transferred and consumed, never duplicated | [One physical scroll](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#one-physical-scroll--selected-2026-10-17) |
| Three scroll uses | Loose one-shot (prepaid, scribe's snapshot, anyone may use); mounted in a binder (current caster pays and uses own statistics); installed in a Spellround (snapshot fired by the rifle, consumed on release) | same |
| Snapshots | Formulas, not rolls: scribe, spell, cast level, DC, attack, scaling, enhancements, options | [Snapshot contents](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#snapshot-contents-and-casting-provenance) |
| Scribing costs | Published baseline table by spell level, times the scribe's Arcana multiplier M = 3^((5 − A)/5); upcast scrolls priced at their cast level | [Scribing](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#scribing-mounting-and-removal) |
| Mounting and removal | 50 gp and two hours per spell level (cantrips 25 gp and one hour), times the operator's M | same |
| Concentration | Capacity one by default; authored abilities may raise it; only instances that need concentration occupy it | [Concentration capacity](../Systems/Spell%20Effects%20and%20Active%20State.md#concentration-capacity--selected-2026-10-20) |
| Containers | Depth, capacity warnings, slots and kinds, dragging rules | [Spell Containers](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md) (built in Milestone 2) |
| Aetherlock | Chambers, rounds, fuzes, canisters, charge costs, replacement lockout | [Aetherlock Engineered Rounds](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md) and [Costs and Damage](../Class%20Reference/Aetherlock%20Costs%20and%20Damage.md) |

## Build slices

Each slice ends with tests and with its documents updated.

1. **S1 — Concentration capacity** (built 2026-10-23, engine only). Capacity from the ruleset's `defaultCapacity` plus grants aimed at `concentration.capacity`; occupancy from active effects whose spell needs concentration; a visible warning when over capacity. The replacement prompt and automatic loss belong to Milestone 5.
2. **S2 — Scroll crafting costs** (built 2026-10-23, engine only). The Arcana multiplier, scribing costs for every level, mounting and removal costs (cantrips 25 gp and one hour) and eligibility. It calculates and explains only.
3. **S3 — Spell details.** Structured facts for Carol's spells, then Capella's, verified against SRD 5.2 and then the 2024 Player's Handbook. Each spell panel shows a summary, the full SRD text where the spell is in the SRD (expandable, credited), then the facts, with linked facts such as class lists opening the usual hover and click windows. A separate overflow spellbook in Carol's inventory holds a few extra ritual spells and spells with costly or consumed components for testing ([Spell details and display](../Systems/Spell%20Effects%20and%20Active%20State.md)).
4. **S4 — Scrolls as items.** A scroll item kind carrying its snapshot and a spent marker; 0.1 lb loose; a spellbook works as the binder, and a mounted scroll takes one entry. Scrolls drag freely into and out of books, and the app shows what mounting or removal would cost; paying for it waits for 5b. Scribing new scrolls waits for 5b, so test scrolls are entered as content ([Binders and spent scrolls](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md)).
5. **S5 — Charge counters.** Rounds stay inventory items; each canister's charges also show as a counter in the resources area, linked to the canister. Display only: no manual spending before Milestone 5.
6. **S6 — Coins.** The five coins as stackable inventory items, 50 to the pound, and a wallet total on the sheet. An engine payment function that makes change and rounds a fractional price up to the next copper, ready for shops and 5b ([Currency and Trade](../Systems/Currency%20and%20Trade.md)).
7. **S7 — Item lifecycle.** Marking an item lost or destroyed (weightless, kept until deleted), and an alert that asks what to do with the contents when a container holding items is moved ([Item lifecycle](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md)).

Moved to Milestone 5b: crafting jobs, scribing, paid mounting and removal, Aetherlock round assembly, canister refills, magic items, replicas and elixirs.

## Questions and answers

Asked one topic at a time on 2026-10-23; each topic notes where its answers are recorded.

**A. Spell details (S3)** — answered 2026-10-23 at 12:58 am PDT; recorded in [Spell details and display](../Systems/Spell%20Effects%20and%20Active%20State.md#spell-details-and-display--selected-2026-10-23-at-1258-am-pdt-americalos_angeles).

1. Which spells first: only Carol's 32, or a wider published set?
2. Should a spell's panel show any rules prose at all? Copyright limits reproducing the books; the proposal is structured facts plus a link to the official source.
3. Which 2024 source to verify against when sources disagree (D&D Beyond, the SRD 5.2 PDF, or the wikidot transcription used for class lists)?

**B. Scrolls as items (S4)** — answered 2026-10-23 at 12:58 am PDT: a spellbook is the binder and a mounted scroll takes one entry; a used scroll stays as spent; a loose scroll weighs 0.1 lb; cantrip mounting is now 25 gp and one hour. Recorded in [Spell Containers](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md). Question 4: in Milestone 3 a character scribes only into their own inventory, with their own Arcana; giving scrolls to others waits for transfers (topic E) and campaigns.

1. Does a scroll mounted in a binder count toward the binder's 16 entries, and is a binder a different item from a spellbook?
2. When a one-shot scroll is used, does the item disappear from the inventory, or stay as a "spent" record for history?
3. What does a loose scroll weigh (needed for carried weight)?
4. Who may scribe for whom in Milestone 3, given that donors and campaigns come later?

**C. Ammunition and charges (S5)** — answered 2026-10-23 at 1:02 am PDT (America/Los_Angeles): inventory items plus a linked charge counter; no manual spending before Milestone 5. Recorded in [Aetherlock Engineered Rounds](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md).

1. Do rounds and canister charges become resources the sheet shows as counters, or stay inventory quantities only?
2. Should the sheet let the player spend a charge by hand now (before the Milestone 5 casting workflow), as a manual adjustment?

**D. Currency (S6)** — answered 2026-10-23 at 1:10 am PDT: all five coins at 50 per pound, as inventory items; automatic payment after review; exact calculated costs paid rounded up to the copper. Recorded in [Currency and Trade](../Systems/Currency%20and%20Trade.md), with the user's trade-window and market-value ideas.

1. Which coins (cp, sp, ep, gp, pp) and do coins have weight (published: 50 coins per pound)?
2. Is money a line in the inventory (a coin pouch), a separate wallet value on the sheet, or both?
3. Do purchases and crafting debit money automatically, or does the player adjust it by hand?
4. Rounding: to the copper, or kept exact until displayed? (Settled scroll costs are fractional, such as 1.34 gp.)

**E. Inventory lifecycle (S7)** — answered 2026-10-23 at 1:16 am PDT (America/Los_Angeles): no transfers before the trade window; lost or destroyed items are marked; moving a full container asks about its contents; lost or stolen containers take their contents; action costs wait for Milestone 5; selling stays open. Recorded in [Spell Containers](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#item-lifecycle--selected-2026-10-23-at-116-am-pdt-americalos_angeles).

1. Giving an item to another character: a move between two sheets in one save, or a copy plus deletion?
2. Selling: a fixed share of the price (published guidance is half), a DM-set price, or by hand?
3. Lost or destroyed items: deleted, or kept as a record?
4. Does a container's action cost (retrieving an item from a bag) matter yet, or stay a Milestone 5 rule?

**F. Crafting jobs (S8)** — answered 2026-10-23 at 1:24 am PDT: rules recorded in [Crafting Jobs](../Systems/Crafting%20Jobs.md); building crafting jobs and all recipes moved to Milestone 5b. Until then scrolls drag freely into and out of books with the mounting cost shown. Question 4 (parked economy proposals) stays parked.

1. Does a crafting job use the score at the start of the job, or the current score when it completes? Do temporary buffs count?
2. Is work time tracked in calendar days on the game clock (Milestone 5), or as a simple counter now?
3. Which recipes matter first: scrolls, magic items, Aetherlock rounds, canister refills, replicas, elixirs?
4. The parked economy proposals (120 gp canister refill, DIY casings): keep parked, or decide now?

## Proposed acceptance (to agree with the user)

- S1 and S2 reproduce Carol's documented values (a sixth-level scroll at Arcana +16 costs about 891.94 gp and 3.56774 workdays; a fifth-level mounting about 22.30 gp and 53.52 minutes; a cantrip mounting about 2.23 gp and 5.35 minutes).
- Every spell in Carol's books, and in the overflow book, shows a summary, its facts and, where it is in SRD 5.2, the credited full text.
- A test scroll can be dragged into a book, takes an entry, shows its mounting cost, and can be marked spent.
- The canister charge counter, coin stacks, wallet total and coin weight appear on Carol's sheet; the payment function passes its rounding and change tests.
- An item can be marked lost or destroyed and stops counting weight; moving a container with contents asks first.
- Each slice adds unit tests for its rules and a browser check for what it shows. No slice presents an unbuilt workflow (casting, crafting, trading) as working.
