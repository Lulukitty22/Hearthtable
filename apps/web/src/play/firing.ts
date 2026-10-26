// Firing a weapon (Milestone 5 S10; Aetherlock Engineered Rounds, "Firing, loading and clearing in
// play"). A weapon offers attack actions as data (`attacks`): the Aetherlock's bursts and its
// single-shot modes, a bow's or crossbow's shot, a melee weapon's attack. Each round of the chosen
// action can load a slot (with a round from the inventory), fire a slot and clear one afterwards;
// loading is part of the attack. These plain functions work over stored inventory lines: the
// review uses them to suggest shots and to work out what the request holds, and resolution runs
// the same steps to change the inventory. Firing with nothing loaded only warns.

import type { Holds, Shot } from "@hearthtable/play";
import { moveItem, type ItemRules, type Line } from "../sheet/drag";

export interface AttackMode {
  readonly id: string;
  readonly name: string;
  /** How many rounds it fires; 0 for a melee attack. */
  readonly rounds: number;
  /** Round classes it may fire, e.g. `standard` (Basic and Arcane) or `special`. */
  readonly allows?: readonly string[];
  /** Precision: Advantage on each shot, at the weapon's precision charge cost. */
  readonly precision?: boolean;
}

export interface Part {
  readonly dice: string;
  readonly type?: string;
}

export interface RoundRules {
  readonly class?: string;
  readonly charges?: number;
  readonly damage?: readonly (Part & { readonly addsAim?: boolean })[];
  readonly save?: {
    readonly ability: string;
    readonly dc: number;
    readonly success: string;
  };
  readonly area?: string;
  readonly payload?: "scroll";
}

export interface WeaponRules extends Omit<ItemRules, "container"> {
  readonly name?: string;
  readonly attacks?: readonly AttackMode[];
  readonly weapon?: {
    readonly kind?: string;
    readonly damage?: Part;
    readonly precisionCharges?: number;
  };
  readonly round?: RoundRules;
  readonly container?: Omit<NonNullable<ItemRules["container"]>, "slots"> & {
    readonly slots?: readonly {
      readonly id: string;
      readonly label?: string;
    }[];
  };
}

export type RulesOf = (ref: string) => WeaponRules | undefined;

export interface WeaponState {
  readonly weapon: Line;
  readonly rules: WeaponRules;
  readonly slots: readonly {
    readonly id: string;
    readonly label: string;
    readonly round?: Line;
  }[];
  /** Rounds in the inventory that fit the weapon, with how many are free to use. */
  readonly rounds: readonly { readonly line: Line; readonly free: number }[];
  readonly canister?: Line;
}

const nameOf = (rulesOf: RulesOf, ref: string) =>
  rulesOf(ref)?.name ?? ref.split("/").at(-1)?.replaceAll("_", " ") ?? ref;

/** A weapon's slots and what each holds, the rounds that fit it, and its installed canister. */
export function weaponState(
  lines: readonly Line[],
  weaponId: string,
  rulesOf: RulesOf,
  held: Readonly<Record<string, number>> = {},
): WeaponState | undefined {
  const weapon = lines.find((l) => l.id === weaponId);
  const rules = weapon && rulesOf(weapon.ref);
  if (!weapon || !rules) return undefined;
  const accepts = rules.container?.accepts ?? [];
  const canisterId = (weapon["magazine"] as { canister?: string } | undefined)
    ?.canister;
  const canister = lines.find((l) => l.id === canisterId);
  return {
    weapon,
    rules,
    slots: (rules.container?.slots ?? []).map((s) => {
      const round = lines.find((l) => l.parent === weaponId && l.slot === s.id);
      return { id: s.id, label: s.label ?? s.id, ...(round ? { round } : {}) };
    }),
    rounds: lines
      .filter(
        (l) =>
          l.parent !== weaponId &&
          l.slot === undefined &&
          !l["lost"] &&
          (rulesOf(l.ref)?.tags ?? []).some((t) => accepts.includes(t)),
      )
      .map((line) => ({
        line,
        free: Math.max(0, line.quantity - (held[line.id] ?? 0)),
      }))
      .filter((r) => r.free > 0),
    ...(canister ? { canister } : {}),
  };
}

/** Whether an attack mode may fire this round. */
export function allows(mode: AttackMode, round: RoundRules | undefined) {
  return !mode.allows || mode.allows.includes(round?.class ?? "standard");
}

/**
 * Suggested shots for an attack mode: fire what is already loaded first, then load the next
 * empty slot from the first fitting round in the inventory and fire it. A melee attack (no
 * rounds) is a single shot with nothing to fire.
 */
export function suggestShots(
  state: WeaponState,
  mode: AttackMode,
  rulesOf: RulesOf,
  target?: string,
): Shot[] {
  if (mode.rounds === 0) return [{ ...(target ? { target } : {}) }];
  const used = new Set<string>();
  const left = new Map(state.rounds.map((r) => [r.line.id, r.free]));
  const fits = (l: Line) => allows(mode, rulesOf(l.ref)?.round);
  const shots: Shot[] = [];
  for (let i = 0; i < mode.rounds; i++) {
    const t = target ? { target } : {};
    const loaded = state.slots.find(
      (s) => s.round && !used.has(s.id) && fits(s.round),
    );
    if (loaded) {
      used.add(loaded.id);
      shots.push({ fire: loaded.id, ...t });
      continue;
    }
    const empty =
      state.slots.find((s) => !s.round && !used.has(s.id)) ??
      state.slots.find((s) => !used.has(s.id));
    const source = state.rounds.find(
      (r) => fits(r.line) && (left.get(r.line.id) ?? 0) > 0,
    );
    if (empty && source && !empty.round) {
      used.add(empty.id);
      left.set(source.line.id, (left.get(source.line.id) ?? 0) - 1);
      shots.push({
        load: { slot: empty.id, line: source.line.id },
        fire: empty.id,
        ...t,
      });
    } else if (empty) {
      used.add(empty.id);
      shots.push({ fire: empty.id, ...t });
    } else shots.push({ ...t });
  }
  return shots;
}

export interface Fired {
  readonly shot: number;
  readonly line: Line;
}

export interface Firing {
  readonly lines: Line[];
  /** The stored lines the shots use: each round loaded, and each fired that was already loaded. */
  readonly used: Record<string, number>;
  readonly fired: readonly Fired[];
  readonly warnings: readonly string[];
}

/**
 * Runs the shots in order over the weapon's inventory: each loads its slot, fires and clears.
 * A fired round is used up, except a Spellround, whose scroll is spent and casing stays.
 */
export function fireShots(
  lines: readonly Line[],
  weaponId: string,
  shots: readonly Shot[],
  rulesOf: RulesOf,
  newId: () => string,
): Firing {
  let out = [...lines];
  const stored = new Set(lines.map((l) => l.id));
  const loadedNow = new Set<string>();
  const held: Record<string, number> = {};
  const fired: Fired[] = [];
  const warnings: string[] = [];
  const hold = (id: string) => {
    if (stored.has(id)) held[id] = (held[id] ?? 0) + 1;
  };
  const labelOf = (slot: string) =>
    rulesOf(
      lines.find((l) => l.id === weaponId)?.ref ?? "",
    )?.container?.slots?.find((s) => s.id === slot)?.label ?? slot;
  const inSlot = (slot: string) =>
    out.find((l) => l.parent === weaponId && l.slot === slot);

  shots.forEach((shot, i) => {
    const n = shots.length > 1 ? `Shot ${i + 1}: ` : "";
    if (shot.load) {
      const { slot, line } = shot.load;
      if (inSlot(slot))
        warnings.push(`${n}${labelOf(slot)} already holds a round.`);
      let made: string | undefined;
      const moved = moveItem(
        out,
        line,
        { kind: "slot", lineId: weaponId, slot },
        1,
        rulesOf,
        () => (made = newId()),
      );
      if (!moved.ok) warnings.push(`${n}${moved.reason}`);
      else {
        out = moved.lines;
        hold(line);
        loadedNow.add(made ?? line);
      }
    }
    if (shot.fire) {
      const round = inSlot(shot.fire);
      if (!round)
        warnings.push(`${n}${labelOf(shot.fire)} has nothing loaded.`);
      else {
        if (!loadedNow.has(round.id)) hold(round.id);
        fired.push({ shot: i, line: round });
        if (rulesOf(round.ref)?.round?.payload === "scroll") {
          const scroll = out.find(
            (l) =>
              l.parent === round.id &&
              !(l["scroll"] as { spent?: boolean } | undefined)?.spent,
          );
          if (!scroll)
            warnings.push(
              `${n}${nameOf(rulesOf, round.ref)} holds no unspent scroll.`,
            );
          out = out.map((l) =>
            l.id === scroll?.id
              ? { ...l, scroll: { ...(l["scroll"] as object), spent: true } }
              : l,
          );
        } else
          out =
            round.quantity > 1
              ? out.map((l) =>
                  l.id === round.id ? { ...l, quantity: l.quantity - 1 } : l,
                )
              : out.filter((l) => l.id !== round.id);
      }
    }
    if (shot.clear) {
      const round = inSlot(shot.clear);
      if (round) {
        const moved = moveItem(
          out,
          round.id,
          { kind: "root" },
          round.quantity,
          rulesOf,
          newId,
        );
        if (moved.ok) out = moved.lines;
      }
    }
  });
  return { lines: out, used: held, fired, warnings };
}

/** Charges an attack spends from the weapon's canister: each fired round's, or Precision's. */
export function chargesFor(
  firing: Firing,
  mode: AttackMode | undefined,
  rules: WeaponRules,
  rulesOf: RulesOf,
): number {
  return firing.fired.reduce(
    (n, f) =>
      n +
      (mode?.precision
        ? (rules.weapon?.precisionCharges ?? 1)
        : (rulesOf(f.line.ref)?.round?.charges ?? 0)),
    0,
  );
}

/** What an attack's shots hold: the rounds and, with a canister, its charges. */
export function holdsFor(
  state: WeaponState | undefined,
  firing: Firing | undefined,
  mode: AttackMode | undefined,
  rulesOf: RulesOf,
): Holds {
  if (!state || !firing) return {};
  const charges = chargesFor(firing, mode, state.rules, rulesOf);
  return {
    lines: firing.used,
    ...(state.canister && charges > 0
      ? { charges: { [state.canister.id]: charges } }
      : {}),
  };
}

/**
 * Fills in each shot from the round it fires: its damage (the round's, with the aim modifier
 * where it adds it, or the weapon's own), an area round's save, or a Spellround's scroll.
 */
export function describeShots(
  shots: readonly Shot[],
  firing: Firing | undefined,
  rulesOf: RulesOf,
  fallback: readonly Part[],
  aimModifier: number,
  lines: readonly Line[],
): Shot[] {
  return shots.map((shot, i) => {
    const line = firing?.fired.find((f) => f.shot === i)?.line;
    const round = line ? rulesOf(line.ref)?.round : undefined;
    const base = { ...shot, ...(line ? { round: line.ref } : {}) };
    if (round?.payload === "scroll") {
      const scroll = lines.find(
        (l) =>
          l.parent === line?.id &&
          !(l["scroll"] as { spent?: boolean } | undefined)?.spent,
      );
      return scroll ? { ...base, payload: scroll.id } : base;
    }
    const damage = round?.damage?.length
      ? round.damage.map((d) => ({
          dice:
            d.addsAim && aimModifier
              ? `${d.dice}${aimModifier < 0 ? "-" : "+"}${Math.abs(aimModifier)}`
              : d.dice,
          ...(d.type ? { type: d.type } : {}),
        }))
      : fallback;
    return {
      ...base,
      ...(damage.length ? { damage } : {}),
      ...(round?.save ? { save: round.save } : {}),
    };
  });
}

/**
 * Everything a review needs for an attack: the weapon's state, the shots (suggested for the
 * mode unless given) filled in from what they fire, what they hold and any warnings.
 */
export function prepareAttack(o: {
  readonly lines: readonly Line[];
  readonly held?: Readonly<Record<string, number>>;
  readonly weaponId?: string;
  readonly mode?: AttackMode;
  readonly rulesOf: RulesOf;
  readonly shots?: readonly Shot[];
  readonly target?: string;
  readonly fallback: readonly Part[];
  readonly aimModifier: number;
}) {
  const state = o.weaponId
    ? weaponState(o.lines, o.weaponId, o.rulesOf, o.held)
    : undefined;
  const planned =
    o.shots ??
    (state && o.mode
      ? suggestShots(state, o.mode, o.rulesOf, o.target)
      : [o.target ? { target: o.target } : {}]);
  let k = 0;
  const firing = state
    ? fireShots(
        o.lines,
        state.weapon.id,
        planned,
        o.rulesOf,
        () => `preview-${k++}`,
      )
    : undefined;
  return {
    state,
    shots: describeShots(
      planned,
      firing,
      o.rulesOf,
      o.fallback,
      o.aimModifier,
      o.lines,
    ),
    holds: holdsFor(state, firing, o.mode, o.rulesOf),
    warnings: firing?.warnings ?? [],
  };
}
