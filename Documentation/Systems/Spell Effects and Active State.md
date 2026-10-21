# Spell Effects and Active State

This document owns the shared casting, response, roll and active-effect workflow, including concentration capacity. It records selected design requirements and explicitly marked proposals, not implemented behavior; unresolved approval details, concurrency and response policies remain explicit below. Failure modes from the previous application are in [Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md).

## Casting workflow — selected 2026-10-17

DM/party coordination is included in this design. This does not restart every archived DM feature or authorize runtime implementation.

**Review → confirm/reserve → queue until eligible → request DM approval → resolve.** Confirmation creates a request and resource holds; it is not a completed cast. Selected 2026-10-19: request DM approval only when the queued action is eligible to execute, not in advance while waiting for its turn or trigger.

Requests remain visible while queued according to the existing [submitted-action and queue visibility rules](Campaigns%20and%20Shared%20Data.md#character-sheet-visibility).

| Stage | Intended behavior |
|---|---|
| Review | Show source, spell and cast level, targets, options, current-caster versus saved statistics, costs and timing. Nothing is spent. |
| Confirm/reserve | Create a pending action and transfer its numeric resource costs out of usable quantities into the request's holds, as specified below. Held resources cannot fund another request; the action has not executed. |
| Waiting | Keep the request queued with its resource holds until its execution timing is eligible. Next Turn waits for the actor's eligible turn; Instant uses its applicable response window, including a valid trigger for a Reaction. Do not ask the DM to preapprove a request that is still waiting for its execution timing. |
| Execution approval | At the eligible execution moment, revalidate the current request, targets, costs and requirements, then ask the DM to approve or reject it. Approval starts resolution rather than creating an approved request waiting for a later turn. A solo owner uses DM mode through the same flow. Required rolls, responses and choices still apply during resolution. |
| Resolve | Determine required rolls, saves, targets and choices. Apply source-specific payments, consumption, effects, damage, healing, concentration and expiry; update affected state and linked logs. |
| Reconcile | Proposed requirement: one action identity links requests, revisions, holds, rolls, effects and logs. Retries or duplicate approvals must not apply the action twice. Partial failure must not separate payment from recorded consequences. |

Queued resource holds — selected 2026-10-19: submitting a request immediately transfers every numeric resource quantity it requires out of the usable character amounts into the request's holds. This applies to item quantities, stack sizes, spell slots, charges and other quantified costs, including a quantity of one. For example, queuing one potion removes one potion from inventory; there is no remaining reserved potion in the inventory to remove through an edit. Retain held item identities/state and numeric resource amounts with the request. Execution consumes the held resources without a second deduction from usable quantities. Cancellation or rejection returns each held quantity by adding it to the current usable amount, never by restoring an old total. The transfer, consumption and return must each occur once despite retries or concurrent edits. Source-specific payment rules for actions that have begun resolving still apply.

Capped-resource replenishment — selected 2026-10-20: replenish usable resources normally, including restoring them to their current maximum, without subtracting queued holds from the replenishment or requiring queued requests to finish first. Existing holds remain with their requests. Approval uses the held amount without another deduction. On cancellation or rejection, add the returned amount to the current usable quantity, then clamp to the resource's current maximum: `min(current maximum, current usable + returned amount)`. Discard any excess; do not retain it as another credit. For example, a resource restored to two usable slots with one slot still held remains at two if that request is denied; its returned slot is discarded. Apply this clamp where the resource has an applicable numeric cap; do not invent a cap for uncapped quantities.

Players may cancel their own request before approval, releasing unspent holds while retaining request history. A character's owner can also cancel a delegate's request for that character under the same rules. [Revoking delegated control](Campaigns%20and%20Shared%20Data.md#delegated-character-control--selected-2026-10-18) does not automatically cancel queued requests.

DM rejection — selected 2026-10-18: reject the queued request, release all its unspent resource holds, including reserved slots, scrolls, ammunition, charges and action costs as applicable, and log the request as rejected. Nothing is spent because the action did not execute. An action that already began resolving and then failed or was interrupted follows its normal source-specific payment rules; this is distinct from rejecting an unexecuted request. Other abort cases still need policy.

For example, book Shield reserves the caster's applicable resource and Reaction. A prepaid scroll reserves the actual scroll. Rifle Shield reserves a loaded round, charges and Reaction, and uses the selected delivery rule. Opening an editor or saving a sheet is never a cast.

Open: nested resolution/response ordering, changes while waiting, final commit implementation and other abort cases. DM approval at execution time, rejection behavior and [manual retcons](Campaigns%20and%20Shared%20Data.md#manual-retcons) are settled. Client disconnection does not itself release server reservations; see the architecture document. DM gating must preserve the opportunity to use valid Reaction spells. Server-side revision checks and one-time execution are still required even without advance approval.

## Scheduling and repeating response polls — selected 2026-10-17

The scheduling options are **Instant** and **Next Turn**. Reaction is an authored action cost and trigger, not a third scheduling button. These options apply to state-changing gameplay interactions such as spells, item use and inventory actions.

| Timing | Selected intent |
|---|---|
| Instant | Submit without waiting for the actor's own initiative. Use the applicable response window and DM handling. Approval, triggers, action costs, eligibility and held resources still apply. |
| Next Turn | Queue for the actor's own eligible turn and normal action budget; request DM approval when ready to execute. Queuing multiple requests does not execute them all for free. |

After a gameplay event, poll for responses. Resolve **one** response, show its outcome according to the submitted visibility setting, then open a fresh poll against the updated state. Public is the default; hidden requests do not expose private details. Continue until everyone skips the same current poll or the DM force-skips remaining responses. A previous skip does not carry over after a response changes the situation. Having reacted once is not a closing condition.

A parent event remains paused wherever its rules require. For example:

1. An attack roll would hit; pause before damage.
2. The target submits Shield as Instant, with the normal Reaction trigger and cost.
3. Resolve Shield, then recheck the hit against the increased AC.
4. Open a fresh response poll. When it closes, finish the pending consequences.

Shield does not guarantee a miss and does not negate Fireball's Dexterity save. The earlier Fireball/Shield example illustrated the desired workflow, not a change to either spell. No automatic retroactive HP rollback is selected.

Response polls are steps within game flow. They do not create new initiative turns, restore actions or Reactions, or advance effect durations. Ordinary events may have windows even if no mechanical Reaction is available. Instant does not grant free off-turn item handling or use of inaccessible items. The user's uncertain backpack/arrows example did not establish a universal exception.

Open: who participates when someone is disconnected, timeout behavior, simultaneous submissions, nested trigger ordering and unfinished requests when the DM force-skips. Do not infer an automatic countdown, autopass, resource loss or retrospective rewrite. Ordinary campaign build/equipment edits also require DM approval. They may need authoring-specific UI rather than combat timing, but retain the approval gate. A solo owner switches to DM mode to approve their own requests; there is no bypass. Imports still need detailed workflow design; not every UI change is a gameplay action.

## Competing submissions and request revisions

The user selected: “DM chooses in order of submitted.” Display competing Instant submissions chronologically and let the DM approve the next response in submission order. This is not automatic FIFO execution or initiative priority. Resolve one response, show its outcome to permitted viewers and repoll.

Resources are held at submission. Another response neither spends nor releases those holds automatically. Recheck targets and eligibility before approval:

- A second heal may become unnecessary after the first heal, while remaining legal.
- A second protection may lose its trigger after the first prevents the attack.
- An attack may become invalid when its target moves out of range.

The player may keep, revise or cancel their own request **before DM approval**. Cancellation releases holds. Revision validates and reserves the replacement cost without duplicating or losing the old hold. Kept requests retain holds and still require validity checks. Never silently retarget or fire an obsolete request.

Use the reviewed revision for authoritative approval. Prevent both old and revised requests from executing or spending. Queue position after revision, approval/edit races, ties, latency, hidden enemy submissions and any DM override of ordering remain design questions. This does not authorize rewriting completed actions.

## Active effects, game time and early ending

Configured effects count down and expire automatically on the normal shared game clock. Use the relevant actor's start/end-of-turn boundary, round duration or other configured condition. No wall-clock countdown is selected. Incomplete effect configurations still need design.

Out-of-combat time — selected 2026-10-18: the DM manually advances campaign time by an entered amount, such as ten minutes or two hours. The app updates configured effect durations and expires effects whose duration has elapsed. It does not infer elapsed travel time, run a real-world countdown or advance game time merely because players are offline. Other authorized campaign activity can still advance game time while a player is absent.

- Start the effect on actual activation, not submission or reservation. At expiry, remove its contribution and refresh affected statistics. Link the status and log to its originating event; duplicate messages must not expire it twice.
- The DM may end an effect early. Update active state, derived values and logs without rewriting its definition or paid snapshot.
- Players request an early end through the same Instant approval/event flow. Scheduling adds no extra D&D Reaction cost; use the feature's actual ending requirements.
- Items, spells, abilities and forms use the same event and clock system. A response poll never adds six seconds or resets a turn budget.
- Keep required concentration rolls and replacement/end choices explicit. Unknown ending conditions require marked manual handling, not invented expiry or failed saves.

Action/effect visibility follows [Campaigns and Shared Data](Campaigns%20and%20Shared%20Data.md#character-sheet-visibility): notifications default to public even for private source tabs, with hiding selected at submission. Hiding an action/effect does not disable its mechanics; tooltips, logs and notifications must respect that setting. Detailed notification/log fields, aggregate-stat presentation, control of others' effects and whether visibility can be revised later still need design.
Validate turn advancement against unfinished response chains; do not skip a required response opportunity.

## Armor Class formulas and augments

Purpose: distinguish a complete replacement AC calculation from additive AC modifiers in character definitions, equipment, and active effects. Selected design direction, 2026-10-20 at 3:28 pm PDT (America/Los_Angeles): support both categories and a current AC derived from the selected eligible base plus applicable augments. Implementation is pending; exact controls, field schema, and conflict-resolution interaction remain open. Character-specific formulas and defaults belong in the character's sheet.

**Replacement calculation:** supplies the complete base formula, including its ability modifiers and caps, such as ordinary 10 + DEX or another authored armor formula. Select one eligible base calculation at a time. Preserve the user's selected/default base rather than automatically replacing it with the numerically highest option. Two complete base formulas do not add together.

**Augment:** adds an explicit modifier to the selected base result, subject to its source's eligibility, duration, stacking, and activation rules. Multiple compatible augments may contribute together. A source can restrict its bonus to a particular base, equipment state, or other condition; a +3 intended only as the difference from ordinary unarmored AC must not become a universal +3 to every armor formula by accident.

Show the selected base, ability contributions, each applied augment and source, and the resulting current AC. Keep available-but-unselected bases distinct from contributing bonuses; distinguish a user's selection from an effect that has not yet been cast, equipped, approved, or resolved. Track active-effect identities and expiry so the same bonus is not applied twice through its source and its displayed state.

The published Shield spell illustrates an augment: +5 AC until the start of the caster's next turn, including the triggering attack. Shield of Faith is a separate +2 AC effect that may coexist if its own requirements are met. Repeated casts of the same spell do not add their bonuses together. Changing the base does not bypass a bonus's requirements, create a free cast, or determine whether it persists; follow the authored source and existing request/active-state workflow.

The interface may therefore need a single selected base and multiple eligible augment selections rather than one exclusive choice for every AC source. Detailed validation, expired/ineligible selection handling, manual adjudication, and interface layout remain open. Supporting this design does not select Capella's armor numbers or grant Shield to her.

Verified published references: [Armor Class](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary#ArmorClass), [Shield and Shield of Faith](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions#Shield), and [Combining Spell Effects](https://www.dndbeyond.com/sources/dnd/br-2024/spells#CombiningSpellEffects). Checked 2026-10-20 at 3:28 pm PDT (America/Los_Angeles).

## Concentration capacity — selected 2026-10-20

This section owns concentration capacity and Capella's selected two-concentration exception. Capacity, unrestricted concentration-spell eligibility, independent damage saves, a replacement prompt at full capacity, automatic loss on Incapacitated/death, and voluntary ending of chosen instances are selected; lifecycle and execution-reconciliation details stay open below. Neither the capacity model nor that character-specific exception is implemented. The published revised baseline is one concentration at a time; beginning another concentration spell or effect ends the previous concentration. See the [2024 Concentration rules](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/#Concentration), checked 2026-10-20. Capella's exception does not grant a campaign-wide change.

Represent concentration as logical active-state capacity, with a default capacity of **one**. The user's inventory-slot metaphor describes capacity and a possible interface: each occupied position displays a temporary reference to the ongoing cast or effect instance being maintained. It is not a physical inventory item, a duplicate owned spell, another spellbook entry or a consumed spell slot. Physical nesting, access depth and spellbook capacity remain governed by [Spell Containers and Consumable Sources](Spell%20Containers%20and%20Consumable%20Sources.md).

Clarified 2026-10-20 at 2:05 pm PDT (America/Los_Angeles): one is the ordinary default, not a permanently hard-coded capacity. Authored abilities or later explicit rule changes can alter effective capacity; Capella's selected exception is one such ability. This does not itself select a new campaign-wide maximum or change the unresolved capacity-reduction handling below.

Multiple active effects may coexist without occupying concentration capacity. Only an instance that actually requires concentration occupies it; an explicit exception that removes concentration must be represented as such. A multi-target or upcast spell normally remains one cast and one occupancy, rather than occupying a position for each affected target, subject to the verified source rules. Nonspell effects, readied spells and long castings also need their actual concentration requirements represented rather than being inferred from duration alone.

**Capella homebrew — selected 2026-10-20:** an authored custom trait or ability increases her concentration capacity from one to **two**. Any concentration spell she can otherwise legally cast may occupy either position; the second position is not restricted to bodily alteration or disguise. This permits Alter Self alongside Hold Person, or Hold Person alongside Silent Image, but not all three simultaneously. The capacity increase and spell eligibility are accepted for her level-12 design; the feature's final wording and the open mechanics below still need design. It grants no additional actions, spell slots, free casts or exemptions from components, targets, saves, concentration checks, spell durations or other normal restrictions unless an explicit further exception is selected. Do not infer additional nonspell concentration exceptions from the decision about spell eligibility.

The displayed occupancy must reference the same instance identity used by casting resolution, active effects and logs; duplicating a display must not create another effect or charge capacity again. Ending concentration must reconcile the affected linked state under the eventual lifecycle policy. The display is a view of active state, not an alternative ownership or persistence system.

### Damage checks with multiple instances

Selected 2026-10-20 at 3:49 pm PDT (America/Los_Angeles): when damage requires Capella to check two maintained spell concentrations, make a separate Constitution saving throw for each spell. Each save applies its own normal modifiers and any applicable Advantage, including War Caster; do not reuse one rolled result for both spells. Each failure ends only the concentration associated with that save. Both can succeed, one can fail, or both can fail. A character maintaining one spell still makes only the normal single save. This selects damage-failure allocation, not a waiver of the separate automatic loss conditions below.

Use the revised damage-check DC: the greater of 10 or half the damage taken rounded down, capped at DC 30. Repeated sources of damage follow their normal check triggers. The identity of each prompted save must identify the maintained instance so results cannot end the wrong concentration or apply twice. Capella's character sheet owns her save modifier; this section owns the shared rule and her exception's failure handling.

### Replacing concentration at full capacity

Selected 2026-10-20 at 4:38 pm PDT (America/Los_Angeles): when both of Capella's concentration positions are occupied and she starts another eligible concentration spell, prompt her to select which existing concentration to replace. Do not automatically choose the oldest or require a separate manual end before the replacement flow. Reviewing, queuing, or selecting a replacement candidate does not itself end an ongoing concentration.

The published loss boundary is the start of casting a new concentration spell, not its eventual success. Resolve the chosen replacement when casting actually begins under the existing execution workflow; preserve both existing instances if the request is canceled or rejected before casting starts. Revalidate occupancy and replacement eligibility at that moment rather than acting on a stale queued choice. If a position has become free, do not end another instance merely because the queue previously anticipated a replacement. Detailed counterspell/interruption reconciliation, partial-resolution recovery, and nonspell requirements remain open; this prompt does not supply extra capacity or free casting resources.

### Automatic loss and voluntary ending

Selected 2026-10-20 at 5:04 pm PDT (America/Los_Angeles): becoming Incapacitated or dying ends all of Capella's maintained concentrations, without a saving throw to preserve either. Extra capacity changes neither published loss condition. Where another condition includes Incapacitated, apply that consequence as well; hover does not prevent concentration loss.

She can voluntarily end either maintained concentration or both at any time, with no action cost. Identify the chosen active instances explicitly; ending one does not end the other. Use the existing Instant approval/event flow for a player's requested ending without adding a D&D Reaction cost. Automatic loss follows resolution of the triggering condition/death rather than waiting for the player to choose a spell. The implementation must reconcile each affected instance and its linked effects; detailed event ordering/recovery remains deferred below. [Published ending conditions](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary#Concentration).

### Open concentration decisions

Keep unresolved concentration mechanics here rather than selecting defaults in character prose or implementation:

- **Replacement execution reconciliation:** the choice prompt and casting-start boundary are selected above. Resolve the remaining implementation handling for interrupted/failed casts, resource holds, partial updates, and nonspell concentration requirements without inventing automatic restoration of an ended effect.
- **Lifecycle and expiry:** define when an occupancy begins and releases, which linked consequences end when its concentration ends, and how timed expiry, long castings, readied spells, target removal and effects with independently continuing consequences interact. Do not assume that ending one linked display ends every target or that an independently continuing effect occupies concentration forever.
- **Capacity reduction:** decide how to handle more maintained instances than the new maximum when the granting feature ends or changes, including who chooses what ends. Removing a display is not a substitute for resolving the linked effects.

### Historical campaign observation — recorded 2026-10-20

The user reports that prior campaign play usually checked whether concentration was interrupted by outside forces but rarely enforced how many concentration spells were maintained concurrently. This explains the requested capacity feature; it does not establish unlimited concentration as a selected current rule or change Carol's documented one-concentration baseline.

## Roll ownership and input modes

When an effect requires a target PC's roll, prompt that PC's player. The DM may take over using the target's configured formula or a manual result. Use the target character's data, not the DM character's bonuses. The DM handles NPCs. A caster cannot silently supply another PC's save.

| Mode | Behavior |
|---|---|
| Configured roll with bonuses | Generate dice from the selected character/action formula and apply configured bonuses. Show dice, modifiers and total. |
| Custom dice expression | The user enters an expression such as 1d20 or 2d20; the app rolls it. Add no character bonuses unless explicitly included or selected. Advantage/keep-die UI remains open. |
| Manual final result | Accept one numeric total from physical dice or other adjudication. Do not add bonuses again or infer individual faces, natural 20s or critical hits from a total. |

Use the same action/target/result/log flow for attacks, saves, damage, healing and concentration. Record input mode, submitting actor, formula-owning character, expression and known raw/modifier/final values. A manual total need not pretend the breakdown is known. Do not silently reroll.

One prompt accepts one final result. A DM takeover and player reply must not both resolve it. Area effects need the appropriate separate target prompts; wait for required inputs before applying their dependent consequences. Re-evaluate eligibility when state changes. An “evade” example does not grant universal saving throws against weapon attacks.

Paid scrolls retain formulas rolled on use, not manufacturing-time outcomes. Secret rolls, result visibility and reroll/critical confirmation remain open. Mistakes after resolution follow [manual retcons](Campaigns%20and%20Shared%20Data.md#manual-retcons), without changing the original logged roll. Hidden NPC defenses are not automatically public.

## Structured effects and manual adjudication

Author or import verified structured behavior for spells, items and traits: base AC versus bonuses, triggers, targets, scope, duration, conditional Advantage, damage, healing, resources and source/version. Keep readable definitions available. Do not infer executable rules solely from names, prose or unreviewed LLM output.

The user selected partial automation: allow a feature even when some parts need explicit DM adjudication. Clearly identify automated, unknown and manual parts. Record manual outcomes within the same action, approval and log flow; do not apply a part twice. Essential missing costs, formulas or targets must be resolved before dependent consequences commit. This is not permission to treat a missing definition as complete or bypass logging.

Review of prose against structured fields and later LLM-assisted extraction remain design work.

## Definition updates and publication

Definition publication, independent customization and live links belong to [Campaigns and Shared Data](Campaigns%20and%20Shared%20Data.md#publication-and-approval). Track origin, source, rules edition and revision; refresh dependent views consistently without converting independent historical copies into live links.

Pending actions and active effects resolve current linked definitions, and pending requests must revalidate costs, targets and eligibility before execution. Owned state, prepaid scroll snapshots and completed historical results remain preserved. The detailed boundary between updated definition fields and immutable paid-casting fields, as well as races and changed-condition handling, still needs implementation design; do not infer that a live correction rewrites a prepaid formula or historical outcome.

## Related decisions and implementation dependencies

[Containers and scrolls](Spell%20Containers%20and%20Consumable%20Sources.md) owns physical depth, nonempty deletion, capacity overrides, the single-scroll lifecycle and crafting rules. [Aetherlock](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md) owns weapon-specific actions and recipes. These settled mechanics do not need another vote to continue architecture design.

[Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md) owns the previous application's persistence, calculation and gameplay failures, carried-forward record requirements and later LLM work.

Prior rules sources, recorded as verified 2026-10-17: [Shield](https://www.dndbeyond.com/spells/2619019-shield) and [Fireball](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions#Fireball). This cleanup does not claim new rules verification.
