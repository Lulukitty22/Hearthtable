import { describe, expect, it } from "vitest";
import { parseGrant } from "./grants";

describe("spell-formula grants", () => {
  it("read Empowered Evocation's declaration", () => {
    const parsed = parseGrant(
      {
        type: "spell-formula",
        role: "damage",
        amount: { key: "abilities.int.modifier" },
        when: { school: "Evocation", class: "core/Classes/Wizard" },
        once: true,
      },
      "x",
    );
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        type: "spell-formula",
        role: "damage",
        amount: { key: "abilities.int.modifier" },
        when: { school: "Evocation", class: "core/Classes/Wizard" },
        once: true,
      },
    });
  });

  it("refuse unknown roles and conditions instead of guessing", () => {
    expect(
      parseGrant({ type: "spell-formula", role: "range", amount: 1 }, "x").ok,
    ).toBe(false);
    expect(
      parseGrant(
        {
          type: "spell-formula",
          role: "damage",
          amount: 1,
          when: { level: "3" },
        },
        "x",
      ).ok,
    ).toBe(false);
  });
});
