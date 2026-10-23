# Start Here

Hearthtable is a planned hosted web app for running tabletop campaigns: shared character sheets, campaigns with DM approval, live updates and spell and item systems. It is a fresh start that replaces Character Manager, an earlier HTML/JavaScript app whose code was not carried over. Current work: **Milestone 3** (spell details, scrolls, charge counters, coins and item lifecycle) is built and awaiting acceptance; Milestones 1 and 2 are accepted. **See [Current progress](Implementation/Milestones.md#current-progress) for where things stand**; the roadmap and acceptance criteria are in [Milestones](Implementation/Milestones.md). Firebase (Google sign-in, Firestore and Cloud Storage) is the selected backend direction; the app runs locally on the Firebase emulator with Carol's sheet, and no real Firebase project exists yet.

## Choose a folder

| Folder | What to expect |
|---|---|
| [Systems](Systems/x_Directory.md) | Module and ruleset architecture, character creation and advancement, and selected campaign, container, casting and active-effect rules, with genuine open questions. Start with Modules, Systems and Rulesets for how the app is layered. |
| [Character Sheets](Character%20Sheets/x_Directory.md) | Playable tabletop character sheets. Carol's sheet owns her accepted statistics, inventory and spell selections. |
| [Class Reference](Class%20Reference/x_Directory.md) | Supporting build provenance, weapon rules, costs and reusable mechanics. Calculation examples retain their assumptions and do not reopen selected builds. |
| [Implementation](Implementation/x_Directory.md) | Implementation planning: architecture and hosting, milestones, lessons from the previous application and the Firebase cost model. Read Architecture and Hosting and the lessons note before writing runtime code. |

Each folder's `x_Directory.md` describes its files. A topic's opening states its scope, implementation status, selected direction and open work; detailed rules have one authoritative home.

Documentation editing and sub-agent review instructions live in [AGENTS.md](../AGENTS.md). The previous application, its runtime audits and reproduction evidence are archived in [Lulukitty22/Character_Manager](https://github.com/Lulukitty22/Character_Manager) at commit `da9b1e4` on `codex/docs-consolidation`.
