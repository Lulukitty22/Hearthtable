# Character Creation and Advancement

Purpose: own how characters gain class levels, spell slots, proficiency, feats and starting ability scores in Hearthtable Vanilla+. Status: draft started 2026-10-21 (Step A2 of Milestone 1); the question rounds are not finished and no code exists. Decisions so far are listed below, followed by open questions.

## Selected decisions

Recorded with the user on 2026-10-21, before about 3 am PDT (America/Los_Angeles):

- **No individual class goes above level 20.** The only way past total level 20 is multiclassing.
- **The total-level cap is configurable** (ruleset variable `maxLevel`). Hearthtable Vanilla+ has **no cap by default**.
- **Each class gives exactly what its own published level 1–20 table gives, and multiclass amounts add together.** Nothing is extrapolated beyond a class's table. Two Wizard 20s would simply give everything twice.
- **Spell slots add up per class.** Each class's own slot table is summed, replacing the published merged multiclass slot table. Pact Magic stays a separate pool.
- **Carol's slots change.** Wizard 12 gives 4/3/3/3/2/1, and Artificer 3 gives three first-level slots by the user's recollection. Her total becomes 7/3/3/3/2/1 (spell levels 1–6) with no seventh-level slot. The Artificer number still needs checking against the published book. Carol's sheet and the Milestone 2 acceptance test (which says 4/3/3/3/2/1/1) have not been updated yet.
- **Proficiency follows total character level** and continues the published pattern past 20: +2 at levels 1–4, then +1 every four levels (+7 at 21–24, +8 at 25–28, and so on). Formula: 2 + floor((total level − 1) / 4).
- **Cantrip scaling stops at the published tiers** (total levels 5, 11 and 17). Nothing is added past 17.
- **Multiclass ability prerequisites only warn.** An unmet prerequisite (such as INT 13 for Wizard) shows a visible warning; the level is still added.
- **The full order of levels taken is recorded** (Wizard 1, Wizard 2, …, Artificer 1). First class, starting saves, level-1 maximum HP and feat timing derive from it.
- **Epic Boons follow the published rule:** any feat slot taken at total level 19 or higher may choose an Epic Boon.
- **Point buy:** Vanilla+ extends the point-buy price pattern without an upper limit. The DM sets the point budget as a campaign option. Proposed range is minimum 5, no maximum. For example, a player could lower other scores to fund DEX 40. Spending more than the budget is allowed: the app shows a visible warning and the point deficit, so the DM can spot it when reviewing the character. Nothing blocks the overspend.

## Open questions

- Point-buy pricing below 8: whether scores of 5–7 refund points, and at what rate. The current extended table starts at 8 for 0 points and is in [Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md#ability-scores--campaign-policy-confirmed-2026-10-16); move it here as its one home.
- Default point budget for Vanilla+ (published standard is 27).
- Feat and invocation budgets per class, and how DM grants are recorded so they are never applied twice.
- Whether the add-up principle changes anything else that published multiclassing merges (for example Extra Attack or Channel Divinity).
- `Capella - Boss.md` held a beyond-20 proficiency rule; it is superseded by the decisions above, and that file is to be removed in Step A6.
