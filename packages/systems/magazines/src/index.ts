// Chambered weapons: chambers, what each holds, and the installed charge canister. Firing and
// charge costs come later. A weapon definition declares `magazine.chambers`, and its chambers
// are the weapon's container slots (2026-10-22): a round is loaded by placing a round line inside
// the weapon with that chamber's `slot`. The weapon's line records which canister line is
// installed (`magazine.canister`). A canister definition declares
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
  container: z
    .looseObject({
      slots: z
        .array(
          z.object({
            id: z.string(),
            label: z.string().optional(),
            x: z.number(),
            y: z.number(),
          }),
        )
        .optional(),
    })
    .optional(),
  canister: z.object({ charges: z.number().int().min(1) }).optional(),
  aim: z.object({ ability: z.string(), proficient: z.boolean() }).optional(),
});

const LineState = z.looseObject({
  magazine: z
    .object({
      canister: z.string().nullable().optional(),
    })
    .optional(),
  charges: z.number().int().min(0).optional(),
});

export interface ChamberView {
  readonly index: number;
  /** The container slot this chamber is, with its grid position. */
  readonly slot: {
    readonly id: string;
    readonly label?: string | undefined;
    readonly x: number;
    readonly y: number;
  };
  readonly round?: { readonly lineId: string; readonly name: string };
}

export interface WeaponView {
  readonly lineId: string;
  readonly name: string;
  readonly chambers: readonly ChamberView[];
  readonly loaded: number;
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
    const size = rules.value.magazine.chambers;
    const slots = rules.value.container?.slots ?? [];
    if (slots.length !== size) {
      ctx.report(
        issue(
          "error",
          "magazines.chamber-slots",
          `${row.name} has ${size} chambers but ${slots.length} chamber slots.`,
          row.line.ref,
        ),
      );
    }
    const inside = all.value.filter((r) => r.line.parent === row.line.id);
    const chambers = slots.map((slot, index): ChamberView => {
      const round = inside.find((r) => r.line.slot === slot.id);
      return round
        ? { index, slot, round: { lineId: round.line.id, name: round.name } }
        : { index, slot };
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
