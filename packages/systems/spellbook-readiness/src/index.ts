// Which spells are ready to cast. Every spell, cantrips included, is an entry in a book item
// (Spell Containers and Consumable Sources). A spell is eligible when one of the character's
// classes has it on its list at an accessible tier, or a grant gives `spell-access:<spell id>`
// (Magic Initiate, subclass spells). The ruleset picks how eligible spells become ready:
//
// - `book-contents-ready` (Vanilla+): every eligible entry in an accessible book is ready;
//   books hold `bookCapacity` entries, and over-full books warn.
// - `published-preparation`: eligible spells on the character's prepared list are ready.

import type { CasterClass } from "@hearthtable/system-spellcasting";
import type { LineRow } from "@hearthtable/system-containers";
import {
  DERIVATIONS_POINT,
  hasCapability,
  issue,
  known,
  readDefinition,
  readField,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";
import { z } from "zod";

const SpellbookData = z.looseObject({
  entries: z.array(z.looseObject({ id: z.string(), ref: z.string() })),
});

const SpellDefinition = z.looseObject({
  name: z.string(),
  level: z.number().int().min(0).max(9),
  /** Class definition ids whose lists include the spell. */
  classes: z.array(z.string()),
});

const Prepared = z.looseObject({ prepared: z.array(z.string()).optional() });

export interface EntryView {
  readonly id: string;
  readonly ref: string;
  readonly name: string;
  readonly level?: number;
  readonly status: "resolved" | "unresolved";
  readonly ready: boolean;
  /** Why it is or is not ready. */
  readonly reasons: readonly string[];
}

export interface BookView {
  readonly lineId: string;
  readonly name: string;
  readonly accessible: boolean;
  readonly capacity?: number;
  readonly entries: readonly EntryView[];
}

function eligibility(
  ctx: ResolveContext,
  ref: string,
  level: number,
  classes: readonly string[],
): { ok: boolean; why: string } {
  if (hasCapability(ctx, `spell-access:${ref}`))
    return { ok: true, why: "granted by a feature" };
  const list = ctx.get<readonly CasterClass[]>("character.casterClasses");
  if (list.kind === "unresolved") return { ok: false, why: list.reason };
  const match = list.value.find(
    (c) => classes.includes(c.id) && level <= c.maxSpellLevel,
  );
  if (match)
    return {
      ok: true,
      why: `${match.name} ${match.level} can cast level ${level}`,
    };
  const onList = list.value.filter((c) => classes.includes(c.id));
  return {
    ok: false,
    why:
      onList.length > 0
        ? `level ${level} is above ${onList.map((c) => `${c.name}'s level ${c.maxSpellLevel}`).join(" and ")}`
        : "not on any of the character's class lists",
  };
}

function books(ctx: ResolveContext): Value<readonly BookView[]> {
  const method = ctx.settings.method("spellbook-readiness.readiness");
  if (method.kind === "unresolved") return method;
  const lines = ctx.get<readonly LineRow[]>("containers.lines");
  if (lines.kind === "unresolved") return lines;
  const capacity = ctx.settings.variable<number>(
    "spellbook-readiness.bookCapacity",
  );
  const prepared = new Set(
    readField(ctx, "character", "spellbook", Prepared)[0]?.value.prepared ?? [],
  );

  return known(
    readField(ctx, "spellbook", "entries", SpellbookData.shape.entries).map(
      ({ record, value }): BookView => {
        const bookLine = (record.data as { book?: unknown }).book;
        const line = lines.value.find((l) => l.line.id === bookLine);
        if (!line) {
          ctx.report(
            issue(
              "error",
              "spellbook-readiness.missing-book",
              `${record.id} belongs to book line ${String(bookLine)}, which is not in the inventory.`,
              record.id,
            ),
          );
        }
        const accessible = line?.accessible ?? false;
        const cap =
          method.value === "book-contents-ready" && capacity.kind === "known"
            ? capacity.value
            : undefined;
        if (cap !== undefined && value.length > cap) {
          ctx.report(
            issue(
              "warning",
              "spellbook-readiness.over-capacity",
              `${line?.name ?? record.id} holds ${value.length} of ${cap} entries.`,
              record.id,
            ),
          );
        }
        const entries = value.map((e): EntryView => {
          const def = readDefinition(ctx, e.ref, "spell", SpellDefinition);
          if (!def.ok) {
            ctx.report(
              issue(
                "error",
                "spellbook-readiness.unresolved",
                def.reason,
                e.id,
              ),
            );
            return {
              id: e.id,
              ref: e.ref,
              name: e.ref,
              status: "unresolved",
              ready: false,
              reasons: [def.reason],
            };
          }
          const spell = def.value;
          const eligible = eligibility(ctx, e.ref, spell.level, spell.classes);
          const reasons = [eligible.why];
          let ready = eligible.ok;
          if (method.value === "book-contents-ready") {
            if (!accessible) {
              ready = false;
              reasons.push("the book is packed too deep to reach");
            }
          } else if (!prepared.has(e.ref)) {
            ready = false;
            reasons.push("not prepared");
          }
          return {
            id: e.id,
            ref: e.ref,
            name: spell.name,
            level: spell.level,
            status: "resolved",
            ready,
            reasons,
          };
        });
        return {
          lineId: String(bookLine),
          name: line?.name ?? "Reference not found",
          accessible,
          ...(cap === undefined ? {} : { capacity: cap }),
          entries,
        };
      },
    ),
    "Spellbooks",
    { note: method.value },
  );
}

export const spellbookReadiness: KernelModule = {
  manifest: {
    id: "spellbook-readiness",
    version: "1.0.0",
    requires: [
      { id: "containers", range: "^1.0.0" },
      { id: "spellcasting", range: "^1.0.0" },
    ],
    extends: [DERIVATIONS_POINT],
    provides: {
      recordKinds: ["spellbook"],
      methods: [
        {
          slot: "readiness",
          options: ["book-contents-ready", "published-preparation"],
        },
      ],
      ruleVariables: [{ name: "bookCapacity", type: "integer" }],
    },
  },
  setup: (ctx) =>
    ctx.extend(DERIVATIONS_POINT, {
      key: "spellbook-readiness.books",
      compute: books,
    }),
};
