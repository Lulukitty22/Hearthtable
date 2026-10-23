// Physical scrolls (Spell Containers and Consumable Sources, "One physical scroll" and "Binders
// and spent scrolls"). A scroll is one item that keeps its identity: loose in the inventory it is
// a line carrying `scroll` state; mounted, it is a spellbook entry with the same id and state (a
// book works as the binder and the scroll takes one entry). A used scroll stays, marked spent.
//
// This system lists every scroll the character has, wherever it is, with what mounting or
// removing it would cost at its level (`scroll-crafting.mounting`). Paying for that, scribing new
// scrolls and casting from them come later (Milestones 5 and 5b).

import type { LineRow } from "@hearthtable/system-containers";
import type { MountingCost } from "@hearthtable/system-scroll-crafting";
import { ScrollState } from "@hearthtable/system-spellbook-readiness";
import {
  DERIVATIONS_POINT,
  issue,
  known,
  readDefinition,
  readField,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";
import { z } from "zod";

export type ScrollPlace =
  | { readonly kind: "inventory"; readonly lineId: string }
  | {
      readonly kind: "book";
      readonly bookRecordId: string;
      readonly bookLineId: string;
    };

export interface ScrollView {
  /** The line id while loose, the entry id while mounted: the same id either way. */
  readonly id: string;
  readonly spell: string;
  readonly name: string;
  /** The spell's own level. */
  readonly level?: number;
  /** The level it was scribed at. */
  readonly castLevel: number;
  readonly spent: boolean;
  readonly scribe?: string;
  readonly snapshot?: Readonly<Record<string, unknown>>;
  readonly place: ScrollPlace;
  /** Mounting or removal at this scroll's level, when the ruleset defines it. */
  readonly mounting: Value<MountingCost>;
}

const SpellName = z.looseObject({
  name: z.string(),
  level: z.number().int().min(0).max(9),
});

const BookEntries = z.array(
  z.looseObject({
    id: z.string(),
    ref: z.string(),
    scroll: ScrollState.optional(),
  }),
);

function list(ctx: ResolveContext): Value<readonly ScrollView[]> {
  const lines = ctx.get<readonly LineRow[]>("containers.lines");
  if (lines.kind === "unresolved") return lines;
  const mounting = ctx.get<readonly MountingCost[]>("scroll-crafting.mounting");

  const view = (
    id: string,
    state: ScrollState,
    place: ScrollPlace,
  ): ScrollView => {
    const def = readDefinition(ctx, state.spell, "spell", SpellName);
    if (!def.ok)
      ctx.report(issue("error", "scrolls.unresolved-spell", def.reason, id));
    const cost: Value<MountingCost> =
      mounting.kind === "unresolved"
        ? mounting
        : (() => {
            const row = mounting.value.find((m) => m.level === state.castLevel);
            return row
              ? known(row, `Mounting a level ${state.castLevel} scroll`)
              : {
                  kind: "unresolved" as const,
                  reason: `No mounting cost for level ${state.castLevel}.`,
                };
          })();
    return {
      id,
      spell: state.spell,
      name: def.ok ? def.value.name : state.spell,
      ...(def.ok ? { level: def.value.level } : {}),
      castLevel: state.castLevel,
      spent: state.spent === true,
      ...(state.scribe ? { scribe: state.scribe } : {}),
      ...(state.snapshot ? { snapshot: state.snapshot } : {}),
      place,
      mounting: cost,
    };
  };

  const loose = lines.value.flatMap((row) => {
    const parsed = ScrollState.safeParse(
      (row.line as { scroll?: unknown }).scroll,
    );
    if ((row.line as { scroll?: unknown }).scroll === undefined) return [];
    if (!parsed.success) {
      ctx.report(
        issue(
          "error",
          "scrolls.invalid",
          `${row.line.id} has scroll data that cannot be read.`,
          row.line.id,
        ),
      );
      return [];
    }
    return [
      view(row.line.id, parsed.data, {
        kind: "inventory",
        lineId: row.line.id,
      }),
    ];
  });

  const mounted = readField(ctx, "spellbook", "entries", BookEntries).flatMap(
    ({ record, value }) =>
      value.flatMap((e) =>
        e.scroll
          ? [
              view(e.id, e.scroll, {
                kind: "book",
                bookRecordId: record.id,
                bookLineId: String((record.data as { book?: unknown }).book),
              }),
            ]
          : [],
      ),
  );

  const all = [...loose, ...mounted];
  return known(all, "Scrolls", {
    note: `${all.length} scrolls, ${all.filter((s) => s.spent).length} spent`,
  });
}

export const scrolls: KernelModule = {
  manifest: {
    id: "scrolls",
    version: "1.0.0",
    requires: [
      { id: "containers", range: "^1.0.0" },
      { id: "spellbook-readiness", range: "^1.0.0" },
    ],
    extends: [DERIVATIONS_POINT],
    provides: {},
  },
  setup: (ctx) =>
    ctx.extend(DERIVATIONS_POINT, { key: "scrolls.list", compute: list }),
};
