# Turns, Encounters and Time

Purpose: own how play moves forward in a campaign: encounters, initiative and turn order, rounds and the campaign's game clock, NPCs as participants, and (as they are decided) action budgets, rests and conditions. Status: being specified for Milestone 5 ([Milestone 5 Plan](../Implementation/Milestone%205%20Plan.md)); nothing is built. The casting workflow, holds, response polls and effect expiry that run inside this flow are owned by [Spell Effects and Active State](Spell%20Effects%20and%20Active%20State.md).

Selected decisions: the sections below, recorded with the user on 2026-10-24 (each with its time).

Open questions: rests and conditions (Milestone 5 Plan topics D and E); how NPCs are stored and shown (their records and the look of a stat card).

## NPCs are characters

Selected 2026-10-24 at 4:56 pm PDT (America/Los_Angeles), like Encounters, Initiative and Rounds below.

NPCs are not a separate kind of thing: they are characters owned and controlled by the campaign's DM, using the same systems, records, rolls and turn handling as players' characters. A monster's stat card is a character sheet that looks different. Reuse the existing systems wherever that is feasible rather than building parallel ones. An NPC can be as simple as a name and hit points or a full sheet; monster stat blocks and imports come later ([Milestones](../Implementation/Milestones.md#roadmap)).

## Encounters

The DM starts an encounter by choosing who takes part: characters and NPCs. The DM ends it. Outside an encounter there is no turn order, and the DM moves the game clock forward by entered amounts ([out-of-combat time](Spell%20Effects%20and%20Active%20State.md#active-effects-game-time-and-early-ending)).

## Initiative and turn order

Whoever controls a character enters its initiative: they roll it in the app (d20 plus the character's initiative bonus) or type a physical roll, the same way as any other roll ([roll ownership](Spell%20Effects%20and%20Active%20State.md#roll-ownership-and-input-modes)). The DM controls NPCs, so the DM rolls for them, and may roll for a player who is not there, as with any roll the DM takes over.

Ties go to whoever entered their initiative first. The DM can always open the turn order and drag, change or edit it, including adding participants partway through an encounter, such as monsters joining a fight or a player arriving late.

## Rounds and the game clock

Each encounter counts its own rounds, starting at 1. Every round adds six seconds to the campaign's game clock, which keeps running across encounters, rests and the time between them, so effects measured in minutes or hours keep counting. (The user proposed restarting rounds per encounter in the Hearthside prototypes; adopted here.)

## Action budget

Selected 2026-10-24 at 5:09 pm PDT (America/Los_Angeles) (user decision): on a character's turn the app tracks what each request uses (an action, a bonus action, a Reaction) and shows what is left. Going over is flagged for the DM, who can still approve it, as over-budget feats only warn ([Character Creation and Advancement](Character%20Creation%20and%20Advancement.md)). A character's Reaction refreshes at the start of its own turn. Movement is not tracked: battle maps, positions and movement come with Milestone 6 ([Milestones](../Implementation/Milestones.md#roadmap)).
