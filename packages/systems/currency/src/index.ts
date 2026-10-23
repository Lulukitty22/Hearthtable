// Coins and paying (Currency and Trade). Coins are ordinary stackable inventory items whose
// definition says what one coin is worth (`coin.valueCp`); 50 coins weigh a pound through the
// item's own weight. The wallet adds up every coin the character carries, wherever it is packed.
//
// `planPayment` is the paying rule, ready for shops and crafting jobs: the price is broken down
// to copper and rounded up to the next whole copper (the raw price stays visible), coins are
// taken smallest first without overpaying more than needed, and change is given back in the
// largest coins. Electrum is never given as change; it is spent like any other coin.

import type { LineRow } from "@hearthtable/system-containers";
import {
  DERIVATIONS_POINT,
  known,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";

export const DENOMINATIONS = [
  { symbol: "cp", valueCp: 1 },
  { symbol: "sp", valueCp: 10 },
  { symbol: "ep", valueCp: 50 },
  { symbol: "gp", valueCp: 100 },
  { symbol: "pp", valueCp: 1000 },
] as const;
export type Symbol = (typeof DENOMINATIONS)[number]["symbol"];
export type Purse = Readonly<Record<Symbol, number>>;

const CHANGE: readonly Symbol[] = ["pp", "gp", "sp", "cp"];
const value = (s: Symbol) =>
  DENOMINATIONS.find((d) => d.symbol === s)?.valueCp ?? 0;
export const emptyPurse = (): Record<Symbol, number> => ({
  cp: 0,
  sp: 0,
  ep: 0,
  gp: 0,
  pp: 0,
});
export const purseCp = (p: Purse) =>
  DENOMINATIONS.reduce((n, d) => n + p[d.symbol] * d.valueCp, 0);

/** A purse written the usual way, largest coin first: "3 pp, 25 gp, 37 cp". */
export function formatPurse(p: Purse): string {
  const parts = [...DENOMINATIONS]
    .reverse()
    .filter((d) => p[d.symbol] > 0)
    .map((d) => `${p[d.symbol]} ${d.symbol}`);
  return parts.length > 0 ? parts.join(", ") : "no coins";
}

export type PaymentPlan =
  | {
      readonly ok: true;
      /** The exact price in copper, which may have a fraction. */
      readonly rawCp: number;
      /** What is actually paid: the price rounded up to a whole copper. */
      readonly chargedCp: number;
      readonly spend: Purse;
      readonly change: Purse;
      readonly after: Purse;
    }
  | { readonly ok: false; readonly rawCp: number; readonly shortCp: number };

export function planPayment(purse: Purse, priceCp: number): PaymentPlan {
  const rawCp = priceCp;
  // Rounding noise (2.23 gp is 222.99999… cp in binary) must not cost an extra copper.
  const chargedCp = Math.ceil(Math.round(priceCp * 1e6) / 1e6);
  const total = purseCp(purse);
  if (total < chargedCp)
    return { ok: false, rawCp, shortCp: chargedCp - total };

  // Take coins smallest first until the price is covered...
  const spend = emptyPurse();
  let paid = 0;
  for (const d of DENOMINATIONS) {
    while (paid < chargedCp && spend[d.symbol] < purse[d.symbol]) {
      spend[d.symbol]++;
      paid += d.valueCp;
    }
  }
  // ...then put back any coin that is not needed, largest first, so nothing is overpaid twice.
  for (const d of [...DENOMINATIONS].reverse()) {
    while (spend[d.symbol] > 0 && paid - d.valueCp >= chargedCp) {
      spend[d.symbol]--;
      paid -= d.valueCp;
    }
  }
  const change = emptyPurse();
  let owed = paid - chargedCp;
  for (const s of CHANGE) {
    change[s] = Math.floor(owed / value(s));
    owed -= change[s] * value(s);
  }
  const after = emptyPurse();
  for (const d of DENOMINATIONS)
    after[d.symbol] = purse[d.symbol] - spend[d.symbol] + change[d.symbol];
  return { ok: true, rawCp, chargedCp, spend, change, after };
}

export interface Wallet {
  readonly purse: Purse;
  readonly totalCp: number;
  /** Coin lines, so a payment can later debit the right stacks. */
  readonly lines: readonly {
    readonly lineId: string;
    readonly symbol: Symbol;
  }[];
}

function wallet(ctx: ResolveContext): Value<Wallet> {
  const rows = ctx.get<readonly LineRow[]>("containers.lines");
  if (rows.kind === "unresolved") return rows;
  const purse = emptyPurse();
  const lines: { lineId: string; symbol: Symbol }[] = [];
  for (const row of rows.value) {
    const coin = (
      row.definition as { coin?: { valueCp?: unknown } } | undefined
    )?.coin;
    const d = DENOMINATIONS.find((x) => x.valueCp === coin?.valueCp);
    if (!d || (row.line as { lost?: unknown }).lost) continue;
    purse[d.symbol] += row.line.quantity;
    lines.push({ lineId: row.line.id, symbol: d.symbol });
  }
  const totalCp = purseCp(purse);
  return known({ purse, totalCp, lines }, "Wallet", {
    note: `${formatPurse(purse)} = ${totalCp / 100} gp`,
  });
}

export const currency: KernelModule = {
  manifest: {
    id: "currency",
    version: "1.0.0",
    requires: [{ id: "containers", range: "^1.0.0" }],
    extends: [DERIVATIONS_POINT],
    provides: {},
  },
  setup: (ctx) =>
    ctx.extend(DERIVATIONS_POINT, { key: "currency.wallet", compute: wallet }),
};
