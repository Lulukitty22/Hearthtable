# Milestones

Purpose: the one home for Hearthtable's milestone roadmap, each milestone's acceptance criteria, the Milestone 2 build steps and the feature inventory. Status: written 2026-10-21 at 4:00 am PDT (America/Los_Angeles) during Milestone 1 (Step A4). Milestone 1 was accepted on 2026-10-22 at 11:42 am PDT, with no changes to the Milestone 2 build steps; coding may start with Step B. Step B (scaffold) was completed 2026-10-22 at 12:17 pm PDT (America/Los_Angeles); its commands are in [Architecture and Hosting](Architecture%20and%20Hosting.md#development-setup). Step C (kernel) was completed 2026-10-22 at 12:46 pm PDT (America/Los_Angeles) in `packages/kernel`, with unit tests for the envelope round trip, the registry's undeclared-dependency rejection and the ruleset compatibility check. Step D (systems and game module) was completed 2026-10-22 at 1:13 pm PDT (America/Los_Angeles): the thirteen Milestone 2 systems in `packages/systems` and `packages/games/dnd5e-2024`, with an integration test that reproduces Carol's documented numbers from a test fixture. The Artificer slot table is verified only at level 3 (the level Carol uses); its other rows follow the earlier published table and are marked unverified in the class record. Step E (ruleset) was completed 2026-10-22 at 1:18 pm PDT (America/Los_Angeles): `packages/rulesets/hearthtable-vanilla-plus/src/hearthtable-vanilla-plus.json` holds the Vanilla+ data, and a test checks it names only existing systems, methods and variables. Step F (Carol's content) was completed 2026-10-22 at 1:42 pm PDT (America/Los_Angeles) in `content/`, with the Milestone 2 expected-values test in `content/src/carol.test.ts`; `pnpm peek` prints her resolved sheet. Step G (storage) was completed 2026-10-22 at 1:52 pm PDT (America/Los_Angeles): both adapters pass the same contract tests, including the no-change and edit round trips (the Firestore one against the emulator), and `pnpm seed` loads Carol into the emulator. Step H (sheet viewer and editor) was completed 2026-10-22 at 2:26 pm PDT (America/Los_Angeles): `pnpm dev` shows Carol's sheet from the emulator in the selected dark fantasy theme, with Stats, Inventory, Spells & Books and Features tabs declared by the systems; editing of HP, quantities, book contents, active effects and the Wand's held state; and saving with an optional note into the sheet's history. Two Playwright tests cover the browser acceptance checks.

## Current progress

Updated 2026-10-24 at 4:38 pm PDT (America/Los_Angeles). This section is the one place that says where the project stands; the roadmap below owns each milestone's scope, and the [Milestone 5 Plan](Milestone%205%20Plan.md) owns the current slice details.

**Now:** Milestones 1–4 are accepted (Milestone 4 on 2026-10-24 at 4:38 pm PDT (America/Los_Angeles): "Milestone 4 is accepted", with privacy (S8) deferred to a later milestone). Milestone 5, the gameplay loop, is being planned: [Milestone 5 Plan](Milestone%205%20Plan.md) (draft). Milestones 3 and 4 keep their slice tables and acceptance in their own plans ([Milestone 3](Milestone%203%20Plan.md), [Milestone 4](Milestone%204%20Plan.md)).

**After Milestone 5:** Milestone 5b (crafting), Milestone 5c (trade window), Milestone 6 (real Firebase, only with the user's approval); see the [roadmap](#roadmap).

**Waiting on the user:** Carol's real gold amount (she has a labelled test purse); review of the Codex chat's Hearthside UI prototypes (`prototypes/hearthside/`, checklist in `REVIEW.md`).

**Running it locally:** double-click `Hearthtable Launcher.exe` (or `pnpm start`); see [development setup](Architecture%20and%20Hosting.md#development-setup).

## Selected decisions

Recorded with the user on 2026-10-21 at 12:10 am PDT (America/Los_Angeles):

- **Milestone 1 is documentation and theory.** No code is written until the user agrees to start coding (Step A7).
- **Milestone 2 is the engine plus Carol, running offline:** Carol's sheet fully rendered from one resolved state, with basic editing, saved to the local Firebase Emulator, and the lossless round-trip tests passing. No real Firebase project is made.
- **Milestones 3 onward are tentative.** Their order and contents are confirmed with the user after each milestone, asking for the user's opinion and whether they want to change anything.
- **Standing rule for every step and feature:** the agent and any sub-agents ask the user through the questions tool whenever something is unclear, contradictory or not stated in the documentation. They never guess.

## Open questions

- The order and contents of Milestones 3 onward (confirmed after each milestone).

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **1. Documentation and theory** | The architecture, rulesets and theory sketches; character creation; hosting and stack; milestone criteria; open-work stubs. | Accepted by the user 2026-10-22 at 11:42 am PDT (America/Los_Angeles) |
| **2. Engine + Carol offline** | Kernel, Milestone 2 systems, the Vanilla+ ruleset, Carol hand-entered, storage adapters, sheet viewer and basic editor, all on the emulator. | Built 2026-10-23 at 12:08 am PDT; accepted by the user 2026-10-23 at 1:54 am PDT (America/Los_Angeles) |
| 3. Core systems deep plan | Write a second plan for spells (details, scrolls as items, cost calculation), inventory (lifecycle, currency, ammunition counters) and economy rules. Then build them. Crafting jobs moved to 5b (2026-10-23 at 1:53 am PDT). | Accepted by the user 2026-10-23 at 4:57 am PDT (America/Los_Angeles). [Milestone 3 Plan](Milestone%203%20Plan.md) |
| 4. Accounts and campaigns on the emulator | All permissions and approvals: sign-in, Alias, account approval, folders, campaigns, membership, the DM review queue for character insertion and edits and for library proposals, concurrent-edit review, live export, portraits, Rules and the Firestore schema (approvals moved here by the user, 2026-10-23 at 5:26 am PDT (America/Los_Angeles); privacy deferred, 2026-10-24). | Accepted by the user 2026-10-24 at 4:38 pm PDT (America/Los_Angeles). [Milestone 4 Plan](Milestone%204%20Plan.md) |
| 5. Gameplay loop | The action inside a campaign. Specify, then build, turns, initiative, rests and conditions. Then the casting workflow: holds, execution-time approval, resolution, polls, rolls and effects on the game clock. | Being planned: [Milestone 5 Plan](Milestone%205%20Plan.md) (draft); see [Notes for Milestone 5](#notes-for-milestone-5) |
| 5b. Crafting | Crafting jobs with paid stretches, split rates and progress: scroll scribing, mounting and removal, Aetherlock rounds, canister refills, magic items, replicas and elixirs ([Crafting Jobs](../Systems/Crafting%20Jobs.md)). Moved from Milestone 3 by the user, 2026-10-23 at 1:53 am PDT. | Tentative |
| 5c. Trade window | Player-to-player and player-to-DM trades with barter valued in coin from library prices, and selling ([Currency and Trade](../Systems/Currency%20and%20Trade.md#open-design)). Made its own milestone by the user, 2026-10-23 at 5:00 am PDT (America/Los_Angeles); it needs campaigns (Milestone 4). | Tentative |
| Character creator | A character creator, starting from the minimal blank-with-a-name character of Milestone 4, and more broadly creating custom entries with their game fields (items, spells, features). Added by the user 2026-10-24 at 5:11 am PDT (America/Los_Angeles); it comes after Milestone 5 (turns and campaigns), and its exact place is open. | Tentative |
| 6. Move to real Firebase | Only with the user's explicit approval: project, region, Blaze, deployment, first administrator. | Tentative |
| Later | Privacy (moved from Milestone 4 S8; [model](../Systems/Campaigns%20and%20Shared%20Data.md#character-sheet-visibility)), NPCs and encounters, Discord bot, LLM helpers, importers, other rulesets and games. | Tentative |

## Notes for Milestone 5

Topics the user asked to revisit when Milestone 5 starts, recorded 2026-10-23 at 12:58 am PDT (America/Los_Angeles). They are open, not decisions.

> **⚠ Must be done in Milestone 5: Spellrounds and scroll snapshots** (recorded 2026-10-24 at 2:50 pm PDT (America/Los_Angeles), user decision). Carol's Spellrounds are stored wrongly today: each is a made-up item per spell (`Spellround_(Cone_of_Cold)`, `…(Shield)`, `…(Cure_Wounds)`) with no scroll inside, which contradicts [Aetherlock Engineered Rounds](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md#spellrounds-and-snapshots) (a Spellround is one real scroll mounted in a Basic Round). In Milestone 5:
>
> 1. Replace them with one **Spellround** item whose inventory lines carry a `scroll` exactly like loose scrolls (`spell`, `castLevel`, `scribe`, `snapshot`, `spent`), and convert Carol's three stacks in the content and in the user's saved data.
> 2. Design the **scribed-formula snapshot** for every scroll and Spellround: the scribe's bonuses saved as dice formulas when written (cast level and DC, applicable modifiers such as Empowered Evocation's +6 applied once, scaling and chosen options), rolled on use and never rewritten by later changes. Today a snapshot keeps only the save DC and attack bonus.
> 3. Opening a loose scroll or a Spellround shows the full spell panel (its stats, as Mage Armor shows in a book) beside the scroll's own facts. In the data, an inventory line's `ref` names the physical item and `scroll.spell` the spell; a book entry's `ref` names the spell and `item` the physical item.
> 4. Decide whether core entries move from flat paths (`core/Fireball`, `core/Spell_Scroll`) into kind folders (`core/Spells/…`, `core/Items/…`, `core/Features/…`); that rewrites every reference, so do it together with the Spellround conversion.

- **Play addresses** (decided 2026-10-24 at 2:16 pm PDT (America/Los_Angeles)): the players' view of the game in progress is `/Campaigns/<name>/Table` and the DM's is `/Campaigns/<name>/Table/Dungeon_Master` ([web addresses](../Systems/Campaigns%20and%20Shared%20Data.md#account-organization-and-address-design)).
- **Redo spellbook and spell-entry handling.** The user wants to rethink how and where spellbooks and their entries are stored and handled. Spellbooks currently double as scroll binders, and a book might become a container with its own item or weight limit, like a backpack. Discuss before building the casting workflow.
- **Spent scrolls.** Casting from a scroll could consume the materials stored in it, including its dice and formulas, leaving a passive spent scroll. Spent scrolls could serve as receipts of the spells used in a battle or as trophies, and might later be restored to working order. Other uses are open.

## Milestone 1 acceptance (documentation and theory)

- These documents exist, each opening with purpose, status, decisions and open questions:
  - [Modules, Systems and Rulesets](../Systems/Modules%2C%20Systems%20and%20Rulesets.md), including the three-ruleset matrix and the non-5e sketch
  - [Character Creation and Advancement](../Systems/Character%20Creation%20and%20Advancement.md)
  - [Architecture and Hosting](Architecture%20and%20Hosting.md)
  - this Milestones document
- The open-work stubs exist (turns, initiative and rests; conditions; NPCs and encounters).
- `Capella - Boss.md` is removed, with no broken links.
- Start Here, each directory file, README and AGENTS.md link to the new documents, with one authoritative home for each decision.
- A review agent compares the new and changed documents against the baseline for lost facts, duplicate authority and new contradictions, as AGENTS.md requires.
- `node 'Documentation/Implementation/Firebase Cost Model.cjs'` still passes.
- The user has reviewed the documents and the Milestone 2 build steps (Step A7), including whether anything should be generalized beyond 5e, and agreed to start coding.
- The working branch is committed and pushed, with the user's go-ahead.

## Milestone 2 build steps

At each step and feature, ask the user about anything unstated, contradictory or unclear, and ask for their general opinion. Layout, stack and testing tools are owned by [Architecture and Hosting](Architecture%20and%20Hosting.md).

- **B. Scaffold:** pnpm workspace, TypeScript strict, Vite + React, Vitest, Playwright, ESLint + Prettier, and Firebase Emulator configuration. No real project and no billing.
- **C. Kernel:** record envelope with `unknown` pass-through, module registry with `requires` and `extends` checking, the ruleset compatibility check, extension points, the resolved-state pipeline with an explanation trail, validation results, dice and a transition interface stub.
- **D. Systems and game module:** only the Milestone 2 systems listed in Architecture and Hosting, each written to the [placement rules](../Systems/Modules%2C%20Systems%20and%20Rulesets.md#placement-method-this-goes-here-this-uses-this).
- **E. Ruleset:** Hearthtable Vanilla+ data. Any value still unset shows as unresolved rather than a guessed default.
- **F. Carol content:** hand-enter Carol's records from [her sheet](../Character%20Sheets/Carol%20Elfnein.md), the [Carol Build Reference](../Class%20Reference/Carol%20Build%20Reference.md) and [Aetherlock Engineered Rounds](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md), as a campaignless character. Enter the Aetherlock as campaign-content data and Indomitable as a DM grant item. Do not use old JSON.
- **G. Storage:** `Repository` interface, memory adapter and Firestore adapter tested against the emulator, using the [record grouping](../Systems/Modules%2C%20Systems%20and%20Rulesets.md#records-storage-and-caching) (one document per definition and per sheet tab).
- **H. User interface:** the sheet viewer with tabs (Stats, Inventory, Spells/Books, Features) registered by systems; a basic editor for HP, quantities, book contents and an optional author note; saving to the emulator.

## Milestone 2 acceptance (engine + Carol offline)

- `pnpm test` passes. The suite must include:
  - **No-change round trip.** Load, edit nothing, save and reload Carol, and get a deep-equal result, including unknown and nested fields and quantity 0.
  - **Edit round trip.** Changing one field changes only that field.
  - **One resolved state.** Header, Stats and every tab show identical HP, AC, initiative and slots, taken from the single `ResolvedCharacter`.
  - **Expected values.** Carol's derived numbers match her accepted sheet: ability modifiers (INT 22 = base 20 + Indomitable item +2), proficiency +5, HP 95, initiative +8, saves and skills (including Arcana +16 and Investigation +16), slots 7/3/3/3/2/1 added per class, spellbook entry counts 16/10/6, and container depth accessibility.
  - **AC from active state.** AC is 13 with no active effects, 16 with Mage Armor marked active, and 21 with Shield also active. Owning a spell alone never changes AC.
  - **Held-item bonus.** The Wand's +1 applies to spell attacks (+12) only while it is attuned and held, and never changes DC 19 or gun aim +11.
  - **Unresolved references.** A deliberately missing definition renders as visibly `Unresolved`, never as a usable default.
  - **Module registry.** It rejects a module that uses an undeclared dependency.
  - **Ruleset compatibility.** A ruleset naming a missing method or variable produces a visible error, and the campaign's selected ruleset is not replaced.
  - **Ruleset switch.** A test ruleset that switches `spellbook-readiness` to `published-preparation`, with a fixture prepared-spell list, changes readiness without editing any system file. This is the placement-rule proof.
- **Browser end-to-end.** A Playwright test against `firebase emulators:start` plus `pnpm --filter web dev` opens Carol's sheet, edits HP and an inventory quantity, reloads, and sees both values persist in the emulator.
- Push the working branch. No pull request unless the user asks.

## Feature inventory

A reminder and scope list for future work, grouped by area. When building any feature here, ask the user about anything unstated, contradictory or unclear.

Each bullet's rules are owned by the linked Systems or Class Reference document; this list only tracks scope and status.

**Labels:** **M2** = Milestone 2 scope. *Selected* = designed in the documentation and waiting for implementation. *Needs spec* = must be specified in the documentation before implementation. *Future* = proposed or later.

### A. Multiple games and rulesets

The kernel must not be shaped around 5e. Architecture, vocabulary rule and compatibility rules are owned by [Modules, Systems and Rulesets](../Systems/Modules%2C%20Systems%20and%20Rulesets.md).

- **Hearthtable Vanilla+:** the main ruleset, built first. *M2, data only.*
- **Vanilla 5e:** published 2024 rules over the same systems. *Future*; sketched now.
- **Hearthtable Modern Fantasy:** gunfights and bullet-type damage tracking (armor depth, penetration, fragmentation) through `magazines` and an attached `ballistics` system. *Future*; sketched now.
- **Another game entirely,** with no levels, classes or spell slots (the Roblox outfits sketch). Sketched only to prove the kernel holds no 5e assumptions.

### B. Spell system

Spells are their own system family; their behavior depends on where a spell is stored.

- *Selected:* reusable spell definitions, with edition, source, tags, scaling and structured effects. **M2** for display.
- *Selected:* casting origin per spell and multiple grant sources without duplicate entries. **M2** for display.
- *Selected:* slots added per class, with slot level separate from spell-tier access; Pact Magic is a separate pool ([Character Creation and Advancement](../Systems/Character%20Creation%20and%20Advancement.md)). **M2** for the slot table.
- *Selected:* campaign spellbooks, where every spell including cantrips lives in a book; 16 entries; all contents ready; access inherits from the book's container depth. **M2.**
- *Selected:* storage changes function. A loose scroll is a prepaid one-shot using the scribe's snapshot, usable by anyone. A scroll mounted in a binder or book uses the current caster's statistics and resources and is not consumed. A scroll installed in a Spellround supplies its snapshot to the rifle and is consumed on release. One physical scroll keeps its identity through all of these.
- *Selected:* three data layers: definition, stored casting snapshot (formulas, not rolls) and owned instance.
- *Selected, not M2:* scribing a new scroll, including upcast scrolls at their actual level; mounting and removal; and the Arcana multiplier, as owned by [Spell Containers and Consumable Sources](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md). Scribing is its own system, separate from `magazines`.
- *Resolved 2026-10-23 at 12:58 am PDT (America/Los_Angeles):* cantrip mounting and removal now use 25 gp and one hour × M, half a level on the copying pattern, so cantrips are no longer slower than level 1 ([Spell Containers](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#scribing-mounting-and-removal)).
- *Selected, not M2:* the casting workflow (review → holds → queue → execution-time DM approval → resolve), and concentration capacity, replacement and loss.
- *Needs spec:* rituals, duplicate spell identities, class-granted spells when a book is lost, and conditional snapshot options.

### C. Inventory system

- *Selected:* owned instances separate from definitions, with stable identities, quantities (0 is valid), charges and contents. **M2.**
- *Selected:* nested containers and accessible depth 0–1. **M2.**
- *Selected:* capacity by count, weight and volume, with visible warnings and explicit overrides; unknown measurements are never treated as zero. **M2** for display.
- *Selected:* carried weight, including the Bag of Holding's fixed 5 lb. **M2** for display.
- *Selected:* attunement (3 slots, class restrictions) and equipped or held state. Held state drives conditional bonuses such as the Wand +1. **M2** for display.
- *Selected:* items can grant ability increases, feats, invocations and features; DM grants are such items. **M2** for Carol's Indomitable.
- *Selected:* deletion is blocked until a container is empty. Moving a container preserves its contents. Cycles and self-containment are prevented.
- *Selected:* queued holds remove quantities from inventory at submission.
- *Selected:* disabled missing-item placeholders when a custom definition is absent.
- *Selected 2026-10-23 at 1:53 am PDT:* item lifecycle — transfers wait for the trade window (Milestone 4); lost or destroyed items are marked, not removed; moving a full container asks about its contents; action costs belong to Milestone 5 ([Spell Containers](../Systems/Spell%20Containers%20and%20Consumable%20Sources.md#item-lifecycle--selected-2026-10-23-at-153-am-pdt-americalos_angeles)).
- *Future:* stealing, with a hidden notice roll for the owner or party.
- *Needs spec:* sale prices; ammunition and consumable tracking rules; volume estimates.

### D. Crafting, economy and custom content

- *Selected:* custom item and spell definitions as account and campaign content, created by hand entry, with linking, independent customization, publication and manual import.
- *Selected:* a campaign may override definitions and set ruleset variables within what its ruleset exposes.
- *Needs spec:* how far a campaign can tweak its ruleset before it should become a new ruleset.
- Crafting methods: systems provide recipe and cost formulas, rulesets set the numbers. Examples: scroll scribing and mounting; magic-item crafting (gp, workdays, tool proficiency by rarity); Aetherlock ammunition recipes; canister charges and refills; Artificer replicas and elixirs.
- *Selected 2026-10-23 at 1:53 am PDT:* coins, paying and cost rounding ([Currency and Trade](../Systems/Currency%20and%20Trade.md)).
- *Milestone 5c:* a trade window for player-to-player and player-to-DM trades, with barter valued in coin from library prices, and market value kept separate from crafting cost ([Currency and Trade](../Systems/Currency%20and%20Trade.md#open-design)).
- *Selected 2026-10-23 at 1:53 am PDT:* crafting jobs run in paid stretches of up to one workday, each at the rate in effect when paid; temporary bonuses count while they last; progress is marked by hand until the game clock. Built in Milestone 5b ([Crafting Jobs](../Systems/Crafting%20Jobs.md)).
- *Needs spec:* economy policy — the parked 120 gp canister refill and DIY casings, work-time rounding and shop prices.

### E. Weapons and combat items

- *Selected:* the shared `magazines` system: chambers, loaded rounds, load order and per-round contents.
- *Selected:* the Aetherlock rifle as campaign data attached to `magazines`: 6 chambers, mixed rounds and discharge counts; 12-charge canisters, mode costs and the Precision surcharge; canister replacement lockout; Impact, Airburst and Self fuzes; Shield-round Reaction delivery and HE-FRAG area. **M2** for display of chambers and charges only.
- *Selected:* capabilities such as Extra Attack are present or absent and apply once, however many classes grant them ([Character Creation and Advancement](../Systems/Character%20Creation%20and%20Advancement.md)).
- *Needs spec:* generic weapons, weapon mastery, attacks per Attack action, and Fighting Styles as reusable systems.

### F. Character core

- **M2:** abilities, including scores above 20 with a marker and extended point buy; proficiency with `maxLevel` as a ruleset variable; HP, authored or derived; AC as a selected base plus augments, using minimal active-effect state; skills (including expertise), saves and initiative; feats and class features as modifier sources; limited-use resources with their reset type.
- *Selected:* character creation and level-up rules, multiclass order and legality, feat, invocation and Epic Boon budgets, the level cap and scaling past 20, point buy and DM grants, owned by [Character Creation and Advancement](../Systems/Character%20Creation%20and%20Advancement.md). The creation wizard interface comes later.
- *Needs spec:* custom ancestries (creature type, flight, resistances), transformations and summons.

### G. Gameplay, effects and time

- *Selected:* Instant and Next Turn scheduling; repeating response polls and competing submissions; rolls (configured, expression or manual) and DM takeover; active effects on the game clock, DM time advance and early ending; partial automation with manual adjudication; manual retcons.
- *Needs spec:* turns, initiative and rests (resource reset), conditions, and NPCs, monsters and encounters.

### H. Accounts, campaigns and sharing

- *Selected:* Google sign-in, Alias and administrator approval (one `/accounts` area); site administrators (the first one seeded outside the app) and guest and public viewing; account folders and the three-layer campaigns; copy-only placement and duplicate-name rejection; ownerless campaigns with equal DMs, invites and joins; delegated control; per-tab and per-line privacy, screen-only, with true totals and unnamed private sources; hidden actions; concurrent-edit difference review; offline honesty; live export shell, portraits and the optional Discord link. These are owned by [Campaigns and Shared Data](../Systems/Campaigns%20and%20Shared%20Data.md).
- **M2:** basic editing with an optional author note, saved to the emulator. Carol is campaignless in Milestone 2, so owner edits need no DM approval.

### I. Future or proposed

- Discord bot.
- LLM helpers for sheet questions and answers, item search, import parsing and structured-effect proposals, always behind human acceptance.
- Automatic importers and bulk definition import.
- Visible-content export snapshots, for consideration only.
- Proposed by the user 2026-10-22 at 2:26 pm PDT (America/Los_Angeles): notes and commentary attached to a character's own copy of an item or spell (never to the shared library definition), and Discord-style mentions in save notes that link a change to its roll or to the campaign card involved, for example "lost [25 HP] from [Dragon]", entered by hand or written automatically.
- Proposed by the user 2026-10-22 at 2:26 pm PDT (America/Los_Angeles): roll results shown the same way as other numbers, with hover giving the dice and modifiers in one line ("33 (4d10+5) + 10 (2d6+3)") and click or tap opening every die and modifier.
