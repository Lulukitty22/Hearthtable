// Concentration capacity (Spell Effects and Active State). A character can maintain
// `defaultCapacity` concentrations, one by default, plus any grants aimed at
// `concentration.capacity`, such as Capella's authored second position. Only active effects whose
// definition needs concentration occupy capacity; other active effects coexist freely. Maintaining
// more than the capacity is a visible warning naming the newest ones, which are over the limit.
// Choosing what to replace when a new concentration starts, and automatic loss, belong to the
// casting workflow (Milestone 5); this system shows the current state.

import type { ActiveEffectRow } from "@hearthtable/system-active-effects";
import {
  DERIVATIONS_POINT,
  amountValue,
  grantsOf,
  issue,
  known,
  sum,
  type Derivation,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";

export interface Maintained {
  readonly effectId: string;
  readonly ref: string;
  readonly name: string;
  readonly activatedAt: string;
  readonly overLimit: boolean;
}

function needsConcentration(ctx: ResolveContext, ref: string): boolean {
  return (
    (ctx.record(ref)?.data as { concentration?: unknown } | undefined)
      ?.concentration === true
  );
}

const derivations: Derivation[] = [
  {
    key: "concentration.capacity",
    compute: (ctx): Value<number> => {
      const base = ctx.settings.variable<number>(
        "concentration.defaultCapacity",
      );
      if (base.kind === "unresolved") return base;
      return sum("Concentration capacity", [
        known(base.value, "default"),
        ...grantsOf(ctx, "bonus", "concentration.capacity").map((g) =>
          amountValue(ctx, g.grant.amount, g.source.label, g.source.note),
        ),
      ]);
    },
  },
  {
    key: "concentration.maintained",
    compute: (ctx) => {
      const effects = ctx.get<readonly ActiveEffectRow[]>(
        "active-effects.list",
      );
      if (effects.kind === "unresolved") return effects;
      const capacity = ctx.get<number>("concentration.capacity");
      const held = effects.value
        .filter((e) => e.status === "active" && needsConcentration(ctx, e.ref))
        .sort((a, b) => Date.parse(a.activatedAt) - Date.parse(b.activatedAt));
      const rows = held.map((e, i): Maintained => ({
        effectId: e.id,
        ref: e.ref,
        name: e.name,
        activatedAt: e.activatedAt,
        overLimit: capacity.kind === "known" && i >= capacity.value,
      }));
      const over = rows.filter((r) => r.overLimit);
      if (over.length > 0 && capacity.kind === "known") {
        ctx.report(
          issue(
            "warning",
            "concentration.over-capacity",
            `Maintaining ${rows.length} concentrations with capacity ${capacity.value}; over the limit: ${over.map((r) => r.name).join(", ")}.`,
            "concentration",
          ),
        );
      }
      return known(rows, "Concentration", {
        note:
          capacity.kind === "known"
            ? `${rows.length}/${capacity.value}`
            : `${rows.length} maintained`,
      });
    },
  },
];

export const concentration: KernelModule = {
  manifest: {
    id: "concentration",
    version: "1.0.0",
    requires: [{ id: "active-effects", range: "^1.0.0" }],
    extends: [DERIVATIONS_POINT],
    provides: { ruleVariables: [{ name: "defaultCapacity", type: "integer" }] },
  },
  setup: (ctx) => derivations.forEach((d) => ctx.extend(DERIVATIONS_POINT, d)),
};
