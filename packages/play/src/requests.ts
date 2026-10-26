// Requests and holds (Spell Effects and Active State, "Casting workflow", "Queued resource
// holds", "Capped-resource replenishment" and "Competing submissions and request revisions";
// Milestone 5 S6). Reviewing an action shows its costs; confirming it creates a request that
// holds them, so they cannot fund anything else, until the request resolves (S7), or is
// cancelled or rejected, which returns them.
//
// Holds are kept with the request and subtracted from what the character can use, never
// written into the sheet: a held spell slot counts as used, a held potion is not there to use.
// Returning a hold is the request leaving the queue, so it happens exactly once. A capped
// resource never shows more than its maximum, which gives the selected replenishment rule: a
// rest restores the sheet in full, and a hold returned afterwards is discarded.
//
// What an action holds comes from its request kind, a module registered here, as activity types
// are (casting a spell now; using items and firing the Aetherlock in S10).

import type { BudgetKind } from "./turns";

/** What a request holds, by resource. */
export interface Holds {
  /** Spell slots by level ("1" to "9"). */
  readonly slots?: Readonly<Record<string, number>>;
  /** Inventory lines by id: how many of the stack (a scroll, a potion). */
  readonly lines?: Readonly<Record<string, number>>;
  /** Limited-use resource pools by name. */
  readonly pools?: Readonly<Record<string, number>>;
  /** Charges in a canister, by its line id (S10). */
  readonly charges?: Readonly<Record<string, number>>;
}

export type Timing = "instant" | "next-turn";
export const TIMING_NAMES: Readonly<Record<Timing, string>> = {
  instant: "Instant",
  "next-turn": "Next Turn",
};

/** What a request kind may know about the acting character. */
export interface RequestFacts {
  readonly name: string;
  /** Spell slots usable now by level, after holds. */
  readonly slots: Readonly<Record<string, number>>;
  /** Inventory lines usable now (quantity after holds). */
  readonly lines: Readonly<Record<string, number>>;
}

export interface RequestKind<I = Readonly<Record<string, unknown>>> {
  readonly id: string;
  /** What it holds. */
  holds(input: I): Holds;
  /** The action budget it uses, if any. */
  budget(input: I): BudgetKind | undefined;
  /** "Cast Mage Armor at level 1 from Combat", for the queue and the log. */
  describe(input: I): string;
  /** What the rules say against it right now; they only warn. */
  warnings(input: I, facts: RequestFacts): string[];
}

const kinds = new Map<string, RequestKind>();

export function registerRequestKind<I>(kind: RequestKind<I>) {
  kinds.set(kind.id, kind as unknown as RequestKind);
}

export function requestKind(id: string): RequestKind | undefined {
  return kinds.get(id);
}

/** Adds holds together, e.g. every open request of one character. */
export function addHolds(list: readonly Holds[]): Required<Holds> {
  const out = { slots: {}, lines: {}, pools: {}, charges: {} } as {
    slots: Record<string, number>;
    lines: Record<string, number>;
    pools: Record<string, number>;
    charges: Record<string, number>;
  };
  for (const h of list)
    for (const part of ["slots", "lines", "pools", "charges"] as const)
      for (const [k, n] of Object.entries(h[part] ?? {}))
        out[part][k] = (out[part][k] ?? 0) + n;
  return out;
}

/** "one level-3 spell slot, the scroll": what a hold is, for the review and the log. */
export function describeHolds(
  h: Holds,
  lineName: (id: string) => string = (id) => id,
): string {
  const parts = [
    ...Object.entries(h.slots ?? {}).map(
      ([level, n]) =>
        `${n === 1 ? "one" : n} level-${level} spell slot${n === 1 ? "" : "s"}`,
    ),
    ...Object.entries(h.lines ?? {}).map(
      ([id, n]) => `${n === 1 ? "" : `${n} × `}${lineName(id)}`,
    ),
    ...Object.entries(h.charges ?? {}).map(
      ([id, n]) => `${n} charge${n === 1 ? "" : "s"} from ${lineName(id)}`,
    ),
    ...Object.entries(h.pools ?? {}).map(
      ([pool, n]) => `${n} ${pool.replaceAll("-", " ")}`,
    ),
  ];
  return parts.length ? parts.join(", ") : "nothing";
}

/** Casting a spell, from a spellbook (a slot unless a cantrip) or from a scroll (the scroll). */
export interface CastInput {
  readonly spell: string;
  readonly name: string;
  /** The spell's own level; 0 for a cantrip. */
  readonly level: number;
  /** The level it is cast at (a scroll: the level it was scribed at). */
  readonly castLevel: number;
  /** As written, e.g. "Action", "Bonus Action", "Reaction, which you take when…". */
  readonly castingTime: string;
  readonly source:
    | { readonly kind: "book"; readonly title: string }
    | { readonly kind: "scroll"; readonly lineId: string };
  /** Targets or anything else the player wants the DM to know. */
  readonly note?: string;
  /** Who the player picked as targets (record paths); the DM may change them (S7). */
  readonly targets?: readonly string[];
  /** The concentration effect this cast ends when it begins, at full capacity (S7). */
  readonly replaces?: string;
}

export function budgetOfCastingTime(text: string): BudgetKind | undefined {
  const t = text.toLowerCase();
  if (t.startsWith("bonus action")) return "bonus";
  if (t.startsWith("reaction")) return "reaction";
  // An Action, and longer castings, which take the Magic action on each turn.
  return t ? "action" : undefined;
}

export const castSpell: RequestKind<CastInput> = {
  id: "cast-spell",
  holds: (i) =>
    i.source.kind === "scroll"
      ? { lines: { [i.source.lineId]: 1 } }
      : i.level === 0
        ? {}
        : { slots: { [String(i.castLevel)]: 1 } },
  budget: (i) => budgetOfCastingTime(i.castingTime),
  describe: (i) =>
    `Cast ${i.name}${i.level === 0 ? "" : ` at level ${i.castLevel}`} ${i.source.kind === "scroll" ? "from a scroll" : `from ${i.source.title}`}`,
  warnings: (i, facts) => {
    const out: string[] = [];
    if (i.source.kind === "scroll") {
      if ((facts.lines[i.source.lineId] ?? 0) < 1)
        out.push(
          "That scroll is not available: it is already held by another request.",
        );
      return out;
    }
    if (i.level > 0 && i.castLevel < i.level)
      out.push(`${i.name} cannot be cast below level ${i.level}.`);
    if (i.level > 0 && (facts.slots[String(i.castLevel)] ?? 0) < 1)
      out.push(`${facts.name} has no level-${i.castLevel} spell slot left.`);
    return out;
  },
};

registerRequestKind(castSpell);

/**
 * Whether a queued request may go to the DM now: Instant at once; Next Turn on the actor's own
 * turn in an encounter ("request DM approval only when the queued action is eligible").
 */
export function isEligible(
  timing: Timing,
  character: string,
  encounter?: { readonly round: number; readonly current?: string },
): boolean {
  if (timing === "instant") return true;
  return !!encounter && encounter.round >= 1 && encounter.current === character;
}

/**
 * An attack described at the table (Milestone 5 S9): the DM's way for an NPC (or anyone without
 * a weapon on their sheet) to attack, with its attack bonus and damage. It holds nothing and
 * uses an Action. Weapon attacks from a sheet come with S10.
 */
export interface AttackInput {
  /** What attacks with what, e.g. "Bandit Scout's scimitar". */
  readonly name: string;
  readonly bonus: number;
  /** Damage dice, e.g. "1d6+2". */
  readonly dice: string;
  readonly damageType?: string;
  readonly targets?: readonly string[];
  readonly note?: string;
}

export const attack: RequestKind<AttackInput> = {
  id: "attack",
  holds: () => ({}),
  budget: () => "action",
  describe: (i) => `Attack: ${i.name}`,
  warnings: () => [],
};

registerRequestKind(attack);

/** Whether every player who must answer has skipped the poll's current round. */
export function everyoneSkipped(
  round: number,
  skips: Readonly<Record<string, number>>,
  players: readonly string[],
): boolean {
  return players.every((uid) => skips[uid] === round);
}

/**
 * Using an item (Milestone 5 S10), such as drinking a Potion of Healing (a Bonus Action, drunk or
 * given to someone within 5 feet): it holds the item, which resolution uses up.
 */
export interface UseItemInput {
  readonly line: string;
  readonly name: string;
  /** Hit points it restores, as dice, e.g. "2d4+2". */
  readonly healing?: string;
  readonly targets?: readonly string[];
  readonly note?: string;
  /** The Action, Bonus Action or Reaction it takes; nothing for some items. */
  readonly budget?: BudgetKind;
}

export const useItem: RequestKind<UseItemInput> = {
  id: "use-item",
  holds: (i) => ({ lines: { [i.line]: 1 } }),
  budget: (i) => i.budget,
  describe: (i) => `Use ${i.name}`,
  warnings: (i, facts) =>
    (facts.lines[i.line] ?? 0) < 1
      ? [`${i.name} is not available: it is already held by another request.`]
      : [],
};

registerRequestKind(useItem);

/**
 * One round of a weapon attack (Aetherlock Engineered Rounds, "Firing, loading and clearing in
 * play"): load a round into a chamber or slot first, fire a chamber, and clear one afterwards.
 * A melee attack has a single shot with nothing to fire.
 */
export interface Shot {
  readonly load?: { readonly slot: string; readonly line: string };
  /** The chamber or slot fired; absent for a melee attack. */
  readonly fire?: string;
  readonly clear?: string;
  /** The creature this shot is aimed at. */
  readonly target?: string;
  /** The round it fires, by item id, as worked out at review. */
  readonly round?: string;
  /** Its damage on a hit, with any ability modifier already added. */
  readonly damage?: readonly {
    readonly dice: string;
    readonly type?: string;
  }[];
  /** An area round's save instead of an attack roll (HE-FRAG). */
  readonly save?: {
    readonly ability: string;
    readonly dc: number;
    readonly success: string;
  };
  /** A Spellround's scroll line: the payload is cast from its stored snapshot. */
  readonly payload?: string;
}

/**
 * Attacking with a weapon (S10): the Aetherlock's modes, a bow's or crossbow's shot, a melee
 * swing, or an NPC's stat-block attack. What it holds is worked out when the attack is reviewed:
 * the rounds it loads or fires and the canister charges it spends.
 */
export interface WeaponAttackInput {
  /** "Aetherlock: 2 rounds", "Skeleton: Shortbow". */
  readonly name: string;
  /** The weapon's line, when it is an item in the inventory. */
  readonly weapon?: string;
  /** Which of the weapon's attacks, e.g. `burst-2`. */
  readonly mode?: string;
  readonly precision?: boolean;
  readonly shots: readonly Shot[];
  /** The attack roll's bonus. */
  readonly bonus: number;
  /** Damage when it does not come from the round fired (a bow's, a sword's, a monster's). */
  readonly damage?: readonly {
    readonly dice: string;
    readonly type?: string;
  }[];
  /** What the shots hold: the rounds loaded or fired, and the charges spent. */
  readonly consumes: Holds;
  readonly targets?: readonly string[];
  readonly note?: string;
}

export const weaponAttack: RequestKind<WeaponAttackInput> = {
  id: "weapon-attack",
  holds: (i) => i.consumes,
  budget: () => "action",
  describe: (i) => `Attack: ${i.name}`,
  warnings: (i, facts) =>
    Object.entries(i.consumes.lines ?? {}).flatMap(([line, n]) =>
      (facts.lines[line] ?? 0) < n
        ? [`A round it needs is not available: it is held by another request.`]
        : [],
    ),
};

registerRequestKind(weaponAttack);
