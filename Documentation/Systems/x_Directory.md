# Systems Table of Contents

These documents own selected shared-system behavior. They describe intended capabilities; runtime implementation and migration remain pending.

| File | Contents |
|---|---|
| [Campaigns and Shared Data](Campaigns%20and%20Shared%20Data.md) | Owns core/campaign definitions, accounts, authority, copy-only placement, privacy, live character-sheet exports, hosting and disconnected behavior. This is the current design discussion, owns the user-supplied planning scale and links to the implementation cost model; it lists remaining architecture decisions. |
| [Spell Containers and Consumable Sources](Spell%20Containers%20and%20Consumable%20Sources.md) | Owns physical containers, access depth, capacity, spellbook readiness and scroll identity. Distinguishes scribing, installation/removal, stored snapshots and their selected cost rules. |
| [Spell Effects and Active State](Spell%20Effects%20and%20Active%20State.md) | Owns request review, holds, DM approval, timing, repeated response polls, rolls, manual adjudication and effects. It distinguishes replacement AC formulas from additive augments and separates selected workflow/concentration capacity, including Capella's two-instance homebrew, from unresolved execution and lifecycle details. |
