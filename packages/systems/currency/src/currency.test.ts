import { describe, expect, test } from "vitest";
import { emptyPurse, formatPurse, planPayment, type Purse } from "./index";

const purse = (p: Partial<Purse>): Purse => ({ ...emptyPurse(), ...p });

describe("paying (Currency and Trade, Paying and Rounding)", () => {
  test("2.23 gp is exactly 223 cp; change comes back in the largest coins", () => {
    const plan = planPayment(purse({ gp: 5 }), 2.23 * 100);
    expect(plan).toMatchObject({
      ok: true,
      chargedCp: 223,
      spend: purse({ gp: 3 }),
      change: purse({ sp: 7, cp: 7 }),
      after: purse({ gp: 2, sp: 7, cp: 7 }),
    });
  });

  test("8.38 sp is 83.8 cp: 84 cp are paid and the raw price is kept", () => {
    const plan = planPayment(purse({ sp: 9 }), 83.8);
    expect(plan).toMatchObject({ ok: true, rawCp: 83.8, chargedCp: 84 });
    expect(plan.ok && formatPurse(plan.after)).toBe("6 cp");
  });

  test("small coins go first, and coins not needed are put back", () => {
    const plan = planPayment(purse({ cp: 9, gp: 1, pp: 1 }), 15);
    // The copper alone is not enough, so a gold piece is needed; then the copper is not.
    expect(plan.ok && plan.spend).toEqual(purse({ gp: 1 }));
    expect(plan.ok && plan.change).toEqual(purse({ sp: 8, cp: 5 }));
    expect(plan.ok && plan.after).toEqual(purse({ cp: 14, sp: 8, pp: 1 }));
  });

  test("electrum is spent but never given as change", () => {
    const plan = planPayment(purse({ ep: 3 }), 60);
    expect(plan.ok && plan.after).toEqual(purse({ ep: 1, sp: 4 }));
  });

  test("not enough money says how much is missing", () => {
    expect(planPayment(purse({ gp: 1 }), 150.5)).toEqual({
      ok: false,
      rawCp: 150.5,
      shortCp: 51,
    });
  });
});
