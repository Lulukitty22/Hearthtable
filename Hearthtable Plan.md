# Hearthtable: Documentation Evaluation, Architecture Decisions and Milestone Plan

Revised 2026-10-21 at 12:51 am PDT (America/Los_Angeles) after checking the plan against the documentation. The revision log at the end lists what changed and why.

Kept as a planning record (user decision, 2026-10-21 at 4:00 am PDT, America/Los_Angeles). Its decisions now live in the documentation: [Modules, Systems and Rulesets](Documentation/Systems/Modules%2C%20Systems%20and%20Rulesets.md), [Character Creation and Advancement](Documentation/Systems/Character%20Creation%20and%20Advancement.md), [Architecture and Hosting](Documentation/Implementation/Architecture%20and%20Hosting.md) and [Milestones](Documentation/Implementation/Milestones.md). Where this plan differs, those documents win.

## Context

Hearthtable is a fresh start containing only documentation: no code and no Firebase project. The user asked for five things:

1. An evaluation of the documentation, including what it lacks.
2. A decision on whether the app can run purely in the browser with Firebase, or needs a dedicated host.
3. A modular, expandable architecture for "games, systems and subsystems". This runs from D&D down to spellcasting logic and Superiority Dice. It also covers future presets like *Hearthtable Modern Fantasy*, which would handle bullet types instead of spells.
4. An inventory of planned and future features.
5. A plan to start scripting.

### Decisions made with the user

Session of 2026-10-21, 12:10 am PDT (America/Los_Angeles):

**Standing rule for every step:** the agent and any sub-agents ask the user questions through the questions tool whenever something is unclear, contradictory, or not stated in the documentation. They never guess. They also ask for the user's general opinion and whether the user wants to change anything. This applies to every step and every feature below.

- **Backend:** pure browser plus Firebase. Add server compute only where it is unavoidable. Cheating is not a concern for a friends group. **Start on the local Firebase Emulator**, and learn how real Firebase deployment works alongside it, so moving over is ready whenever it is chosen.
- **Frontend stack:** my choice. Selected React + TypeScript + Vite in a pnpm monorepo. TypeScript lets one rules engine run in the browser, in tests, and in any later server code.
- **Core content:** hand entry only for now. Importers come later. LLM helpers for search and import parsing are recorded as a future feature.
- **Systems versus rules:**
  - Systems are code. They hold the methods and logic for calculating things, and one system may offer several interchangeable methods.
  - Rules and presets are data only. They turn systems on or off, pick methods, set variables (such as maximum spellbook entries) and whitelist or blacklist traits.
  - A major mechanic, such as Modern Fantasy ballistics, can be its own system attached to another system.
  - The user requires a clear placement method: "this goes here, this uses this", working across two or three rulesets without invalidating any file.
- **Ruleset versioning:** every major version of a ruleset is its own separate ruleset, with its own file and title (for example "Hearthtable Vanilla+" and later "Hearthtable Vanilla+ 2"). To move a campaign to it, a DM *selects the new ruleset*; it is not an in-place upgrade. Bug fixes may update an existing ruleset in place. Large revamps become a new ruleset, and the older ruleset's file is not edited.
- **Ruleset name:** the first ruleset is titled "Hearthtable Vanilla+ Rules", called "Hearthtable Vanilla+" for short. Its package is `hearthtable-vanilla-plus`. A later major version would be "Hearthtable Vanilla+ 2".
- **Milestones** (restructured at the user's request):
  - **Milestone 1** is documentation and theory.
  - **Milestone 2** is the engine plus Carol, running offline. Open Carol's sheet fully rendered from one resolved state, with basic editing, saved to the local Firebase Emulator. Run the lossless round-trip tests. Make no real Firebase project.
  - Later milestones are tentative; see section 5.
- **Documentation before code:** write the Module/Ruleset architecture and Character Creation/Level-up documents now, asking the user questions along the way. Leave explicit "must be specified before implementation" notes for:
  - turns, initiative and rests
  - conditions
  - NPCs and encounters
- **Stale Capella and mounting-cost text:** queued as a separate task (already suggested to the user). It is out of scope here.

Follow-up decisions, 2026-10-21 at 12:51 am PDT (America/Los_Angeles):

- **Level cap:** `maxLevel` is a ruleset variable, 20 by default. Hearthtable Vanilla+'s value, and how proficiency, cantrips and slots scale past level 20, are open questions for Step A2. The documentation requires an explicit campaign rule for scaling past the published tables, not an assumed extrapolation.
- **Security Rules enforce authority, not game math.** Rules check who may read and write: membership, DM role, delegation and its revocation, DM approval for character changes, administrator and approval fields, and private-tab access. They do not check whether a hold amount or a calculation is correct.
- **Finer privacy:** private entries inside a tab (one inventory item, one spellbook entry) are proposed as an extra layer on top of tab privacy, not a replacement. A dated proposal was added to [Campaigns and Shared Data](Documentation/Systems/Campaigns%20and%20Shared%20Data.md#character-sheet-visibility). How totals that depend on private data appear to other viewers is decided in Step A1.
- **Gun handling:** a reusable `magazines` system covers chambers, loaded rounds, load order and per-round contents. Hearthtable Vanilla+ enables it, and Modern Fantasy can reuse it. The Aetherlock's canisters, fuzes and Spellrounds attach to it. The Aetherlock itself is campaign custom content (data), so the documented missing-definition placeholder still applies.
- **Methods and old rulesets:** a system holds several methods, and each ruleset picks one by setting. Old ruleset files are never edited, but there is no backward-compatibility promise. If a system change breaks a ruleset (a variable renamed, a method removed), campaigns stay on the ruleset they selected; nothing switches them automatically. Whatever no longer works must show a visible warning or error when it runs, and must never quietly fall back to a default. Keeping the campaign working is the DM's job: they select a newer ruleset.
- **Alias uniqueness:** Aliases use the same duplicate rule as names: capitalization, and spaces versus underscores, do not distinguish two Aliases. The chosen display capitalization is kept.
- **Boss Capella:** remove `Capella - Boss.md` from the working documentation in Step A6, after moving any unique facts that other documents still need. Git history keeps it.

---

## 1. Documentation evaluation

### Strengths

The documentation is unusually strong on several fronts:

- Authority and permissions.
- The casting workflow: holds, execution-time approval, response polls and rejection.
- The three data layers: definition, snapshot and instance.
- Containers and their depth.
- Concentration capacity.
- AC as a base plus augments.
- Copy-only placement.
- Privacy.
- Concurrent-edit differences.
- The cost model.

The Lessons note turns the old app's failures into testable requirements: lossless round trips, one resolved state, stable identities, and unresolved data that is visibly unresolved. Carol's sheet and the Aetherlock ledger check out arithmetically.

### Gaps

No gap blocks Milestone 2 once Milestone 1's documents are written. These gaps are **not** resolved in planning. They are worked through with the user, question by question, during the execution steps below (mainly Step A).

| Gap | Blocks | Action |
|---|---|---|
| No module, system, ruleset or preset architecture. The docs assume a single hard-coded D&D 2024 app with house rules mixed in. | Milestone 2 | Milestone 1: write the architecture doc (Step A1). |
| No character creation or level-up design. Missing pieces include multiclass order, feat and invocation budgets, the level cap and scaling past 20, point buy and DM grants. | Milestone 2, in part | Milestone 1: write the doc with question rounds (Step A2). Milestone 2 needs only the data model; the wizard UI comes later. |
| No tech stack, repository layout, testing strategy or milestone acceptance criteria. | Milestone 2 | Milestone 1: implementation doc (Step A3). |
| Totals that depend on private tabs or entries. One resolved state must not leak private data, and the docs leave aggregate-stat presentation open. | Milestone 2 data model, Milestone 4 | Step A1 question; it shapes the document split. |
| Logical records versus stored documents. The cost model assumes a character view reads about ten 10 KiB documents; one document per spell or item would mean 50–100+ reads for Carol. | Milestone 2 storage | Step A1/A3: separate the record envelope from how records are grouped into Firestore documents. |
| Turns, initiative order, turn advancement, short and long rests, and resource reset. The casting workflow and "replenish to maximum" depend on these. | Milestone 5 | Stub with a "must be specified before implementation" note. |
| Conditions (Incapacitated is referenced, never modelled) and NPC, monster and encounter records. | Milestone 5+ | Stub notes. |
| Rule-record metadata. Every sheet distinguishes published, campaign, proposed, parked and secondary-source confidence, and mixes 2014/2024/third-party content per feature. The record schema needs `status` + `edition` + `sourceConfidence`. | Milestone 2 | Milestone 1: fold into the architecture doc's record envelope. |
| `file://` exports and Google sign-in. Firebase Auth will not run from a downloaded file's origin, but guest reads of public data can. | Later | Note in the implementation doc. Verify when exports are built. |
| Firestore schema, region and private-tab document split. | Milestone 4 | Remains an open item in Campaigns and Shared Data. |
| First site administrator. Rules stop users from setting their own administrator flag, so the first one must be set outside the app. | Milestone 4 | Step A3: emulator seed data now; Firebase console (or a one-off script) when moving to real Firebase. |

### Contradictions found

- **`Capella - Boss.md`:** out of scope. Nothing is built for it, and the file is removed in Step A6.
- **`Capella.md`:** the header says the build is "not finalized", while other sections call parts of it complete. The user thinks it probably is final. Confirm with the user, then update the status wording in Step A6.
- **`Aetherlock Costs and Damage.md`:** mounting a cantrip takes longer than mounting a level-1 spell (an 8-hour baseline versus 2 hours, about 42.8 versus 10.7 minutes at Carol's Arcana). The Arcana multiplier *is* applied in both cases, and the 15 gp / one-workday cantrip baseline was selected deliberately ("replaces the 25 gp/one-hour proposal"). The only question is whether that time ordering is intended. **Deferred:** raise it when the scroll scribing and mounting system is built.

---

## 2. Hosting decision: browser + Firebase, no dedicated host now

Every trusted need in the current documentation can be met without server code:

| Need | Pure browser + Firebase method |
|---|---|
| Resource holds and one-time resolution | Firestore client `runTransaction`. The request document id is the stable action identity. The transaction refuses if the action status is not `pending`, which makes duplicate approval a no-op. Usable amount → hold → consumed or returned happens in the same transaction. |
| Who may write | Security Rules enforce authority only (decision above). A player's submission may write the request and its hold to the character, because the hold is part of the selected workflow. Ordinary sheet edits in a campaign go through DM approval, and Rules refuse submissions from a revoked delegate. Rules do not re-check game arithmetic. |
| DM-only approval, membership, tab and entry privacy | Security Rules check `/campaigns/{campaignId}/members/{uid}.role`. Private tabs (and, if adopted, private entries) are separate documents with access lists. Rules enforce what can be read, including the site-administrator read access; the user interface does not. |
| Accounts: Alias, approval and site administrators | One `/accounts` area. `/accounts/{uid}` holds the Alias, approval status and administrator flag, and no Google email or profile data in anything publicly readable. Rules stop a user from changing their own approval or administrator fields. Admins approve accounts in the user interface. No Admin SDK or custom claims are needed. Firestore cannot enforce a unique value across documents, so a small Alias index (`/accounts-by-alias/{normalizedAlias}`, normalized by the duplicate-name rule) is written in the same batch and checked with `existsAfter`. The same pattern covers unique campaign and character paths. The accounts schema has one home in the documentation. |
| Game calculations | The shared TypeScript engine runs in the browser. The DM's browser resolves approved actions. The engine is the same code a server would run later. |
| Live updates | Native Firestore listeners, as already selected. |

What will eventually need compute (all deferred):

- **Discord bot:** an HTTP-interactions endpoint, or a Gateway client.
- **LLM helpers:** an API key cannot ship in the browser bundle.

The options, in order of preference:

1. **Cloud Functions or Cloud Run.** Both have free allowances on Blaze.
2. **The user's PC.** Acceptable for the bot, per the existing documentation.
3. **A GCP e2-micro always-free VM.** Use it if a persistent Gateway bot is wanted, or to move Cloud Run work onto it.

**Design rule for the future:** every state change goes through a named *Transition* interface, such as `submitRequest` or `approveRequest`. That lets any transition later move into a Cloud Function without changing the user interface; its Rules would change with it.

**Running on the user's PC (development only):**

- **At the start, everything runs on the user's PC through the Firebase Emulator Suite** (Auth, Firestore, Storage, Hosting). No real Firebase project exists yet.
- The app must not depend on anything running locally except the emulator, so it can move to real Firebase with only a connection-configuration change.
- Friends can reach a PC-hosted session only while the PC is on, through a tunnel or port forwarding. This is for testing only. It does not meet the documented hosting requirement that the app work while the user's PC is off, which only real Firebase hosting satisfies.

**Blaze is needed** only once the app moves to real Firebase, and only for portrait Cloud Storage. That move, and any billing, waits for the user's explicit approval, as required by AGENTS.md.

---

## 3. Modular architecture

Reminder: while designing and building the modules, ask the user whenever a placement, layer or dependency is unclear. Also ask for their general opinion and whether they want to change anything.

### Layers

Dependencies point downward only.

```
Campaign (DM selects one ruleset; switching means selecting another — never automatic)
  Ruleset (data: "Hearthtable Vanilla+" — enables systems, picks methods, sets variables, white/blacklists)
    Game module (code+data: "dnd5e-2024" — vocabulary: abilities, skills, damage types, class and slot tables)
      Systems (code: abilities, proficiency, spellcasting, spellbook-readiness, containers, resources-and-holds,
               armor-class, active-effects, concentration, damage, magazines, scrolls, superiority-dice, ballistics …)
        Kernel (code, game-agnostic: record envelope, identities, module registry, extension points,
                resolved-state pipeline, dice, validation results, transitions)
```

"Preset" and "ruleset" mean the same thing in this plan; the architecture doc picks one term.

### Kernel contracts

The kernel lives in `packages/kernel` and knows nothing about D&D:

- **Record envelope:**
  - `id`, `kind`, `moduleId`, `schemaVersion`, `origin`, `source` (with edition, status and confidence)
  - `revision`, `data`
  - an **`unknown` pass-through bag**, so a no-change round trip is lossless
  - a record is a logical unit; how records are grouped into stored documents is a storage decision (see Gaps)
- **Module manifest:**
  - `id`, `version`, `requires: [moduleId@range]`
  - `extends: [extensionPointId]`
  - `provides: { extensionPoints, methods, recordKinds, ruleVariables (typed with defaults), uiTabs }`
- **Extension points:** a system publishes named hooks that later systems attach to. Examples:
  - `damage.mitigationSteps`
  - `armorClass.augments`
  - `resources.pools`
  - `magazines.roundPayloads`
  - `sheet.tabs`
- **Resolved-state pipeline:** `resolveCharacter(records, ruleset) → ResolvedCharacter` runs once. Every view renders from it, and it carries an explanation trail for every number, such as "AC 16 = Mage Armor 13 + DEX 3". Authored values stay authoritative. Unresolved references produce visible `Unresolved` markers and never defaults.
- **Ruleset compatibility check:** loading a ruleset validates every system, method and variable it names against the registry. Anything missing or renamed is reported as a visible error when that part runs. The campaign keeps its selected ruleset; nothing substitutes a default.

### Placement method: "this goes here, this uses this"

These are the user's requested rules, to be written into the architecture doc:

1. **Lowest common home.** Code goes in the lowest layer that every user of it needs. Put it in the Kernel if it is game-agnostic. Put it in a System if more than one game or ruleset could use it. Put it in a Game module if it is only that game's vocabulary. One campaign's custom item is data, not code: the Aetherlock is data on top of the `magazines` system.
2. **Never code in a ruleset.** If a ruleset needs behavior that no method provides, write a new method or system. Then the ruleset picks it.
3. **Removal test.** If deleting module X breaks module Y, then Y must list X in `requires`. Siblings never import each other undeclared.
4. **Attach, don't edit.** A new system extends an existing system through one of its extension points. It never modifies that system's files. For example, `ballistics` attaches `armorPenetration` and `fragmentation` steps to `damage.mitigationSteps`, and `damage` does not know ballistics exists.
5. **New behavior is a new method.** A system can hold several methods, and a ruleset picks one by setting. To change behavior for a new ruleset, add a method rather than rewriting one an existing ruleset uses. Genuine bugs are fixed in place. If a system change does break an old ruleset, nothing protects it beyond the compatibility check's visible errors (decision above).
6. **Three-ruleset check.** Every placement must work in a matrix across **Vanilla 5e**, **Hearthtable Vanilla+** and **Hearthtable Modern Fantasy**. The architecture doc includes this matrix as its acceptance test. Example rows:

| Concern | Vanilla 5e | Hearthtable Vanilla+ | Modern Fantasy |
|---|---|---|---|
| Spell readiness (system `spellbook-readiness`) | method `published-preparation` | method `book-contents-ready`, variable `bookCapacity=16` | system disabled |
| Accessible container depth (system `containers`) | `maxAccessibleDepth=unlimited` (explicit value, not an unset variable) | `maxAccessibleDepth=1` | `maxAccessibleDepth=1` |
| Concentration (system `concentration`) | `defaultCapacity=1` | `defaultCapacity=1`; authored abilities may raise it | disabled or 1 |
| Damage (system `damage`) | method `resistance-halving` | same | same, plus `ballistics` attached |
| Firearms (system `magazines`) | disabled | enabled; Aetherlock canisters, fuzes and Spellrounds attach as data and extensions | enabled; bullet types attach through `ballistics` |
| Level cap (game-module variable `maxLevel`); proficiency (system `proficiency`) | `maxLevel=20`; published proficiency table | open (Step A2): `maxLevel` value and scaling past 20 | as Vanilla+ |
| Scroll use (system `scrolls`) | method `published` | method `anyone-one-shot`; Arcana-multiplier formula as a method | disabled |

### Repository layout (pnpm workspaces)

- `packages/kernel` holds the record envelope, registry, pipeline, dice and the Transition interface.
- `packages/systems/*` holds one folder per system. Milestone 2 needs:
  - `abilities`, `proficiency`, `skills-and-saves` (including expertise and initiative), `features` (feats and class features as modifier sources, such as Alert, War Caster and Skill Expert)
  - `hit-points`, `armor-class`, `active-effects` (a minimal store of which effects are active, so AC can show Mage Armor or Shield only when active; no clock or expiry yet)
  - `resources` (limited-use pools with reset types: Arcane Recovery, Tinker's Magic, the free Magic Initiate cast, Heroic Inspiration)
  - `spellcasting`, `spellbook-readiness`
  - `containers`, `attunement` (including held state for conditional bonuses such as the Wand)
  - `magazines` (chambers and charge display only)
- `packages/games/dnd5e-2024` holds the game module, including class records and the multiclass slot table.
- `packages/rulesets/hearthtable-vanilla-plus` holds the ruleset data.
- `packages/storage` holds the `Repository` interface plus `memory` and `firestore` adapters. The engine never imports Firebase.
- `apps/web` holds the React sheet viewer and editor. Tabs come from the `sheet.tabs` registry.
- `apps/export-shell` is a later app.
- `content/` holds hand-entered Carol records as JSON fixtures, plus the Aetherlock as campaign-content data.
- `firebase.json` and `firestore.rules` are emulator-only for now.

`superiority-dice` is not needed for Milestone 2, because Carol has none; it stays on the roadmap as a test of the `resources` system.

---

## 4. Feature inventory

This collects everything from the documentation and this conversation, grouped by core system area. It will be written into the architecture doc as the module roadmap. It is a reminder list for future work as well as a scope list.

Reminder: when building any feature here, ask the user about anything unstated, contradictory or unclear. Also ask for their general opinion and whether they want to change anything.

**Labels:** **M2** = Milestone 2 scope. *Selected* = designed in the docs and waiting for implementation. *Needs spec* = must be specified in the documentation before any implementation. *Future* = proposed or later.

**Follow-up plan (Milestone 3):** after Milestone 2, write a second, updated plan that focuses on the core systems below, mainly spells, inventory and crafting. Their selected rules are deep enough that each needs its own build plan.

### A. Multiple games and rulesets (discuss early, during Step A1)

The user moved this up. It defines how modular the app really is, and it guards against the first version's pitfall of being 5e-only. The kernel must not be shaped around 5e.

- **Hearthtable Vanilla+:** the main ruleset, built first. *M2, data only.*
- **Vanilla 5e:** published 2024 rules as a ruleset over the same systems. *Future*, but sketched in the documentation now as a test of the split.
- **Hearthtable Modern Fantasy:** gunfights, and bullet-type damage tracking (armor depth, penetration, fragmentation) through the shared `magazines` system and an attached `ballistics` system, instead of spells. *Future*, sketched in the documentation now.
- **Another game entirely:** a game with no levels, classes or spell slots. Sketched briefly in the documentation only to prove the kernel holds no 5e assumptions. Examples include point-based, d100 or narrative systems, or something silly like Roblox clothes.
- **Kernel vocabulary rule:** the kernel knows only records, resources, modifiers, effects, actions, rolls and time. Words such as "level", "spell slot", "class" or "AC" belong to game modules and systems.
- **Ruleset compatibility:** old rulesets are never edited and are not guaranteed to keep working after system changes; breakage must be visible (decision above).

### B. Spell system (core)

Spells are important enough to be their own system family. Their behavior depends on where a spell is stored.

- *Selected:* reusable spell definitions, with edition, source, tags, scaling and structured effects. **M2** for display.
- *Selected:* casting origin per spell and multiple grant sources without duplicate entries. **M2** for display.
- *Selected:* the shared multiclass slot pool, with slot level separate from spell-tier access. Pact Magic is a separate pool. **M2** for the slot table.
- *Selected:* campaign spellbooks, where every spell including cantrips lives in a book; 16 entries; all contents ready; access inherits from the book's container depth. **M2.**
- **Storage changes function.** *Selected:*
  - A loose scroll is a prepaid one-shot that uses the scribe's snapshot. Anyone may use it.
  - A scroll mounted in a binder or book uses the current caster's statistics and resources, and is not consumed.
  - A scroll installed in a Spellround supplies its snapshot to the rifle, and is consumed on release.
  - One physical scroll keeps its identity through all of these.
- *Selected:* three data layers: definition, stored casting snapshot (formulas, not rolls) and owned instance.
- *Selected:* scribing a new scroll, including upcast scrolls at their actual level; mounting and removal; and the Arcana multiplier `M = 3^((5 − A)/5)`. This is used by Carol and her weapon, and by all spellcasters. Scribing is its own system, separate from `magazines`. *Not M2.*
- *Deferred question:* mounting a cantrip takes longer than mounting a level-1 spell, although the Arcana multiplier applies to both. Raise whether that ordering is intended when scribing is built.
- *Selected, not M2:* the casting workflow (review → holds → queue → execution-time DM approval → resolve), and concentration capacity, replacement and loss.
- *Needs spec:* rituals, duplicate spell identities, class-granted spells when a book is lost, and conditional snapshot options.

### C. Inventory system (core)

- *Selected:* owned instances separate from definitions, with stable identities, quantities (0 is valid), charges and contents. **M2.**
- *Selected:* nested containers and accessible depth 0–1. **M2.**
- *Selected:* capacity by count, weight and volume, with visible warnings and explicit overrides. Unknown measurements are never treated as zero. **M2** for display.
- *Selected:* carried weight, including the Bag of Holding's fixed 5 lb. **M2** for display.
- *Selected:* attunement (3 slots, class restrictions) and equipped or held state. Held state drives conditional bonuses such as the Wand +1. **M2** for display.
- *Selected:* deletion is blocked until a container is empty. Moving a container preserves its contents. Cycles and self-containment are prevented.
- *Selected:* queued holds remove quantities from inventory at submission.
- *Selected:* disabled missing-item placeholders when a custom definition is absent.
- *Proposed:* private entries inside a tab, as an extra layer on tab privacy (see section H).
- *Needs spec:*
  - gameplay transfer, sale, loss and destruction
  - movement and retrieval action costs
  - currency
  - ammunition and consumable tracking rules
  - volume estimates

### D. Crafting, economy and custom content

This is wider than the parked Aetherlock proposals. It covers four areas:

- **Custom item and spell definitions:** account content and campaign content, created by hand entry, with linking, independent customization, publication and manual import. *Selected.*
- **Campaign-specific edits and house rules:** a campaign may override definitions and set ruleset variables, within what its chosen ruleset exposes. *Needs spec:* how far a campaign can tweak its ruleset before it should become a new ruleset.
- **Crafting methods:** systems provide the recipe and cost formulas; rulesets set the numbers. Examples:
  - scroll scribing and mounting
  - magic-item crafting (gp, workdays, tool proficiency by rarity)
  - Aetherlock ammunition recipes
  - canister charges and refills
  - Artificer replicas and elixirs
- **Economy policy:**
  - the parked 120 gp canister refill and DIY casings
  - currency and work-time rounding
  - whether crafting uses the score at job start, and how temporary buffs count
  - shop prices

  *Needs spec.*

### E. Weapons and combat items

- *Selected:* the shared `magazines` system: chambers, loaded rounds, load order and per-round contents, enabled by Hearthtable Vanilla+ and reusable by Modern Fantasy and other weapons.
- *Selected:* the Aetherlock rifle, as campaign data plus attachments to `magazines`:
  - 6 chambers, mixed rounds and discharge counts
  - 12-charge canisters, mode costs and the Precision surcharge
  - canister replacement lockout
  - Impact, Airburst and Self fuzes
  - Shield-round Reaction delivery and HE-FRAG area

  **M2** for display of chambers and charges only.
- *Needs spec:* generic weapons, weapon mastery, attacks per Attack action, and Fighting Styles as reusable systems.

### F. Character core

- **M2:**
  - abilities, including scores above 20 with a marker, extended point buy and DM grants
  - proficiency, with `maxLevel` as a ruleset variable; scaling past 20 stays open (Step A2)
  - HP, authored or derived
  - AC as a selected base plus augments, using minimal active-effect state
  - skills (including expertise), saves and initiative
  - feats and class features as modifier sources
  - limited-use resources with their reset type
- *Being specified now (Step A2):* character creation and level-up, multiclass order and legality, feat, invocation and boon budgets, and the level cap and scaling past 20.
- *Needs spec:* custom ancestries (creature type, flight, resistances), transformations and summons.

### G. Gameplay, effects and time

- *Selected:*
  - Instant and Next Turn scheduling
  - repeating response polls and competing submissions
  - rolls (configured, expression or manual) and DM takeover
  - active effects on the game clock, DM time advance and early ending
  - partial automation with manual adjudication
  - manual retcons
- *Needs spec:* turns, initiative and rests (resource reset), conditions, and NPCs, monsters and encounters.

### H. Accounts, campaigns and sharing

- *Selected:*
  - Google sign-in, Alias and administrator approval (one `/accounts` area; Alias uniqueness uses the duplicate-name rule)
  - site administrators (the first one seeded outside the app) and guest and public viewing
  - account folders and the three-layer campaigns
  - copy-only placement and duplicate-name rejection
  - ownerless campaigns with equal DMs, invites and joins
  - delegated control and per-tab privacy
  - hidden actions
  - concurrent-edit difference review
  - offline honesty
  - live export shell, portraits and the optional Discord link
- *Proposed:* per-entry privacy inside a tab, as an extra layer.
- *Needs spec (Step A1):* how totals that depend on private tabs or entries appear to viewers without access.
- **M2:** basic editing with an optional author note, saved to the emulator. Carol is a campaignless character in Milestone 2, so owner edits need no DM approval, consistent with the documented campaignless authority.

### I. Future or proposed

- Discord bot.
- LLM helpers for sheet questions and answers, item search, import parsing and structured-effect proposals, always behind human acceptance. Small models such as Claude Haiku or discriminative helpers.
- Automatic importers and bulk definition import.
- Visible-content export snapshots, for consideration only.

---

## 5. Milestone roadmap and execution steps (after approval)

| Milestone | Scope | Status |
|---|---|---|
| **1. Documentation and theory** | Step A below: the architecture, rulesets and theory sketches; character creation; hosting and stack; milestone criteria; open-work stubs. | This plan |
| **2. Engine + Carol offline** | Steps B–H below: kernel, Milestone 2 systems, the Vanilla+ ruleset, Carol hand-entered, storage adapters, sheet viewer and basic editor, all on the emulator. | This plan |
| 3. Core systems deep plan | Write the second plan for spells (casting, scrolls, scribing and mounting), inventory (lifecycle, currency, ammunition) and crafting and economy. Then build them. | Tentative |
| 4. Accounts and campaigns on the emulator | Sign-in, Alias, approval, folders, campaigns, membership, privacy, Rules, and the Firestore schema. | Tentative |
| 5. Gameplay loop | Specify, then build, turns, initiative, rests and conditions. Then the casting workflow: holds, approval, resolution, polls, rolls and effects on the game clock. | Tentative |
| 6. Move to real Firebase | Only with the user's explicit approval: project, region, Blaze, deployment. | Tentative |
| Later | NPCs and encounters, export shell, portraits, Discord bot, LLM helpers, importers, other rulesets and games. | Tentative |

The order and contents of milestones 3 onward will be confirmed with the user after each milestone. Ask for their opinion and whether they want to change anything.

The work happens on a working branch created from `main` before the first commit; confirm its name with the user (the name in the earlier draft, `claude/elegant-mayer-tmobyd`, does not exist). Documentation entries are timestamped per AGENTS.md. Documentation work uses question rounds with the user via the questions tool, one topic at a time, and follows AGENTS.md's sub-agent batches and comparison review for substantive cleanup.

**A. Documentation first (Milestone 1)**

1. `Documentation/Systems/Modules, Systems and Rulesets.md` (new) covers:
   - the layers, kernel contracts and placement method, including "new behavior is a new method"
   - the three-ruleset matrix
   - versioning: each major ruleset version is a separate ruleset with its own file and title, and a DM switches by selecting it. Bug fixes may patch a ruleset in place. Old ruleset files are never edited and carry no backward-compatibility promise; breakage shows as visible errors, and campaigns are never switched automatically. Sub-module versioning stays internal and open.
   - the `magazines` system and how the Aetherlock attaches to it as data
   - the feature roadmap from section 4
   - **open questions to settle here:**
     - how totals that depend on private tabs or entries appear to viewers without access (for example: hidden, totals shown without sources, or something else)
     - how logical records group into stored documents, checked against the cost model's assumptions
     - the term to use: "preset" or "ruleset"
   - **other methods and games, in theory:** brief sketches of Vanilla 5e, Hearthtable Modern Fantasy (`magazines` + `ballistics`) and one non-5e game. They show which systems each would enable, which methods it picks, and what new systems it would add. This proves the kernel is not 5e-shaped before any code exists. Discuss this early with the user.

   Ask the user about the matrix rows, the ruleset contents and the sketches. Ask for their general opinion and whether they want to change anything.
2. `Documentation/Systems/Character Creation and Advancement.md` (new) covers:
   - class-level ordering and the first-class grants
   - multiclass legality
   - feat, invocation and Epic Boon budgets
   - the level cap as a ruleset variable, Vanilla+'s value, and whether and how proficiency, cantrips and slots scale past 20 (an explicit campaign rule, never an assumed extrapolation)
   - point buy and its extension (moved or linked from Lessons; one home)
   - DM grants

   Expect several question rounds.
3. `Documentation/Implementation/Architecture and Hosting.md` (new) holds the hosting decision from section 2, the authority-only Rules scope, the stack, the repository layout, the testing strategy, first-administrator seeding, and the `file://` authentication caveat. It states that PC-hosted sessions are for testing only.
4. `Documentation/Implementation/Milestones.md` (new) is the one home for the milestone roadmap and each milestone's acceptance criteria, using the Verification section below.
5. Stub notes for turns, initiative and rests, conditions, and NPCs and encounters, as "must be specified before implementation". These go as an open-work section in the architecture doc, not as new empty files.
6. Update `Start Here.md`, each `x_Directory.md`, `README.md` and the AGENTS.md Implementation section so they point to these documents. Remove any duplicated authority. Then:
   - Remove `Capella - Boss.md`, after moving any facts that other documents still depend on, and fix links to it. Update the Character Sheets directory.
   - After confirming with the user, update `Capella.md`'s status wording.
   - Record the Alias normalization decision in Campaigns and Shared Data, and turn the per-entry privacy proposal into a decision once Step A1 settles it.
7. Before Step B, review this execution plan with the user once more. Re-check its order and scope against the finished documents, especially whether anything should be generalized beyond 5e.

Steps B to H: at each step and feature, ask the user about anything unstated, contradictory or unclear. Also ask for their general opinion and whether they want to change anything.

*Milestone 2 begins here.*

**B. Scaffold:** pnpm workspace, TypeScript strict, Vite + React, Vitest, ESLint + Prettier, and Firebase Emulator configuration. No real project and no billing.

**C. Kernel:** record envelope with `unknown` pass-through, module registry with `requires` and `extends` checking, the ruleset compatibility check, extension points, resolved-state pipeline with an explanation trail, validation results, dice, and a Transition interface stub.

**D. Systems and game module:** only the Milestone 2 systems listed in section 3, each written to the placement rules.

**E. Ruleset:** Hearthtable Vanilla+ data. Any value still open from Step A2 (such as `maxLevel` past 20) stays explicitly unset and shows as unresolved, rather than a guessed default.

**F. Carol content:** hand-enter Carol's records from `Documentation/Character Sheets/Carol Elfnein.md`, `Carol Build Reference.md` and `Aetherlock Engineered Rounds.md`, as a campaignless character. Enter the Aetherlock as campaign-content data. Do not use old JSON.

**G. Storage:** `Repository` interface, memory adapter and Firestore adapter tested against the emulator, using the record grouping chosen in Step A1.

**H. User interface:**
- The sheet viewer with tabs (Stats, Inventory, Spells/Books, Features) is registered by systems.
- A basic editor covers HP, quantities, book contents and an optional author note.
- Save goes to the emulator.

---

## Verification

### Milestone 1 acceptance (documentation and theory)

- These documents exist, each with its opening stating purpose, status, decisions and open questions:
  - the architecture doc, including the three-ruleset matrix and the non-5e sketch
  - Character Creation and Advancement
  - Architecture and Hosting
  - Milestones
- The open-work stubs exist.
- `Capella - Boss.md` is removed, with no broken links.
- Start Here, each directory file, README and AGENTS.md link to the new documents, with one authoritative home for each decision.
- A review agent compares the new and changed documents against the baseline. It checks for lost facts, duplicate authority and new contradictions, as AGENTS.md requires.
- `node 'Documentation/Implementation/Firebase Cost Model.cjs'` still passes.
- The user has reviewed the documents and the Milestone 2 build steps (Step A7) and agreed to start coding.
- Commit and push the working branch, with the user's go-ahead.

### Milestone 2 acceptance (engine + Carol offline)

- `pnpm test` passes. The suite must include:
  - **No-change round trip.** Load, edit nothing, save and reload Carol, and get a deep-equal result, including unknown and nested fields and quantity 0.
  - **Edit round trip.** Changing one field changes only that field.
  - **One resolved state.** Header, Stats and every tab show identical HP, AC, initiative and slots, taken from the single `ResolvedCharacter`.
  - **Expected values.** Carol's derived numbers match her accepted sheet: ability modifiers, proficiency +5, HP 95, initiative +8, saves and skills (including Arcana +16 and Investigation +16), the slot table 4/3/3/3/2/1/1, spellbook entry counts 16/10/6, and container depth accessibility.
  - **AC from active state.** AC is 13 with no active effects, 16 with Mage Armor marked active, and 21 with Shield also active. Owning a spell alone never changes AC.
  - **Held-item bonus.** The Wand's +1 applies to spell attacks (+12) only while it is attuned and held, and never changes DC 19 or gun aim +11.
  - **Unresolved references.** A deliberately missing definition renders as visibly `Unresolved`, never as a usable default.
  - **Module registry.** It rejects a module that uses an undeclared dependency.
  - **Ruleset compatibility.** A ruleset naming a missing method or variable produces a visible error, and the campaign's selected ruleset is not replaced.
  - **Ruleset switch.** A test ruleset that switches `spellbook-readiness` to `published-preparation`, with a fixture prepared-spell list, changes readiness without editing any system file. This is the placement-rule proof.
- `firebase emulators:start` plus `pnpm --filter web dev`: open Carol's sheet in the browser, edit HP and an inventory quantity, reload, and see the values persist in the emulator.
- Push the working branch. No PR unless the user asks.

---

## Revision log

2026-10-21 at 12:51 am PDT (America/Los_Angeles): changes from checking the earlier draft against the documentation.

| Finding | Resolution |
|---|---|
| Proficiency past 20 assumed, against `Capella - Boss.md`'s explicit-rule requirement; level 50 not in the docs | Open question in Step A2; matrix shows it as open (user decision). |
| "Arcana time modifier may be missing" from cantrip mounting | Removed; the ledger already applies it. Only the time ordering stays as a deferred question. |
| Rules scope versus "cheating is not a concern" | Rules enforce authority, not game math (user decision). |
| "DM upgrades" versus "not an in-place upgrade"; mixed names | Diagram corrected; naming clarified. |
| Shared method changes versus old rulesets "staying exactly as they were" | New behavior is a new method; no backward-compatibility promise; breakage is visible; no automatic switching (user decision). |
| PC-hosted sessions versus the "PC may be off" hosting requirement | Labelled development and testing only. |
| Proficiency placed in both a system and the game module | `proficiency` is a system; `maxLevel` is a game-module variable set by the ruleset. |
| Milestone 2 systems did not cover skills, saves, feats, held bonuses or active AC | Added `skills-and-saves`, `features`, `active-effects` and held state; tests added. |
| `aetherlock-weapons` as a code system; `superiority-dice` unused by Carol | Shared `magazines` system with the Aetherlock as data (user decision); `superiority-dice` moved out of Milestone 2. |
| "Unset (no limit)" container depth | Explicit `unlimited` value. |
| One resolved state versus private tabs | Step A1 question; per-entry privacy proposed as an extra layer (user request, added to Campaigns and Shared Data). |
| Record granularity versus the cost model | Step A1/A3 storage-grouping question. |
| First administrator, Alias normalization, Google identity, admin read access | Seeded first admin; Alias uses the duplicate-name rule (user decision); no Google data in public documents; admin reads in Rules. |
| Preset-switch test lacked prepared-spell data | Fixture added to the test. |
| Branch did not exist; Carol's edit authority; Boss Capella | Branch created from `main` and named with the user; Carol is campaignless; `Capella - Boss.md` removed in Step A6 (user decision). |

2026-10-21 at 2:06 am PDT (America/Los_Angeles): Step A1 discussion settled the term "ruleset", screen-only privacy for character tabs and lines (Security Rules no longer check private-tab reads), true totals with unnamed private sources, placeholder lines, core content in Firestore, one document per definition and per sheet tab, cached "since last visit" sync and a campaign deletion log. These now live in [Modules, Systems and Rulesets](Documentation/Systems/Modules%2C%20Systems%20and%20Rulesets.md) and [Campaigns and Shared Data](Documentation/Systems/Campaigns%20and%20Shared%20Data.md#character-sheet-visibility); where this plan says otherwise, those documents win.
