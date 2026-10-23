# Currency and Trade

Purpose: owns coins, how money is stored and paid, cost rounding, item market value and trading between characters. Status: coins, storage, payment and rounding were selected 2026-10-23 at 1:53 am PDT (America/Los_Angeles) for Milestone 3. Coins, the wallet and the payment rule are implemented (2026-10-23 at 4:02 am PDT (America/Los_Angeles)); nothing uses the payment rule yet, since shops and crafting jobs come later. Trading and market prices are recorded user ideas, still open.

Selected decisions:

- The five published coins, as inventory items.
- Purchases and crafting debit coins automatically after the player reviews the cost.
- Calculated crafting costs are shown exactly and paid rounded up to the next copper.

Open questions: market value and selling of crafted items; the trade window; bartering with NPCs or the DM. They are listed under [Open design](#open-design).

## Coins — selected 2026-10-23 at 1:53 am PDT (America/Los_Angeles)

The five published coins exist: copper (cp), silver (sp), electrum (ep), gold (gp) and platinum (pp). 1 gp = 10 sp = 2 ep = 100 cp, and 1 pp = 10 gp. Fifty coins of any kind weigh one pound and count toward carried weight, as published.

Coins are stackable inventory items. They can sit loose or in pouches and bags and be dragged like any other item, following the [container rules](Spell%20Containers%20and%20Consumable%20Sources.md). The sheet shows a wallet total summed from the coins the character carries.

## Paying — selected 2026-10-23 at 1:53 am PDT (America/Los_Angeles)

Buying something or starting a crafting job shows the cost for review. On confirmation, the app removes the coins, making change between denominations as needed. The player does not adjust coins by hand for these.

## Rounding — selected 2026-10-23 at 1:53 am PDT (America/Los_Angeles)

- **Calculated costs** keep full precision and are shown exactly. These are costs changed by a bonus, such as Carol's discounted scroll scribing and mounting ([Arcana multiplier](Spell%20Containers%20and%20Consumable%20Sources.md#selected-arcana-multiplier)).
- **Items with a listed price**, such as potions, use that price.
- **Payment** is broken down to copper, the smallest coin, and rounds up to the next whole copper when a fraction remains. The raw price stays visible next to it. For example, 2.23 gp is exactly 223 cp; 8.38 sp is 83.8 cp, so 84 cp is paid and 83.8 cp is shown as the raw price.

## Implementation — 2026-10-23 at 4:02 am PDT (America/Los_Angeles)

The `currency` system adds up every carried coin into the wallet shown on the Inventory tab; coins are the five `core/...Piece` items, each 0.02 lb (50 to the pound) with its value in copper. `planPayment` is the paying rule: the price is rounded up to the next whole copper, coins are taken smallest first, any coin that turns out not to be needed is put back, and change is given in the largest coins. Electrum is spent like any coin but never given as change, because it is rarely used; that detail is an implementation choice the user can change. Carol carries a labelled test purse (3 pp, 25 gp, 2 ep, 14 sp, 37 cp) because her real gold is not set on her sheet (user decision, 2026-10-23 at 4:02 am PDT (America/Los_Angeles)).

## Open design

Recorded 2026-10-23 at 1:53 am PDT (America/Los_Angeles) from the user's notes. These are ideas to address when trading and shops are built, not decisions.

- **Market value is not crafting cost.** A cheaply or quickly crafted item, such as one of Carol's discounted scrolls, should still be listed at a fixed average market price. Use the published price where one exists. Some published prices are ranges: the Dungeon Master's Guide gives magic items wide price bands by rarity. Charisma-based haggling with shopkeepers or the DM could move the final price. How to set the market price, and how haggling works, needs more thought.
- **Trade window.** Trades happen player to player and player to DM. In play, the DM's side is usually an NPC, but it is the DM improvising or following a preset either way.
- **Barter and value matching.** A trade can mix coins and items, for example 50 gp plus seven arrow bundles for a potion. The trade window shows the coin value of each side, calculated from the prices entered in the library, even when no coins change hands. For example, it could show that 20 arrows equal one arrow bundle in gold.
- Selling price, whether a fixed share of the price, a DM-set price or by hand, is still open under [Milestone 3 Plan](../Implementation/Milestone%203%20Plan.md) topic E.
