# Implementation Table of Contents

This folder holds implementation planning for Hearthtable. No runtime code exists yet; nothing here claims that documented designs already run.

| File | Contents |
|---|---|
| [Architecture and Hosting](Architecture%20and%20Hosting.md) | Owns the browser-plus-Firebase hosting decision, Security Rules scope, stack, repository layout, testing strategy and emulator development. Lists deferred compute and first-administrator seeding. |
| [Milestones](Milestones.md) | Owns the milestone roadmap, each milestone's acceptance criteria, the Milestone 2 build steps and the feature inventory. |
| [Lessons from Character Manager](Lessons%20from%20Character%20Manager.md) | Failure modes found in the previous application, written as requirements to design against. It also keeps record-content requirements and LLM proposals whose only home was the old runtime guide. |
| [Firebase Cost Model](Firebase%20Cost%20Model.md) | Owns the dated USD estimates and workload assumptions for the selected immediate Firestore updates and native live listeners. It distinguishes calculated browser-service costs from additional backend and bot costs. |
| [Firebase Cost Model.cjs](Firebase%20Cost%20Model.cjs) | Reproduces the estimate and sensitivity scenarios without Firebase access or production writes. Rates and assumptions are inputs, not measured usage or spending caps. |
