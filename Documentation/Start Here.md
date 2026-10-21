# Start Here

Hearthtable is a planned hosted web app for running tabletop campaigns: shared character sheets, campaigns with DM approval, live updates and spell and item systems. It is a fresh start that replaces Character Manager, an earlier HTML/JavaScript app whose code was not carried over. Current work is **systems design**, using Carol's accepted tabletop build as a concrete example. Firebase (Google sign-in, Firestore and Cloud Storage) is the selected backend direction; no Firebase project, code or character data exists yet.

## Choose a folder

| Folder | What to expect |
|---|---|
| [Systems](Systems/x_Directory.md) | Selected campaign, container, casting and active-effect rules, with genuine open questions. Start with Campaigns and Shared Data to resume the current design discussion. |
| [Character Sheets](Character%20Sheets/x_Directory.md) | Playable tabletop character sheets. Carol's sheet owns her accepted statistics, inventory and spell selections. |
| [Class Reference](Class%20Reference/x_Directory.md) | Supporting build provenance, weapon rules, costs and reusable mechanics. Calculation examples retain their assumptions and do not reopen selected builds. |
| [Implementation](Implementation/x_Directory.md) | Implementation planning: lessons from the previous application and the Firebase cost model. Read the lessons note before writing runtime code. |

Each folder's `x_Directory.md` describes its files. A topic's opening states its scope, implementation status, selected direction and open work; detailed rules have one authoritative home.

Documentation editing and sub-agent review instructions live in [AGENTS.md](../AGENTS.md). The previous application, its runtime audits and reproduction evidence are archived in [Lulukitty22/Character_Manager](https://github.com/Lulukitty22/Character_Manager) at commit `da9b1e4` on `codex/docs-consolidation`.
