// Feats, class features, species traits and background benefits as grant sources. The
// character lists every feature it has, with any choices made (for example which skill Scholar
// gives Expertise in). Each definition's grants fill `{choice}` placeholders from those choices.
// A missing or malformed definition grants nothing and is listed as unresolved.

import {
  DERIVATIONS_POINT,
  GRANT_SOURCES_POINT,
  applyChoices,
  issue,
  known,
  parseGrants,
  readDefinition,
  readField,
  type Grant,
  type GrantSource,
  type KernelModule,
  type ResolveContext,
  type SourcedGrant,
} from "@hearthtable/kernel";
import { z } from "zod";

const FeatureLine = z.looseObject({
  ref: z.string(),
  /** Where it came from, e.g. `Human (Versatile)` or `Wizard 2`. */
  from: z.string().optional(),
  choices: z.record(z.string(), z.string()).optional(),
});

const FeatureDefinition = z.looseObject({
  name: z.string(),
  grants: z.unknown().optional(),
});

export interface FeatureRow {
  readonly ref: string;
  readonly name: string;
  readonly from?: string;
  readonly status: "resolved" | "unresolved";
  readonly reason?: string;
  readonly grants: readonly Grant[];
}

function featureRows(ctx: ResolveContext): readonly FeatureRow[] {
  const lines = readField(
    ctx,
    "character",
    "features",
    z.array(FeatureLine),
  ).flatMap((f) => f.value);
  return lines.map((line): FeatureRow => {
    const from = line.from === undefined ? {} : { from: line.from };
    const def = readDefinition(ctx, line.ref, "feature", FeatureDefinition);
    if (!def.ok) {
      ctx.report(issue("error", "features.unresolved", def.reason, line.ref));
      return {
        ref: line.ref,
        name: line.ref,
        ...from,
        status: "unresolved",
        reason: def.reason,
        grants: [],
      };
    }
    const parsed = parseGrants(def.value.grants, `${line.ref}.grants`);
    const filled = parsed.ok
      ? parsed.value.map((g) => applyChoices(g, line.choices ?? {}))
      : [];
    const problems = [
      ...(parsed.ok ? [] : parsed.issues),
      ...filled.flatMap((r) => (r.ok ? [] : r.issues)),
    ];
    if (problems.length > 0) {
      const reason = problems.map((p) => p.message).join("; ");
      ctx.report(
        issue(
          "error",
          "features.bad-grants",
          `${def.value.name}: ${reason}`,
          line.ref,
        ),
      );
      return {
        ref: line.ref,
        name: def.value.name,
        ...from,
        status: "unresolved",
        reason,
        grants: [],
      };
    }
    return {
      ref: line.ref,
      name: def.value.name,
      ...from,
      status: "resolved",
      grants: filled.flatMap((r) => (r.ok ? [r.value] : [])),
    };
  });
}

const source: GrantSource = (ctx) => {
  const rows = ctx.get<readonly FeatureRow[]>("features.list");
  if (rows.kind === "unresolved") return [];
  return rows.value.flatMap((row) =>
    row.grants.map((grant): SourcedGrant => ({
      grant,
      source: { id: row.ref, label: row.name },
    })),
  );
};

export const features: KernelModule = {
  manifest: {
    id: "features",
    version: "1.0.0",
    requires: [],
    extends: [DERIVATIONS_POINT, GRANT_SOURCES_POINT],
    provides: { recordKinds: ["feature"] },
  },
  setup: (ctx) => {
    ctx.extend(DERIVATIONS_POINT, {
      key: "features.list",
      compute: (rc: ResolveContext) => known(featureRows(rc), "Features"),
    });
    ctx.extend(GRANT_SOURCES_POINT, source);
  },
};
