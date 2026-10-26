import { describe, expect, test } from "vitest";
import type { Line } from "../sheet/drag";
import {
  fireShots,
  prepareAttack,
  suggestShots,
  weaponState,
  type WeaponRules,
} from "./firing";

const SLOTS = ["a", "b", "c"].map((id) => ({ id, label: id.toUpperCase() }));
const RULES: Record<string, WeaponRules> = {
  rifle: {
    name: "Rifle",
    container: { slots: SLOTS, accepts: ["round"] },
    attacks: [
      { id: "burst-2", name: "2 rounds", rounds: 2, allows: ["standard"] },
      { id: "special", name: "Special", rounds: 1, allows: ["special"] },
      {
        id: "precise",
        name: "Precise",
        rounds: 1,
        allows: ["standard"],
        precision: true,
      },
    ],
    weapon: { precisionCharges: 4 },
  },
  basic: {
    name: "Basic",
    tags: ["round"],
    round: {
      class: "standard",
      charges: 1,
      damage: [{ dice: "2d10", type: "Piercing", addsAim: true }],
    },
  },
  frag: {
    name: "Frag",
    tags: ["round"],
    round: {
      class: "special",
      charges: 2,
      save: { ability: "dex", dc: 15, success: "half" },
      damage: [{ dice: "5d6", type: "Piercing" }],
    },
  },
  spellround: {
    name: "Spellround",
    tags: ["round"],
    container: { accepts: ["scroll"] },
    round: { class: "special", charges: 2, payload: "scroll" },
  },
  scroll: { tags: ["scroll"] },
  canister: {},
  bow: {
    name: "Bow",
    container: { slots: [{ id: "nocked" }], accepts: ["arrow"] },
    attacks: [{ id: "fire", name: "Fire", rounds: 1 }],
    weapon: { damage: { dice: "1d6", type: "Piercing" } },
  },
  arrow: { tags: ["arrow"], round: { class: "standard" } },
};
const rulesOf = (ref: string) => RULES[ref];
let n = 0;
const newId = () => `new-${++n}`;

const rifleLines = (): Line[] => [
  { id: "rifle", ref: "rifle", quantity: 1, magazine: { canister: "can" } },
  { id: "can", ref: "canister", quantity: 1, charges: 12 },
  { id: "loaded", ref: "basic", quantity: 1, parent: "rifle", slot: "a" },
  { id: "stock", ref: "basic", quantity: 10 },
  { id: "frag", ref: "frag", quantity: 2 },
];

describe("firing", () => {
  test("a burst fires what is loaded, then loads the next empty chamber", () => {
    const state = weaponState(rifleLines(), "rifle", rulesOf);
    expect(state?.canister?.id).toBe("can");
    const mode = RULES["rifle"]?.attacks?.[0];
    if (!state || !mode) throw new Error("no rifle");
    expect(suggestShots(state, mode, rulesOf, "goblin")).toEqual([
      { fire: "a", target: "goblin" },
      { load: { slot: "b", line: "stock" }, fire: "b", target: "goblin" },
    ]);
  });

  test("firing uses up rounds; the shots hold each round and the charges", () => {
    const mode = RULES["rifle"]?.attacks?.[0];
    const prepared = prepareAttack({
      lines: rifleLines(),
      weaponId: "rifle",
      ...(mode ? { mode } : {}),
      rulesOf,
      fallback: [],
      aimModifier: 6,
    });
    expect(prepared.holds).toEqual({
      lines: { loaded: 1, stock: 1 },
      charges: { can: 2 },
    });
    expect(prepared.shots[0]?.damage).toEqual([
      { dice: "2d10+6", type: "Piercing" },
    ]);
    const run = fireShots(
      rifleLines(),
      "rifle",
      prepared.shots,
      rulesOf,
      newId,
    );
    expect(run.lines.find((l) => l.id === "loaded")).toBeUndefined();
    expect(run.lines.find((l) => l.id === "stock")?.quantity).toBe(9);
    expect(run.lines.filter((l) => l.parent === "rifle")).toEqual([]);
    expect(run.warnings).toEqual([]);
  });

  test("Precision costs its own charges per round", () => {
    const mode = RULES["rifle"]?.attacks?.[2];
    const prepared = prepareAttack({
      lines: rifleLines(),
      weaponId: "rifle",
      ...(mode ? { mode } : {}),
      rulesOf,
      fallback: [],
      aimModifier: 6,
    });
    expect(prepared.holds.charges).toEqual({ can: 4 });
  });

  test("an area round carries its save; a special mode skips standard rounds", () => {
    const mode = RULES["rifle"]?.attacks?.[1];
    const prepared = prepareAttack({
      lines: rifleLines(),
      weaponId: "rifle",
      ...(mode ? { mode } : {}),
      rulesOf,
      fallback: [],
      aimModifier: 6,
    });
    expect(prepared.shots).toHaveLength(1);
    expect(prepared.shots[0]?.load?.line).toBe("frag");
    expect(prepared.shots[0]?.save).toEqual({
      ability: "dex",
      dc: 15,
      success: "half",
    });
    expect(prepared.holds.charges).toEqual({ can: 2 });
  });

  test("a Spellround spends its scroll and the casing stays", () => {
    const lines: Line[] = [
      ...rifleLines(),
      { id: "sr", ref: "spellround", quantity: 1, parent: "rifle", slot: "c" },
      {
        id: "sc",
        ref: "scroll",
        quantity: 1,
        parent: "sr",
        scroll: { spell: "fireball", spent: false },
      },
    ];
    const shots = [{ fire: "c" }];
    const prepared = prepareAttack({
      lines,
      weaponId: "rifle",
      rulesOf,
      shots,
      fallback: [],
      aimModifier: 0,
    });
    expect(prepared.shots[0]?.payload).toBe("sc");
    const run = fireShots(lines, "rifle", shots, rulesOf, newId);
    expect(run.lines.find((l) => l.id === "sr")?.slot).toBe("c");
    expect(run.lines.find((l) => l.id === "sc")?.["scroll"]).toEqual({
      spell: "fireball",
      spent: true,
    });
  });

  test("a bow loads an arrow as part of its shot; clearing empties a chamber", () => {
    const bow: Line[] = [
      { id: "bow", ref: "bow", quantity: 1 },
      { id: "arrows", ref: "arrow", quantity: 20 },
    ];
    const prepared = prepareAttack({
      lines: bow,
      weaponId: "bow",
      ...(RULES["bow"]?.attacks?.[0] ? { mode: RULES["bow"].attacks[0] } : {}),
      rulesOf,
      fallback: [{ dice: "1d6+3", type: "Piercing" }],
      aimModifier: 0,
    });
    expect(prepared.shots[0]?.load).toEqual({ slot: "nocked", line: "arrows" });
    expect(prepared.shots[0]?.damage).toEqual([
      { dice: "1d6+3", type: "Piercing" },
    ]);
    expect(prepared.holds).toEqual({ lines: { arrows: 1 } });
    const run = fireShots(bow, "bow", prepared.shots, rulesOf, newId);
    expect(run.lines.find((l) => l.id === "arrows")?.quantity).toBe(19);

    const cleared = fireShots(
      rifleLines(),
      "rifle",
      [{ clear: "a" }],
      rulesOf,
      newId,
    );
    expect(
      cleared.lines.find((l) => l.id === "loaded")?.parent,
    ).toBeUndefined();
  });

  test("firing an empty chamber only warns", () => {
    const run = fireShots(
      rifleLines(),
      "rifle",
      [{ fire: "b" }],
      rulesOf,
      newId,
    );
    expect(run.fired).toEqual([]);
    expect(run.warnings).toEqual(["B has nothing loaded."]);
  });
});
