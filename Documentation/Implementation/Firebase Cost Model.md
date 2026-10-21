# Firebase Cost Model

This document owns the Firebase estimate and its numerical assumptions. Status: planning only, checked 2026-10-19; no service setup or runtime changes. [Campaigns and Shared Data](../Systems/Campaigns%20and%20Shared%20Data.md#planning-scale-and-cost-model) owns the selected budget direction, user-supplied traffic and immediate Firestore updates with native live listeners. The estimates below calculate that selected update model. Actual edits per day, document sizes and permissions queries remain unmeasured.

## What viewing and navigation cost

Firestore's [realtime listeners](https://firebase.google.com/docs/firestore/query-data/listen) deliver initial data and subsequent changes without a page refresh, once implemented in the app. Commit saved edits and gameplay changes immediately to Firestore; subscribers receive the resulting updates through those listeners. A committed change means a submitted save or state transition, not every keystroke while composing input. The existing program does not already have this integration. Leaving a listener open does not itself incur a per-minute Firestore charge; loading records, receiving changes and reconnecting can incur reads. Each additional browser tab may have its own subscription.

A URL changing from `/home` to `/live_party` has no special directory fee. Downloads and database operations matter. Changing a visible section using already loaded data can cost zero additional reads and writes. Fetching its data anew incurs reads; loading a fresh HTML/app page also transfers static assets. Browsing alone does not edit a character. See [Firestore billing](https://firebase.google.com/docs/firestore/pricing) and [Hosting usage](https://firebase.google.com/docs/hosting/usage-quotas-pricing).

## Daily traffic supplied by the user

| Daily activity | Expected | High case |
|---|---:|---:|
| Unique visitors, not a Firebase billing unit | 15 | 33 |
| Campaign home views kept open | 10 | 33 |
| Additional personal character-sheet tabs | 10 | 25 |
| Guest character-sheet views | 5 | 0 |
| People switching inventory and spells | 5 | 10 |
| Inventory/spells round trips per person | 10 | 10 |
| Total section openings if every round trip fetches twice | 100 | 200 |

For arithmetic, each visitor opens the listed pages once daily, with no additional reloads/reconnections. Unique IPs do not establish billable operations. We interpret “10 times” as ten round trips, twenty section openings; cached sections can avoid these fetches entirely. Open-page duration does not establish the number of edits.

## Explicit modeling inputs

The reproducible numbers live in [Firebase Cost Model.cjs](Firebase%20Cost%20Model.cjs). Run `node 'Documentation/Implementation/Firebase Cost Model.cjs'` from the repository root. This standalone arithmetic script needs no credentials, network or Firebase SDK. Its assertions verify representative calculations, not backend correctness.

These are hypothetical inputs, not facts about the unfinished schema:

- Each campaign home initially reads five 2 KiB documents. Each character view reads ten 10 KiB documents. Each uncached section opening reads one 10 KiB document. Each fresh page downloads a 2 MiB app, even when a browser might reuse it.
- Half of persisted updates concern shared data delivered to all campaign-home viewers; half concern personal data. A personal update reaches one viewer in the high case, or an average 1.5 in the expected case to allow guest viewing. Thus average listeners per update are 17 and 5.75 respectively. Actual visibility determines the audience; these averages never grant access.
- Each update delivers a 2 KiB document. Two additional dependent security-rule reads per delivered record are budgeted as a conservative allowance. Actual rule evaluation can reuse reads or require a different amount. A 1.5 multiplier covers serialized payload-size uncertainty, not SSL overhead charges. Queries use simple document access; complex index scans, validation reads, retries and reconnects would add work.
- Database data including indexes starts at 100 MiB. Retained log/index growth is budgeted at 4 KiB per committed document write; campaign history remains retained. All listed first-month cases stay below 1 GiB; continued history growth eventually changes storage cost.
- Portraits are fifty 1 MiB images, uploaded once. Every home view downloads one portrait per participant (10 or 33), plus one portrait per sheet view, without cache savings. This gives about 3.62 GB/month and 35.04 GB/month respectively, with 3,450 and 33,420 downloads.

Example: expected browsing alone gives `10 × 5 + 15 × 10 + 100 = 300` delivered records/day. Including the rule-read allowance gives 900 billable reads/day. The high case gives 1,845. Cached section switching instead gives 600 and 1,245. Hosting transfer is 50 MiB/day and 116 MiB/day. Those viewing costs fit the allowances below.

## Rates and boundaries

All amounts are USD for 30 identical days, before tax. Free daily quotas are applied per day. This is a sensitivity estimate, not a maximum bill.

| Service | Allowance / rate used |
|---|---|
| Firestore Standard reads | 50,000/day, then $0.03 per 100,000 |
| Firestore Standard writes | 20,000/day, then $0.09 per 100,000 |
| Firestore storage | 1 GiB included |
| Firestore downloads | 10 GiB/month, then $0.12/GiB at the modeled first paid tier/destinations |
| Static Firebase Hosting transfer | 360 MB/day, then $0.15/GB |
| Google sign-in | Within included usage for this group |
| Portrait Storage | Within eligible 5 GB stored, 100 GB downloaded/month, 5,000 upload/Class A and 50,000 download/Class B operations/month |

Sources: [Firestore rates](https://cloud.google.com/firestore/pricing), [Firebase prices](https://firebase.google.com/pricing), [Storage prices and restrictions](https://cloud.google.com/storage/pricing). The database calculation assumes the single eligible default database. Regional prices must be confirmed before setup. Portrait allowances require eligible US storage regions and download destinations, with the allowances otherwise unused. Cloud Storage requires Blaze even if usage stays free; see [Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).

The subtotal includes the listed database, static Hosting, Google sign-in and portrait usage. Optional compute, bot hosting, deployment/build artifacts, additional logging, domain registration and other projects' usage are outside it. No backup or recovery system is included or required by this estimate. Native listeners do not require a separate live relay. Additional backend compute could still be needed after the permissions and transaction design is verified; this subtotal does not promise that every future backend feature has zero compute cost.

## Selected update model: monthly estimates

The user supplied visitor counts, not edit counts. Rather than infer actions from visits, these rows vary the number of committed document writes per day. These are document updates, not player actions; one action can change several documents. Firestore charges per document operation: committing one batch containing one hundred distinct document updates still counts as one hundred writes.

| Traffic | Committed document writes/day | Monthly browser-service subtotal |
|---|---:|---:|
| Expected | 0, browsing only | $0.00 |
| Expected | 400 | $0.00 |
| Expected | 1,000 | $0.00 |
| Expected | 5,000 | $0.33 |
| High | 0, browsing only | $0.00 |
| High | 400 | $0.00 |
| High | 1,000 | $0.03 |
| High | 5,000 | $1.86 |

All rows remain within the write allowance: the paid amounts are listener/rule **read** overages, not write fees. These subtotals use immediate Firestore writes and native listeners, with no delayed compaction or separate relay.

Worked high-case example: 1,000 writes/day yields `(415 initial + 200 section + 1,000 × 17 update deliveries) × 3 = 52,845` reads/day. Overage costs `(52,845 − 50,000) × 30 ÷ 100,000 × $0.03 = $0.025605/month`, rounded to $0.03 in the table.

The modeled shared audience matters more than the visitors merely staying connected. At 5,000 updates/day, increasing each live update from 2 KiB to 10 KiB raises the high-case subtotal to about $5.06/month through download overage. That sensitivity illustrates why the final document layout matters.

## Implementation boundaries

The update-selection authority is [Campaigns and Shared Data](../Systems/Campaigns%20and%20Shared%20Data.md#planning-scale-and-cost-model); this report calculates its service usage rather than selecting a parallel architecture.

Permissions and transactions still need design and verification before implementation. Readable documents must exclude private tab content the viewer cannot access, so separate documents are a proposed privacy boundary. Creating requests and resource holds, then resolving state changes once with DM approval, must preserve the selected [gameplay workflow](../Systems/Spell%20Effects%20and%20Active%20State.md). Firestore does not supply those gameplay or authorization rules automatically.

For the stated planning traffic, modest daily editing can plausibly remain within included service allowances. Higher update rates, larger payloads, additional traffic, additional services and retained-history growth can change the cost. No Firebase setup or production changes are authorized or performed by this estimate.
