// Resolving an approved weapon attack (Milestone 5 S10; Aetherlock Engineered Rounds, "Firing,
// loading and clearing in play"). The shots run again over the attacker's inventory as stored
// now: each loads, fires and clears, so a fired round is used up (a Spellround's scroll is spent
// and its casing stays), and the canister loses the charges the request held. Each shot's target
// then takes the shot's damage when it hits or fails its save (half on a save where the round
// says so). A Spellround's payload is cast afterwards from its scroll, with the same ledger.

import type { WeaponAttackInput } from "@hearthtable/play";
import type { ActionRequest } from "@hearthtable/storage";
import { fireShots, type RulesOf } from "../play/firing";
import type { Line } from "../sheet/drag";
import { Ledger, type Plan, type TargetResult } from "./resolveSpell";
import type { Participant } from "./useTable";

type Data = Record<string, unknown>;

export interface ShotResult {
  readonly person: Participant;
  readonly result: TargetResult;
  /** The rolled (or typed) total of each of the shot's damage parts. */
  readonly amounts: readonly number[];
}

/** Every change an approved weapon attack makes; shots without a result only fire. */
export async function planWeaponAttack(options: {
  readonly request: ActionRequest;
  readonly attacker: Participant;
  readonly rulesOf: RulesOf;
  readonly results: readonly (ShotResult | undefined)[];
  readonly ledger?: Ledger;
}): Promise<Plan | string> {
  const o = options;
  const input = o.request.input as unknown as WeaponAttackInput;
  const ledger = o.ledger ?? new Ledger();
  const logs: string[] = [];
  const inventory = `${o.attacker.path}/Inventory`;
  const nameOf = (ref: string) =>
    o.rulesOf(ref)?.name ?? ref.split("/").at(-1)?.replaceAll("_", " ");

  try {
    // 1. Load, fire and clear, then spend the held charges.
    if (input.weapon) {
      const weapon = input.weapon;
      const stamp = Date.now().toString(36);
      let n = 0;
      let firedNames: string[] = [];
      let warnings: readonly string[] = [];
      await ledger.change(inventory, (d) => {
        const run = fireShots(
          (d["lines"] as Line[]) ?? [],
          weapon,
          input.shots,
          o.rulesOf,
          () => `line-${stamp}-${n++}`,
        );
        firedNames = run.fired.map((f) => nameOf(f.line.ref) ?? f.line.ref);
        warnings = run.warnings;
        return { ...d, lines: run.lines };
      });
      const charges = Object.entries(o.request.holds.charges ?? {});
      if (charges.length)
        await ledger.change(inventory, (d) => ({
          ...d,
          lines: ((d["lines"] as Data[]) ?? []).map((l) => {
            const spent = (o.request.holds.charges ?? {})[l["id"] as string];
            return spent
              ? {
                  ...l,
                  charges: Math.max(0, ((l["charges"] as number) ?? 0) - spent),
                }
              : l;
          }),
        }));
      const total = charges.reduce((t, [, c]) => t + c, 0);
      logs.push(
        `${o.attacker.name} fired ${firedNames.length ? firedNames.join(", ") : "nothing"}${total ? `, spending ${total} charge${total === 1 ? "" : "s"}` : ""}.`,
        ...warnings.map((w) => `${w} The DM let it go ahead.`),
      );
    }

    // 2. Each shot's damage on its target.
    for (const [i, shot] of input.shots.entries()) {
      const r = o.results[i];
      if (!r) continue;
      const parts: string[] = [];
      const affected = r.result === "hit" || r.result === "failed";
      const half = r.result === "saved" && shot.save?.success === "half";
      for (const [j, part] of (shot.damage ?? []).entries()) {
        const rolled = r.amounts[j] ?? 0;
        const amount = affected ? rolled : half ? Math.floor(rolled / 2) : 0;
        if (amount > 0)
          parts.push(await ledger.damage(r.person, amount, part.type));
      }
      const how =
        r.result === "saved"
          ? "saved"
          : r.result === "failed"
            ? "failed the save"
            : r.result === "miss"
              ? "missed"
              : "hit";
      logs.push(
        `${input.shots.length > 1 ? `Shot ${i + 1} at ` : ""}${r.person.name} ${how}: ${parts.length ? parts.join("; ") : "no damage"}.`,
      );
    }

    const summary = `${o.attacker.name}: ${o.request.summary.replace(/^Attack/, "attack")}`;
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
