# Architecture and Hosting

Purpose: own the hosting decision, the scope of Firestore Security Rules, the technology stack, the repository layout, the testing strategy, local development on the Firebase Emulator and first-administrator seeding. Status: written 2026-10-21 at 4:00 am PDT (America/Los_Angeles) during Milestone 1 (Step A3); no code, Firebase project or billing exists. How code and data are layered, and how records are stored and cached, is owned by [Modules, Systems and Rulesets](../Systems/Modules%2C%20Systems%20and%20Rulesets.md).

## Selected decisions

Recorded with the user on 2026-10-21 between 12:10 am and 12:51 am PDT (America/Los_Angeles), unless dated otherwise:

- **Pure browser plus Firebase.** There is no dedicated server now. Server compute is added only where it is unavoidable. Cheating is not a concern for a friends group.
- **Start on the local Firebase Emulator**, and learn how real Firebase deployment works alongside it, so moving over is ready whenever it is chosen. Creating the real Firebase project, choosing its region and enabling billing all wait for the user's explicit approval.
- **Firebase Hosting serves the app's files** (selected 2026-10-22 at 11:42 am PDT (America/Los_Angeles), after the [comparison](#serving-the-app-options-compared)). It keeps one provider and console, works in the emulator and gives the simplest Google sign-in. It is free at the planned traffic; Cloudflare Pages remains the fallback if traffic ever grows far beyond it. Deployment still waits for the user's approval in Milestone 6.
- **PC-hosted sessions are for development and testing only.** Only real Firebase hosting meets the requirement that the app works while the user's PC is off.
- **Security Rules enforce authority, not game math.** See [Security Rules scope](#security-rules-scope).
- **Stack:** React + TypeScript + Vite in a pnpm monorepo, chosen by the agent at the user's invitation. TypeScript lets one rules engine run in the browser, in tests and in any later server code.
- **Core content is hand-entered for now.** Importers and LLM helpers come later.
- **Every state change goes through a named transition**, as defined in the [kernel contracts](../Systems/Modules%2C%20Systems%20and%20Rulesets.md#kernel-contracts). When a transition later moves into a Cloud Function, its Rules change with it.
- **Testing** (2026-10-21 at 4:00 am PDT): unit tests, emulator tests, Rules tests from Milestone 4, and one browser end-to-end test from Milestone 2. See [Testing strategy](#testing-strategy).
- **Cost measurement** (2026-10-21 at 4:00 am PDT; updated 2026-10-22 at 11:42 am PDT (America/Los_Angeles)): at the user's request the [Firebase Cost Model](Firebase%20Cost%20Model.md) was recalculated for the one-document-per-definition layout. Actual reads, writes and storage are still to be measured once the app runs, and the model updated from those measurements.

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

## Serving the app: options compared

Researched 2026-10-22 at 11:42 am PDT (America/Los_Angeles) at the user's request, because changing the host later means changing sign-in and deployment setup. Firestore, Firebase Authentication and Cloud Storage stay the backend in every option; only the service that serves the app's static files, and any extra compute, differs. Prices are USD from the providers' official pricing pages on that date.

| | Firebase Hosting | Cloudflare Pages | GitHub Pages |
|---|---|---|---|
| Free serving | 10 GB stored; 360 MB/day transfer | Unlimited static requests and bandwidth; 500 builds/month | 1 GB site; soft 100 GB/month bandwidth; soft 10 builds/hour |
| Beyond free | $0.026/GB stored; $0.15/GB transfer | Static serving stays free | No paid tier; GitHub may stop serving and suggest a CDN |
| Private repository | Works | Works | Needs a paid GitHub plan |
| Google sign-in | Redirect sign-in works on a custom domain served by Firebase Hosting | Popup sign-in, or a transparent reverse proxy to `firebaseapp.com/__/auth/`, or self-hosted sign-in helper files | Popup sign-in or self-hosted helper files; no proxy option |
| Local testing | Part of the Firebase Emulator Suite | Separate Wrangler tool | None needed for static files |
| Preview links per branch | Preview channels | Automatic per branch | No |
| Terms | General use | General use | Not intended for running an online business or commercial software service |

Compute that comes with each option (needed later for the Discord bot and LLM helpers, not now):

| | Google Cloud / Firebase (Blaze) | Cloudflare | GitHub |
|---|---|---|---|
| Free functions | Cloud Functions: 2M invocations, 400,000 GB-seconds, 200,000 GHz-seconds, 5 GB egress per month. Cloud Run: 2M requests, 180,000 vCPU-seconds, 360,000 GB-seconds per month | Workers Free: 100,000 requests/day, 10 ms CPU per request | None for serving (Actions minutes are for builds only) |
| Paid functions | $0.40 per million invocations plus compute | Workers Paid, $5/month minimum: 10M requests and 30M CPU-ms included, then $0.30 per million requests and $0.02 per million CPU-ms | — |
| Always-on machine | One free e2-micro VM in us-west1, us-central1 or us-east1, with 30 GB disk and 1 GB egress/month; needs a billing account | Durable Objects (included on Free with daily limits) or Containers on the paid plan | — |
| Storage extras | Cloud Storage for portraits: 5 GB stored, 100 GB/month download in us-central1, us-west1 or us-east1 | R2: 10 GB stored, 1M writes and 10M reads/month free, no egress fees | — |

Monthly cost estimates for the current layout are in the [Firebase Cost Model](Firebase%20Cost%20Model.md#layout-of-2026-10-22-recalculated). For the user-supplied traffic every option serves the app for $0, and the Firestore bill is the same whichever host is chosen. At ten times that traffic in one large campaign, Firebase Hosting would cost about $0.74–$3.85/month for transfer, while Cloudflare Pages stays at $0 and GitHub Pages stays within its soft limit.

**A small server of our own, if ever wanted.** Nothing planned needs one: Firestore listeners deliver live updates straight to browsers, whichever host serves the files. As a check, a generous workload (33 connected viewers, 1,000 updates/day of about 1 KB to every viewer, plus a Discord bot) fits free on either:

- A Cloudflare Durable Object uses about 110 of its 100,000 free daily requests (incoming WebSocket messages count 20:1; outgoing messages are free), and even awake all day stays under its 13,000 GB-seconds/day.
- Google's free e2-micro VM (0.25 vCPU sustained, 1 GB RAM, always on) handles it easily; data sent out would be about 1 GB/month only if everyone were connected every day. The user expects far less, since the group does not play daily.
- Cloud Run and Cloud Functions suit short requests such as bot commands, not streams held open all day.
- An always-connected Discord bot needs the VM; a bot that receives Discord's HTTP calls fits Cloud Functions or Workers.

Sources: [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [E2 machine types](https://cloud.google.com/blog/products/compute/google-compute-engine-gets-new-e2-vm-machine-types), [Firebase pricing](https://firebase.google.com/pricing), [Google Cloud free tier](https://docs.cloud.google.com/free/docs/free-cloud-features), [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Firebase redirect sign-in options](https://firebase.google.com/docs/auth/web/redirect-best-practices).

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

## Development setup

Scaffolded 2026-10-22 at 12:17 pm PDT (America/Los_Angeles) (Milestone 2, Step B). Requirements: Node 24 or later, pnpm 11 (pinned in `package.json`), and a Java 21 or later JDK for the Firebase emulators. The current Firebase CLI refuses older Java; this machine uses Eclipse Temurin 25. The Firebase CLI is a project dev dependency, not a global install.

| Command | What it does |
|---|---|
| `pnpm install`, then `pnpm exec playwright install chromium` | Install dependencies and Playwright's browser |
| `pnpm dev` | Run the web app at `http://localhost:5173` |
| `pnpm emulators` | Start the Auth, Firestore, Storage and Hosting emulators, with the emulator UI at `http://localhost:4000` |
| `pnpm check` | Typecheck, lint, check formatting and run unit tests |
| `pnpm test:emulator` | Run the emulator tests inside a temporary emulator |
| `pnpm test:e2e` | Run the Playwright tests against the dev server and a temporary emulator |
| `pnpm peek` | Print Carol's resolved sheet, with how every number was worked out |

Decisions made while scaffolding:

- Packages use the `@hearthtable/` prefix, and packages export their TypeScript sources directly; there is no separate build step for libraries (user decision for the prefix).
- The emulator project ID is `demo-hearthtable`. The `demo-` prefix means Firebase treats it as offline-only, so nothing can reach a real project (user decision).
- TypeScript is pinned to 6.0, because the ESLint TypeScript plugin does not yet support TypeScript 7.
- Install scripts for `@firebase/util`, `protobufjs` and `re2` are turned off in `pnpm-workspace.yaml`; none is needed for this app.
- `firestore.rules` and `storage.rules` deny everything except a `scaffold` collection used by the emulator smoke test. Real Rules come in Milestone 4.

## Repository layout

- `packages/kernel`: record envelope, module registry, resolved-state pipeline, grants, dice, validation results and the transition interface. Systems read their record data through Zod schemas (`readField`, `readDefinition`) that report problems instead of guessing.
- `packages/systems/*`: one folder per system. Milestone 2 needs:
  - `abilities`, `proficiency`, `skills-and-saves` (including expertise and initiative), `features` (feats and class features as modifier sources, such as Alert, War Caster and Skill Expert)
  - `hit-points`, `armor-class`, `active-effects` (a minimal store of which effects are active, so AC shows Mage Armor or Shield only when active; no clock or expiry yet)
  - `resources` (limited-use pools with reset types: Arcane Recovery, Tinker's Magic, the free Magic Initiate cast, Heroic Inspiration)
  - `spellcasting`, `spellbook-readiness`
  - `containers`, `attunement` (including held state for conditional bonuses such as the Wand)
  - `magazines` (chambers and charge display only)
- `packages/games/dnd5e-2024`: the game module, including class records and each class's own slot table (Vanilla+ adds slots per class; see [Character Creation and Advancement](../Systems/Character%20Creation%20and%20Advancement.md)).
- `packages/rulesets/hearthtable-vanilla-plus`: the ruleset data.
- `packages/engine`: the composition root. It lists the modules and resolves a character's records under a ruleset; views, tests and scripts use it.
- `packages/storage`: the `Repository` interface plus `memory` and `firestore` adapters.
- `apps/web`: the React sheet viewer and editor. Tabs come from the `sheet.tabs` registry.
- `apps/export-shell`: a later app.
- `content/`: hand-entered record envelopes as JSON: `core/` (features, spells, items), `account/vrlulu/` (VRLulu's Aetherlock, rounds, canisters and Indomitable, and Carol's character, inventory and three books). `content/src` loads and checks them.

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
