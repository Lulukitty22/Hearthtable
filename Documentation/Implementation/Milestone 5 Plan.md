# Milestone 5 Plan

Purpose: the working plan for Milestone 5, the gameplay loop, as [Milestones](Milestones.md) defines it: the action inside a campaign. Status: drafted 2026-10-24 at 4:45 pm PDT (America/Los_Angeles), right after the user accepted Milestone 4; nothing is built, and the scope is not yet confirmed. Decisions live in the documents linked below; this plan orders the work and lists what still needs the user's answer.

Selected decisions: none yet for this plan. The roadmap's scope (Milestones): specify, then build, turns, initiative, rests and conditions; then the casting workflow (holds, execution-time approval, resolution, response polls, rolls and effects on the game clock). Carried into this milestone by the user: the Spellround and scroll-snapshot work, the spellbook rethink, spent scrolls and the play addresses ([Notes for Milestone 5](Milestones.md#notes-for-milestone-5)).

Open questions: listed by topic under [Questions for the user](#questions-for-the-user), asked one topic at a time, starting with the scope.

## What is already settled

| Area | Settled rule | Owner |
|---|---|---|
| Play addresses | `/Campaigns/<name>/Table` is the players' view of the game in progress, `/Campaigns/<name>/Table/Dungeon_Master` the DM's; the campaign's own address stays the out-of-character overview | [Web addresses](../Systems/Campaigns%20and%20Shared%20Data.md#account-organization-and-address-design) |
| Casting stages | Review → confirm and reserve (resource holds) → wait until eligible → DM approval at execution time → resolve; nothing spends at review; rejection releases every hold; players may cancel or revise before approval | [Casting workflow](../Systems/Spell%20Effects%20and%20Active%20State.md#casting-workflow--selected-2026-10-17) |
| Holds | Submitting moves every numeric cost (items, slots, charges) out of usable amounts into the request; returns add back and clamp to the current maximum; each transfer happens once despite retries | same |
| Timing | Instant (uses the response window) or Next Turn (waits for the actor's turn); Reaction is an action cost and trigger, not a third option | [Scheduling](../Systems/Spell%20Effects%20and%20Active%20State.md#scheduling-and-repeating-response-polls--selected-2026-10-17) |
| Response polls | After an event, resolve one response at a time and repoll until everyone skips the same poll or the DM force-skips; polls never add time or restore actions | same |
| Competing responses | The DM approves in order of submission; requests are rechecked before approval | [Competing submissions](../Systems/Spell%20Effects%20and%20Active%20State.md#competing-submissions-and-request-revisions) |
| Game clock | Effects count down on the shared game clock at turn boundaries and rounds; out of combat the DM advances time by an entered amount; no wall-clock countdown | [Active effects](../Systems/Spell%20Effects%20and%20Active%20State.md#active-effects-game-time-and-early-ending) |
| Concentration | Capacity (default one), separate saves per maintained spell, a replacement prompt at full capacity, loss on Incapacitated or death, voluntary ending; capacity is built (Milestone 3) | [Concentration](../Systems/Spell%20Effects%20and%20Active%20State.md#concentration-capacity--selected-2026-10-20) |
| Rolls | A target's player rolls their own save; the DM may take over; configured, custom-expression or manual-total input; one prompt accepts one result | [Roll ownership](../Systems/Spell%20Effects%20and%20Active%20State.md#roll-ownership-and-input-modes) |
| Partial automation | Automated, unknown and manual parts are marked; manual outcomes go through the same approval and log | [Structured effects](../Systems/Spell%20Effects%20and%20Active%20State.md#structured-effects-and-manual-adjudication) |
| Scrolls | A loose scroll uses its scribe's snapshot; a bound scroll uses the current caster; a Spellround's scroll is consumed on release | [Spell Containers](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md) |
| Authority | DMs approve at execution; a solo owner uses DM mode with no bypass; delegates submit for a character they control; Rules check authority, not game math | [Campaigns and Shared Data](../Systems/Campaigns%20and%20Shared%20Data.md#campaign-membership) |

## Proposed build slices

A proposal for the user to change. S1 is documentation only, because turns, initiative, rests and conditions have no specification yet.

0. **S0 — Carried over (must do).** Carol's Spellrounds become one Spellround item whose lines carry a scroll; the scribed-formula snapshot for every scroll; opening a scroll shows the full spell; the decision on core folder paths; and the spellbook rethink and spent-scroll ideas, decided before the casting workflow is built on them.
1. **S1 — Specify turns, initiative, rounds, rests and conditions.** Written with the user, topic by topic, into the Systems documents before any code.
2. **S2 — The table.** The players' view (`/Table`) and the DM's view (`/Table/Dungeon_Master`): who is in the scene, the turn order, whose turn it is, the round, the game clock and a campaign log.
3. **S3 — Turns and initiative.** Starting and ending an encounter, entering or rolling initiative, the order, next turn and the round counter, and each turn's action budget.
4. **S4 — Game clock and active effects.** Effects that start on activation and expire at turn boundaries, rounds or when the DM advances time; the DM ending an effect early; concentration's replacement prompt, loss and voluntary ending.
5. **S5 — Rests and conditions.** Short and long rests that reset resources by their reset type, and conditions applied, shown and used in calculations (Incapacitated ends concentration).
6. **S6 — Requests and holds.** Reviewing an action, confirming it (moving its costs into holds), Instant or Next Turn, cancelling, revising, rejection returning holds, all exactly once.
7. **S7 — Execution and resolution.** DM approval at the eligible moment, then resolution with costs consumed, effects applied, damage and healing, and the log; one action identity throughout.
8. **S8 — Rolls.** Prompts to the right player, DM takeover, configured, custom-expression and manual totals, shown and logged.
9. **S9 — Response polls.** One response at a time, repolling, force-skip, and the Shield example end to end.
10. **S10 — Items and the Aetherlock in play.** Using potions and scrolls, and firing the Aetherlock (rounds, charges, Spellrounds) through the same workflow.

## Questions for the user

**A. Scope.** The roadmap's Milestone 5 is large. Keep it as one milestone in the order above, or split it (for example turns, clock, rests and conditions first; then the casting workflow)? Are NPCs, monsters and encounters (now "Later" on the roadmap) needed in it, since a turn order without enemies is thin?

**B. Turns and the clock.** How initiative is entered or rolled and ties broken; whether rounds restart for each encounter while campaign time continues (a proposal from the prototypes); how long a round is on the game clock; what starts and ends an encounter.

**C. Action budget.** Whether the app tracks and enforces action, bonus action, Reaction and movement per turn, or only shows them.

**D. Rests.** Who starts a rest and who approves it; what each rest restores in Hearthtable Vanilla+ (HP, Hit Dice, slots, resources by reset type); interrupted rests.

**E. Conditions.** Which conditions are modelled, how they affect calculations and actions, and how they end.

**F. The table pages.** What each view shows; how much of the Codex chat's Hearthside prototypes to adopt (their review by the user is still pending).

**G. Carried-over items.** The exact scroll and Spellround snapshot fields, the core folder layout, and the spellbook rethink.

## Proposed acceptance (to agree with the user)

To be written after topic A, so it matches the confirmed scope.
