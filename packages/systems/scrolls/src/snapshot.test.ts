import { describe, expect, test } from "vitest";
import type { SourcedGrant } from "@hearthtable/kernel";
import { buildSnapshot, type SnapshotInput } from "./snapshot";

const WIZARD = {
  id: "core/Classes/Wizard",
  name: "Wizard",
  ability: "int",
  dc: 17,
  attack: 9,
};
const CLERIC = {
  ...WIZARD,
  id: "core/Classes/Cleric",
  name: "Cleric",
  ability: "wis",
  dc: 13,
  attack: 5,
};
const EMPOWERED: SourcedGrant = {
  grant: {
    type: "spell-formula",
    role: "damage",
    amount: { key: "abilities.int.modifier" },
    when: { school: "Evocation", class: "core/Classes/Wizard" },
    once: true,
  },
  source: {
    id: "core/Features/Empowered_Evocation",
    label: "Empowered Evocation",
  },
};
const numbers: Record<string, number> = {
  "abilities.int.modifier": 5,
  "abilities.wis.modifier": 1,
};
const input = (over: Partial<SnapshotInput>): SnapshotInput => ({
  spell: {},
  castLevel: 1,
  characterLevel: 14,
  casters: [WIZARD, CLERIC],
  grants: [EMPOWERED],
  number: (k) => numbers[k],
  ...over,
});
const FIREBALL = {
  level: 3,
  school: "Evocation",
  classes: ["core/Classes/Wizard"],
  effect: {
    damage: [{ dice: "8d6", type: "Fire" }],
    scaling: { kind: "slot", per: "1d6", of: "damage" },
  },
};

describe("the scroll snapshot builder", () => {
  test("Fireball upcast at 5 with Empowered Evocation once", () => {
    expect(buildSnapshot(input({ spell: FIREBALL, castLevel: 5 }))).toEqual({
      casterClass: "core/Classes/Wizard",
      spellSaveDC: 17,
      spellAttackBonus: 9,
      formulas: [
        {
          role: "damage",
          dice: "10d6",
          type: "Fire",
          bonuses: [{ source: "Empowered Evocation", value: 5, once: true }],
        },
      ],
    });
  });

  test("healing adds the spellcasting modifier of a class that lists the spell", () => {
    const snap = buildSnapshot(
      input({
        spell: {
          level: 1,
          school: "Abjuration",
          classes: ["core/Classes/Cleric"],
          effect: {
            healing: { dice: "2d8", addsModifier: true },
            scaling: { kind: "slot", per: "2d8", of: "healing" },
          },
        },
        castLevel: 2,
      }),
    );
    expect(snap.casterClass).toBe("core/Classes/Cleric");
    expect(snap.formulas).toEqual([
      {
        role: "healing",
        dice: "4d8",
        bonuses: [{ source: "Cleric spellcasting modifier", value: 1 }],
      },
    ]);
  });

  test("a cantrip uses the scribe's level; a type bonus waits for the choice", () => {
    const typed: SourcedGrant = {
      grant: {
        type: "spell-formula",
        role: "damage",
        amount: 2,
        when: { damageType: "Fire" },
      },
      source: { id: "x", label: "Fire focus" },
    };
    const bolt = buildSnapshot(
      input({
        spell: {
          level: 0,
          school: "Evocation",
          classes: ["core/Classes/Wizard"],
          effect: {
            damage: [{ dice: "1d10", type: "Fire" }],
            scaling: {
              kind: "cantrip",
              dice: ["1d10", "2d10", "3d10", "4d10"],
            },
          },
        },
        castLevel: 0,
        grants: [typed],
      }),
    );
    expect(bolt.formulas[0]).toMatchObject({
      dice: "3d10",
      bonuses: [{ value: 2 }],
    });
    const orb = buildSnapshot(
      input({
        spell: {
          level: 1,
          school: "Evocation",
          classes: ["core/Classes/Wizard"],
          effect: {
            damage: [
              { dice: "3d8", type: "Acid, Cold, Fire, Lightning or Thunder" },
            ],
          },
        },
        grants: [typed],
      }),
    );
    expect(orb.formulas[0]?.bonuses).toEqual([
      { source: "Fire focus", value: 2, when: { damageType: "Fire" } },
    ]);
  });
});
