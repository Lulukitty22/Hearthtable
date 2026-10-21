# Modules, Systems and Rulesets

Purpose: define how Hearthtable's code and data are layered so one engine can run several games and rulesets, and where every new piece of logic or content belongs. It also owns how records are stored in Firestore and cached by browsers. Status: written 2026-10-21 at 2:06 am PDT (America/Los_Angeles) during Milestone 1; no code exists yet. Selected decisions are listed directly below; open questions follow them.

## Selected decisions

Recorded with the user on 2026-10-21, between 12:10 am and 2:06 am PDT (America/Los_Angeles):

- **Systems are code; rulesets are data.** A system holds calculation logic and may offer several interchangeable methods. A ruleset only turns systems on or off, picks methods, sets variables and whitelists or blacklists content. A major mechanic can be its own system attached to another system.
- **The term is "ruleset".** "Preset" is not used in documentation or code.
- **Each major ruleset version is a separate ruleset**, with its own file and title, such as "Hearthtable Vanilla+" and later "Hearthtable Vanilla+ 2". A DM moves a campaign by selecting the new ruleset; nothing upgrades in place or switches automatically. Bug fixes may patch a ruleset in place; large revamps become a new ruleset, and the older file is not edited.
- **No backward-compatibility promise.** If a system change breaks an old ruleset (a variable renamed, a method removed), the campaign stays on its selected ruleset and the broken part shows a visible warning or error when it runs. It never quietly falls back to a default. Keeping a campaign working is the DM's job.
- **The first ruleset** is "Hearthtable Vanilla+ Rules", called "Hearthtable Vanilla+", package `hearthtable-vanilla-plus`.
- **`maxLevel` is a ruleset variable**, 20 by default. Vanilla+ sets no cap; its scaling past 20 is owned by [Character Creation and Advancement](Character%20Creation%20and%20Advancement.md).
- **Firearms use a reusable `magazines` system** (chambers, loaded rounds, load order, per-round contents). The Aetherlock is campaign custom content (data) attached to it.
- **Storage and caching:** see [Records, storage and caching](#records-storage-and-caching). In short: one Firestore document per definition, one document per character-sheet tab, references from sheets to definitions, a persistent browser cache synchronized by "changed since last visit" queries, and a campaign deletion log.
- **Privacy is screen-only** for character tabs and lines. Viewers' browsers receive the data and the app hides it. The privacy rules themselves are owned by [Campaigns and Shared Data](Campaigns%20and%20Shared%20Data.md#character-sheet-visibility).

## Open questions

- Whether privacy beyond character tabs and lines (whole private campaigns or characters, DM-only notes, hidden actions) is also screen-only or enforced by Security Rules.
- Modern Fantasy's use of magic and its armor model: deliberately left open until that ruleset is needed. The architecture only has to allow it.
- Whether the Roblox catalog can be queried directly from a browser (see [the non-5e sketch](#another-game-roblox-roleplay-outfits)).
- Sub-module versioning (how a system's own version relates to rulesets) stays internal and open.

## Layers

Dependencies point downward only.

```
Campaign      selects one ruleset; switching means selecting another, never automatic
  Ruleset     data: enables systems, picks methods, sets variables, white/blacklists
    Game      code + data vocabulary, e.g. dnd5e-2024: abilities, skills, damage types, class and slot tables
      Systems code: abilities, proficiency, spellcasting, containers, armor-class, damage, magazines …
        Kernel  game-agnostic code: record envelope, identities, module registry, extension points,
                resolved-state pipeline, dice, validation results, transitions
```

**Kernel vocabulary rule:** the kernel knows only records, resources, modifiers, effects, actions, rolls, slots and time. Words such as "level", "spell slot", "class" or "AC" belong to game modules and systems.

## Kernel contracts

- **Record envelope:** `id`, `kind`, `moduleId`, `schemaVersion`, `origin`, `source` (edition, status such as published, campaign, proposed or parked, and source confidence), `revision`, `updatedAt` and `data`. An `unknown` pass-through bag keeps fields the current code does not understand, so a no-change round trip is lossless. A record is a logical unit; how records group into stored documents is described under storage below.
- **Module manifest:** `id`, `version`, `requires: [moduleId@range]`, `extends: [extensionPointId]`, and `provides: { extensionPoints, methods, recordKinds, ruleVariables (typed, with defaults), uiTabs }`.
- **Extension points:** a system publishes named hooks that later systems attach to, such as `damage.mitigationSteps`, `armorClass.augments`, `resources.pools`, `magazines.roundPayloads` and `sheet.tabs`.
- **Resolved-state pipeline:** `resolveCharacter(records, ruleset) → ResolvedCharacter` runs once, and every view renders from its result. Each number carries an explanation trail, such as "AC 16 = Mage Armor 13 + DEX 3". Authored values stay authoritative. Unresolved references produce visible `Unresolved` markers, never defaults.
- **Ruleset compatibility check:** loading a ruleset validates every system, method and variable it names against the registry. Anything missing or renamed is a visible error where that part runs; the campaign keeps its selected ruleset.
- **Transitions:** every state change goes through a named transition, such as `submitRequest` or `approveRequest`, so any transition can later move into a Cloud Function without changing the interface.

## Placement method: "this goes here, this uses this"

1. **Lowest common home.** Code goes in the lowest layer every user of it needs: the kernel if it is game-agnostic, a system if more than one game or ruleset could use it, a game module if it is only that game's vocabulary. One campaign's custom item is data, not code.
2. **Never code in a ruleset.** If a ruleset needs behavior no method provides, write a new method or system, then let the ruleset pick it.
3. **Removal test.** If deleting module X breaks module Y, Y must list X in `requires`. Siblings never import each other undeclared.
4. **Attach, don't edit.** A new system extends an existing one through its extension points and never modifies its files. For example, a future `ballistics` system would attach steps to `damage.mitigationSteps`, and `damage` would not know it exists.
5. **New behavior is a new method.** To change behavior for a new ruleset, add a method rather than rewriting one an existing ruleset uses. Genuine bugs are fixed in place.
6. **Three-ruleset check.** Every placement must make sense across Vanilla 5e, Hearthtable Vanilla+ and Hearthtable Modern Fantasy (matrix below), and the kernel must also suit the [non-5e sketch](#another-game-roblox-roleplay-outfits).

### Three-ruleset matrix

Modern Fantasy cells are illustrative; its magic and armor are open.

| Concern | Vanilla 5e | Hearthtable Vanilla+ | Modern Fantasy |
|---|---|---|---|
| Spell readiness (system `spellbook-readiness`) | method `published-preparation` | method `book-contents-ready`, variable `bookCapacity=16` | open |
| Accessible container depth (system `containers`) | `maxAccessibleDepth=unlimited` (explicit value) | `maxAccessibleDepth=1` | `maxAccessibleDepth=1` |
| Concentration (system `concentration`) | `defaultCapacity=1` | `defaultCapacity=1`; authored abilities may raise it | open |
| Damage (system `damage`) | method `resistance-halving` | same | same, plus an attached `ballistics` system |
| Firearms (system `magazines`) | disabled | enabled; Aetherlock attaches as data | enabled; bullet types attach through `ballistics` |
| Level cap and proficiency (variable `maxLevel`, system `proficiency`) | `maxLevel=20`; published table | no cap; proficiency continues the published pattern; see [Character Creation and Advancement](Character%20Creation%20and%20Advancement.md) | as Vanilla+ |
| Scroll use (system `scrolls`) | method `published` | method `anyone-one-shot`; Arcana-multiplier formula as a method | open |

## Records, storage and caching

Selected 2026-10-21 at 2:06 am PDT (America/Los_Angeles). The aim is to stay within Firestore's free daily allowance (50,000 reads) without a dedicated server.

**Definitions: one document per definition.** Every item, spell, feature or class definition is its own Firestore document. Creating an item creates a document, editing it edits that document, and removing it deletes that document. Core (published) content is stored in Firestore too, not shipped as static files, so maintainers can edit it live. Campaign and account custom content live in their own collections and are created by approved players and DMs, not by core maintainers.

**Character sheets: one document per tab.** Stats, inventory and each spellbook are separate documents. A sheet line holds a reference plus its own instance state, never a copy of the definition. For example: slot 3, reference `campaign:aetherlock`, quantity 1, chambers and contents. Each tab document also lists the definitions it references, so "which sheets use this?" is one query.

**Browser cache.** Browsers keep definitions in Firestore's persistent cache, which survives closing the tab. On opening, the app asks for definitions whose `updatedAt` is later than its last sync and pays only for the documents returned (at least one read per query). A live listener on the same query delivers later edits. Editing a sheet reads nothing from the library, because definitions are already in memory.

**Deletion.** Official core content is normally not deleted. Campaign custom content may be hard-deleted campaign-wide. Each deletion writes an entry to the campaign's deletion log, such as "Bluesteel deleted"; browsers check the log with the same "since last visit" query and purge their cached copy. Sheets are not edited: a line referencing a deleted definition keeps its reference and state exactly as saved ("Bluesteel, quantity 4"), shows "Reference not found", and grants no actions or bonuses. The player or DM removes it manually.

**Estimated reads**, for planning only:

| Situation | Reads |
|---|---|
| Carol's sheet, first visit on a device | about 100 referenced definitions + about 6 tab documents |
| Later visits, library unchanged | about 6 tab documents + 1–3 "since last visit" checks |
| A definition is edited while sheets are open | 1 per open viewer |
| Editing one's own inventory | 0 reads; 1–2 writes |

The [Firebase Cost Model](../Implementation/Firebase%20Cost%20Model.md) owns cost estimates; it should be rechecked against this layout.

**Privacy and totals.** Because privacy is screen-only, a viewer's browser has the full data and computes true totals itself. Private lines appear as placeholders ("Private Item", "Private Spell"), and a total that includes a private source is shown with that source unnamed. The rules live in [Campaigns and Shared Data](Campaigns%20and%20Shared%20Data.md#character-sheet-visibility).

## The `magazines` system and the Aetherlock

`magazines` models chambers, loaded rounds, load order and per-round contents, and exposes `magazines.roundPayloads` for what a round carries. Hearthtable Vanilla+ enables it, and Modern Fantasy can reuse it. The Aetherlock is campaign custom content: its 6 chambers, 12-charge canisters, fuzes and Spellrounds are data and payload extensions, as owned by [Aetherlock Engineered Rounds](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md). If the definition is missing, the documented disabled placeholder applies.

## Theory sketches

These show which systems each ruleset or game would use, to prove the kernel is not shaped around 5e. They are not commitments to build.

### Vanilla 5e

The published 2024 rules over the same `dnd5e-2024` game module and systems as Vanilla+. It picks the published methods (preparation, scroll use), sets `maxAccessibleDepth=unlimited` and disables `magazines`. It needs no new systems.

### Hearthtable Modern Fantasy

Gunfights and bullet-type damage tracking through `magazines` plus an attached `ballistics` system on `damage.mitigationSteps`. Whether magic remains, and whether armor uses AC or a protection-versus-penetration model, are open until the ruleset is needed.

### Another game: Roblox roleplay outfits

A separate game module with no levels, classes, spell slots or combat. A character is an avatar with named equipment slots: shirt, pants, hats and accessories, and hair 1, hair 2 and more. Saved items reference Roblox catalog IDs.

- **Kernel use:** records, slots and modifiers only. A slot system with typed slots and per-slot capacity would be a new system any game could reuse.
- **Idea, unverified:** fetch an item's name from its catalog ID in the browser. Roblox's web APIs may refuse browser requests from other sites (CORS); if so, this needs a small server function or manual entry. Check before relying on it.

## Open work: must be specified before implementation

These areas are referenced by selected rules but not yet designed:

- **Turns, initiative and rests,** including turn advancement, short and long rests and resource reset. The casting workflow and "replenish to maximum" depend on them.
- **Conditions.** Incapacitated is referenced but never modelled.
- **NPCs, monsters and encounters.**

## Feature roadmap

The full feature inventory, grouped by core area with Milestone 2 scope marked, is section 4 of the [Hearthtable Plan](../../Hearthtable%20Plan.md#4-feature-inventory) until the Milestones document becomes its home.
