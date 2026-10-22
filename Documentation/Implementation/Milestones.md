# Milestones

Purpose: the one home for Hearthtable's milestone roadmap, each milestone's acceptance criteria, the Milestone 2 build steps and the feature inventory. Status: written 2026-10-21 at 4:00 am PDT (America/Los_Angeles) during Milestone 1 (Step A4). Milestone 1 was accepted on 2026-10-22 at 11:42 am PDT, with no changes to the Milestone 2 build steps; coding may start with Step B. Step B (scaffold) was completed 2026-10-22 at 12:17 pm PDT (America/Los_Angeles); its commands are in [Architecture and Hosting](Architecture%20and%20Hosting.md#development-setup). Step C (kernel) was completed 2026-10-22 at 12:46 pm PDT (America/Los_Angeles) in `packages/kernel`, with unit tests for the envelope round trip, the registry's undeclared-dependency rejection and the ruleset compatibility check. Step D (systems and game module) was completed 2026-10-22 at 1:13 pm PDT (America/Los_Angeles): the thirteen Milestone 2 systems in `packages/systems` and `packages/games/dnd5e-2024`, with an integration test that reproduces Carol's documented numbers from a test fixture. The Artificer slot table is verified only at level 3 (the level Carol uses); its other rows follow the earlier published table and are marked unverified in the class record. Step E (ruleset) was completed 2026-10-22 at 1:18 pm PDT (America/Los_Angeles): `packages/rulesets/hearthtable-vanilla-plus/src/hearthtable-vanilla-plus.json` holds the Vanilla+ data, and a test checks it names only existing systems, methods and variables.

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
| **2. Engine + Carol offline** | Kernel, Milestone 2 systems, the Vanilla+ ruleset, Carol hand-entered, storage adapters, sheet viewer and basic editor, all on the emulator. | Next |
| 3. Core systems deep plan | Write a second plan for spells (casting, scrolls, scribing and mounting), inventory (lifecycle, currency, ammunition) and crafting and economy. Then build them. | Tentative |
| 4. Accounts and campaigns on the emulator | Sign-in, Alias, approval, folders, campaigns, membership, privacy, Rules and the Firestore schema. | Tentative |
| 5. Gameplay loop | Specify, then build, turns, initiative, rests and conditions. Then the casting workflow: holds, approval, resolution, polls, rolls and effects on the game clock. | Tentative |
| 6. Move to real Firebase | Only with the user's explicit approval: project, region, Blaze, deployment, first administrator. | Tentative |
| Later | NPCs and encounters, export shell, portraits, Discord bot, LLM helpers, importers, other rulesets and games. | Tentative |

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
- *Deferred question:* mounting a cantrip takes longer than mounting a level-1 spell, although the Arcana multiplier applies to both. Raise whether that ordering is intended when scribing is built.
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
- *Needs spec:* gameplay transfer, sale, loss and destruction; movement and retrieval action costs; currency; ammunition and consumable tracking rules; volume estimates.

### D. Crafting, economy and custom content

- *Selected:* custom item and spell definitions as account and campaign content, created by hand entry, with linking, independent customization, publication and manual import.
- *Selected:* a campaign may override definitions and set ruleset variables within what its ruleset exposes.
- *Needs spec:* how far a campaign can tweak its ruleset before it should become a new ruleset.
- Crafting methods: systems provide recipe and cost formulas, rulesets set the numbers. Examples: scroll scribing and mounting; magic-item crafting (gp, workdays, tool proficiency by rarity); Aetherlock ammunition recipes; canister charges and refills; Artificer replicas and elixirs.
- *Needs spec:* economy policy — the parked 120 gp canister refill and DIY casings, currency and work-time rounding, whether crafting uses the score at job start and how temporary buffs count, and shop prices.

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
