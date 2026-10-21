# Architecture and Hosting

Purpose: own the hosting decision, the scope of Firestore Security Rules, the technology stack, the repository layout, the testing strategy, local development on the Firebase Emulator and first-administrator seeding. Status: written 2026-10-21 at 4:00 am PDT (America/Los_Angeles) during Milestone 1 (Step A3); no code, Firebase project or billing exists. How code and data are layered, and how records are stored and cached, is owned by [Modules, Systems and Rulesets](../Systems/Modules%2C%20Systems%20and%20Rulesets.md).

## Selected decisions

Recorded with the user on 2026-10-21 between 12:10 am and 12:51 am PDT (America/Los_Angeles), unless dated otherwise:

- **Pure browser plus Firebase.** There is no dedicated server now. Server compute is added only where it is unavoidable. Cheating is not a concern for a friends group.
- **Start on the local Firebase Emulator**, and learn how real Firebase deployment works alongside it, so moving over is ready whenever it is chosen. Creating the real Firebase project, choosing its region and enabling billing all wait for the user's explicit approval.
- **PC-hosted sessions are for development and testing only.** Only real Firebase hosting meets the requirement that the app works while the user's PC is off.
- **Security Rules enforce authority, not game math.** See [Security Rules scope](#security-rules-scope).
- **Stack:** React + TypeScript + Vite in a pnpm monorepo, chosen by the agent at the user's invitation. TypeScript lets one rules engine run in the browser, in tests and in any later server code.
- **Core content is hand-entered for now.** Importers and LLM helpers come later.
- **Every state change goes through a named transition** (such as `submitRequest` or `approveRequest`), so any transition can later move into a Cloud Function without changing the user interface; its Rules would change with it.
- **Testing** (2026-10-21 at 4:00 am PDT): unit tests, emulator tests, Rules tests from Milestone 4, and one browser end-to-end test from Milestone 2. See [Testing strategy](#testing-strategy).
- **Cost measurement** (2026-10-21 at 4:00 am PDT): the [Firebase Cost Model](Firebase%20Cost%20Model.md) predates the one-document-per-definition layout. The user expects real usage to be well below it. Rather than re-estimating now, actual reads, writes and storage are to be measured once the app runs, and the cost model updated from those measurements.

## Open questions

- How the first site administrator is set on real Firebase: by hand in the Firebase console, or with a one-off local script. Decide at Milestone 6 (user decision, 2026-10-21 at 4:00 am PDT).
- Firebase region, project setup and billing: wait for the user's explicit approval (Milestone 6).
- Whether privacy beyond character tabs and lines is enforced by Rules; owned by [Modules, Systems and Rulesets](../Systems/Modules%2C%20Systems%20and%20Rulesets.md#open-questions).

## Hosting: browser plus Firebase

Every trusted need in the current documentation can be met without server code:

| Need | Pure browser + Firebase method |
|---|---|
| Resource holds and one-time resolution | Firestore client `runTransaction`. The request document id is the stable action identity. The transaction refuses if the action status is not `pending`, which makes duplicate approval a no-op. Usable amount → hold → consumed or returned happens in the same transaction. |
| Who may write | Security Rules check authority (below). A player's submission may write the request and its hold to the character, because the hold is part of the selected workflow. Ordinary sheet edits in a campaign go through DM approval, and Rules refuse submissions from a revoked delegate. |
| DM-only approval and membership | Rules check `/campaigns/{campaignId}/members/{uid}.role`. |
| Character tab and line privacy | Screen-only: viewers' browsers receive the data and the app hides it. Rules do not block those reads. Owned by [Campaigns and Shared Data](../Systems/Campaigns%20and%20Shared%20Data.md#character-sheet-visibility). |
| Accounts: Alias, approval and site administrators | One `/accounts` area. `/accounts/{uid}` holds the Alias, approval status and administrator flag, and no Google email or profile data in anything publicly readable. Rules stop a user from changing their own approval or administrator fields. Admins approve accounts in the user interface; no Admin SDK or custom claims are needed. Firestore cannot enforce a unique value across documents, so a small Alias index (`/accounts-by-alias/{normalizedAlias}`) is written in the same batch and checked with `existsAfter`. The same pattern covers unique campaign and character paths. Alias rules are owned by [Campaigns and Shared Data](../Systems/Campaigns%20and%20Shared%20Data.md#guest-viewing-and-accounts). |
| Game calculations | The shared TypeScript engine runs in the browser. The DM's browser resolves approved actions, using the same code a server would run later. |
| Live updates | Native Firestore listeners, as selected in [Campaigns and Shared Data](../Systems/Campaigns%20and%20Shared%20Data.md#planning-scale-and-cost-model). |

What will eventually need compute (all deferred):

- **Discord bot:** an HTTP-interactions endpoint, or a Gateway client.
- **LLM helpers:** an API key cannot ship in the browser bundle.

Options for that compute, in order of preference:

1. **Cloud Functions or Cloud Run.** Both have free allowances on Blaze.
2. **The user's PC.** Acceptable for the bot, per the existing documentation.
3. **A GCP e2-micro always-free VM**, if a persistent Gateway bot is wanted or Cloud Run work should move onto it.

**Blaze is needed** only once the app moves to real Firebase, and then for portrait Cloud Storage. The budget direction (target no-cost allowances, Blaze acceptable) is owned by [Campaigns and Shared Data](../Systems/Campaigns%20and%20Shared%20Data.md#hosted-backend-comparison).

## Security Rules scope

Rules check who may read and write: campaign membership, the DM role, delegation and its revocation, DM approval for character changes, the account approval and administrator fields, and site-administrator read access. They do not check whether a hold amount or a calculation is correct, and they do not hide private character tabs or lines (privacy there is screen-only).

## Local development on the emulator

- **Everything runs on the user's PC through the Firebase Emulator Suite** (Auth, Firestore, Storage, Hosting). No real Firebase project exists yet; `firebase.json` and `firestore.rules` are emulator-only for now.
- The app must not depend on anything running locally except the emulator, so it can move to real Firebase with only a connection-configuration change.
- Friends can reach a PC-hosted session only while the PC is on, through a tunnel or port forwarding. This is for testing only.

**First site administrator.** Rules stop users from setting their own administrator flag, so the first administrator must be set outside the app. On the emulator, seed data sets it. On real Firebase it is open (see above).

**Exported files and sign-in.** Firebase Authentication will not run from a downloaded file's `file://` origin, while guest reads of public data can. Verify this when the live export shell is built; the export requirement is owned by [Campaigns and Shared Data](../Systems/Campaigns%20and%20Shared%20Data.md#html-and-live-state-requirements).

## Stack

- pnpm workspaces, TypeScript in strict mode.
- Vite + React for the web app.
- Vitest for unit and emulator tests; Firebase's rules-testing library for Rules tests; Playwright for browser end-to-end tests.
- ESLint + Prettier.
- Firebase JavaScript SDK (Auth, Firestore, Storage) only inside the storage and web packages. The engine never imports Firebase.

## Repository layout

- `packages/kernel`: record envelope, module registry, resolved-state pipeline, dice, validation results and the transition interface.
- `packages/systems/*`: one folder per system. Milestone 2 needs:
  - `abilities`, `proficiency`, `skills-and-saves` (including expertise and initiative), `features` (feats and class features as modifier sources, such as Alert, War Caster and Skill Expert)
  - `hit-points`, `armor-class`, `active-effects` (a minimal store of which effects are active, so AC shows Mage Armor or Shield only when active; no clock or expiry yet)
  - `resources` (limited-use pools with reset types: Arcane Recovery, Tinker's Magic, the free Magic Initiate cast, Heroic Inspiration)
  - `spellcasting`, `spellbook-readiness`
  - `containers`, `attunement` (including held state for conditional bonuses such as the Wand)
  - `magazines` (chambers and charge display only)
- `packages/games/dnd5e-2024`: the game module, including class records and each class's own slot table (Vanilla+ adds slots per class; see [Character Creation and Advancement](../Systems/Character%20Creation%20and%20Advancement.md)).
- `packages/rulesets/hearthtable-vanilla-plus`: the ruleset data.
- `packages/storage`: the `Repository` interface plus `memory` and `firestore` adapters.
- `apps/web`: the React sheet viewer and editor. Tabs come from the `sheet.tabs` registry.
- `apps/export-shell`: a later app.
- `content/`: hand-entered Carol records as JSON fixtures, plus the Aetherlock as campaign-content data.

`superiority-dice` is not needed for Milestone 2, because Carol has none; it stays on the roadmap as a test of the `resources` system.

## Testing strategy

| Layer | Tool | Starts |
|---|---|---|
| Kernel, systems, game module and rulesets | Vitest unit tests, no Firebase | Milestone 2 |
| Storage adapters | Vitest against the Firestore emulator | Milestone 2 |
| Browser end-to-end | One Playwright test: open Carol, edit HP and an inventory quantity, reload, and check both persist in the emulator | Milestone 2 |
| Security Rules | Firebase's rules-testing library against the emulator | Milestone 4 |

Each milestone's required tests are listed in [Milestones](Milestones.md).

## Open work

Turns, initiative and rests; conditions; and NPCs, monsters and encounters must be specified before they are implemented. The list is owned by [Modules, Systems and Rulesets](../Systems/Modules%2C%20Systems%20and%20Rulesets.md#open-work-must-be-specified-before-implementation).
