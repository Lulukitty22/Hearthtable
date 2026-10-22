// Attunement, equipped and held state, and the grants items give in each state. An item
// definition says when its grants apply (`grantsWhen`): while owned, equipped, held, attuned,
// or attuned and held (the Wand of the War Mage's +1 to spell attacks). A line with quantity 0
// grants nothing.
//
// Attunement is an ordered list of slots (user decision, 2026-10-22): the inventory records
// `attuned` as line ids in the owner's chosen order. There are `maxSlots` slots plus any bonus
// grants aimed at `attunement.slots`, such as Indomitable's +1 while attuned. Items past the
// limit, in that order, are flagged and warned about; nothing is unattuned automatically and
// the recorded state stays as authored. Attuning without a class requirement also warns.

import type { LineRow } from "@hearthtable/system-containers";
import {
  DERIVATIONS_POINT,
  GRANT_SOURCES_POINT,
  amountValue,
  grantsOf,
  issue,
  known,
  parseGrants,
  parseWith,
  readField,
  sum,
  type GrantSource,
  type KernelModule,
  type ResolveContext,
  type SourcedGrant,
  type Value,
} from "@hearthtable/kernel";
import { z } from "zod";

const LineState = z.looseObject({
  held: z.boolean().optional(),
  equipped: z.boolean().optional(),
});

const ItemRules = z.looseObject({
  attunement: z
    .object({ required: z.boolean(), requiresClass: z.string().optional() })
    .optional(),
  grants: z.unknown().optional(),
  grantsWhen: z
    .enum(["owned", "equipped", "held", "attuned", "attuned-and-held"])
    .optional(),
});

const NOTES = {
  owned: "while owned",
  equipped: "while equipped",
  held: "while held",
  attuned: "while attuned",
  "attuned-and-held": "while attuned and held",
} as const;

interface ClassLevel {
  readonly id: string;
  readonly name: string;
  readonly level: number;
}

export interface AttunedSlot {
  readonly position: number;
  readonly lineId: string;
  readonly name: string;
  readonly overLimit: boolean;
}

function lineRows(ctx: ResolveContext): readonly LineRow[] {
  const v = ctx.get<readonly LineRow[]>("containers.lines");
  return v.kind === "known" ? v.value : [];
}

/** Attuned line ids in the owner's order, as recorded. */
function attunedOrder(ctx: ResolveContext): readonly string[] {
  const v = ctx.get<readonly string[]>("attunement.order");
  return v.kind === "known" ? v.value : [];
}

const source: GrantSource = (ctx) => {
  const attuned = new Set(attunedOrder(ctx));
  const out: SourcedGrant[] = [];
  for (const row of lineRows(ctx)) {
    if (row.status !== "resolved" || row.line.quantity < 1) continue;
    const rules = parseWith(ItemRules, row.definition, row.line.ref);
    const state = parseWith(LineState, row.line, row.line.id);
    if (!rules.ok || !state.ok || rules.value.grants === undefined) continue;
    const when = rules.value.grantsWhen;
    if (when === undefined) {
      ctx.report(
        issue(
          "error",
          "attunement.missing-grants-when",
          `${row.name} has grants but does not say when they apply.`,
          row.line.ref,
        ),
      );
      continue;
    }
    const s = state.value;
    const isAttuned = attuned.has(row.line.id);
    const applies =
      when === "owned" ||
      (when === "equipped" && s.equipped === true) ||
      (when === "held" && s.held === true) ||
      (when === "attuned" && isAttuned) ||
      (when === "attuned-and-held" && isAttuned && s.held === true);
    if (!applies) continue;
    const grants = parseGrants(rules.value.grants, `${row.line.ref}.grants`);
    if (!grants.ok) {
      grants.issues.forEach((i) => ctx.report(i));
      continue;
    }
    for (const grant of grants.value) {
      out.push({
        grant,
        source: { id: row.line.id, label: row.name, note: NOTES[when] },
      });
    }
  }
  return out;
};

export const attunement: KernelModule = {
  manifest: {
    id: "attunement",
    version: "1.0.0",
    requires: [{ id: "containers", range: "^1.0.0" }],
    extends: [DERIVATIONS_POINT, GRANT_SOURCES_POINT],
    provides: { ruleVariables: [{ name: "maxSlots", type: "integer" }] },
  },
  setup: (ctx) => {
    ctx.extend(GRANT_SOURCES_POINT, source);
    ctx.extend(DERIVATIONS_POINT, {
      key: "attunement.order",
      compute: (rc: ResolveContext) => {
        const order = readField(
          rc,
          "inventory",
          "attuned",
          z.array(z.string()).optional(),
        ).flatMap((f) => f.value ?? []);
        const lines = new Set(lineRows(rc).map((r) => r.line.id));
        const seen = new Set<string>();
        for (const id of order) {
          if (!lines.has(id))
            rc.report(
              issue(
                "error",
                "attunement.missing-line",
                `Attuned line ${id} is not in the inventory.`,
                id,
              ),
            );
          if (seen.has(id))
            rc.report(
              issue(
                "error",
                "attunement.duplicate",
                `Line ${id} is attuned twice.`,
                id,
              ),
            );
          seen.add(id);
        }
        return known(order, "Attunement order");
      },
    });
    ctx.extend(DERIVATIONS_POINT, {
      key: "attunement.capacity",
      compute: (rc: ResolveContext): Value<number> => {
        const max = rc.settings.variable<number>("attunement.maxSlots");
        if (max.kind === "unresolved") return max;
        return sum("Attunement slots", [
          known(max.value, "base slots"),
          ...grantsOf(rc, "bonus", "attunement.slots").map((g) =>
            amountValue(rc, g.grant.amount, g.source.label, g.source.note),
          ),
        ]);
      },
    });
    ctx.extend(DERIVATIONS_POINT, {
      key: "attunement.slots",
      compute: (rc: ResolveContext) => {
        const capacity = rc.get<number>("attunement.capacity");
        const classes = rc.get<readonly ClassLevel[]>("character.classes");
        const rows = new Map(lineRows(rc).map((r) => [r.line.id, r]));
        const slots = attunedOrder(rc).map((lineId, index): AttunedSlot => {
          const row = rows.get(lineId);
          const name = row?.name ?? "Reference not found";
          const rules = parseWith(ItemRules, row?.definition ?? {}, lineId);
          const needed = rules.ok ? rules.value.attunement : undefined;
          if (row?.status === "resolved" && needed?.required !== true) {
            rc.report(
              issue(
                "info",
                "attunement.not-required",
                `${name} is attuned but does not require attunement.`,
                lineId,
              ),
            );
          }
          if (needed?.requiresClass !== undefined) {
            const has =
              classes.kind === "known" &&
              classes.value.some((c) => c.id === needed.requiresClass);
            if (!has)
              rc.report(
                issue(
                  "warning",
                  "attunement.class-requirement",
                  `${name} requires ${needed.requiresClass} to attune.`,
                  lineId,
                ),
              );
          }
          const overLimit =
            capacity.kind === "known" && index >= capacity.value;
          return { position: index + 1, lineId, name, overLimit };
        });
        if (capacity.kind === "unresolved") return capacity;
        const over = slots.filter((s) => s.overLimit);
        if (over.length > 0) {
          rc.report(
            issue(
              "warning",
              "attunement.over-limit",
              `${slots.length} items attuned with ${capacity.value} slots; over the limit: ${over.map((s) => s.name).join(", ")}.`,
              "attunement",
            ),
          );
        }
        return known(
          { used: slots.length, max: capacity.value, slots },
          "Attunement",
          {
            note: `${slots.length}/${capacity.value}`,
            parts: [capacity.explain],
          },
        );
      },
    });
  },
};
