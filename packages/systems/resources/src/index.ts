// Limited-use resource pools with their reset type, such as Arcane Recovery (long rest) or
// Tinker's Magic (INT modifier uses per long rest). Pools come from `resource` grants; grants
// with the same pool name add their maximums together (Character Creation and Advancement).
// Uses spent are recorded on the character; resting is not part of Milestone 2.

import {
  DERIVATIONS_POINT,
  amountValue,
  grantsOf,
  issue,
  known,
  readField,
  sum,
  type KernelModule,
  type ResolveContext,
  type Value,
} from "@hearthtable/kernel";
import { z } from "zod";

const ResourceState = z.looseObject({
  used: z.record(z.string(), z.number().int().min(0)).optional(),
});

export interface ResourcePool {
  readonly pool: string;
  readonly reset: string;
  readonly max: Value<number>;
  readonly used: number;
  readonly remaining: Value<number>;
}

function pools(ctx: ResolveContext): readonly ResourcePool[] {
  const used =
    readField(ctx, "character", "resources", ResourceState.optional())[0]?.value
      ?.used ?? {};
  const byPool = new Map<
    string,
    ReturnType<typeof grantsOf<"resource">>[number][]
  >();
  for (const g of grantsOf(ctx, "resource")) {
    byPool.set(g.grant.pool, [...(byPool.get(g.grant.pool) ?? []), g]);
  }
  return [...byPool].map(([pool, grants]): ResourcePool => {
    const resets = [...new Set(grants.map((g) => g.grant.reset))];
    if (resets.length > 1) {
      ctx.report(
        issue(
          "warning",
          "resources.mixed-reset",
          `${pool} has sources with different resets: ${resets.join(", ")}.`,
          pool,
        ),
      );
    }
    const max = sum(
      pool,
      grants.map((g) =>
        amountValue(ctx, g.grant.max, g.source.label, g.source.note),
      ),
    );
    const spent = used[pool] ?? 0;
    const remaining: Value<number> =
      max.kind === "unresolved"
        ? max
        : known(max.value - spent, `${pool} remaining`, {
            note: `${spent} used of ${max.value}`,
          });
    if (max.kind === "known" && spent > max.value) {
      ctx.report(
        issue(
          "warning",
          "resources.overspent",
          `${pool}: ${spent} used of ${max.value}.`,
          pool,
        ),
      );
    }
    return { pool, reset: resets.join(" / "), max, used: spent, remaining };
  });
}

export const resources: KernelModule = {
  manifest: {
    id: "resources",
    version: "1.0.0",
    requires: [],
    extends: [DERIVATIONS_POINT],
    provides: {},
  },
  setup: (ctx) =>
    ctx.extend(DERIVATIONS_POINT, {
      key: "resources.pools",
      compute: (rc: ResolveContext) => known(pools(rc), "Resources"),
    }),
};
