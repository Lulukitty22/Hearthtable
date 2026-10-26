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
}): Promise<Plan | string> {
  const o = options;
  const input = o.request.input as unknown as CastInput & { replaces?: string };
  const shape = spellShape(o.spell);
  const duration = spellDuration(
    o.spell.duration,
    o.spell.concentration === true,
  );
  const records = new Map<string, RecordEnvelope>();
  const load = async (path: string) => {
    const known = records.get(path);
    if (known) return known;
    const got = await repository.get(path as RecordId);
    if (!got.ok) throw new Error(got.errors.map((e) => e.message).join("\n"));
    if (!got.value) throw new Error(`${path} is no longer there.`);
    records.set(path, got.value);
    return got.value;
  };
  const change = async (path: string, f: (d: Data) => Data) => {
    const r = await load(path);
    records.set(path, { ...r, data: f(r.data as Data) });
  };
  const logs: string[] = [];
  const damaged: { path: string; amount: number }[] = [];
  const casterName = o.caster.name;
  const method = engine.settings.method("conditions.goingDown");
  const goingDown = method.kind === "known" ? method.value : undefined;

  try {
    // 1. Consume what the request holds.
    const held = o.request.holds;
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
        if (base > 0) {
          const taken = damageTaken(base, shape.damageType, p.defenses);
          const r = await load(p.path);
          const hp =
            ((r.data as Data)["hitPoints"] as {
              current?: number;
              temporary?: number;
            }) ?? {};
          // The 2024 rules stop at 0; Vanilla+ goes below.
          const floor = goingDown === "death-saves";
          const out = applyDamage(
            { current: hp.current ?? 0, temporary: hp.temporary ?? 0 },
            taken.amount,
            floor,
          );
          await change(p.path, (d) => ({
            ...d,
            hitPoints: {
              ...(d["hitPoints"] as Data),
              current: out.current,
              temporary: out.temporary,
            },
          }));
          parts.push(
            `${taken.amount} ${shape.damageType ?? ""} damage${[...taken.steps, ...out.steps].length ? ` (${[...taken.steps, ...out.steps].join("; ")})` : ""}, HP ${out.current}`,
          );
          damaged.push({ path: p.path, amount: taken.amount });
        } else parts.push("no damage");
      }
      if (shape.heals && affected) {
        const r = await load(p.path);
        const hp =
          ((r.data as Data)["hitPoints"] as { current?: number }) ?? {};
        const next = applyHealing(hp.current ?? 0, p.hp?.max, o.amount);
        await change(p.path, (d) => ({
          ...d,
          hitPoints: { ...(d["hitPoints"] as Data), current: next },
        }));
        parts.push(`healed ${o.amount}, HP ${next}`);
      }
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

    const summary = `${casterName}: ${o.request.summary.replace(/^Cast/, "cast")} on ${o.targets.map((t) => t.person.name).join(", ") || "nobody"}`;
    return {
      records: [...records.values()],
      result: summary,
      logs: [`The DM approved it. ${summary}.`, ...logs],
      damaged,
    };
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
