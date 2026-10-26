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

Implementation status, 2026-10-25 at 2:23 am PDT (America/Los_Angeles) (Milestone 5 S6): reviewing, confirming, Instant and Next Turn, revising, cancelling and DM rejection are built; approval and resolution come with S7. Request kinds are modules (`registerRequestKind`; casting a spell from a book is the first), each saying what it holds and which part of the action budget it uses. A request is a `/campaigns/{id}/actions` document holding its costs while `queued`; the app gives resolution the totals of each character's queued holds as an unstored `holds` record, and spell slots, resource pools and inventory lines subtract them, so held costs are not usable anywhere. Cancelling or rejecting is a single status change the Rules allow once, so holds return exactly once. A rest records held slots and uses below zero and usable amounts never exceed their maximum, which gives the replenishment rule below. Revisions edit in place, keeping the queue position. The sheet's Spells tab reviews and confirms casts and lists the character's requests; the table lists every queued request, ready for the DM or waiting for its turn, and the turn order shows budget held by requests.

Implementation status, 2026-10-25 at 2:50 am PDT (America/Los_Angeles) (Milestone 5 S7): approval and resolution are built for casting from a book. The DM resolves a request only when it is eligible (Instant at once, Next Turn on the caster's turn): the panel shows the targets the player picked, a hit or save tick per target, and the damage or healing rolled from the caster's current formula, which the DM can retype. Resolving writes everything with the request in one transaction (`resolveAction`): held costs consumed without a second deduction, the concentration the player chose to replace ended (with anything it kept going on others), lasting spells as active effects starting now and ending by their duration (a caster concentrating on an effect on others keeps a linked entry of their own), conditions a spell applies with their repeat save, and damage and healing by the 2024 arithmetic with Vanilla+ negative hit points; a stale request or record refuses it, so it never applies twice, and every log entry carries the request's id. Damaged concentrators get a logged reminder of their check (prompts come with S8).

Implementation status, 2026-10-25 at 10:48 pm PDT (America/Los_Angeles) (Milestone 5 S10): items and weapons use the same workflow as casting, as two more request kinds. **Use item** holds the item line and its action cost (a Potion of Healing: a Bonus Action, for its user or a creature within 5 feet); resolving rolls its healing through the user's player and uses up the item. **Weapon attack** holds the rounds its shots load or fire and the canister charges they spend; the DM resolves it shot by shot, each with its own target, attack roll and damage per damage type, and approving runs the loads, fires and clears over the stored inventory in the same transaction as the damage. Both poll for responses like any action. Firing with nothing loaded warns only.

**Targets and dice until roll prompts** — selected 2026-10-25 at 2:36 am PDT (America/Los_Angeles) (user decisions, Milestone 5 S7): the player picks a spell's targets in the review from who is present (self first for Self and Touch spells), and the DM sees them at approval and can change them. Until S8's roll prompts, the app rolls damage and healing from the caster's formula (bonuses such as Empowered Evocation included) and the DM can type a different total; for attack and save spells the DM ticks each target's hit or save. Hold Person is added from the SRD for testing, as a scroll in Carol's "Overflow (test spells)" book (content only; the user's saved Carol is not changed).

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

**Every action polls; who skips; force-skip** — selected 2026-10-25 at 8:48 pm PDT (America/Los_Angeles) (user decisions, Milestone 5 S9): every action pauses for a response poll once its rolls are known and before its consequences apply. Responses come one at a time, each followed by a fresh poll against the new state, all within the same action (the user's example: turn 1, a goblin's hit on player 2; 1.1, player 2 casts Shield, which is not enough; 1.2, player 3 uses a feature to take the damage instead; 1.3, everyone skips; then the damage applies). A response does not open a poll of its own; it continues the chain of the action it answers. "Everyone" is each player who controls a character in the current scene; the DM answers for NPCs and can force-skip at any time; nobody is skipped for being away. A force-skip closes the poll and rejects any response still waiting for approval, returning its holds.

Implementation status, 2026-10-25 at 8:58 pm PDT (America/Los_Angeles) (Milestone 5 S9): built. A poll is a `/campaigns/{id}/polls/{action}` document; the DM opens it from the resolve panel once the action's rolls are known, and the action cannot resolve until it closes. A response is an Instant request marked `respondsTo` the action (the sheet's review offers it while a poll is open, ticked for Reaction spells); it resolves without a poll of its own and then opens a fresh round, so earlier passes no longer count, and attack hits are rechecked against the target's current Armor Class. Players pass from the table's Responses panel; the DM's view closes the poll once every player has passed the current round, and the DM's force-skip closes it and rejects waiting responses. The DM can also describe an attack (for an NPC) as a request, so the Shield example runs end to end.

Open: nested trigger ordering beyond one chain. Do not infer an automatic countdown, autopass, resource loss or retrospective rewrite. Ordinary campaign build/equipment edits also require DM approval. They may need authoring-specific UI rather than combat timing, but retain the approval gate. A solo owner switches to DM mode to approve their own requests; there is no bypass. Imports still need detailed workflow design; not every UI change is a gameplay action.

## Competing submissions and request revisions

The user selected: “DM chooses in order of submitted.” Display competing Instant submissions chronologically and let the DM approve the next response in submission order. This is not automatic FIFO execution or initiative priority. Resolve one response, show its outcome to permitted viewers and repoll.

Resources are held at submission. Another response neither spends nor releases those holds automatically. Recheck targets and eligibility before approval:

- A second heal may become unnecessary after the first heal, while remaining legal.
- A second protection may lose its trigger after the first prevents the attack.
- An attack may become invalid when its target moves out of range.

The player may keep, revise or cancel their own request **before DM approval**. Cancellation releases holds. Revision validates and reserves the replacement cost without duplicating or losing the old hold. Kept requests retain holds and still require validity checks. Never silently retarget or fire an obsolete request.

Use the reviewed revision for authoritative approval. Prevent both old and revised requests from executing or spending. **Revision keeps its place** (selected 2026-10-25 at 2:07 am PDT (America/Los_Angeles), user decision): a revised request is the same request edited in place with a new revision number; it keeps its submission time and so its position in the queue, the DM always approves its latest revision, and its holds switch over in the same step. **Outside an encounter every request is Instant** (selected 2026-10-25 at 2:07 am PDT (America/Los_Angeles), user decision): there are no turns to wait for, so Next Turn is offered only during an encounter. Queue position after other changes, approval/edit races, ties, latency, hidden enemy submissions and any DM override of ordering remain design questions. This does not authorize rewriting completed actions.

## Active effects, game time and early ending

Configured effects count down and expire automatically on the normal shared game clock. Use the relevant actor's start/end-of-turn boundary, round duration or other configured condition. No wall-clock countdown is selected. Incomplete effect configurations still need design.

**Exact timing within a round** — selected 2026-10-25 at 1:02 am PDT (America/Los_Angeles) (user decisions): an effect lasts exactly its duration from the moment it began, by turn order. During an encounter, time moves in steps of 1/40 second (0.025 s): every turn that starts and every action or reaction taken is one step, so a round holds up to 240 steps, and the next round starts six seconds after the last regardless. A 1-round effect cast as a reaction during Goblin 1's turn in round 2 therefore ends at the same step of round 3, just after the corresponding moment of Goblin 1's next turn; a 1-minute effect ten rounds on. The clock still shows whole seconds. Outside an encounter durations count on the clock. When an effect ends it disappears from the sheet at once and the log records it. Outside a campaign there is no game clock, so effects end only by hand.

Implementation status, 2026-10-25 at 1:11 am PDT (America/Los_Angeles) (Milestone 5 S4): an active effect records the game moment it began and, from its definition's duration, when it ends (`startedAt`, `endsAt`; moments are whole seconds plus steps). Resolution reads the campaign's current moment from a `game-time` record the app supplies, so an effect stops counting the moment its time is up, on sheets and at the table. The DM's view then clears it from the character and logs its ending once. Every turn start and each ticked Action, Bonus Action or Reaction is a step. The DM ends effects early from the table; a player ending their own (switching it off on the sheet) goes through the DM review queue like any edit of a campaign character. Outside a campaign nothing ends on its own.

Out-of-combat time — selected 2026-10-18: the DM manually advances campaign time by an entered amount, such as ten minutes or two hours. The app updates configured effect durations and expires effects whose duration has elapsed. It does not infer elapsed travel time, run a real-world countdown or advance game time merely because players are offline. Other authorized campaign activity can still advance game time while a player is absent.

- Start the effect on actual activation, not submission or reservation. At expiry, remove its contribution and refresh affected statistics. Link the status and log to its originating event; duplicate messages must not expire it twice.
- The DM may end an effect early. Update active state, derived values and logs without rewriting its definition or paid snapshot.
- Players request an early end through the same Instant approval/event flow. Scheduling adds no extra D&D Reaction cost; use the feature's actual ending requirements.
- Items, spells, abilities and forms use the same event and clock system. A response poll never adds six seconds or resets a turn budget.
- Keep required concentration rolls and replacement/end choices explicit. Unknown ending conditions require marked manual handling, not invented expiry or failed saves.

Action/effect visibility follows [Campaigns and Shared Data](Campaigns%20and%20Shared%20Data.md#character-sheet-visibility): notifications default to public even for private source tabs, with hiding selected at submission. Hiding an action/effect does not disable its mechanics; tooltips, logs and notifications must respect that setting. Detailed notification/log fields, aggregate-stat presentation, control of others' effects and whether visibility can be revised later still need design.
Validate turn advancement against unfinished response chains; do not skip a required response opportunity.

## Armor Class formulas and augments

Purpose: distinguish a complete replacement AC calculation from additive AC modifiers in character definitions, equipment, and active effects. Selected design direction, 2026-10-20 at 3:28 pm PDT (America/Los_Angeles): support both categories and a current AC derived from the selected eligible base plus applicable augments. Base selection — selected 2026-10-22 at 1:13 pm PDT (America/Los_Angeles): when an effect that supplies a base formula becomes active (for example Mage Armor), its formula becomes the selected base automatically; the player can switch back, and the newer of the player's choice and the activation wins. Implemented in the `armor-class` system for Milestone 2; exact controls and conflict-resolution interaction remain open. Character-specific formulas and defaults belong in the character's sheet.

**Replacement calculation:** supplies the complete base formula, including its ability modifiers and caps, such as ordinary 10 + DEX or another authored armor formula. Select one eligible base calculation at a time. Preserve the user's selected/default base rather than automatically replacing it with the numerically highest option. Two complete base formulas do not add together.

**Augment:** adds an explicit modifier to the selected base result, subject to its source's eligibility, duration, stacking, and activation rules. Multiple compatible augments may contribute together. A source can restrict its bonus to a particular base, equipment state, or other condition; a +3 intended only as the difference from ordinary unarmored AC must not become a universal +3 to every armor formula by accident.

Show the selected base, ability contributions, each applied augment and source, and the resulting current AC. Keep available-but-unselected bases distinct from contributing bonuses; distinguish a user's selection from an effect that has not yet been cast, equipped, approved, or resolved. Track active-effect identities and expiry so the same bonus is not applied twice through its source and its displayed state.

The published Shield spell illustrates an augment: +5 AC until the start of the caster's next turn, including the triggering attack. Shield of Faith is a separate +2 AC effect that may coexist if its own requirements are met. Repeated casts of the same spell do not add their bonuses together. Changing the base does not bypass a bonus's requirements, create a free cast, or determine whether it persists; follow the authored source and existing request/active-state workflow.

The interface may therefore need a single selected base and multiple eligible augment selections rather than one exclusive choice for every AC source. Detailed validation, expired/ineligible selection handling, manual adjudication, and interface layout remain open. Supporting this design does not select Capella's armor numbers or grant Shield to her.

Verified published references: [Armor Class](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary#ArmorClass), [Shield and Shield of Faith](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions#Shield), and [Combining Spell Effects](https://www.dndbeyond.com/sources/dnd/br-2024/spells#CombiningSpellEffects). Checked 2026-10-20 at 3:28 pm PDT (America/Los_Angeles).

## Concentration capacity — selected 2026-10-20

This section owns concentration capacity and Capella's selected two-concentration exception. Capacity, unrestricted concentration-spell eligibility, independent damage saves, a replacement prompt at full capacity, automatic loss on Incapacitated/death, and voluntary ending of chosen instances are selected; lifecycle and execution-reconciliation details stay open below. Implementation status, 2026-10-23 at 12:16 am PDT (America/Los_Angeles): the capacity model is built as the `concentration` system (default capacity from the ruleset, raised by grants aimed at `concentration.capacity`; only active effects whose spell needs concentration occupy it; maintaining more than the capacity is a visible warning naming the newest ones). Capella's exception would be such a grant once her records exist. The replacement prompt, automatic loss and voluntary ending belong to the Milestone 5 casting workflow. Since 2026-10-25 at 1:11 am PDT (America/Los_Angeles) (S4) switching on a concentration effect at full capacity asks which maintained concentration to end, and switching one off ends it voluntarily; automatic loss on Incapacitated comes with conditions (S5), and starting concentration at the moment casting begins with the casting workflow (S6–S7). The published revised baseline is one concentration at a time; beginning another concentration spell or effect ends the previous concentration. See the [2024 Concentration rules](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/#Concentration), checked 2026-10-20. Capella's exception does not grant a campaign-wide change.

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

**Every roll works this way** (clarified by the user 2026-10-24 at 7:56 pm PDT (America/Los_Angeles)): any dice roll, whether initiative, an attack, a save, damage or anything else, is either **prompted** to the player who controls the character or **rolled by the DM** for them, and either way the person rolling may use the app's dice or enter their own input (a custom expression or a typed total from physical dice). The DM may ask for the exact roll, prefilled with its formula and any Advantage or Disadvantage, so a new or distracted player only has to press roll; or the DM rolls that exact thing themself.

**Who rolls in a cast; critical hits** — selected 2026-10-25 at 8:13 pm PDT (America/Los_Angeles) (user decisions, Milestone 5 S8): the caster's player rolls the attack roll and, on a hit, the damage roll; each target's player rolls their save; the DM can roll any of them instead. A natural 20 on an attack roll rolled in the app or in typed dice is a Critical Hit (the damage dice are rolled twice, 2024) and a natural 1 misses; a typed total cannot show its dice, so the roller ticks "natural 20" themself. The DM can still change any result.

Implementation status, 2026-10-25 at 8:34 pm PDT (America/Los_Angeles) (Milestone 5 S8): roll prompts are `/campaigns/{id}/rolls` documents asked of a character, answered once (a transaction refuses a second answer, so a player's reply and a DM takeover never both count) by its controller or by the DM, in any of the three modes, and logged with how they were rolled. The DM asks for any save, skill check or dice roll from the table, prefilled with the character's formula and Advantage or Disadvantage. Resolution asks targets for saves, the caster for attack rolls against each target's Armor Class (natural 20 a Critical Hit that doubles the damage dice, natural 1 a miss) and for damage or healing; answers fill the panel and the DM can still override. Saves a condition makes fail fail automatically. After resolution anyone damaged while concentrating is asked for a concentration check (with Advantage from War Caster), and a failure ends their concentration; at the end of a turn, repeat saves are asked for, and a success ends the condition and the effect behind it.

Use the same action/target/result/log flow for attacks, saves, damage, healing and concentration. Record input mode, submitting actor, formula-owning character, expression and known raw/modifier/final values. A manual total need not pretend the breakdown is known. Do not silently reroll.

One prompt accepts one final result. A DM takeover and player reply must not both resolve it. Area effects need the appropriate separate target prompts; wait for required inputs before applying their dependent consequences. Re-evaluate eligibility when state changes. An “evade” example does not grant universal saving throws against weapon attacks.

Paid scrolls retain formulas rolled on use, not manufacturing-time outcomes. Secret rolls, result visibility and reroll/critical confirmation remain open. Mistakes after resolution follow [manual retcons](Campaigns%20and%20Shared%20Data.md#manual-retcons), without changing the original logged roll. Hidden NPC defenses are not automatically public.

## Structured effects and manual adjudication

Author or import verified structured behavior for spells, items and traits: base AC versus bonuses, triggers, targets, scope, duration, conditional Advantage, damage, healing, resources and source/version. Keep readable definitions available. Do not infer executable rules solely from names, prose or unreviewed LLM output.

The user selected partial automation: allow a feature even when some parts need explicit DM adjudication. Clearly identify automated, unknown and manual parts. Record manual outcomes within the same action, approval and log flow; do not apply a part twice. Essential missing costs, formulas or targets must be resolved before dependent consequences commit. This is not permission to treat a missing definition as complete or bypass logging.

Review of prose against structured fields and later LLM-assisted extraction remain design work.

## Spell details and display — selected 2026-10-23 at 12:58 am PDT (America/Los_Angeles)

Each spell definition stores structured facts: level, school, casting time, range, components with any costly or consumed materials, duration, concentration, ritual, attack or save, damage or healing formulas, upcast scaling and the classes whose lists include it. A spell's panel shows a short summary first, then the full rules text where the spell is in SRD 5.2 (expandable, with the CC-BY-4.0 credit), then the facts. Facts that name another record, such as the classes that can cast it, use the same hover and click windows as other links.

SRD 5.2 is open under CC-BY-4.0, so its text may be copied and changed with credit. The full 2024 Player's Handbook on D&D Beyond is not open; spells outside the SRD get a summary in our own words and no copied text. When sources disagree, SRD 5.2 decides, then the 2024 Player's Handbook.

Implementation status, 2026-10-23 at 2:13 am PDT (America/Los_Angeles): built for Carol's 32 spells and eight overflow test spells. `pnpm srd:spells` copies the SRD text and header facts (casting time, ritual, range, components with cost and consumption, duration, concentration); summaries and effect facts (attack, save, damage, healing, area, scaling) were written by Claude Code from that text and are marked unreviewed until the user checks them. Mind Sliver and Tasha's Otherworldly Guise are not in the SRD; Guise comes from Tasha's Cauldron of Everything, as Carol's sheet records. The SRD has no Artificer, so Artificer entries on class lists come from the Artificer source, and the overflow spells carry only the SRD's lists. Revivify is correctly not ready for Carol: the user confirmed 2026-10-23 at 3:20 am PDT (America/Los_Angeles) that it is not on the Artificer list. The user reviewed the panels and effect facts at the same time and found no problems.

Order of entry: Carol's spells, then Capella's, then others as needed. A few extra ritual spells and spells with costly or consumed components (such as Teleportation Circle) are added for testing in a separate overflow spellbook in Carol's inventory.

## Definition updates and publication

Definition publication, independent customization and live links belong to [Campaigns and Shared Data](Campaigns%20and%20Shared%20Data.md#publication-and-approval). Track origin, source, rules edition and revision; refresh dependent views consistently without converting independent historical copies into live links.

Pending actions and active effects resolve current linked definitions, and pending requests must revalidate costs, targets and eligibility before execution. Owned state, prepaid scroll snapshots and completed historical results remain preserved. The detailed boundary between updated definition fields and immutable paid-casting fields, as well as races and changed-condition handling, still needs implementation design; do not infer that a live correction rewrites a prepaid formula or historical outcome.

## Related decisions and implementation dependencies

[Containers and scrolls](Spell%20Containers%20and%20Consumable%20Sources.md) owns physical depth, nonempty deletion, capacity overrides, the single-scroll lifecycle and crafting rules. [Aetherlock](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md) owns weapon-specific actions and recipes. These settled mechanics do not need another vote to continue architecture design.

[Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md) owns the previous application's persistence, calculation and gameplay failures, carried-forward record requirements and later LLM work.

Prior rules sources, recorded as verified 2026-10-17: [Shield](https://www.dndbeyond.com/spells/2619019-shield) and [Fireball](https://www.dndbeyond.com/sources/dnd/br-2024/spell-descriptions#Fireball). This cleanup does not claim new rules verification.
