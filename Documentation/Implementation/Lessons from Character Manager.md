# Lessons from Character Manager

Purpose: carry forward what the previous application, Character Manager, taught us, so Hearthtable does not repeat its defects. Status: written 2026-10-20 at 10:29 pm PDT (America/Los_Angeles) when Hearthtable started from documentation only; no Hearthtable runtime exists yet. Decisions: the old code is not ported. This note keeps the requirements and failure modes worth designing against, plus a few campaign policies whose only home was the old runtime guide. Open questions: none here; system decisions live in [Systems](../Systems/x_Directory.md).

The old repository is the archive: [`Lulukitty22/Character_Manager`](https://github.com/Lulukitty22/Character_Manager). Commit `da9b1e4` on `codex/docs-consolidation` holds the full documentation set this project started from, including the Runtime and Repair Guide, the 2026-10-12 Runtime Audit, Character Audit, Carol Repair Findings and their reproduction evidence. Its `staging` branch is still what previously shared HTML sheets load, so leave it untouched.

## What the old design got wrong

Character Manager was a static HTML/JavaScript app. Small HTML shims fetched runtime code from GitHub, and saves committed character and library JSON through the GitHub Contents API. The [campaign architecture](../Systems/Campaigns%20and%20Shared%20Data.md#github-and-hosted-state) explains why repository commits are not a live campaign store. The audits found these concrete failures, each of which Hearthtable should treat as a requirement.

### Saving must never lose data

- **Conversion produced empty canonical records.** Converting an inline spell into a shared record stamped it with the new schema version and empty `features`, while the real content stayed in old fields that the normalizer then ignored. A level-3 spell came back as a blank level-0 spell. Fireball broke this way for every character that referenced it.
- **Blank merges overwrote shared definitions.** Saving a character built an empty class/species record and merged it over the existing one, so Wizard lost its hit die and caster metadata. Never merge a partially populated record over a richer one.
- **Interrupted saves left dangling references.** The character was rewritten to point at records before those records were saved. If a later write failed, a retry saw references and wrote nothing. Carol ended up with 31 missing definitions. Writes that belong together need one transaction, or the character must not change until its records exist.
- **Editor round trips dropped fields.** Forms rebuilt items and spells from visible inputs only. They dropped `addons`, attunement and access metadata; changed an unsupported `clothing` type to `weapon`; and turned quantity 0 into 1. Unknown and nested fields must survive load, edit, save and reload unchanged. Test a no-change round trip before anything else.
- **Conflict retries overwrote newer data.** On a version conflict, saves fetched the new version marker and wrote the same stale object again, discarding another client's changes. The selected [concurrent-edit difference review](../Systems/Campaigns%20and%20Shared%20Data.md#concurrent-editing-and-difference-review) replaces this.
- **Resource history IDs were regenerated on every save,** even for unchanged entries. Identities must be stable.

### One resolved state should drive every number

- The header, Stats tab, Gameplay tab and boss preview each read different inputs, so one sheet could show HP 66, 104 and 210 at once. Derive active form, HP, AC, initiative, casting profiles and modifiers once, and render every view and preview from that result.
- Missing `hp.mode` or slot mode silently switched authored values to calculated ones. Capella's custom HP pool and spell slots were replaced or erased. An authored value must stay authoritative until someone explicitly changes it.
- A manual slot override used the larger of override, calculated and stored values, so it could never lower a maximum.
- Single-class half-casters used the multiclass slot table, which gave Ranger 5 the wrong slots. Subclass progression and pact magic were not modelled.
- Proficiency, initiative and speed were stored literals rather than derived values. AC options were hand-entered totals. Merely owning Mage Armor or listing a spell made its effect look active. Ownership never activates an effect.
- Multiclass labels printed total level beside the primary class, inflating it.
- Missing or malformed spells displayed as usable cantrips. Unresolved data must look unresolved, never ordinary and safe to use.

### Gameplay must change real state

- DM approval only moved requests into a log. It never applied HP, slot, ammunition or inventory changes to the character. The [selected casting workflow](../Systems/Spell%20Effects%20and%20Active%20State.md#casting-workflow--selected-2026-10-17) resolves into real state.
- "Spell actions" were slot-spend requests, not casts of a specific spell with its origin, targets, components and concentration.
- A partially failed batch submission, retried, recreated already-sent requests under new IDs. DM batch errors were swallowed so the batch did not stop. Requests need stable identities and must report each outcome truthfully.
- Polling caught its own errors and still reported success, and refreshed the entire library every ten seconds. Read-only views could show stale data behind a working-looking refresh button. Firestore listeners replace polling; failures must be visible.
- Queued request labels showed raw UUIDs because participant names were not loaded.
- Exports were hardcoded to one branch, separately from where the editor saved.

### Validation must cover the real problem

The library validator skipped all character files and checked only structure. All six characters rendered without exceptions while being seriously wrong. Rendering successfully, or parsing as JSON, does not prove correctness. Validate references, record mechanics and save/reload round trips, and flag unresolved references, unsupported types or units, stale explanations and incomplete prerequisites before saving or importing.

## Requirements carried forward

These came from the old runtime guide and have no other home.

### Definitions and records

Reusable features need class/subclass identity, publication and version, minimum class level, prerequisites, calculation or effect, action or trigger, resource with cap and reset, and a source pointer. They must distinguish published, playtest, approved homebrew and unresolved material. Spells need class tags and grant source, edition, tier, action, attack or save, damage or healing, duration and concentration, components and costs, scaling, and verified structured effects. Keep the full readable definition alongside normalized values; flavor text is not a rule.

Base AC formulas, conditional bonuses and Reaction bonuses need distinct representations, so prose such as "+5 AC" never becomes a permanent modifier. Keep class level, total character level, effective caster level and casting origin separate. Shared slots have one authoritative pool; preparation and known or eligible catalogues are separate, and stored items keep their own capacity and consumed state. A package such as a Dragonmark must not apply its ability increases twice when its member features are also listed.

The old library had no Artificer class record and no subclass collection, and its hit-die reader looked in a different place from where records stored it. Hearthtable's class and subclass catalogue needs deliberate design, not a fallback that conceals missing data.

### Ability scores

The ability-score policy and the extended point buy confirmed 2026-10-16 now live in [Character Creation and Advancement](../Systems/Character%20Creation%20and%20Advancement.md#point-buy).

### Later LLM assistance (proposed)

Sheet questions and answers, spell and import review, and contextual recommendations may come later, after reliable structured data exists. Numeric answers must use deterministic calculations and cite their source fields and revision. For example, Seraphine's DC 16 is 8 + proficiency 4 + WIS 4. A model may propose structured effects from verified text, but validation and human acceptance come before any gameplay change. Extraction needs source spans, rules version, target, formula or magnitude, conditions, duration and stacking, and may leave values unknown. The Jev and Julia-1 proposals had no verified integration, and self-reported model confidence is not measured accuracy.

## Old character data

Do not import old character JSON directly. Rebuild characters from their accepted sheets in [Character Sheets](../Character%20Sheets/x_Directory.md). The old data was partly migrated and internally contradictory:

- **Carol:** production JSON predates her accepted sheet. `Documentation/Troubleshooting/Evidence/carol-pre-migration.json` in the archive holds older inline content if a detail needs recovering. Do not revive retired features to satisfy a missing reference.
- **Capella:** HP, ability scores, save DCs and attack bonuses disagreed across stored values, formulas and prose. Her new sheet supersedes that data.
- **Seraphine:** all 95 spell entries lacked rules text; AC 16 was an unexplained assumption; Cleric 9 had no subclass. Her 38 prepared spells were intentionally permitted by a source note, so do not enforce standard limits without a table decision.
- **Rall, Aina Quickquiver, Test Character 1 and John Baluci** exist only in the archive. Rall's build looked incomplete, and John Baluci was only on the old `main` branch.

Interface notes from the audits: long spell lists need compact groups, filters and detail views; hidden tabs need a clear scroll affordance on mobile; feats need the same source drill-down as spells and items.
