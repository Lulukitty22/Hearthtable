# Milestone 4 Plan

Purpose: the working plan for Milestone 4, accounts and campaigns on the local emulator, as [Milestones](Milestones.md) defines it. Status: drafted 2026-10-23 at 5:01 am PDT (America/Los_Angeles) after the user confirmed the milestone's scope; nothing is built yet. Decisions live in the documents linked below; this plan orders the work and lists what still needs the user's answer.

Selected decisions: Milestone 4 is all permissions and approvals: who may see, edit and join what, and every DM or administrator approval outside gameplay (user decision, 2026-10-23 at 5:26 am PDT (America/Los_Angeles)). Milestone 5 is the action inside a campaign: turns, time, the casting workflow and its execution-time approval. The scope (user, 2026-10-23): Google sign-in, the public Alias, administrator approval, folders, campaigns with DMs and members, invites, tab privacy, Security Rules and the Firestore schema, all on the emulator. The trade window is Milestone 5c. No real Firebase project is created (that is Milestone 6).

Open questions: listed by topic under [Questions for the user](#questions-for-the-user), asked one topic at a time.

## What is already settled

| Area | Settled rule | Owner |
|---|---|---|
| Sign-in | Google sign-in only, through Firebase Authentication; no app passwords | [Guest viewing and accounts](../Systems/Campaigns%20and%20Shared%20Data.md#guest-viewing-and-accounts) |
| Alias | Chosen after sign-in; public handle used in addresses; never the Google email or name; unique ignoring capitals and spaces versus underscores, display capitals kept | same |
| Approval | An Alias and site-administrator approval are needed before creating characters, campaigns or custom entries, or joining campaigns; guests and pending accounts may browse public content | same |
| Site administrators | See everything, approve accounts, and can restore a campaign's DM permission; the first one is seeded on the emulator | [Site administration](../Systems/Campaigns%20and%20Shared%20Data.md#site-administration), [Architecture](Architecture%20and%20Hosting.md#local-development-on-the-emulator) |
| Folders | Accounts hold campaigns, characters and custom entries at the top level or in nested folders; a record's identity is its full path, folders included | [Account organization](../Systems/Campaigns%20and%20Shared%20Data.md#account-organization-and-address-design), [Modules](../Systems/Modules%2C%20Systems%20and%20Rulesets.md#selected-decisions) |
| Names | A name already taken in the destination is refused, ignoring capitals and spaces versus underscores; never overwritten or renamed automatically | [Copying a campaign character](../Systems/Campaigns%20and%20Shared%20Data.md#copying-a-campaign-character-into-an-account-folder) |
| Campaigns | Created from any folder; the creator becomes the first DM; storage, account link and campaign view are three separate layers; no owner role, all DMs equal and able to grant or revoke DM | [Creating a campaign](../Systems/Campaigns%20and%20Shared%20Data.md#creating-a-campaign), [Campaign membership](../Systems/Campaigns%20and%20Shared%20Data.md#campaign-membership) |
| Joining | Invite link or code → join request → DM approval → player access | [Campaign membership](../Systems/Campaigns%20and%20Shared%20Data.md#campaign-membership) |
| Characters | Placing a character anywhere makes a 1:1 copy; a campaign character is the campaign's own copy; DM approval for insertion; DMs may edit any character in their campaign through DM mode | [Copy only](../Systems/Campaigns%20and%20Shared%20Data.md#character-placement-copy-only), [Publication and approval](../Systems/Campaigns%20and%20Shared%20Data.md#publication-and-approval) |
| Delegation | Owners grant or revoke control to specific players; revocation is enforced by Rules | [Delegated character control](../Systems/Campaigns%20and%20Shared%20Data.md#delegated-character-control--selected-2026-10-18) |
| Privacy | Public by default; private tabs and private lines with per-player grants; placeholders; true totals with private sources unnamed; screen-only | [Character-sheet visibility](../Systems/Campaigns%20and%20Shared%20Data.md#character-sheet-visibility) |
| Rules | Rules check authority (membership, DM role, delegation, approval, admin fields), not game math or tab privacy | [Security Rules scope](Architecture%20and%20Hosting.md#security-rules-scope) |
| Schema | One document per definition and per sheet tab; `/accounts/{uid}` plus an Alias index written in the same batch; history as separate records | [Records, storage and caching](../Systems/Modules%2C%20Systems%20and%20Rulesets.md#records-storage-and-caching), [Hosting](Architecture%20and%20Hosting.md#hosting-browser-plus-firebase) |

## Proposed build slices

1. **S1 — Sign-in and Alias.** Google sign-in against the Auth emulator, an account document, choosing an Alias (with the uniqueness index), and the pending state; guests can still browse public content.
2. **S2 — Site administration.** A seeded first administrator and an approval screen for pending accounts.
3. **S3 — Security Rules.** Rules for accounts, approval, ownership of account records by path, campaign membership and DM role, with rules tests against the emulator.
4. **S4 — Account home and folders.** The account's home with nested folders holding characters, campaigns and custom entries; New → folder, character, campaign, or custom item, spell or feature; duplicate names refused; copy as (new name and destination) and separate delete. No rename or move.
5. **S5 — Campaigns and membership.** Creating a campaign (first DM, account link, campaign view), invite codes, join requests, approval, and DMs granting or revoking DM.
6. **S6 — Characters in campaigns.** Copying a character into a campaign, DM mode editing, and delegated control with revocation.
7. **S7 — DM review queue.** Everything a DM approves outside gameplay waits as a proposed change: inserting, deleting or replacing a campaign character, a player's edits to their campaign character, and players' proposed edits to campaign library definitions. The DM accepts or rejects each; accepted changes save with the usual history.
8. **S8 — Privacy.** Private campaigns, private characters, private tabs and private lines with per-player grants, placeholders and unnamed contributions to totals, all screen-only.
9. **S9 — Moving today's data in.** VR_Lulu's existing records and Carol become owned by a real (emulator) account, keeping their paths.

## Questions for the user

**A. Alias** — answered 2026-10-23 at 5:13 am PDT (America/Los_Angeles): letters, digits, `_` and `-`; 4–32 characters; capitals ignored and `_` equal to `-`; fixed once chosen; the user's Alias is now `VR_Lulu`. Recorded in [Guest viewing and accounts](../Systems/Campaigns%20and%20Shared%20Data.md#guest-viewing-and-accounts).

1. Which characters and length are allowed (for example letters, digits, spaces, underscores, hyphens; 3–24 characters)?
2. Can an Alias be changed later? Its paths would change, which breaks old exports.

**B. Sign-in on the emulator** — answered 2026-10-23 at 5:17 am PDT (America/Los_Angeles): the emulator seeds six fake Google accounts for a comprehensive test. `VR_Lulu` (the user) is approved, the first site administrator, and a member and DM of the campaign Moonlit Coast, and owns Carol and the account content. `Test_DM` is approved, a member and DM of Moonlit Coast. `Test_Player` is approved, a player in Moonlit Coast. `Test_Joiner` is approved with a pending request to join Moonlit Coast. `Test_Other_DM` is approved, a member and DM of a second campaign, `Test Campaign`, to show several campaigns side by side. `Test_Pending` has an Alias, awaits approval and is in no campaign. The test Aliases and the second campaign's name are placeholders chosen by the engine chat.

1. The Auth emulator offers fake Google accounts. Should Carol's records belong to a seeded "VR_Lulu" account that you sign in as, with you as the first administrator?
2. Any other seeded test accounts (a second player, a second DM) for trying campaigns?

**C. What "approval of character changes" means in Milestone 4** — answered 2026-10-23 at 5:26 am PDT (America/Los_Angeles): all approvals outside gameplay are built in Milestone 4 (slice S7), including a DM review queue for players' campaign sheet edits; gameplay action approval stays in Milestone 5.

1. Campaign DMs approve insertion, deletion, modification and replacement of campaign characters. Should Milestone 4 build an approval queue for ordinary sheet edits in a campaign, or only DM approval of insertion, with edit approval arriving with the Milestone 5 request workflow?

**D. Privacy beyond tabs** — answered 2026-10-23 at 5:26 am PDT (America/Los_Angeles): screen-only for everything, like tabs, recorded in [Character-sheet visibility](../Systems/Campaigns%20and%20Shared%20Data.md#character-sheet-visibility).

1. Whole private campaigns or characters, and DM-only notes: screen-only like tab privacy, or enforced by Security Rules (the open question in Modules, Systems and Rulesets)?

**E. Folders and custom entries** — answered 2026-10-23 at 5:29 am PDT (America/Los_Angeles): New → creates custom items, spells and features. Nothing is renamed or moved, folders included: the only operations are copy as (choosing the new name and destination) and a separate delete, and nothing else is rewritten ([copy only](../Systems/Campaigns%20and%20Shared%20Data.md#character-placement-copy-only); the user has stated this many times).

1. Which custom-entry types can be created from New in Milestone 4: items only, or also spells and features?
2. Can folders be renamed or moved (which, by the path rule, duplicates everything inside), or only created and deleted when empty?

**F. Deferred pieces (confirm they stay out)**

1. Concurrent-editing difference review, live HTML exports, portraits, Discord linking and core-maintainer publishing: leave all for later milestones?

## Proposed acceptance (to agree with the user)

- Sign in with a fake Google account, choose an Alias, wait as pending, be approved by the administrator, then create a folder, a character and a campaign.
- A second account joins the campaign through an invite and DM approval, and its copied character is inserted only after DM approval.
- Rules tests show a pending account, a non-member and a revoked delegate are refused, and a DM is allowed.
- Private tabs and lines show placeholders to other viewers while totals stay true.
- Carol and VR_Lulu's content load under the seeded account exactly as before.
