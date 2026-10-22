// Attunement, equipped and held state, and the grants items give in each state. An item
// definition says when its grants apply (`grantsWhen`): while owned (a DM grant item such as
// Indomitable), equipped, held, attuned, or attuned and held (the Wand of the War Mage's +1 to
// spell attacks). A line with quantity 0 grants nothing. Attunement uses `maxSlots` slots;
// exceeding them, or attuning without meeting a class requirement, is a visible warning. The
// recorded state stays as authored.

import type { LineRow } from "@hearthtable/system-containers";
import {
  DERIVATIONS_POINT,
  GRANT_SOURCES_POINT,
  issue,
  known,
  parseGrants,
  parseWith,
  type GrantSource,
  type KernelModule,
  type ResolveContext,
  type SourcedGrant,
} from "@hearthtable/kernel";
import { z } from "zod";

const LineState = z.looseObject({
  attuned: z.boolean().optional(),
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

function lineRows(ctx: ResolveContext): readonly LineRow[] {
  const v = ctx.get<readonly LineRow[]>("containers.lines");
  return v.kind === "known" ? v.value : [];
}

const source: GrantSource = (ctx) => {
  const out: SourcedGrant[] = [];
  for (const row of lineRows(ctx)) {
    if (row.status !== "resolved" || row.line.quantity < 1) continue;
    const rules = parseWith(ItemRules, row.definition, row.line.ref);
    const state = parseWith(LineState, row.line, row.line.id);
    if (!rules.ok || !state.ok) continue;
    if (rules.value.grants === undefined) continue;
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
    const applies =
      when === "owned" ||
      (when === "equipped" && s.equipped === true) ||
      (when === "held" && s.held === true) ||
      (when === "attuned" && s.attuned === true) ||
      (when === "attuned-and-held" && s.attuned === true && s.held === true);
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
      key: "attunement.slots",
      compute: (rc: ResolveContext) => {
        const max = rc.settings.variable<number>("attunement.maxSlots");
        const classes = rc.get<readonly ClassLevel[]>("character.classes");
        const attuned: { id: string; name: string }[] = [];
        for (const row of lineRows(rc)) {
          const state = parseWith(LineState, row.line, row.line.id);
          if (!state.ok || state.value.attuned !== true) continue;
          attuned.push({ id: row.line.id, name: row.name });
          const rules = parseWith(
            ItemRules,
            row.definition ?? {},
            row.line.ref,
          );
          const needed = rules.ok ? rules.value.attunement : undefined;
          if (row.status === "resolved" && needed?.required !== true) {
            rc.report(
              issue(
                "info",
                "attunement.not-required",
                `${row.name} is marked attuned but does not require attunement.`,
                row.line.id,
              ),
            );
          }
          if (needed?.requiresClass !== undefined) {
            const has =
              classes.kind === "known" &&
              classes.value.some((c) => c.id === needed.requiresClass);
            if (!has) {
              rc.report(
                issue(
                  "warning",
                  "attunement.class-requirement",
                  `${row.name} requires ${needed.requiresClass} to attune.`,
                  row.line.id,
                ),
              );
            }
          }
        }
        if (max.kind === "unresolved") return max;
        if (attuned.length > max.value) {
          rc.report(
            issue(
              "warning",
              "attunement.over-limit",
              `${attuned.length} items attuned; the limit is ${max.value}.`,
              "attunement",
            ),
          );
        }
        return known(
          { used: attuned.length, max: max.value, items: attuned },
          "Attunement",
          {
            note: `${attuned.length}/${max.value}`,
          },
        );
      },
    });
  },
};
