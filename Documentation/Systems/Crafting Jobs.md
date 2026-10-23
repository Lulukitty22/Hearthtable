# Crafting Jobs

Purpose: owns how a crafting job runs from start to finish: rates, payment, progress, and which recipes exist. Status: rules selected 2026-10-23 at 1:53 am PDT (America/Los_Angeles); building them moves to Milestone 5b, Crafting ([Milestones](../Implementation/Milestones.md)). Only cost calculation for scrolls exists today (the `scroll-crafting` system).

Selected decisions:

- Work happens in paid stretches of up to one eight-hour workday.
- Each stretch locks the rate that applies when it is paid; changes apply from the next stretch.
- Progress is marked by hand until the Milestone 5 game clock exists.

Open questions: the shortest stretch that can be paid; listed under [Open design](#open-design).

## Rates and stretches — selected 2026-10-23 at 1:53 am PDT (America/Los_Angeles)

A job's cost and time come from the crafter's current values, for example the [Arcana multiplier](Spell%20Containers%20and%20Consumable%20Sources.md#selected-arcana-multiplier) for scrolls. Temporary bonuses count for as long as they last.

The crafter pays up front for the next stretch of work, at most one eight-hour workday, at the rate that applies at that moment. That rate holds for the whole stretch. A level up, or a bonus gained or lost partway through, takes effect from the next stretch paid for. If nothing changes, every stretch uses the starting rate, so the job ends exactly as calculated at the start. If something changes, the job's stretches carry different rates and the total is their combination: starting early is never penalised, and a later bonus helps only the work still to do. The job log records each stretch with its rate.

More than one workday can be crammed into a calendar day; each eight hours is its own stretch.

## Progress — selected 2026-10-23 at 1:53 am PDT (America/Los_Angeles)

A job shows its required time and the progress made. Until the game clock exists in Milestone 5, the player or the DM marks progress or completion by hand. With the game clock, progress follows game time.

## Recipes

These all wait for Milestone 5b; their cost rules are owned elsewhere:

- Scroll scribing, including upcast scrolls, and scroll mounting and removal ([Spell Containers](Spell%20Containers%20and%20Consumable%20Sources.md#scribing-mounting-and-removal)).
- Aetherlock rounds: Basic, Arcane, HEDP and Spellround assembly ([Aetherlock Costs and Damage](../Class%20Reference/Aetherlock%20Costs%20and%20Damage.md)).
- Canister refills ([Aetherlock Engineered Rounds](../Class%20Reference/Aetherlock%20Engineered%20Rounds.md#canister-economy)).
- Magic items by rarity, Artificer replicas and elixirs (needs spec).

Until then, scrolls may be dragged into and out of spellbooks freely, and the app shows what mounting or removal would cost; paying for it comes with the job system.

## Open design

- **Shortest stretch.** The user suggested stretches could be shorter than a workday: anything from one to eight hours, then half an hour, down to the job's remaining time (for example a cantrip mounting of a few minutes). Settle the smallest stretch when 5b is built.
- Coins are paid as [Currency and Trade](Currency%20and%20Trade.md#paying--selected-2026-10-23-at-153-am-pdt-americalos_angeles) describes.
