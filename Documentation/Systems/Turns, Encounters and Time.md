# Turns, Encounters and Time

Purpose: own how play moves forward in a campaign: encounters, initiative and turn order, rounds and the campaign's game clock, NPCs as participants, and (as they are decided) action budgets, rests and conditions. Status: specified for Milestone 5 (2026-10-24 at 8:17 pm PDT (America/Los_Angeles), S1 of the [Milestone 5 Plan](../Implementation/Milestone%205%20Plan.md)); nothing is built yet. The casting workflow, holds, response polls and effect expiry that run inside this flow are owned by [Spell Effects and Active State](Spell%20Effects%20and%20Active%20State.md).

Selected decisions: the sections below, recorded with the user on 2026-10-24 (each with its time).

Open questions: none blocking Milestone 5. The S1 specification was finished 2026-10-24 at 8:17 pm PDT (America/Los_Angeles).

## NPCs are characters

Selected 2026-10-24 at 4:56 pm PDT (America/Los_Angeles), like Encounters, Initiative and Rounds below.

NPCs are not a separate kind of thing: they are characters owned and controlled by the campaign's DM, using the same systems, records, rolls and turn handling as players' characters. A monster's stat card is a character sheet that looks different. Reuse the existing systems wherever that is feasible rather than building parallel ones. An NPC can be as simple as a name and hit points or a full sheet; monster stat blocks and imports come later ([Milestones](../Implementation/Milestones.md#roadmap)).

**Templates and instances** — selected 2026-10-24 at 7:52 pm PDT (America/Los_Angeles) (user decisions):

- **Every character in an NPCs folder is a template.** A campaign's templates live at `campaign/<Campaign>/NPCs/<Name>` (web address `/Campaigns/<Campaign>/NPCs/<Name>`); global templates any campaign can use live at `core/NPCs/<Name>`.
- **The quickest template** is whatever the automated mechanics need to call on it: name, maximum hit points, Armor Class and initiative bonus, typed in directly. Ability scores default to 10, so saves and other rolls still work. It is a full character sheet underneath, so abilities, features, items, actions and spells can be filled in later.
- **Deploying** an NPC into an encounter copies its template into an **instance** for each one deployed: one Goblin makes one instance, five make five, numbered or named as needed (Goblin 1–5). Instances live in their scene, at `campaign/<Campaign>/Encounters/<Encounter>/<Name>` or, for an NPC the DM places in downtime (a market stall to trade with), `campaign/<Campaign>/Downtime/<Scene>/<Name>` (widened 2026-10-24 at 10:22 pm PDT (America/Los_Angeles)), and are tracked with the same fidelity as a player's character (hit points, conditions, resources, inventory, initiative); they have no creator and are run by the systems and the DM. Changing a template later does not change instances already deployed. An NPC who returns in a later encounter is deployed again from its template, and the DM adjusts it (for example its current hit points) before revealing it.
- **Nothing is hidden** from players: privacy does not exist yet ([Milestones](../Implementation/Milestones.md#roadmap)).
- **Core monsters for testing:** imported with S7 and S10, when their attacks and gear can be used (selected 2026-10-25 at 12:10 am PDT (America/Los_Angeles), user decision); S3 makes templates with the quick form. Milestone 5 adds three SRD 5.2.1 creatures to `core/NPCs`: Goblin, Bandit and Skeleton (which has a shortbow, so ranged attacks use up ammunition). Each is a complete import, set up exactly as a player's character would be: the whole stat block as data (attacks as structured actions with to-hit, damage and range), its SRD text and descriptions with credit, and its gear as real items with their own definitions and descriptions, such as the Skeleton's shortbow and a stack of arrows in its inventory.

## Scenes

Selected 2026-10-24 at 10:22 pm PDT (America/Los_Angeles) (user decisions). Play is always in a **scene**: an encounter or a downtime scene. A new campaign starts in a downtime scene at Day 1, so the table always has a current scene.

- **Where they live:** encounters at `campaign/<Campaign>/Encounters/<Scene>` and downtime scenes at `campaign/<Campaign>/Downtime/<Scene>`, each holding its own NPC instances.
- **Names:** scenes are named automatically from the clock, such as "Day 1 Downtime" or "Day 3 Encounter 2", and that stays their path. The DM can give one a title ("Ambush at the ford"), shown with it; the path does not change.
- **Who is present:** in an encounter, whoever the DM chose; in downtime, every character in the campaign's Characters folder, plus any NPCs the DM places there.
- **The campaign log** records what happens (scenes starting and ending, clock changes, and later actions and rolls). The DM and the players can also post free text to it, like a table chat. Nothing in the log is edited or removed afterwards.
- **Setting the clock:** the DM can set the clock's day and time at any time, for the start or a correction; each change is logged with the old and new time. Time moving forward in play still comes from rounds and from ending downtime.

## Encounters

The DM starts an encounter by choosing who takes part: characters and NPCs. The DM ends it. An ended encounter is never deleted: it becomes read-only history, including its instances and (later) its map, so the table can look back and see what happened, not only read the log; its records are kept small (selected 2026-10-24 at 7:52 pm PDT (America/Los_Angeles), user decision). Outside an encounter there is no turn order, and the DM moves the game clock forward by entered amounts ([out-of-combat time](Spell%20Effects%20and%20Active%20State.md#active-effects-game-time-and-early-ending)).

## Initiative and turn order

Whoever controls a character enters its initiative: they roll it in the app (d20 plus the character's initiative bonus) or type a physical roll, the same way as any other roll ([roll ownership](Spell%20Effects%20and%20Active%20State.md#roll-ownership-and-input-modes)). The DM controls NPCs, so the DM rolls for them: deploying NPCs rolls one initiative for each instance automatically, one after another, so five goblins get five rolls and ties go to whichever was rolled first, as for players (selected 2026-10-24 at 8:17 pm PDT (America/Los_Angeles), user decision); the DM can always reorder. The DM may also roll or type initiative for any player's character, as with any roll the DM takes over (clarified by the user 2026-10-24 at 5:44 pm PDT (America/Los_Angeles)).

**Surprise** (selected 2026-10-24 at 7:56 pm PDT (America/Los_Angeles), user decision): when starting an encounter the DM can mark participants as surprised. By the 2024 rules they roll initiative with Disadvantage, and the roll prompt (or the DM's roll for them) comes prefilled with it ([every roll](Spell%20Effects%20and%20Active%20State.md#roll-ownership-and-input-modes)).

Ties go to whoever entered their initiative first. The DM can always open the turn order and drag, change or edit it, including adding participants partway through an encounter, such as monsters joining a fight or a player arriving late.

**Round 1** (selected 2026-10-25 at 12:10 am PDT (America/Los_Angeles), user decision): starting an encounter opens initiative. NPC instances roll at once; players are prompted to roll or type theirs. The DM begins round 1 when ready; anyone still without an initiative is warned about and goes last, where the DM can still move them.

**Removing participants** (selected 2026-10-25 at 12:10 am PDT (America/Los_Angeles), user decision): the DM can take anyone out of the turn order during an encounter, such as a fleeing goblin or a player who leaves, and add them back; both are logged. An NPC below 0 hit points stays in the order until the DM removes it.

**Ending a turn** (selected 2026-10-24 at 7:56 pm PDT (America/Los_Angeles), user decision): whoever controls the active character ends its turn (the DM for NPCs), and the DM can advance at any time, for example when a player is away. Start-of-turn and end-of-turn events, such as a Reaction refreshing or a repeat save, happen as the turn changes.

## Rounds and the game clock

Each encounter counts its own rounds, starting at 1. Every round adds six seconds to the campaign's game clock, which keeps running across encounters, rests and the time between them, so effects measured in minutes or hours keep counting.

The clock reads as **day and time**, such as "Day 3, 2:32 pm": days counted from the campaign's start plus the time of day, starting at a time the DM sets (selected 2026-10-24 at 7:56 pm PDT (America/Los_Angeles), user decision). There are no calendar names; a campaign calendar could later be a module of its own. (The user proposed restarting rounds per encounter in the Hearthside prototypes; adopted here.)

## Action budget

Selected 2026-10-24 at 5:09 pm PDT (America/Los_Angeles) (user decision): on a character's turn the app tracks what each request uses (an action, a bonus action, a Reaction) and shows what is left. Going over is shown to the player before they submit and flagged for the DM, who can still approve it (shown to the player too: clarified 2026-10-24 at 5:44 pm PDT (America/Los_Angeles)), as over-budget feats only warn ([Character Creation and Advancement](Character%20Creation%20and%20Advancement.md)). A character's Reaction refreshes at the start of its own turn. Until requests (S6) record what each action uses, each participant shows Action, Bonus Action and Reaction as boxes its controller or the DM ticks, and using more than the budget warns (selected 2026-10-25 at 12:10 am PDT (America/Los_Angeles), user decision). Movement is not tracked: battle maps, positions and movement come with Milestone 6 ([Milestones](../Implementation/Milestones.md#roadmap)).

## Hit points, damage and going down

Selected 2026-10-24 at 8:07 pm PDT (America/Los_Angeles) (user decisions).

**Damage arithmetic** follows the 2024 rules and is applied automatically: Temporary Hit Points absorb damage first and do not stack (the higher amount is kept); resistance halves, vulnerability doubles and immunity ignores, in the 2024 order. Every step shows in the explanation, and the DM can adjust before approving.

**Negative hit points (Hearthtable Vanilla+).** The user's house rule replaces death saving throws, so that a character is never killed without its player's consent:

- **Hit points have no floor.** A character with 30 HP who takes 45 damage has −15.
- **At 0 or below a character is down:** Unconscious until its hit points are 1 or more again, when it wakes at once (2024 has no roll to wake). Acting while down only warns, as with any rule.
- **Healing adds to the number,** so a deep hole needs more than one heal: −30 healed for 10 is −20. A spell that returns a creature "with" a number of hit points, such as Revivify (1 HP), sets them to that number when they are lower. Spells that only stabilize, such as Spare the Dying, have nothing to do.
- **There are no death saves and no dead state.** Dead NPCs simply stay below 0, and a hardcore table treats a character as dead by never healing it. A character below 0 can still be healed, used or reused later.
- **NPC instances follow the same rule.**

The Vanilla 5e ruleset keeps the published 2024 rules: Unconscious at 0 HP with death saving throws ([three-ruleset matrix](Modules%2C%20Systems%20and%20Rulesets.md#three-ruleset-matrix)).

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
- **Activity types are modules** (user decision, 2026-10-24 at 6:07 pm PDT (America/Los_Angeles)). The downtime machinery knows nothing about any particular activity. Each activity type (sleeping, resting, crafting, scribing, trading, a note with a duration) comes from its own module, which supplies its own logic: how long it takes, whether it can be split, what it checks, how it changes the state shown ahead of approval, and what happens when it finishes. Adding an activity type later means adding a module, with no change to the machinery, the same way systems declare what they provide ([Modules, Systems and Rulesets](Modules%2C%20Systems%20and%20Rulesets.md)). Milestone 5 builds the machinery and the activity types whose rules exist: Short Rest, Long Rest and the note with a duration; crafting and scribing arrive as modules with Milestone 5b, and trading with Milestone 5c.
- **Players do not see the length in the app.** Since the DM sets the time only when ending the scene, players plan without knowing it; the DM may tell them anything in the story. The clock never moves on its own.

## What rests restore

Selected 2026-10-24 at 5:28 pm PDT (America/Los_Angeles) (user decision): Hearthtable Vanilla+ rests restore what the published 2024 rules say. A Short Rest lets a character spend Hit Point Dice to heal and resets short-rest resources; a Long Rest restores all hit points and all Hit Point Dice, all spell slots and long-rest resources, and lowers Exhaustion by one. Resources reset to their current maximum while queued holds stay with their requests ([capped replenishment](Spell%20Effects%20and%20Active%20State.md#casting-workflow--selected-2026-10-17)). Rests are downtime activities ([Downtime](#downtime)).

**Spending Hit Point Dice** (selected 2026-10-24 at 8:11 pm PDT (America/Los_Angeles), as the 2024 rules dictate): when a Short Rest finishes, its player is prompted to spend Hit Point Dice one at a time; each die is rolled and the character's Constitution modifier added, and the player sees each result before choosing whether to spend another. The DM can roll for them, like any roll. Until then the projected state shows the rest without its healing.

Interruptions — accepted by the user 2026-10-24 at 5:44 pm PDT (America/Los_Angeles), using the 2024 rules (to be verified against the rules text when built): a Short Rest gives nothing if the character rolls initiative, casts a spell other than a cantrip or takes damage; a Long Rest is stopped by those or by an hour of walking or other exertion, and if at least an hour of it had passed, the character still gets a Short Rest's benefits. Also by the 2024 rules (to be verified the same way): a character benefits from at most one Long Rest in 24 hours and needs at least 1 Hit Point at its start; breaking either only warns. An interrupted crafting job keeps its partial progress ([Crafting Jobs](Crafting%20Jobs.md)).

## Conditions

Selected 2026-10-24 at 6:11 pm PDT (America/Los_Angeles) (user decisions):

- **All fifteen 2024 conditions** (Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious) are complete definitions, like spells, with their SRD 5.2 rules text and credit. Nothing is shortcut: each condition's whole definition is there, and its logic is its own plug-in module, following the open-and-modular principle ([Modules, Systems and Rulesets](Modules%2C%20Systems%20and%20Rulesets.md#open-work-must-be-specified-before-implementation)).
- **Exhaustion level 6 in Hearthtable Vanilla+** (selected 2026-10-24 at 8:11 pm PDT (America/Los_Angeles), user decision): instead of death, the character is down, Unconscious until a Long Rest lowers its Exhaustion to 5, matching [negative hit points](#hit-points-damage-and-going-down). Vanilla 5e keeps the 2024 rule (death).
- **What is purely mechanical is automated,** such as Exhaustion's penalty to d20 tests and Incapacitated ending concentration. The rest (Advantage and Disadvantage situations, not being able to see, and so on) shows its rules text and is applied by hand, marked as manual ([partial automation](Spell%20Effects%20and%20Active%20State.md#structured-effects-and-manual-adjudication)).
- **Applying and removing:** a resolved spell or effect applies its condition automatically (Hold Person: Paralyzed while it lasts). The DM can apply or remove any condition directly; a player asks, like any request.
- **Ending:** a condition ends when its source says so: when the effect causing it ends or expires on the game clock, on a successful repeat save (prompted at the right turn boundary, like any roll), or when the DM removes it.

## Rules warn; the DM decides

Selected 2026-10-24 at 6:11 pm PDT (America/Los_Angeles) (user decision), for conditions and generally for gameplay rules: the app warns, it does not block. An Incapacitated character can still queue a spell or use an item; the app tells them they are Incapacitated, and only doing nothing (or something the rules allow, such as trying to wake) raises no warning. Approval and the final enforcement of rules are the DM's. The action budget works the same way (above).
