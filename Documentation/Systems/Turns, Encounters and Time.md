# Turns, Encounters and Time

Purpose: own how play moves forward in a campaign: encounters, initiative and turn order, rounds and the campaign's game clock, NPCs as participants, and (as they are decided) action budgets, rests and conditions. Status: being specified for Milestone 5 ([Milestone 5 Plan](../Implementation/Milestone%205%20Plan.md)); nothing is built. The casting workflow, holds, response polls and effect expiry that run inside this flow are owned by [Spell Effects and Active State](Spell%20Effects%20and%20Active%20State.md).

Selected decisions: the sections below, recorded with the user on 2026-10-24 (each with its time).

Open questions: whether trading between characters is built in Milestone 5 or waits for the trade window (Milestone 5c); conditions (Milestone 5 Plan topic E); how NPCs are stored and shown (their records and the look of a stat card).

## NPCs are characters

Selected 2026-10-24 at 4:56 pm PDT (America/Los_Angeles), like Encounters, Initiative and Rounds below.

NPCs are not a separate kind of thing: they are characters owned and controlled by the campaign's DM, using the same systems, records, rolls and turn handling as players' characters. A monster's stat card is a character sheet that looks different. Reuse the existing systems wherever that is feasible rather than building parallel ones. An NPC can be as simple as a name and hit points or a full sheet; monster stat blocks and imports come later ([Milestones](../Implementation/Milestones.md#roadmap)).

## Encounters

The DM starts an encounter by choosing who takes part: characters and NPCs. The DM ends it. Outside an encounter there is no turn order, and the DM moves the game clock forward by entered amounts ([out-of-combat time](Spell%20Effects%20and%20Active%20State.md#active-effects-game-time-and-early-ending)).

## Initiative and turn order

Whoever controls a character enters its initiative: they roll it in the app (d20 plus the character's initiative bonus) or type a physical roll, the same way as any other roll ([roll ownership](Spell%20Effects%20and%20Active%20State.md#roll-ownership-and-input-modes)). The DM controls NPCs, so the DM rolls for them. The DM may also roll or type initiative for any player's character, as with any roll the DM takes over (clarified by the user 2026-10-24 at 5:44 pm PDT (America/Los_Angeles)).

Ties go to whoever entered their initiative first. The DM can always open the turn order and drag, change or edit it, including adding participants partway through an encounter, such as monsters joining a fight or a player arriving late.

## Rounds and the game clock

Each encounter counts its own rounds, starting at 1. Every round adds six seconds to the campaign's game clock, which keeps running across encounters, rests and the time between them, so effects measured in minutes or hours keep counting. (The user proposed restarting rounds per encounter in the Hearthside prototypes; adopted here.)

## Action budget

Selected 2026-10-24 at 5:09 pm PDT (America/Los_Angeles) (user decision): on a character's turn the app tracks what each request uses (an action, a bonus action, a Reaction) and shows what is left. Going over is shown to the player before they submit and flagged for the DM, who can still approve it (shown to the player too: clarified 2026-10-24 at 5:44 pm PDT (America/Los_Angeles)), as over-budget feats only warn ([Character Creation and Advancement](Character%20Creation%20and%20Advancement.md)). A character's Reaction refreshes at the start of its own turn. Movement is not tracked: battle maps, positions and movement come with Milestone 6 ([Milestones](../Implementation/Milestones.md#roadmap)).

## Downtime

Selected 2026-10-24 at 5:55 pm PDT (America/Los_Angeles) (user decisions): the time between encounters is a **downtime scene**, built on the same machinery as an encounter but with nothing to fight and some restrictions lifted. It stays open, across real days if need be, until the DM ends it. Because it stays open, a DM can start it and leave, and a player who joins late can still take part.

- **Activities** (resting, crafting, scribing, anything else) are submitted one at a time like reactions in a log: each is visible in order and approved on its own. The DM also sees a **summary per character**, in order ("Carol: craft X 2 h, scribe 6 h, short rest 1 h, craft Y 5 h"), where each item opens that activity in the log.
- **Activities are jobs that can be split,** as crafting is ([Crafting Jobs](Crafting%20Jobs.md)): twenty minutes here and forty there. Rests cannot: an unfinished Long Rest or Short Rest gives no benefit and does not carry over (with the interruption rule below).
- **Activities without rules of their own** (keeping watch, scouting, shopping) are a short note to the DM with a duration. They use the character's time, are approved and logged, and change nothing automatically; the DM handles any outcome.
- **Ending it:** the DM ends the downtime scene by entering how much time actually passed, which can be the same step as starting the next encounter. The game clock moves by that amount, and each character's approved activities run in order for that long: finished ones take effect at their time, the one in progress keeps its progress and continues in the next downtime, and ones not started wait for the next downtime. A player can cancel any activity of their own. An encounter in between pauses activities; it does not clear them.
- **No turns** (selected 2026-10-24 at 6:03 pm PDT (America/Los_Angeles)): a downtime scene is an open floor. Anyone may add an activity at any time; activities are listed in the order submitted and the DM approves them in that order, like competing reactions. No action, bonus action or Reaction budget applies; time is the only budget.
- **Responding** (selected 2026-10-24 at 6:03 pm PDT (America/Los_Angeles)): everyone sees each submitted activity as it arrives, even before the DM approves it, and responds by adding or changing their own ("Bram keeps watch, so I'll sleep"). The open floor is the response window; it closes when the DM ends the scene.
- **Planning ahead on each other** (selected 2026-10-24 at 6:03 pm PDT (America/Los_Angeles)): the app shows each character's state as if every pending activity will be approved, so players can chain off one another. An activity can **wait for** another character's activity: when time runs, it starts only after that one finishes, and if that one is rejected, cancelled or does not finish in time, the waiting activity stays queued and is flagged to its owner and the DM. Crafting and trading stay separate activities, so a hand-over is its own step: Bram crafts an arrow; Carol offers a trade; Bram accepts and gives the arrow; Carol's craft waits for that trade.
- **Starting** (selected 2026-10-24 at 6:03 pm PDT (America/Los_Angeles)): a downtime scene starts by itself the moment an encounter ends, so a DM who leaves at once blocks nobody, and the DM is reminded to account for time when ending it.
- **Players do not see the length in the app.** Since the DM sets the time only when ending the scene, players plan without knowing it; the DM may tell them anything in the story. The clock never moves on its own.

## What rests restore

Selected 2026-10-24 at 5:28 pm PDT (America/Los_Angeles) (user decision): Hearthtable Vanilla+ rests restore what the published 2024 rules say. A Short Rest lets a character spend Hit Point Dice to heal and resets short-rest resources; a Long Rest restores all hit points and all Hit Point Dice, all spell slots and long-rest resources, and lowers Exhaustion by one. Resources reset to their current maximum while queued holds stay with their requests ([capped replenishment](Spell%20Effects%20and%20Active%20State.md#casting-workflow--selected-2026-10-17)). How rests are started, timed and combined with other downtime is open (above).

Interruptions — accepted by the user 2026-10-24 at 5:44 pm PDT (America/Los_Angeles), using the 2024 rules (to be verified against the rules text when built): a Short Rest gives nothing if the character rolls initiative, casts a spell other than a cantrip or takes damage; a Long Rest is stopped by those or by an hour of walking or other exertion, and if at least an hour of it had passed, the character still gets a Short Rest's benefits. An interrupted crafting job keeps its partial progress ([Crafting Jobs](Crafting%20Jobs.md)).
