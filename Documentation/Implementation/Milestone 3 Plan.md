# Milestone 3 Plan

Purpose: the working plan for Milestone 3, the core systems for spells, inventory, crafting and economy, as [Milestones](Milestones.md) defines it. Status: draft written 2026-10-23 at 12:10 am PDT (America/Los_Angeles) by the Claude Code engine chat while the user was away, for the user to review. Nothing here is a decision: settled rules are linked to the document that owns them, and everything else is a proposal or an open question. Milestone 2 is built and awaits the user's acceptance.

Selected decisions: none new. The slices below build only on rules already settled in the linked documents. Two slices whose rules are fully settled (S1 concentration capacity and S2 scroll crafting costs) were built on 2026-10-23 at 12:16 am PDT (America/Los_Angeles) so they are ready for review; they change no gameplay flow and add nothing to the sheet's display yet.

Open questions: listed by topic under [Questions for the user](#questions-for-the-user), one topic per question round, as AGENTS.md asks. Turns, rests, the casting request workflow and game-clock effects stay in Milestone 5; accounts and campaigns stay in Milestone 4.

## What is already settled

These rules are selected and owned elsewhere; Milestone 3 implements them rather than re-deciding them.

| Area | Settled rule | Owner |
|---|---|---|
| Spellbooks | Every spell, cantrips included, lives in a book; 16 entries; eligible accessible entries are ready | [Spell Containers](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#books-and-spell-readiness) (built in Milestone 2) |
| Scroll identity | One physical scroll item that is scribed, acquired, mounted, removed, transferred and consumed, never duplicated | [One physical scroll](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#one-physical-scroll--selected-2026-10-17) |
| Three scroll uses | Loose one-shot (prepaid, scribe's snapshot, anyone may use); mounted in a binder (current caster pays and uses own statistics); installed in a Spellround (snapshot fired by the rifle, consumed on release) | same |
| Snapshots | Formulas, not rolls: scribe, spell, cast level, DC, attack, scaling, enhancements, options | [Snapshot contents](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#snapshot-contents-and-casting-provenance) |
| Scribing costs | Published baseline table by spell level, times the scribe's Arcana multiplier M = 3^((5 − A)/5); upcast scrolls priced at their cast level | [Scribing](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#scribing-mounting-and-removal) |
| Mounting and removal | 50 gp and two hours per spell level (cantrips 15 gp and one eight-hour workday), times the operator's M | same |
| Concentration | Capacity one by default; authored abilities may raise it; only instances that need concentration occupy it | [Concentration capacity](../Systems/Spell%20Effects%20and%20Active%20State.md#concentration-capacity--selected-2026-10-20) |
| Containers | Depth, capacity warnings, slots and kinds, dragging rules | [Spell Containers](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md) (built in Milestone 2) |
| Aetherlock | Chambers, rounds, fuzes, canisters, charge costs, replacement lockout | [Aetherlock Engineered Rounds](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md) and [Costs and Damage](../Class%20Reference/Aetherlock%20Costs%20and%20Damage.md) |

## Proposed build slices

Each slice ends with tests and with its documents updated. Slices marked *needs answers* wait for the questions below.

1. **S1 — Concentration capacity** (settled; built 2026-10-23, engine only). A `concentration` system: capacity from the ruleset's `defaultCapacity` plus grants aimed at `concentration.capacity`; occupancy from active effects whose spell needs concentration; a visible warning when more are maintained than the capacity. The replacement prompt and automatic loss belong to the casting workflow in Milestone 5.
2. **S2 — Scroll crafting costs** (settled; built 2026-10-23, engine only). A `scroll-crafting` system: the character's Arcana multiplier; scribing materials and workdays for every spell level; mounting and removal fees and time; eligibility (Arcana or Calligrapher's Supplies proficiency). It calculates and explains; it does not yet run a crafting job.
3. **S3 — Spell details** (*needs answers*, topic A). Structured facts for each spell: casting time, range, components and costly materials, duration, concentration, ritual, attack or save, damage or healing formulas and upcast scaling, researched from 2024 sources and stored as facts, never as copied rules text.
4. **S4 — Scrolls as items** (*needs answers*, topic B). A scroll item kind carrying its snapshot; scribing one creates the item; mounting places it in a binder or Spellround; removal takes it out; the three uses above.
5. **S5 — Ammunition and charges** (*needs answers*, topic C). Round stock and canister charges as resources the later casting workflow can hold and spend; the charge-cost table from the weapon rules as data.
6. **S6 — Currency** (*needs answers*, topic D). Coins and wealth, how they are stored and shown, and how purchases and crafting debit them.
7. **S7 — Inventory lifecycle** (*needs answers*, topic E). Transferring items between characters, selling, losing and destroying them, and what happens to the contents of a container that leaves.
8. **S8 — Crafting jobs** (*needs answers*, topic F). Tracking a job from start to finish: which score applies, temporary buffs, work time, debiting materials, and other recipes (magic items, canister refills, Artificer replicas and elixirs).

## Questions for the user

Asked one topic at a time when the user is back. The engine chat does not answer these itself.

**A. Spell details (S3)**

1. Which spells first: only Carol's 32, or a wider published set?
2. Should a spell's panel show any rules prose at all? Copyright limits reproducing the books; the proposal is structured facts plus a link to the official source.
3. Which 2024 source to verify against when sources disagree (D&D Beyond, the SRD 5.2 PDF, or the wikidot transcription used for class lists)?

**B. Scrolls as items (S4)**

1. Does a scroll mounted in a binder count toward the binder's 16 entries, and is a binder a different item from a spellbook?
2. When a one-shot scroll is used, does the item disappear from the inventory, or stay as a "spent" record for history?
3. What does a loose scroll weigh (needed for carried weight)?
4. Who may scribe for whom in Milestone 3, given that donors and campaigns come later?

**C. Ammunition and charges (S5)**

1. Do rounds and canister charges become resources the sheet shows as counters, or stay inventory quantities only?
2. Should the sheet let the player spend a charge by hand now (before the Milestone 5 casting workflow), as a manual adjustment?

**D. Currency (S6)**

1. Which coins (cp, sp, ep, gp, pp) and do coins have weight (published: 50 coins per pound)?
2. Is money a line in the inventory (a coin pouch), a separate wallet value on the sheet, or both?
3. Do purchases and crafting debit money automatically, or does the player adjust it by hand?
4. Rounding: to the copper, or kept exact until displayed? (Settled scroll costs are fractional, such as 1.34 gp.)

**E. Inventory lifecycle (S7)**

1. Giving an item to another character: a move between two sheets in one save, or a copy plus deletion?
2. Selling: a fixed share of the price (published guidance is half), a DM-set price, or by hand?
3. Lost or destroyed items: deleted, or kept as a record?
4. Does a container's action cost (retrieving an item from a bag) matter yet, or stay a Milestone 5 rule?

**F. Crafting jobs (S8)**

1. Does a crafting job use the score at the start of the job, or the current score when it completes? Do temporary buffs count?
2. Is work time tracked in calendar days on the game clock (Milestone 5), or as a simple counter now?
3. Which recipes matter first: scrolls, magic items, Aetherlock rounds, canister refills, replicas, elixirs?
4. The parked economy proposals (120 gp canister refill, DIY casings): keep parked, or decide now?

## Proposed acceptance (to agree with the user)

- S1 and S2 calculate Carol's values exactly as the settled documents state (for example, a sixth-level scroll at Arcana +16 costs about 891.94 gp and 3.56774 workdays; a fifth-level mounting about 22.30 gp and 53.52 minutes).
- Each further slice adds unit tests for its rules and a browser check for what it shows.
- No slice presents an unbuilt workflow (casting, turns, campaign approval) as working.
