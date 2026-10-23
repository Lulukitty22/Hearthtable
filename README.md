# Hearthtable

A hosted web app for running tabletop RPG campaigns together: live character sheets, campaigns with DM approval, and spell, item and effect systems that change real character state.

## Status

> **Where things stand: see [Current progress](Documentation/Implementation/Milestones.md#current-progress)** (what is built, what is next, what is waiting on you). To run it locally, double-click `Hearthtable Launcher.exe`.

Milestones 1 and 2 are accepted; Milestone 3 (spell details, scrolls, charge counters, coins and item lifecycle) is accepted too; Milestone 4 (accounts and campaigns) is next. The rules engine, the Hearthtable Vanilla+ ruleset, Carol's hand-entered records, saving to the local Firebase emulator and her sheet in the browser all work. There is no real Firebase project yet; accounts and campaigns come in Milestone 4. Hearthtable replaces Character Manager, an earlier static HTML/JavaScript app that saved characters as JSON committed to GitHub. Its code was intentionally not carried over; the archive is [Lulukitty22/Character_Manager](https://github.com/Lulukitty22/Character_Manager).

## Selected direction

- **Stack:** React + TypeScript + Vite in a pnpm monorepo; development starts on the local Firebase Emulator.
- **Hosting and data:** Firebase, browser-only with no dedicated server. Google sign-in only through Firebase Authentication, Cloud Firestore for live data with native realtime listeners, and Cloud Storage for portrait uploads. Target the no-cost allowances on the Blaze plan.
- **Accounts:** guests can view public content; creating characters, campaigns or custom entries requires a public Alias and administrator approval.
- **Campaigns:** no owner role; every campaign DM has equal authority. Joining needs an invite and DM approval.
- **Characters:** placing a character elsewhere always makes an independent copy. Tabs are public by default and can be made private individually.
- **Gameplay:** players review and confirm actions, resources are held, and the DM approves at execution time before resolution changes real state.
- **Sharing:** exported HTML is a live, view-only shell for one character sheet, not an offline snapshot.
- **Discord:** optional account link, required only for a later bot.

## Documentation

Start with [Documentation/Start Here.md](Documentation/Start%20Here.md), then each folder's `x_Directory.md`. Selected system rules live in `Documentation/Systems`. `Documentation/Implementation` holds Architecture and Hosting (stack, layout, testing), Milestones, and Lessons from Character Manager, which lists the previous app's failure modes to design against. [Hearthtable Plan.md](Hearthtable%20Plan.md) is the original planning record; where it differs, the documentation wins. Working rules for editing documentation and coordinating agents are in [AGENTS.md](AGENTS.md).
