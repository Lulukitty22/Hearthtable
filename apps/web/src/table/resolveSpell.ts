// Resolving an approved cast (Milestone 5 S7; Spell Effects and Active State, "Casting workflow"
// and "Concentration capacity"). From the request, the caster, the targets with what the DM ticked
// (hit or saved, until S8's prompts) and the rolled amount, this works out every record change:
//
// - the held costs are consumed (a slot is expended, a scroll is spent), with no second deduction;
// - a concentration spell first ends the concentration the player chose to replace, if still
//   needed, and anything that concentration kept going on others;
// - a lasting spell becomes an active effect on each affected target, starting now and ending by
//   its duration; on others, the caster keeps an entry of its own when it needs concentration;
// - a condition the spell applies goes on with the effect as its source and its repeat save;
// - damage applies the 2024 arithmetic and Vanilla+ negative hit points; healing adds.
//
// Everything is then written with the request in one transaction (`resolveAction`).

import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import {
  after,
  applyDamage,
  applyHealing,
  damageTaken,
  spellDuration,
  type CastInput,
  type Moment,
} from "@hearthtable/play";
import type { ActionRequest } from "@hearthtable/storage";
import { repository } from "../firebase";
import { engine } from "../useSheet";
import type { Participant } from "./useTable";

export type TargetResult = "hit" | "miss" | "failed" | "saved" | "affected";

export interface TargetChoice {
  readonly person: Participant;
  readonly result: TargetResult;
}

interface SpellData {
  readonly name?: string;
  readonly duration?: string;
  readonly concentration?: boolean;
  readonly whileActive?: unknown;
  readonly effect?: {
    readonly save?: { readonly ability: string; readonly success: string };
    readonly attack?: string;
    readonly damage?: readonly { readonly type?: string }[];
    readonly healing?: unknown;
    readonly applies?: {
      readonly condition: string;
      readonly repeatSave?: string;
    };
  };
}

type Data = Record<string, unknown>;
type Entry = { id: string; ref: string; linkedTo?: string } & Data;

const ABILITY: Record<string, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** What a spell does, as the resolution panel needs to show it. */
export function spellShape(spell: SpellData | undefined) {
  const effect = spell?.effect ?? {};
  return {
    save: effect.save,
    attack: !!effect.attack,
    damageType: effect.damage?.[0]?.type,
    damages: !!effect.damage?.length,
    heals: !!effect.healing,
    applies: effect.applies,
    lasting:
      spell?.whileActive !== undefined && spell?.whileActive !== null
        ? true
        : !!effect.applies,
  };
}

/**
 * The records one resolution changes, each loaded once and written together with the request.
 * Damage and healing go through it so every kind of action applies them the same way.
 */
export class Ledger {
  readonly records = new Map<string, RecordEnvelope>();
  /** Who took damage, and how much, for concentration checks (S8). */
  readonly damaged: { path: string; amount: number }[] = [];

  async load(path: string): Promise<RecordEnvelope> {
    const known = this.records.get(path);
    if (known) return known;
    const got = await repository.get(path as RecordId);
    if (!got.ok) throw new Error(got.errors.map((e) => e.message).join("\n"));
    if (!got.value) throw new Error(`${path} is no longer there.`);
    this.records.set(path, got.value);
    return got.value;
  }

  async change(path: string, f: (d: Data) => Data): Promise<void> {
    const r = await this.load(path);
    this.records.set(path, { ...r, data: f(r.data as Data) });
  }

  /** Damage with the 2024 arithmetic and the table's going-down rule; says how it went. */
  async damage(p: Participant, amount: number, type?: string): Promise<string> {
    const taken = damageTaken(amount, type, p.defenses);
    const r = await this.load(p.path);
    const hp =
      ((r.data as Data)["hitPoints"] as {
        current?: number;
        temporary?: number;
      }) ?? {};
    // The 2024 rules stop at 0; Vanilla+ goes below.
    const method = engine.settings.method("conditions.goingDown");
    const floor = method.kind === "known" && method.value === "death-saves";
    const out = applyDamage(
      { current: hp.current ?? 0, temporary: hp.temporary ?? 0 },
      taken.amount,
      floor,
    );
    await this.change(p.path, (d) => ({
      ...d,
      hitPoints: {
        ...(d["hitPoints"] as Data),
        current: out.current,
        temporary: out.temporary,
      },
    }));
    this.damaged.push({ path: p.path, amount: taken.amount });
    const steps = [...taken.steps, ...out.steps];
    return `${taken.amount} ${type ?? ""} damage${steps.length ? ` (${steps.join("; ")})` : ""}, HP ${out.current}`;
  }

  async heal(p: Participant, amount: number): Promise<string> {
    const r = await this.load(p.path);
    const hp = ((r.data as Data)["hitPoints"] as { current?: number }) ?? {};
    const next = applyHealing(hp.current ?? 0, p.hp?.max, amount);
    await this.change(p.path, (d) => ({
      ...d,
      hitPoints: { ...(d["hitPoints"] as Data), current: next },
    }));
    return `healed ${amount}, HP ${next}`;
  }
}

export interface Plan {
  readonly records: RecordEnvelope[];
  readonly result: string;
  readonly logs: string[];
  /** Who took damage, and how much, for concentration checks (S8). */
  readonly damaged: { readonly path: string; readonly amount: number }[];
}

/** Every change an approved cast makes. */
export async function planCast(options: {
  readonly request: ActionRequest;
  readonly caster: Participant;
  readonly spell: SpellData;
  readonly spellSaveDC: number | undefined;
  readonly targets: readonly TargetChoice[];
  /** The rolled (or typed) damage or healing total. */
  readonly amount: number;
  readonly now: Moment | undefined;
  readonly people: ReadonlyMap<string, Participant>;
  /** Changes already made by the same resolution, such as firing the round that carries it. */
  readonly ledger?: Ledger;
  /** False when something else has already consumed what the request holds. */
  readonly consume?: boolean;
  /** The spell cast, when the request is not itself a cast (a Spellround's payload). */
  readonly as?: { readonly spell: string; readonly name: string };
}): Promise<Plan | string> {
  const o = options;
  const input = {
    ...(o.request.input as unknown as CastInput & { replaces?: string }),
    ...o.as,
  };
  const shape = spellShape(o.spell);
  const duration = spellDuration(
    o.spell.duration,
    o.spell.concentration === true,
  );
  const ledger = o.ledger ?? new Ledger();
  const change = ledger.change.bind(ledger);
  const logs: string[] = [];
  const casterName = o.caster.name;

  try {
    // 1. Consume what the request holds.
    const held = o.consume === false ? {} : o.request.holds;
    if (held.slots && Object.keys(held.slots).length)
      await change(o.caster.path, (d) => {
        const sc =
          (d["spellcasting"] as { expended?: Record<string, number> }) ?? {};
        const expended = { ...(sc.expended ?? {}) };
        for (const [level, n] of Object.entries(held.slots ?? {}))
          expended[level] = (expended[level] ?? 0) + n;
        return { ...d, spellcasting: { ...sc, expended } };
      });
    if (held.lines && Object.keys(held.lines).length)
      await change(`${o.caster.path}/Inventory`, (d) => ({
        ...d,
        lines: ((d["lines"] as Data[]) ?? []).map((l) => {
          const n = (held.lines ?? {})[l["id"] as string];
          if (!n) return l;
          // A scroll is spent and stays; anything else is used up.
          return l["scroll"]
            ? { ...l, scroll: { ...(l["scroll"] as Data), spent: true } }
            : { ...l, quantity: Math.max(0, (l["quantity"] as number) - n) };
        }),
      }));
    if (held.pools && Object.keys(held.pools).length)
      await change(o.caster.path, (d) => {
        const res = (d["resources"] as { used?: Record<string, number> }) ?? {};
        const used = { ...(res.used ?? {}) };
        for (const [pool, n] of Object.entries(held.pools ?? {}))
          used[pool] = (used[pool] ?? 0) + n;
        return { ...d, resources: { ...res, used } };
      });

    // 2. Starting concentration ends the one the player chose to replace, if still there.
    if (duration.concentration && input.replaces) {
      const gone = input.replaces;
      const ending = o.caster.effects.find((e) => e.id === gone);
      if (ending) {
        await change(o.caster.path, (d) => ({
          ...d,
          activeEffects: ((d["activeEffects"] as Entry[]) ?? []).filter(
            (e) => e.id !== gone,
          ),
        }));
        for (const person of o.people.values())
          if (person.effects.some((e) => e.linkedTo === gone))
            await change(person.path, (d) => ({
              ...d,
              activeEffects: ((d["activeEffects"] as Entry[]) ?? []).filter(
                (e) => e.linkedTo !== gone,
              ),
              conditions: ((d["conditions"] as Data[]) ?? []).filter(
                (c) =>
                  !((d["activeEffects"] as Entry[]) ?? []).some(
                    (e) => e.linkedTo === gone && e.id === c["source"],
                  ),
              ),
            }));
        logs.push(`${casterName} stopped concentrating on ${ending.name}.`);
      }
    }

    // 3. Effects, conditions, damage and healing on each target.
    const stamp = Date.now().toString(36);
    const casterEntry = `effect-${stamp}`;
    const endsAt =
      o.now && duration.seconds !== undefined
        ? after(o.now, duration.seconds)
        : undefined;
    const timing = {
      activatedAt: new Date().toISOString(),
      ...(o.now ? { startedAt: { ...o.now } } : {}),
      ...(endsAt ? { endsAt } : {}),
    };
    let othersAffected = false;
    const affectedBy = (r: TargetResult) =>
      r === "hit" || r === "failed" || r === "affected";
    for (const [i, t] of o.targets.entries()) {
      const p = t.person;
      const self = p.path === o.caster.path;
      const affected = affectedBy(t.result);
      const parts: string[] = [];
      if (shape.lasting && affected) {
        const id = self ? casterEntry : `effect-${stamp}-${i}`;
        if (!self) othersAffected = true;
        await change(p.path, (d) => ({
          ...d,
          activeEffects: [
            ...((d["activeEffects"] as Entry[]) ?? []),
            {
              id,
              ref: input.spell,
              ...timing,
              ...(self ? {} : { by: o.caster.path }),
              ...(!self && duration.concentration
                ? { linkedTo: casterEntry }
                : {}),
            },
          ],
          ...(shape.applies
            ? {
                conditions: [
                  ...((d["conditions"] as Data[]) ?? []),
                  {
                    id: `condition-${stamp}-${i}`,
                    ref: shape.applies.condition,
                    source: id,
                    ...(shape.applies.repeatSave &&
                    shape.save &&
                    o.spellSaveDC !== undefined
                      ? {
                          save: {
                            ability: shape.save.ability,
                            dc: o.spellSaveDC,
                          },
                        }
                      : {}),
                  },
                ],
              }
            : {}),
        }));
        const condition = shape.applies?.condition
          .split("/")
          .at(-1)
          ?.replaceAll("_", " ");
        parts.push(
          condition ? `${condition} (${input.name})` : `${input.name} is on`,
        );
      }
      if (shape.damages) {
        const base =
          t.result === "miss"
            ? 0
            : t.result === "saved"
              ? shape.save?.success === "half"
                ? Math.floor(o.amount / 2)
                : 0
              : o.amount;
        if (base > 0)
          parts.push(await ledger.damage(p, base, shape.damageType));
        else parts.push("no damage");
      }
      if (shape.heals && affected) parts.push(await ledger.heal(p, o.amount));
      const how =
        t.result === "saved"
          ? `saved (${ABILITY[shape.save?.ability ?? ""] ?? "save"})`
          : t.result === "failed"
            ? "failed the save"
            : t.result === "miss"
              ? "missed"
              : t.result === "hit"
                ? "hit"
                : "";
      logs.push(
        `${p.name}${how ? ` ${how}` : ""}: ${parts.length ? parts.join("; ") : "unaffected"}.`,
      );
    }
    // The caster keeps track of a concentration spell that only affects others.
    if (
      duration.concentration &&
      othersAffected &&
      !o.targets.some(
        (t) => t.person.path === o.caster.path && affectedBy(t.result),
      )
    )
      await change(o.caster.path, (d) => ({
        ...d,
        activeEffects: [
          ...((d["activeEffects"] as Entry[]) ?? []),
          { id: casterEntry, ref: input.spell, ...timing },
        ],
      }));

    const summary = `${casterName}: ${o.request.summary.replace(/^(Cast|Use|Attack)/, (w) => w.toLowerCase())} on ${o.targets.map((t) => t.person.name).join(", ") || "nobody"}`;
    return {
      records: [...ledger.records.values()],
      result: summary,
      logs: [`The DM approved it. ${summary}.`, ...logs],
      damaged: ledger.damaged,
    };
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
