// Chambered weapons: chambers, what each holds, and the installed charge canister. Milestone 2
// covers display only; firing, loading actions and charge costs come later. A weapon definition
// declares `magazine.chambers`; the weapon's inventory line records each chamber's round (a line
// id, or null when empty) and which canister line is installed. A canister definition declares
// `canister.charges` and its line records charges remaining. The Aetherlock attaches as data.
// A weapon's `aim` names the ability its attacks use and whether the wielder is proficient (the
// Aetherlock's proficient INT guidance is a campaign rule); bonus grants aimed at `weapons.aim`
// add to it. Spell-attack bonuses such as the Wand's never apply to aim.

import type { LineRow } from "@hearthtable/system-containers";
import {
  DERIVATIONS_POINT,
  amountValue,
  grantsOf,
  issue,
  known,
  parseWith,
  sum,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";
import { z } from "zod";

export const ROUND_PAYLOADS_POINT = "magazines.roundPayloads";

const WeaponRules = z.looseObject({
  magazine: z.object({ chambers: z.number().int().min(1) }).optional(),
  canister: z.object({ charges: z.number().int().min(1) }).optional(),
  aim: z.object({ ability: z.string(), proficient: z.boolean() }).optional(),
});

const LineState = z.looseObject({
  magazine: z
    .object({
      chambers: z.array(z.string().nullable()).optional(),
      canister: z.string().nullable().optional(),
    })
    .optional(),
  charges: z.number().int().min(0).optional(),
});

export interface ChamberView {
  readonly index: number;
  readonly round?: { readonly lineId: string; readonly name: string };
}

export interface WeaponView {
  readonly lineId: string;
  readonly name: string;
  readonly chambers: readonly ChamberView[];
  readonly loaded: number;
  /** False when the line records no chamber contents yet (shown as "not recorded", not empty). */
  readonly chambersRecorded: boolean;
  /** Attack bonus, when the weapon declares how it aims. */
  readonly aim?: Value<number>;
  readonly canister?: {
    readonly lineId: string;
    readonly name: string;
    readonly charges?: number;
    readonly max: number;
  };
}

function weapons(ctx: ResolveContext): readonly WeaponView[] {
  const all = ctx.get<readonly LineRow[]>("containers.lines");
  if (all.kind === "unresolved") return [];
  const byId = new Map(all.value.map((r) => [r.line.id, r]));
  const out: WeaponView[] = [];
  for (const row of all.value) {
    const rules = parseWith(WeaponRules, row.definition ?? {}, row.line.ref);
    if (!rules.ok || !rules.value.magazine) continue;
    const state = parseWith(LineState, row.line, row.line.id);
    const recorded = state.ok ? (state.value.magazine?.chambers ?? []) : [];
    const size = rules.value.magazine.chambers;
    if (recorded.length > size) {
      ctx.report(
        issue(
          "error",
          "magazines.too-many-chambers",
          `${row.name} records ${recorded.length} chambers but has ${size}.`,
          row.line.id,
        ),
      );
    }
    const chambers = Array.from({ length: size }, (_, index): ChamberView => {
      const id = recorded[index] ?? null;
      if (id === null) return { index };
      const round = byId.get(id);
      if (!round) {
        ctx.report(
          issue(
            "error",
            "magazines.missing-round",
            `${row.name} chamber ${index + 1} holds missing line ${id}.`,
            row.line.id,
          ),
        );
        return { index, round: { lineId: id, name: "Reference not found" } };
      }
      return { index, round: { lineId: id, name: round.name } };
    });
    const canisterId = state.ok ? state.value.magazine?.canister : undefined;
    let canister: WeaponView["canister"];
    if (canisterId) {
      const c = byId.get(canisterId);
      const cRules =
        c && parseWith(WeaponRules, c.definition ?? {}, c.line.ref);
      const cState = c && parseWith(LineState, c.line, c.line.id);
      if (!c || !cRules?.ok || !cRules.value.canister) {
        ctx.report(
          issue(
            "error",
            "magazines.bad-canister",
            `${row.name}'s installed canister ${canisterId} is missing or not a canister.`,
            row.line.id,
          ),
        );
      } else {
        const charges = cState?.ok ? cState.value.charges : undefined;
        if (charges === undefined) {
          ctx.report(
            issue(
              "warning",
              "magazines.unknown-charges",
              `${c.name} has no recorded charges.`,
              c.line.id,
            ),
          );
        }
        canister = {
          lineId: c.line.id,
          name: c.name,
          max: cRules.value.canister.charges,
          ...(charges === undefined ? {} : { charges }),
        };
      }
    }
    const aimRule = rules.value.aim;
    const aim =
      aimRule &&
      sum(`${row.name} aim`, [
        ctx.get<number>(`abilities.${aimRule.ability}.modifier`),
        ...(aimRule.proficient ? [ctx.get<number>("proficiency.bonus")] : []),
        ...grantsOf(ctx, "bonus", "weapons.aim").map((g) =>
          amountValue(ctx, g.grant.amount, g.source.label, g.source.note),
        ),
      ]);
    out.push({
      lineId: row.line.id,
      name: row.name,
      ...(aim ? { aim } : {}),
      chambers,
      loaded: chambers.filter((c) => c.round).length,
      chambersRecorded:
        state.ok && state.value.magazine?.chambers !== undefined,
      ...(canister ? { canister } : {}),
    });
  }
  return out;
}

export const magazines: KernelModule = {
  manifest: {
    id: "magazines",
    version: "1.0.0",
    requires: [{ id: "containers", range: "^1.0.0" }],
    extends: [DERIVATIONS_POINT],
    provides: { extensionPoints: [ROUND_PAYLOADS_POINT] },
  },
  setup: (ctx) =>
    ctx.extend(DERIVATIONS_POINT, {
      key: "magazines.weapons",
      compute: (rc: ResolveContext) => known(weapons(rc), "Chambered weapons"),
    }),
};
