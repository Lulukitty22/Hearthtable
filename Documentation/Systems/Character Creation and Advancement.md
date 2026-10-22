# Character Creation and Advancement

Purpose: own how characters gain class levels, spell slots, proficiency, feats, invocations and starting ability scores in Hearthtable Vanilla+, and how DM grants are recorded. Status: decisions settled 2026-10-21 (Step A2 of Milestone 1); no code exists. Vanilla+ builds on the 2024 rules (`dnd5e-2024` game module); anything not changed here follows the published text.

## Selected decisions

Recorded with the user on 2026-10-21, before about 3 am PDT (America/Los_Angeles):

- **No individual class goes above level 20.** The only way past total level 20 is multiclassing.
- **The total-level cap is configurable** (ruleset variable `maxLevel`). Hearthtable Vanilla+ has **no cap by default**.
- **Each class gives exactly what its own published level 1–20 table gives, and multiclass amounts add together.** Nothing is extrapolated beyond a class's table. Two Wizard 20s would simply give everything twice, within the stacking rule below.
- **Spell slots add up per class.** Each class's own slot table is summed, replacing the published merged multiclass slot table. The summed slots form one shared pool that any eligible spell may use, whichever class supplied the slot (confirmed 2026-10-22 at 11:42 am PDT (America/Los_Angeles)). Pact Magic stays a separate pool. Because every class stays within its own 1–20 table and amounts simply add, nothing beyond level 20 has to be invented.
- **Proficiency follows total character level** and continues the published pattern past 20: +2 at levels 1–4, then +1 every four levels (+7 at 21–24, +8 at 25–28, and so on). Formula: 2 + floor((total level − 1) / 4).
- **Cantrip scaling stops at the published tiers** (total levels 5, 11 and 17). Nothing is added past 17.
- **Multiclass ability prerequisites only warn.** An unmet prerequisite (such as INT 13 for Wizard) shows a visible warning; the level is still added.
- **The full order of levels taken is recorded** (Wizard 1, Wizard 2, …, Artificer 1). First class, starting saves, level-1 maximum HP and feat timing derive from it.
- **Epic Boons follow the published rule:** any feat slot taken at total level 19 or higher may choose an Epic Boon.
- **Point buy** extends the published price pattern in both directions; see [Point buy](#point-buy). The DM sets the point budget as a campaign option. Spending more than the budget is allowed: the app shows a visible warning and the point deficit, so the DM can spot it when reviewing the character. Nothing blocks the overspend.

Recorded with the user on 2026-10-21 at 3:46 am PDT (America/Los_Angeles):

- **Point-buy floor and default budget.** The lowest purchasable score is 5; scores below 8 refund 1 point per step. The Vanilla+ default budget is the published 27. The DM's budget may be anywhere from 5 points up, with no maximum (confirmed 2026-10-22 at 11:42 am PDT (America/Los_Angeles)).
- **Feat and invocation budgets are published, per class.** One Origin feat comes from the background at creation. Each class then gives the feat slots on its own table at its own class level (4, 8, 12 and 16, with the Epic Boon feature at 19; Fighter also 6 and 14; Rogue also 10). Invocations come from the Warlock table. Each class is counted separately and the counts add together.
- **Over-budget feats or invocations only warn.** The app shows a visible warning with the count over budget; nothing is blocked.
- **DM grants are real inventory items.** A reward such as "+2 INT for passing a test", an extra feat or an extra invocation is an item carrying that bonus or grant. It sits in inventory like any other item (the DM may make it weightless or unlosable) and never edits the base score or the advancement record. Because the grant exists once, as one item, it applies once. Items must therefore be able to grant ability increases, feats, invocations and features. Feats and invocations granted this way sit outside the class budget and never cause an over-budget warning.
- **Capabilities are present or absent; resources add up.** A feature such as Extra Attack, Unarmored Defense or a three-attack Attack action is a capability the character either has or does not. Having it from two classes still means having it once, so it applies once. This keeps the published "does not stack" limits as a consequence of how capabilities are modelled, not as special-case gating. Counted resources with the same name, such as Channel Divinity uses from Cleric and Paladin, add together into one pool.

## Point buy

Vanilla+ point buy has no upper limit and a floor of 5. A score of 8 costs 0 points. Each step below 8 refunds 1 point. Each step from 9 to 13 costs 1 point; from 14 upward the marginal cost starts at 2 and rises by 1 every two scores, so the cost of raising to score *s* (for *s* ≥ 14) is 2 + floor((*s* − 14) / 2).

| Score | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Total points | −3 | −2 | −1 | 0 | 1 | 2 | 3 | 4 | 5 | 7 | 9 | 12 | 15 | 19 | 23 | 28 | 33 | 39 | 45 | 52 | 59 |

Scores 8–15 match the published table; everything outside that range is a Vanilla+ extension. For example, a player could lower other scores to fund DEX 40, warning if the total exceeds the budget.

Ability score policy, confirmed 2026-10-16 and carried over from Character Manager:

- Scores above ordinary published limits are permitted. Show a nonblocking informational marker above 20; never clamp or block an upper score.
- Modifiers stay floor((score − 10) / 2).
- Label the extended prices as the Vanilla+ extension and allow overrides.
- Keep starting purchases separate from later level increases and DM grant items. Carol's Indomitable (+2 INT, earned in play) is one such DM grant item, specific to her; see [her sheet](../Character%20Sheets/Carol%20Elfnein.md#identity-and-core-statistics).

## Open questions

None for Milestone 1. Values still unset when the ruleset is entered in Milestone 2 show as unresolved rather than a guessed default.
