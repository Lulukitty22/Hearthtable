# Repository working instructions

## Documentation

Timestamp convention, selected 2026-10-20 at 2:05 pm PDT (America/Los_Angeles): include the local date, time and timezone when recording new decisions or substantive updates. Do not invent times for older date-only entries; timestamp later clarifications separately.

Start at `Documentation/Start Here.md`. It introduces folders; each folder/subfolder has an `x_Directory.md` with brief descriptions of its files. Start Here is the permanent entry point.

Keep one authoritative home for each decision, formula, inventory and count. Other documents link to it. Superseded drafts and duplicated summaries should be removed after retaining unique useful information; Git history is the recovery archive. The user explicitly abandoned the old character sheet and its obsolete custom-feature lore/mechanics; do not retain superseded source sheets in the working documentation merely for history. Do not replace normal prose with run-on shorthand.

Topic openings should state purpose, implementation status, selected decisions and open questions, followed by supporting detail. A directory description uses no more than three sentences per folder/file. Keep historical observations dated and separate from current decisions; do not revive superseded questions.

Carol revision decision, 2026-10-18: retain only the accepted `Documentation/Character Sheets/Carol Elfnein.md` and references supporting that revision. Remove superseded character sheets, builds, statistics and lore from working prose, including replacement bodies, memory transfer and artificial servants. Archived runtime evidence in the previous repository is for understanding application defects; it is not character-design authority or a list of features to restore.

For substantive documentation cleanup, use focused sub-agents in batches of about eight files or one small folder. Each reports a usefulness score (0 obsolete/duplicate, 1 historical but unique, 2 useful merge candidate, 3 canonical), unique information to preserve, contradictions and questions. Assign bounded file ownership for edits. A separate comparison/review agent checks merged documents against the baseline for lost facts, duplicate authority and new contradictions. Sub-agents may ask the user questions directly when coordinated with the primary agent, or send questions through the primary as intermediary. Never guess to clear an ambiguity. The primary coordinates one topic/question at a time and relays answers to affected agents, avoiding competing batches. Deferred future design may remain explicitly open when it does not block the cleanup.

Use the questions tool for unresolved user decisions. Keep the turn open until outstanding questions have answers. An answer retaining “(Recommended)” may be auto-filled: verify intent before treating it as approval. Do not send duplicate question batches while earlier questions are pending.

## Project origin

Hearthtable started 2026-10-20 at 10:29 pm PDT (America/Los_Angeles) as a fresh start from documentation only. It replaces Character Manager, whose repository [Lulukitty22/Character_Manager](https://github.com/Lulukitty22/Character_Manager) is the archive. Commit `da9b1e4` on `codex/docs-consolidation` there holds the full consolidated documentation, including the old runtime guide, audits and reproduction evidence. That repository's `staging` branch still serves previously shared HTML sheets, so do not change it.

Carried over: Systems, Character Sheets, Class Reference and the Firebase cost model. The old runtime guide and Troubleshooting audits were distilled into `Documentation/Implementation/Lessons from Character Manager.md` rather than copied. No old code, library records or character JSON were carried over; characters are rebuilt from their accepted sheets, not migrated.

## Implementation

No runtime code exists yet. Before writing any, read the Systems documents and the lessons note. Do not port code from Character Manager. The first implementation milestone and its acceptance criteria still need agreement with the user; the Firebase project, billing and region have not been set up, and doing so needs the user's explicit approval.
