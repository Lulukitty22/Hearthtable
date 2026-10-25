// Which spells are ready to cast. Every spell, cantrips included, is an entry in a book item
// (Spell Containers and Consumable Sources). A spell is eligible when one of the character's
// classes has it on its list at an accessible tier, or a grant gives `spell-access:<spell id>`
// (Magic Initiate, subclass spells). The ruleset picks how eligible spells become ready:
//
// - `book-contents-ready` (Vanilla+): every eligible entry in an accessible book is ready;
//   books hold `bookCapacity` entries, and over-full books warn.
// - `published-preparation`: eligible spells on the character's prepared list are ready.
//
// A spellbook is a container (Milestone 5 S0, user decision 2026-10-24): any inventory line whose
// item is tagged `spellbook`. Its entries are the scroll lines inside it, the same lines as loose
// scrolls; a scroll is bound by being in a book, and a spent one stays but is not ready. Books are
// listed in the owner's saved order (the book line's `order`) and named by its `title`.

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

/** A physical scroll's own state, on its inventory line or, once mounted, on its book entry. */
export const ScrollState = z.looseObject({
  /** The spell definition the scroll holds. */
  spell: z.string(),
  /** The level it was scribed at (upcast scrolls keep their actual level). */
  castLevel: z.number().int().min(0).max(9),
  /** Who scribed it, and the numbers frozen when it was scribed (formulas, not rolls). */
  scribe: z.string().optional(),
  snapshot: z.record(z.string(), z.unknown()).optional(),
  /** Used up: it stays as a record but no longer casts. */
  spent: z.boolean().optional(),
});
export type ScrollState = z.infer<typeof ScrollState>;

/** Lines whose item carries this tag are spellbooks. */
export const SPELLBOOK_TAG = "spellbook";

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
  /** The bound scroll's own state (every book entry is a scroll). */
  readonly scroll?: ScrollState;
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

/** Books follow their owner's saved `order`; books without one come last, by id. */
function byOrder(a: LineRow, b: LineRow): number {
  const order = (r: LineRow) => {
    const o = (r.line as { order?: unknown }).order;
    return typeof o === "number" ? o : Number.POSITIVE_INFINITY;
  };
  return order(a) - order(b) || a.line.id.localeCompare(b.line.id);
}

export const isSpellbook = (row: LineRow) =>
  (row.definition?.tags ?? []).includes(SPELLBOOK_TAG);

function books(ctx: ResolveContext): Value<readonly BookView[]> {
  const method = ctx.settings.method("spellbook-readiness.readiness");
  if (method.kind === "unresolved") return method;
  const lines = ctx.get<readonly LineRow[]>("containers.lines");
  if (lines.kind === "unresolved") return lines;
  const capacity = ctx.settings.variable<number>(
    "spellbook-readiness.bookCapacity",
  );
  const prepared = new Set(
    readField(ctx, "character", "spellbook", Prepared.optional())[0]?.value
      ?.prepared ?? [],
  );

  return known(
    lines.value
      .filter(isSpellbook)
      .sort(byOrder)
      .map((line): BookView => {
        const accessible = line.accessible;
        const inside = lines.value.filter(
          (r) =>
            r.line.parent === line.line.id &&
            (r.line as { scroll?: unknown }).scroll !== undefined,
        );
        const cap =
          method.value === "book-contents-ready" && capacity.kind === "known"
            ? capacity.value
            : undefined;
        if (cap !== undefined && inside.length > cap) {
          ctx.report(
            issue(
              "warning",
              "spellbook-readiness.over-capacity",
              `${line.name} holds ${inside.length} of ${cap} entries.`,
              line.line.id,
            ),
          );
        }
        const entries = inside.flatMap((row): EntryView[] => {
          const parsed = ScrollState.safeParse(
            (row.line as { scroll?: unknown }).scroll,
          );
          if (!parsed.success) return [];
          const e = {
            id: row.line.id,
            ref: parsed.data.spell,
            scroll: parsed.data,
          };
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
            return [
              {
                id: e.id,
                ref: e.ref,
                name: e.ref,
                status: "unresolved",
                scroll: e.scroll,
                ready: false,
                reasons: [def.reason],
              },
            ];
          }
          const spell = def.value;
          const eligible = eligibility(ctx, e.ref, spell.level, spell.classes);
          const reasons = [eligible.why];
          let ready = eligible.ok;
          if (e.scroll.spent === true) {
            ready = false;
            reasons.push("the scroll is spent");
          }
          if (method.value === "book-contents-ready") {
            if (!accessible) {
              ready = false;
              reasons.push("the book is packed too deep to reach");
            }
          } else if (!prepared.has(e.ref)) {
            ready = false;
            reasons.push("not prepared");
          }
          return [
            {
              id: e.id,
              ref: e.ref,
              name: spell.name,
              level: spell.level,
              status: "resolved",
              scroll: e.scroll,
              ready,
              reasons,
            },
          ];
        });
        const title = (line.line as { title?: unknown }).title;
        return {
          lineId: line.line.id,
          name: typeof title === "string" ? title : line.name,
          accessible,
          ...(cap === undefined ? {} : { capacity: cap }),
          entries,
        };
      }),
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
      uiTabs: ["spells"],
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
