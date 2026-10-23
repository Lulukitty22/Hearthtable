# Campaigns and Shared Data

This document owns campaign architecture, authority, definition sharing, privacy and disconnected behavior. It records selected design requirements and dated backend research; no Firebase project has been configured or runtime migration started. Remaining implementation and policy questions are listed at the end.

## Current direction

Keep the HTML/JavaScript application and core catalogue separate from private, live campaign data. GitHub can continue hosting source code. Core content is stored in Firestore rather than shipped as static files; see [Modules, Systems and Rulesets](Modules%2C%20Systems%20and%20Rulesets.md#records-storage-and-caching). A managed backend would handle accounts, campaign permissions, requests, resource reservations, rolls, effects and logs.

**Firebase is the selected backend direction.** Firebase Authentication with Google sign-in only and Cloud Firestore are selected. Portrait uploads are required, and Blaze billing is acceptable to access needed services while targeting their no-cost allowances. Exact schema, region, billing controls and service configuration remain undecided; no project or billing setup has begun. Hosting must not require the user's PC to stay online. Other character audits remain deferred while this architecture is clarified.

## Guest viewing and accounts

Selected requirements, 2026-10-18: support guest viewing of shared character sheets and signed-in account use. Campaigns, characters and custom entries such as items are public by default until explicitly made private. Guests and pending accounts use the same visibility rules; there is no separate public-sharing opt-in or guest-only visibility system. A guest can view public content through the browser or a [live character-sheet export](#live-character-sheet-exports) without creating an account.

An administratively approved account permits creating characters, campaigns and custom entries such as item definitions. The creator owns their account's characters and custom entries; a character save can be under an account or in a campaign, retaining the selected copy-only placement behavior below. Account-level custom definitions are distinct from core and campaign definitions; creating one does not publish it globally or import it into a campaign.

Selected 2026-10-18: use Firebase Authentication with Google sign-in only. Google handles passwords and Google-account recovery; the app has no separate password or custom administrator password-reset requirement. Signing in does not itself grant campaign DM or core-definition publishing rights.

After Google sign-in, the user chooses an app-specific public **Alias**, then awaits application-administrator approval. Both an Alias and administrator approval are required before creating characters, campaigns or custom entries or joining campaigns. Campaign membership still requires the campaign DM's approval afterward; DM approval does not bypass account approval. This replaces the earlier permission to join campaigns before administrator approval.

Before account approval, users can browse publicly visible campaigns, characters and custom entries such as items from other accounts. Public viewing does not confer campaign membership, access to private content or editing/control rights. Viewing a public campaign does not bypass account approval or the campaign DM's approval to join it.

The Alias is the public account handle used in account addresses and presentation, rather than the Google email address or Google profile name. Google identity information must not be published through public account profiles, readable addresses, campaign member lists or bot messages. Alias format — selected 2026-10-23 at 5:13 am PDT (America/Los_Angeles), replacing the 2026-10-21 rule that Aliases follow the name duplicate rule: an Alias is 4–32 characters of letters, digits, underscores and hyphens, with no spaces or other punctuation (the user offered the length as "4-32 maybe"). Capitalization does not distinguish Aliases, and an underscore and a hyphen count as the same character, so `VR_Lulu`, `vr_lulu` and `vr-lulu` are one Alias, while `VR_Lulu` and `VRLulu` are two. The chosen display capitalization is kept. An Alias is fixed once chosen, because every path under it would change. The user's own Alias is `VR_Lulu` (changed from `VRLulu` the same day, before any real account existed; all content paths moved with it).

Technical research checked 2026-10-18: Firebase's built-in [Google provider](https://firebase.google.com/docs/auth/web/google-signin) authenticates users through their Google accounts. No authentication service has been configured.

### Site administration

Selected 2026-10-20: site administrators may view all application content, including private campaign and character data, independently of campaign membership or DM permission. They may intervene to restore campaign DM permission, including after another DM has revoked it. This is site-wide administrative authority, not a higher campaign DM role or campaign ownership. Contacting an administrator through Discord can request such intervention; no automatic Discord recovery workflow is required.

### Live character-sheet exports

Selected 2026-10-18: exportable HTML is a live, view-only shell for one character sheet, not a frozen or self-contained offline snapshot. It requires an internet connection and loads the character's current saved data from the hosted service under the viewer's current visibility permissions. Shared HTML does not grant access to information made private after export.

The shell contains only the character-sheet interface, including its visible tabs and sheet details. It provides no navigation to account pages, campaigns, other characters, libraries or the wider application. This is an interface restriction, not a replacement for server-side permissions. The exported shell must not redirect into the full application as its normal viewing flow. Downloaded HTML loading, browser origins and authentication compatibility still require implementation verification.

Selected 2026-10-18: an export points to the character's path at export time. Renaming or moving the character so it is no longer at that path causes older exported HTMLs to fail to find it. Do not redirect or automatically retarget those exports; a fresh export is needed for the new path. Copying alone leaves the source in place under the copy-only rule and does not invalidate its exports. A visible-content snapshot may be considered in a future revision, but is not selected or required now and is not a fallback for a missing character.

### Discord identity and bot direction

Selected 2026-10-18: Discord connection is optional for browser use and application-administrator approval to create content. Require a verified Discord connection only for using the bot. Google remains the selected sign-in method; Discord association is additional account information so campaign turns and roles can be accessed through the browser or an optional configured Discord bot. The exact verification mechanism remains open. A typed Discord ID is an unverified claim and must not alone authorize bot actions as that app account.

Proposed integration: the browser and bot use the same authoritative campaign permissions, turns, requests, approvals and logs rather than independent copies of game state. Bot commands/features, campaign-to-server/channel mapping and role mapping need design. Discord roles do not yet have a selected mapping to campaign DM authority.

Hosting must favor low cost. Running the optional bot on the user's PC is acceptable; the hosted campaign browser must still work while that PC is off. Hosted bot execution is deferred until the browser application works; no bot host is selected. Technical research checked 2026-10-18: Discord supports [identity authorization](https://docs.discord.com/developers/topics/oauth2) and [HTTP interactions without a persistent Gateway client](https://github.com/discord/discord-api-docs/blob/main/developers/interactions/receiving-and-responding.mdx). [Cloud Functions for Firebase requires the Blaze plan](https://firebase.google.com/docs/functions/quotas); it must not be assumed to provide guaranteed free bot hosting. No Discord application, account connection or bot has been created.

### Portrait uploads

Selected 2026-10-19: support portrait uploads. Cloud Storage for Firebase is the proposed file-storage service, while Firestore stores the associated character data and file references. Image formats, upload limits, compression, access rules, retention and region still need design and cost accounting. Portrait access must follow the applicable character visibility rules. The selected live-only export scope is unchanged; no image snapshot/export feature is implied.

## Account organization and address design

Accounts can contain campaigns, characters and custom entries at their top level, or organize these mixed entry types in folders and nested subfolders. Folder organization is separate from campaign roles, guest access and tab visibility. Character reorganization follows the [copy-only placement rule](#character-placement-copy-only), including between folders in the same account or campaign.

Selected direction: distinguish three layers of campaign organization. A campaign has its own storage scope, is reachable through an account's organized main menu, and has a separate campaign-view address. Account folder placement does not define the campaign's storage location or confer ownership; campaign authority is defined under [Campaign membership](#campaign-membership).

| Layer | Purpose | User's illustrative path |
|---|---|---|
| Campaign storage | Keep campaign configuration and permissions in its own logical backend scope. Exact database keys/layout remain unselected. | `/campaigns/Moonlit_Coast/` |
| Account navigation | Show a campaign link in the account folder where it was created. The link opens the campaign view; it is not another campaign save. | `website.com/[ACCOUNT]/Fantasy/Random_Subfolder` contains `Moonlit Coast.campaign.link` |
| Campaign view | Open the campaign's shared HTML interface independently of its account-menu placement. | `website.com/Campaigns/Moonlit_Coast` |

These paths illustrate the intended layers, not a finalized routing schema or a requirement for literal database files. Exact character/custom-entry routes and account-menu navigation remain open. Character export behavior after a path change is selected under [Live character-sheet exports](#live-character-sheet-exports).

### Creating a campaign

From the account home or any nested account folder, choose New → Campaign and enter a campaign name. When the account clicks Create New Campaign and creation succeeds, automatically assign that account as the campaign's first DM. Create the campaign's configuration and permissions in the shared campaign storage scope, add a campaign link to the account folder from which creation began, then open the campaign view. Creating from a nested account folder changes the link's placement, not the campaign's storage scope or view address.

For example, creating Moonlit Coast from Home → Fantasy → Random Subfolder adds `Moonlit Coast.campaign.link` there, creates its configuration/permissions under the illustrative `/campaigns/Moonlit_Coast/` scope, and navigates to `website.com/Campaigns/Moonlit_Coast`. Creating it from Home instead places the link at the account root. The New menu also offers characters and custom-entry types; their detailed creation forms remain open.

### Copying a campaign character into an account folder

From the campaign character view, choose Copy to and an account destination folder. The resulting independent character save appears in that folder; the source campaign character remains unchanged under the [copy-only placement rule](#character-placement-copy-only). For example, copying Carol to `[ACCOUNT]/Fantasy/Random_Subfolder/Mages` produces an account character at the illustrative address `website.com/[ACCOUNT]/Fantasy/Random_Subfolder/Mages/Carol.character`. Preserve the account segment so the destination is unambiguous. Unlike the campaign link above, this operation creates a new character save.

Selected 2026-10-18: if the requested target name/path already exists, reject creation, copying or character renaming with a clear name-already-taken/duplicate-file error. Do not overwrite the existing entry or automatically add an ID/suffix to its name/address. Thus two campaigns cannot occupy the same shared campaign path, and a character copy cannot occupy an existing character's destination path; the same character name in a different folder has a different path.

Name comparison — selected 2026-10-20: within the same destination, names differing only in capitalization or spaces versus underscores count as duplicates. For example, “Moonlit Coast”, “moonlit coast” and “Moonlit_Coast” cannot identify separate entries there. Preserve the chosen display capitalization. Renaming is duplicating under the new name, as owned by [record identity](Modules%2C%20Systems%20and%20Rulesets.md#selected-decisions) (selected 2026-10-22).

Firebase Hosting serves the application files (selected 2026-10-22 at 11:42 am PDT (America/Los_Angeles)); the comparison and decision are in [Architecture and Hosting](../Implementation/Architecture%20and%20Hosting.md#serving-the-app-options-compared); Firebase services supply live data either way, so future shared sheets would use that hosted application rather than fetch runtime/data from GitHub. GitHub could remain source control and a backup destination. This serving model has not been implemented; the previous application's GitHub loaders are summarized in [Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md). Firebase [Hosting](https://firebase.google.com/docs/hosting/use-cases) supports web application assets; the selected [Firestore database](https://firebase.google.com/docs/firestore/data-model) stores documents and collections rather than literal URL-shaped files. Exact schema and routing remain unselected.

## Data scopes

| Scope | Rules and decisions |
|---|---|
| Core catalogue | Standard spells, items, feats, species and other reusable definitions are shared across campaigns. Records need stable identities, source references and rules versions. |
| Campaign content | Custom definitions and house rules belong to their campaign. They must not overwrite the global core or appear in another campaign automatically. |
| Account content | Accounts own personal characters and custom definitions and can organize characters, campaigns and custom entries in nested folders. Campaign placement and publication retain their approval rules. |
| Accounts and membership | One account can participate in multiple campaigns and can create campaigns. Roles are campaign-specific. Being the only participant does not grant DM permission; player/edit authority and DM mode remain distinct as described under [Campaignless and solo authority](#campaignless-and-solo-authority--selected-2026-10-18). |
| Character saves | A character belongs to a campaign, folder or campaignless location. Placing it elsewhere creates an independent 1:1 copy of the sheet's saved data; it does not synchronize the two saves. |
| Owned items and scrolls | An owned instance has its own quantity, container, charges, ownership and saved casting parameters. It is distinct from its reusable definition. |
| Live campaign state | Turns, action requests, held resources, [response polls](Spell%20Effects%20and%20Active%20State.md#scheduling-and-repeating-response-polls--selected-2026-10-17), rolls, shared effect coordination and the campaign log belong to the campaign, separately from character-sheet data. DM-only information requires access controls. |

Linked entries are live references to their source definitions. Editing a source changes what linked uses resolve to; custom or duplicated entries are independent records and retain their values when the original changes. Match records by identity and origin, not by name alone. Proposed lookup uses a campaign-specific definition before the core definition.

Customizing a linked entry for local use makes the whole definition independent, superseding the earlier field-level inheritance model. This is distinct from authorized publication of an edit to the source definition, which still affects existing links. Owned quantity, charges and contents remain instance state; changing them does not itself customize the reusable definition.

Linked pending actions and already-active effects use the current definition, including changes published while they are pending or active. Revalidate pending costs, targets and eligibility against current values before execution. Do not reset owned quantities, charges or contents, or rewrite prepaid casting snapshots, completed rolls or historical results. Custom/duplicate definitions remain wholly independent; none of their fields continue inheriting from the original.

The detailed boundary between updated definition fields and immutable paid-casting fields remains implementation design, including changed timing, targets or conditions. Live updates must not silently rewrite a prepaid formula or completed outcome.

## Publication and approval

Players can propose campaign definition edits; the campaign DM approves publication. Once published, linked entries resolve the current definition through their references. There is no additional per-character acceptance gate for each library correction.

Only explicitly assigned core maintainers may publish global core changes. Campaign DM status alone grants no core publishing rights. Assignment/revocation of maintainers and the detailed publication process still need design.

Campaign DMs also approve character insertion, deletion, modification and replacement, including ordinary build/equipment edits as well as gameplay requests. This is separate from approving membership or publishing a definition.

DM editing authority — selected 2026-10-20: through DM mode, campaign DMs may edit any character sheet in that campaign without the character owner granting delegated control. Use the existing approval and logging flow, including concurrent-edit difference review where applicable. This authority does not extend to the owner's separate account copy or character sheets in other campaigns.

## Delegated character control — selected 2026-10-18

A character's owner can grant and revoke control for specific players in the same campaign. Delegated control permits submitting that character's gameplay actions and proposing equipment/build edits, including while the owner is absent. Those requests retain the usual DM approval requirements; delegation does not grant DM or core-maintainer authority.

Control and [tab visibility](#character-sheet-visibility) are separate permissions. Granting control does not reveal tabs or their contents. A delegated player can act only through information they are allowed to access; with no visible tabs, they effectively cannot act on the character. The remaining scope of delegation controls still needs design.

Revocation is enforced server-side: further submissions from the revoked player fail the current permission check. Requests already queued for the character remain queued with their resource holds; revocation does not automatically cancel them. The character's owner can cancel requests belonging to their character through the [existing cancellation flow](Spell%20Effects%20and%20Active%20State.md#casting-workflow--selected-2026-10-17), including requests submitted by a delegate. Preserve request history, completed actions and logs; revocation does not rewrite them.

## Character placement: copy only

Every placement in another folder, folderless location, campaign or campaignless location creates an **as-is copy**. The original remains until separately deleted: campaign deletion requires DM approval, while the owner controls campaignless deletion. There is no automatic cut-and-paste operation, linked deletion or cross-campaign synchronization.

Clarified 2026-10-18: this rule also applies between folders within the same account or campaign. “Moving” a character means copying it to the new location and separately deleting the original under the existing deletion permissions; it is not another relocation operation. Superseded 2026-10-22 at 1:42 pm PDT (America/Los_Angeles): renaming is duplicating under the new name, because a record's identity is its path ([record identity](Modules%2C%20Systems%20and%20Rulesets.md#selected-decisions)). A character placed in a campaign is that campaign's own copy, stored under the campaign (`campaign/<campaign>/characters/<owner>/<name>`), never a link to the account's original. Old exports continue to find the original after copying alone and fail once its original path no longer exists, as specified under [live exports](#live-character-sheet-exports).

For example, copying Carol from Campaign A into Campaign B does not make later damage, inventory changes or progression in B affect the original in A. The destination campaign DM must approve the new character's insertion.

Selected 2026-10-18: copy the character sheet 1:1, including current HP, spent slots, saved active effects and character history. Do not reset or selectively strip these fields during copying. Confirmed 2026-10-22 at 11:45 pm PDT (America/Los_Angeles) (user decision; do not ask again): a copy is a 1:1 clone and changes nothing, in itself or in any other record. Inventory lines keep `attunedTo` pointing at the original character's path ([attunement](Spell%20Containers%20and%20Consumable%20Sources.md)), so the copy's items show as attuned to the original and grant the copy nothing until it attunes them itself. Privacy settings are separate campaign-specific data and are not copied with the sheet; the destination campaign uses its own visibility settings and defaults. The custom-content exception below still applies: copying a character does not automatically import campaign-specific definitions. The owner controls campaignless saves; destination campaign approval still applies when inserting a copy into a campaign.

Turns and action requests are separate from the character sheet/file. Copying a sheet does not copy campaign turns, request queues or their resource holds; no special request-copying workflow is needed. The campaign has its own log, while each character sheet has history for its participation in that campaign. Character history is stored separately (selected 2026-10-22 at 2:26 pm PDT (America/Los_Angeles)): each save writes one history record under the character's path (`…/<character>/history/<time>`) listing what changed and an optional note from the person saving, which keeps the sheet's own documents small; it must remain distinct from the campaign-wide log. Copying the sheet does not copy the campaign-wide log.

## Custom content: disabled placeholders and manual imports

Campaign-specific items, spells and other definitions stay in their source campaign. They are not automatically imported with a character copy. Users should be able to copy or import definitions manually, individually or in bulk, between campaigns and folders.

If Carol has Campaign A's custom Aetherlock and is copied into Campaign B without that definition, her destination save keeps a **disabled missing-item entry**. It is not silently deleted. Preserve the owned entry's reference, state and contents, but grant no actions or bonuses from the unresolved definition. The original in A is unchanged.

Manually importing and relinking the definition restores that existing entry. It must not create a second owned item or duplicate its quantity, charges or children. Destination campaign approval still applies; a manual import must not accidentally publish something globally.

Import name collisions — clarified 2026-10-19: apply the existing duplicate-name rule to custom definitions too. If the destination already has an entry with the same target name, stop that import and explain that the entry already exists/name is taken. Do not overwrite, merge, silently reuse/relink the existing definition or automatically rename the incoming entry. This is not a separate conflict-resolution workflow.

Core definitions remain shared and do not need to be duplicated for each character. Missing campaign definitions must not cause unrelated core-linked inventory to disappear. Nested containers, paid scroll snapshots, hidden source data and explicit relinking details require further design before implementation; same-name imports are already resolved by the rejection rule above.

## Campaign membership

Selected admission flow:

The account must have an Alias and application-administrator approval under [Guest viewing and accounts](#guest-viewing-and-accounts) before this campaign admission flow applies.

1. The DM supplies an invite link or code.
2. The person submits a join request.
3. The DM approves membership.
4. The person receives player access to that campaign.

A pending request is not membership and grants no campaign content or gameplay authority. Joining does not grant DM or core-maintainer privileges, automatically approve a character, or approve custom content imports.

Selected 2026-10-20: campaigns have no owner role. Campaign-specific DM permission and membership determine campaign authority and participation; characters remain bound to their owning accounts, with delegated control as described above. The first DM is assigned automatically under [Creating a campaign](#creating-a-campaign), without receiving a separate ownership privilege. Any existing campaign DM may grant or revoke DM permission for other campaign members; all campaign DMs have equal authority. This replaces the earlier campaign-owner and ownership-transfer model. No accounts or invitations have been created through this discussion. Account sign-in requirements and remaining implementation choices are recorded under [Guest viewing and accounts](#guest-viewing-and-accounts).

## Campaignless and solo authority — selected 2026-10-18

An account owner can create, edit, copy and delete their campaignless characters, and can create campaigns. A solo campaign means one participating person, not one character. That person still acts as a player when controlling their character; being alone does not itself grant DM permission. If their account also has campaign DM permission, they can switch to DM mode to perform DM operations, including approving character insertion or their own requests through the normal approval system. The creation rule supplies that DM permission when they created the campaign themselves. Holding DM permission does not automatically put a player in DM mode. There is no solo bypass or automatic self-approval, and making campaigns ownerless does not change this separation. Other campaign permissions remain scoped to the relevant campaign.

## Character-sheet visibility

Selected 2026-10-18 during documentation clarification: character tabs are **public by default**, including to guests and pending accounts where the character is publicly visible. Privacy uses the same rules for public visitors and campaign members, rather than a separate guest-sharing configuration. Privacy settings belong to access data, separately from the character sheet/file; campaign-character privacy is stored with campaign access data. The owner can make individual tabs private, including Inventory or D&D statistics, and may hide every tab. The owner can grant and revoke access to each private tab for specific campaign players, independently of character control. Private tab content is visible to the owner, campaign DM(s) and players explicitly granted access to that tab, with the site-administrator access defined under [Site administration](#site-administration). Where the character entry is visible, other viewers still see its name.

Per-line privacy — selected 2026-10-21 at 2:06 am PDT (America/Los_Angeles), replacing the 12:51 am proposal: as an extra layer on top of tab privacy, an owner can make individual lines inside a tab private, such as one inventory item or one spellbook entry, with the same per-player access grants. Viewers without access see a placeholder line ("Private Item", "Private Spell") instead of the entry.

Totals — selected 2026-10-21 at 2:06 am PDT (America/Los_Angeles): game systems always calculate with the full data, including private tabs and lines. Viewers without access see the true total, such as AC 16; a contribution from a private source is left unnamed in the breakdown.

Enforcement — selected 2026-10-21 at 2:06 am PDT (America/Los_Angeles): tab and line privacy are screen-only. Viewers' browsers receive the data and the app hides it; Firestore Security Rules do not block those reads. The user accepted that someone using browser developer tools could see hidden content, because the app is for a private friends group and cheating is not a concern. This replaces the 2026-10-18 requirement that read permissions be enforced by the backend for private tabs. Selected 2026-10-23 at 5:26 am PDT (America/Los_Angeles): whole private campaigns, private characters, DM-only notes and hidden actions are screen-only too. The user accepted that something meant to be hidden may occasionally be visible to someone inspecting the page or its traffic, because this is a friends' tabletop campaign. Security Rules still enforce who may write and approve.

This replaces the earlier requirement to explicitly share each section before any party view exists. Membership still does not grant editing/control rights.

Action/effect notifications are public by default even when their source spell, item or value belongs to a private tab. At submission, the requester can choose to hide the spell/action from other players. This applies to casting, consuming items, adjusting values and other gameplay requests. Keep tab access and submitted-action visibility separate: a public notification does not grant access to the source tab. Hidden details remain available to the owner and DM(s); the exact notification/log fields still need design. Aggregate totals are selected above. [Copying a sheet](#character-placement-copy-only) does not copy its source campaign's privacy settings. [Live exports](#live-character-sheet-exports) use current visibility permissions.

Queue visibility — selected 2026-10-19: queued requests use the same submitted-action visibility setting. Public requests are visible to fellow campaign players while waiting; requests marked hidden are visible only to the requester, character owner and campaign DM(s). Queue visibility does not imply advance approval or access to private source tabs.

## Concurrent editing and difference review

Selected 2026-10-19: while a sheet is being edited, every incoming sheet change prompts a side-by-side difference window as soon as the live update is received, including changes unrelated to the editor's unsaved fields. Show only differing items and let the editor choose the incoming saved value or their local value for each item individually. Preserve the local input and do not silently overwrite the disputed edit while the comparison is unresolved. These choices do not bypass ordinary permissions or required DM approval.

Manual edits may include an optional author note, such as “Updated spell list in her book.” Do not require a note or generate an automatic summary when it is blank. Gameplay changes such as HP adjustments or item consumption may show their existing action-log reason rather than ask for an author note or create a separate summary.

Compute the differences in the browser when an incoming saved character version is detected in an editor view with edit access, using the locally cached version and the incoming version. Keep the comparison compact and show only changed items; a single consumption may produce a single differing item. There is no separately saved diff document or after-the-fact diff archive. The existing campaign/action logs are separate from this temporary comparison. “Keep mine” retains the cached/local value in the draft, while accepting incoming uses the new value. Selecting a local value does not itself write it back to the server. Any later save still follows ordinary permissions and approval rules. The incoming gameplay change is saved through its normal workflow; an editor's comparison does not pause campaign activity or undo the saved action.

Selected 2026-10-19: if further saved updates arrive during an unresolved comparison, queue them separately in the browser in arrival order. Finish the displayed comparison, then show the next one. Do not combine incoming updates or refresh the comparison the editor is currently reading. This queue is temporary browser state, not a persisted diff archive. Reviewing an older incoming update does not make that version current on the server; a later save must still validate current state and permissions.

Open: exact update identifier/timestamp presentation. This interface decision does not establish a lock on other editors.

## Offline behavior and server authority

Without an internet connection, the client makes no authoritative campaign changes. Unsent edits can remain in the current open page's memory. Refreshing, closing the tab or losing power may lose them. No durable offline draft store, automatic recovery or automatic replay is required.

On reconnect, retrieve current server state and permissions before submitting retained inputs. Keep those inputs separate from fresh campaign state where possible. Revalidate costs, targets, eligibility and revisions; never replace current server data with a stale full-character copy.

If the connection dropped after submission, check the action's server status before retrying. Do not assume failure and spend or resolve twice. Existing server reservations are not released simply because the client disconnects.

Other authorized campaign events continue while a player is absent. Fixes or retcons afterward follow the [manual retcon rule](#manual-retcons).

Proposed interface requirements: clearly identify offline, stale and unsent state; never describe an in-memory edit as saved or approved. A required DM approval still waits for an authorized DM even though the hosted service remains available.

## Manual retcons

Clarified 2026-10-19: mistakes in completed actions are corrected manually by editing the affected character sheet, NPC or other current state. Use existing editing permissions, campaign DM approval and ordinary change logging. There is no one-click revert, automatic refund, automatic rewind/replay of later events or dedicated linked-correction workflow. People decide which values or effects need correction and edit those explicitly. Preserve completed-action history; correcting current state does not rewrite the original log.

## GitHub and hosted state

GitHub can remain source control, static distribution and an export/backup destination. Repository commits are not recommended as the live transport for polls, approvals and resource holds: the previous application's SHA-based JSON writes were not campaign transactions. The issue is concurrency, permissions and coordinated state changes, not an established universal five-minute cache delay. The previous application's persistence failures are summarized in [Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md).

Sources: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) describes static hosting. The [Contents API](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents) requires the current SHA when replacing a file and documents conflict responses.

## Hosted backend comparison

Budget direction — selected 2026-10-19: aim to run the required application within no-cost usage allowances. Blaze and supplying billing information are acceptable for needed services, including portrait upload storage; remaining on Spark is not a requirement. Estimate quota usage and service eligibility before setup. If the required application would exceed included allowances, explain why and estimate the paid costs. Blaze permits billable usage, so staying within allowances is a design target rather than a guaranteed spending cap; [budget alerts alone do not cap charges](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans). This discussion selects the planning direction, not authorization to create a project or enable billing now. The final database/update model and media usage still need accounting.

### Planning scale and cost model

Daily planning traffic supplied by the user, 2026-10-19, replaces the earlier ten-user weekly-session capacity estimate:

| Scenario | Daily visitors and pages | Inventory/spells navigation |
|---|---|---|
| Expected | Fifteen unique visitors: five guests view only a character sheet, and ten active users view the campaign home and also open their own character sheets. | Five people switch between Inventory and Spells ten times each per day. |
| High | Thirty-three daily visitors view the campaign home; twenty-five also open their own character sheets. | Ten people switch between Inventory and Spells ten times each per day. |

These are planning assumptions, not account or gameplay limits. Daily viewing counts do not specify editing volume, live-change rates or how long listeners remain connected; the cost model identifies its assumptions for those quantities separately.

Selected 2026-10-19: persist committed changes promptly to Firestore and use its native realtime listeners to update authorized open pages. This replaces the proposed five- or ten-minute in-memory batching server and separate live relay. Save completed edits/submissions rather than every text-field keystroke; no delayed checkpoint or separate backup/recovery system is required. Existing permissions, approval sequencing, resource holds and retained history remain in scope. This direction avoids a dedicated relay's compute charges; whether any separate trusted backend operations are required remains subject to schema and permission design.

The [Firebase Cost Model](../Implementation/Firebase%20Cost%20Model.md) owns live-update behavior, workload assumptions, current service rates and calculated USD estimates for immediate Firestore writes. Its scenarios budget browser listeners, dependent permission reads, retained history, portrait storage and static hosting, with exclusions stated. These are estimates for an unimplemented system, not measurements or guaranteed charges. Selected gameplay and approval behavior remains in [Spell Effects and Active State](Spell%20Effects%20and%20Active%20State.md).

### Earlier provider comparison

The following published limits were checked on 2026-10-17. They are research findings, not a guarantee of permanent free service or measured application capacity.

| Option | Relevant free-tier features and limits | What still needs evaluation |
|---|---|---|
| Firebase Auth and Realtime Database, with a static frontend | Spark includes 100 simultaneous Realtime Database connections, 1 GB stored and 10 GB downloaded per month. The service supports authenticated rules, realtime listeners and transactions. | Validate campaign isolation, private fields, concurrent holds and one-time resolution. Not every Firebase product is free on Spark. Connections are not the same as human players. |
| Supabase, with a static frontend | Free tier includes a 500 MB database, 200 peak Realtime connections and 2 million Realtime messages per month. Postgres, Auth and row policies fit campaign relationships. | Free projects pause after one inactive week; the published limit was two active free projects. Pro started at USD 25/month. Many campaigns can share one service project. |
| GitHub only | Existing JSON editing, version history and static distribution can continue. | Not recommended as the authoritative store for live multiplayer requests and reservations. |
| Backend on the user's PC | Technically possible. | Does not meet the requirement that others can update while that PC is off. |

Firebase is preferred because the user is comfortable with Google. No Firebase project, product configuration, subscription or deployment has been created. A small capability test should validate the requirements before a migration is chosen. A provider project is not the same thing as one D&D campaign.

Sources: [Firebase pricing](https://firebase.google.com/pricing), [Firebase reads, atomic writes and transactions](https://firebase.google.com/docs/database/web/read-and-write), [Firebase security rules](https://firebase.google.com/docs/database/security), [Supabase pricing](https://supabase.com/pricing), [Supabase row security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Supabase realtime](https://supabase.com/docs/guides/realtime/postgres-changes).

## HTML and live-state requirements

- Retain an HTML/JavaScript viewer. A hosted HTTPS page can load a campaign and character, then authenticate for private data.
- Test downloaded HTML, browser origins and authentication before promising identical behavior from `file://` URLs.
- Implement the selected [live character-only export shell](#live-character-sheet-exports); offline/frozen sheet exports are outside the selected scope.
- Enforce campaign membership and DM authority in backend access rules. Character tab and line privacy is screen-only (see [Character-sheet visibility](#character-sheet-visibility)). Public GitHub files must not contain private campaign records, and browser bundles must not contain administrative service secrets.
- Reservations and resolution require coordinated validation, stable action identities and a single authoritative state transition. Persist accepted changes in Firestore; native listeners distribute the committed state to authorized clients.
- Preserve the existing review, reservation, approval, response, roll and effect workflows described in [Spell Effects and Active State](Spell%20Effects%20and%20Active%20State.md).

## Remaining decisions

1. Alias format validation (uniqueness is selected above), Discord verification mechanism and remaining edit/control permissions. Google-only sign-in, an Alias and administrator approval before creation or campaign admission, public-by-default visibility with intentional privacy, public browsing before approval, live character-only HTML exports, optional Discord connection required only for bot use, ownerless campaigns with equal DM authority and automatic first-DM assignment at creation, player delegation and its revocation behavior, independent per-player tab access, 1:1 character-sheet copies, campaignless character ownership and separate player/DM modes during solo play are selected above.
2. Core-maintainer assignment/publication procedures; manual import scope and destination relinking. Core publishing requires an explicitly assigned maintainer role.
3. Notification/log details for hidden actions and storage of per-character campaign history. Aggregate totals, per-line privacy and screen-only enforcement are selected above. Public notification defaults and separate campaign-specific tab privacy are selected above.
4. Firebase schema, region, service configuration and cost controls; portrait-upload limits/storage/access/retention; Discord bot commands/permissions/mapping and later hosting, followed by capability tests if authorized. Google authentication, Firestore, wanted portrait uploads and acceptance of Blaze while targeting no-cost usage are selected.
5. Exact account-menu/character/custom-entry routes, account custom-definition imports, storage adapters, lossless migration and import/export behavior before runtime implementation. The three campaign layers—storage, account navigation and campaign view—copy-only character placement even within folders, and old exports failing after a character path change are selected above.

Other selected systems are recorded in [Spell Containers and Consumable Sources](Spell%20Containers%20and%20Consumable%20Sources.md) and [Spell Effects and Active State](Spell%20Effects%20and%20Active%20State.md). Failure modes to design against are in [Lessons from Character Manager](../Implementation/Lessons%20from%20Character%20Manager.md).
