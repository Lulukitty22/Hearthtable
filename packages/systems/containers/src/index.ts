// Inventory lines, nesting, accessibility, capacity and carried weight (Spell Containers and
// Consumable Sources). A line is an owned instance: a reference to an item definition plus its
// own state (quantity, parent container, attunement …). Depth counts enclosing containers from
// the inventory root; a line is accessible when its depth is at most `maxAccessibleDepth`.
// Unknown measurements are never treated as zero: totals say how many are unknown. Capacity
// problems are warnings; an explicit override keeps the contents and the warning visible.

import {
  DERIVATIONS_POINT,
  issue,
  known,
  readDefinition,
  readField,
  type KernelModule,
  type ResolveContext,
} from "@hearthtable/kernel";
import { z } from "zod";

export const InventoryLine = z.looseObject({
  id: z.string(),
  ref: z.string(),
  quantity: z.number().int().min(0),
  parent: z.string().optional(),
  capacityOverride: z.boolean().optional(),
});
export type InventoryLine = z.infer<typeof InventoryLine>;

export const ItemDefinition = z.looseObject({
  name: z.string(),
  /** Pounds per unit; absent means unknown, not zero. */
  weight: z.number().min(0).optional(),
  /** Cubic feet per unit; absent means unknown. */
  volume: z.number().min(0).optional(),
  container: z
    .object({
      maxWeight: z.number().min(0).optional(),
      maxVolume: z.number().min(0).optional(),
      maxCount: z.number().int().min(0).optional(),
      /** False for extradimensional storage such as a Bag of Holding (fixed carried weight). */
      contentsAddWeight: z.boolean(),
    })
    .optional(),
});
export type ItemDefinition = z.infer<typeof ItemDefinition>;

export interface LineRow {
  readonly line: InventoryLine;
  readonly name: string;
  readonly definition?: ItemDefinition;
  readonly status: "resolved" | "unresolved";
  readonly reason?: string;
  /** Enclosing containers from the root; undefined when the chain is broken. */
  readonly depth?: number;
  readonly accessible: boolean;
}

export interface Weight {
  readonly pounds: number;
  /** Lines whose weight is unknown and therefore not included. */
  readonly unknown: number;
}

function lines(ctx: ResolveContext): readonly InventoryLine[] {
  return readField(ctx, "inventory", "lines", z.array(InventoryLine)).flatMap(
    (f) => f.value,
  );
}

function rows(ctx: ResolveContext): readonly LineRow[] {
  const all = lines(ctx);
  const byId = new Map<string, InventoryLine>();
  for (const l of all) {
    if (byId.has(l.id))
      ctx.report(
        issue(
          "error",
          "containers.duplicate-line",
          `Two inventory lines share id ${l.id}.`,
          l.id,
        ),
      );
    byId.set(l.id, l);
  }
  const maxDepth = ctx.settings.variable<number | "unlimited">(
    "containers.maxAccessibleDepth",
  );

  const depthOf = (line: InventoryLine): number | string => {
    const seen = new Set<string>([line.id]);
    let depth = 0;
    let current = line;
    while (current.parent !== undefined) {
      const parent = byId.get(current.parent);
      if (!parent) return `its container ${current.parent} is missing`;
      if (seen.has(parent.id)) return "its containers form a loop";
      seen.add(parent.id);
      depth++;
      current = parent;
    }
    return depth;
  };

  return all.map((line): LineRow => {
    const def = readDefinition(ctx, line.ref, "item", ItemDefinition);
    const depth = depthOf(line);
    if (typeof depth === "string") {
      ctx.report(
        issue(
          "error",
          "containers.broken-nesting",
          `${line.id}: ${depth}.`,
          line.id,
        ),
      );
    }
    const parent =
      line.parent === undefined ? undefined : byId.get(line.parent);
    if (parent) {
      const parentDef = readDefinition(ctx, parent.ref, "item", ItemDefinition);
      if (parentDef.ok && !parentDef.value.container) {
        ctx.report(
          issue(
            "error",
            "containers.not-a-container",
            `${line.id} is inside ${parentDef.value.name}, which is not a container.`,
            line.id,
          ),
        );
      }
    }
    const accessible =
      typeof depth === "number" &&
      maxDepth.kind === "known" &&
      (maxDepth.value === "unlimited" || depth <= maxDepth.value);
    const shared = {
      line,
      accessible,
      ...(typeof depth === "number" ? { depth } : {}),
    };
    if (!def.ok) {
      ctx.report(
        issue(
          "error",
          "containers.unresolved",
          `${line.id}: ${def.reason}`,
          line.id,
        ),
      );
      return {
        ...shared,
        name: line.ref,
        status: "unresolved",
        reason: def.reason,
      };
    }
    return {
      ...shared,
      name: def.value.name,
      definition: def.value,
      status: "resolved",
    };
  });
}

/** Weight a line adds to whatever holds it. */
function carried(
  row: LineRow,
  children: ReadonlyMap<string, readonly LineRow[]>,
  seen: ReadonlySet<string> = new Set(),
): Weight {
  // Broken (looping) nesting is reported elsewhere; never walk it twice.
  if (seen.has(row.line.id)) return { pounds: 0, unknown: 0 };
  const path = new Set([...seen, row.line.id]);
  const own = row.definition?.weight;
  let pounds = own === undefined ? 0 : own * row.line.quantity;
  let unknown = own === undefined && row.line.quantity > 0 ? 1 : 0;
  if (row.definition?.container?.contentsAddWeight !== false) {
    for (const child of children.get(row.line.id) ?? []) {
      const w = carried(child, children, path);
      pounds += w.pounds;
      unknown += w.unknown;
    }
  }
  return { pounds, unknown };
}

function checkCapacity(
  ctx: ResolveContext,
  all: readonly LineRow[],
  children: ReadonlyMap<string, readonly LineRow[]>,
) {
  for (const row of all) {
    const limits = row.definition?.container;
    if (!limits) continue;
    const inside = children.get(row.line.id) ?? [];
    const contents = inside.reduce(
      (acc, c) => {
        const w = carried(c, children);
        const v = c.definition?.volume;
        return {
          pounds: acc.pounds + w.pounds,
          unknownWeight: acc.unknownWeight + w.unknown,
          volume: acc.volume + (v ?? 0) * c.line.quantity,
          unknownVolume: acc.unknownVolume + (v === undefined ? 1 : 0),
          count: acc.count + c.line.quantity,
        };
      },
      { pounds: 0, unknownWeight: 0, volume: 0, unknownVolume: 0, count: 0 },
    );
    const over: string[] = [];
    if (limits.maxWeight !== undefined && contents.pounds > limits.maxWeight)
      over.push(`${contents.pounds} lb of ${limits.maxWeight} lb`);
    if (limits.maxVolume !== undefined && contents.volume > limits.maxVolume)
      over.push(`${contents.volume} cu ft of ${limits.maxVolume} cu ft`);
    if (limits.maxCount !== undefined && contents.count > limits.maxCount)
      over.push(`${contents.count} items of ${limits.maxCount}`);
    if (over.length > 0) {
      const note = row.line.capacityOverride
        ? " (kept by explicit override)"
        : "";
      ctx.report(
        issue(
          "warning",
          "containers.over-capacity",
          `${row.name} holds ${over.join(", ")}${note}.`,
          row.line.id,
        ),
      );
    }
    const unknown =
      (limits.maxWeight !== undefined ? contents.unknownWeight : 0) +
      (limits.maxVolume !== undefined ? contents.unknownVolume : 0);
    if (unknown > 0) {
      ctx.report(
        issue(
          "info",
          "containers.unknown-measurements",
          `${row.name}: fit not verified, ${unknown} contents have unknown weight or volume.`,
          row.line.id,
        ),
      );
    }
  }
}

export const containers: KernelModule = {
  manifest: {
    id: "containers",
    version: "1.0.0",
    requires: [],
    extends: [DERIVATIONS_POINT],
    provides: {
      recordKinds: ["inventory", "item"],
      ruleVariables: [
        { name: "maxAccessibleDepth", type: "integer", allowUnlimited: true },
      ],
    },
  },
  setup: (ctx) => {
    ctx.extend(DERIVATIONS_POINT, {
      key: "containers.lines",
      compute: (rc: ResolveContext) => {
        const all = rows(rc);
        const children = new Map<string, LineRow[]>();
        for (const r of all) {
          if (r.line.parent !== undefined)
            children.set(r.line.parent, [
              ...(children.get(r.line.parent) ?? []),
              r,
            ]);
        }
        checkCapacity(rc, all, children);
        return known(all, "Inventory");
      },
    });
    ctx.extend(DERIVATIONS_POINT, {
      key: "containers.carriedWeight",
      compute: (rc: ResolveContext) => {
        const all = rc.get<readonly LineRow[]>("containers.lines");
        if (all.kind === "unresolved") return all;
        const children = new Map<string, LineRow[]>();
        for (const r of all.value) {
          if (r.line.parent !== undefined)
            children.set(r.line.parent, [
              ...(children.get(r.line.parent) ?? []),
              r,
            ]);
        }
        const total = all.value
          .filter((r) => r.line.parent === undefined)
          .reduce<Weight>(
            (acc, r) => {
              const w = carried(r, children);
              return {
                pounds: acc.pounds + w.pounds,
                unknown: acc.unknown + w.unknown,
              };
            },
            { pounds: 0, unknown: 0 },
          );
        return known(total, "Carried weight", {
          note:
            total.unknown > 0
              ? `${total.unknown} items of unknown weight not included`
              : "all weights known",
        });
      },
    });
  },
};
