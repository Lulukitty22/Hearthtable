// The module registry. Modules declare what they need (`requires`), which extension points
// they attach to (`extends`) and what they offer (`provides`). Building the registry checks the
// removal test from the placement rules: if deleting module X would break module Y, Y must list X
// in `requires`. Anything a module uses without declaring it is an error, not a silent link.

import { isValidRange, parseVersion, satisfies } from "./semver";
import { fail, issue, ok, type Issue, type Result } from "./validation";

export type RuleValue = number | boolean | string | "unlimited";

export interface RuleVariable {
  /** Local name; the full key is `<moduleId>.<name>`, e.g. `containers.maxAccessibleDepth`. */
  readonly name: string;
  readonly type: "integer" | "number" | "boolean" | "string";
  /** Whether the explicit value `unlimited` is accepted. */
  readonly allowUnlimited?: boolean;
  /** Used when a ruleset does not set the variable; with no default it shows as unresolved. */
  readonly default?: RuleValue;
}

export interface MethodSlot {
  /** Local name; the full key is `<moduleId>.<slot>`, e.g. `spellbook-readiness.readiness`. */
  readonly slot: string;
  readonly options: readonly string[];
  readonly default?: string;
}

export interface ModuleManifest {
  readonly id: string;
  readonly version: string;
  readonly requires: readonly { readonly id: string; readonly range: string }[];
  /** Full extension point ids this module contributes to, e.g. `damage.mitigationSteps`. */
  readonly extends: readonly string[];
  readonly provides: {
    /** Full ids of points this module publishes; they must start with `<moduleId>.`. */
    readonly extensionPoints?: readonly string[];
    readonly methods?: readonly MethodSlot[];
    readonly recordKinds?: readonly string[];
    readonly ruleVariables?: readonly RuleVariable[];
    readonly uiTabs?: readonly string[];
  };
}

export interface ModuleContext {
  /** Adds a contribution to an extension point this module declared in `extends`. */
  extend(pointId: string, contribution: unknown, order?: number): void;
}

export interface KernelModule {
  readonly manifest: ModuleManifest;
  readonly setup?: (ctx: ModuleContext) => void;
}

/** The kernel's own points. Contributing to them needs no `requires` entry. */
export const KERNEL_MODULE_ID = "kernel";
export const DERIVATIONS_POINT = "kernel.derivations";
const KERNEL_POINTS = [DERIVATIONS_POINT] as const;

export interface Registry {
  readonly modules: ReadonlyMap<string, ModuleManifest>;
  /** Contributions per extension point, in `order`, then dependency, then registration order. */
  contributions<T>(pointId: string): readonly T[];
  hasModule(id: string): boolean;
}

export function buildRegistry(
  modules: readonly KernelModule[],
): Result<Registry> {
  const issues: Issue[] = [];
  const byId = new Map<string, KernelModule>();
  for (const m of modules) {
    const { id, version } = m.manifest;
    if (id === KERNEL_MODULE_ID)
      issues.push(
        issue("error", "registry.reserved-id", `"${id}" is reserved.`, id),
      );
    else if (byId.has(id))
      issues.push(
        issue(
          "error",
          "registry.duplicate-module",
          `Module "${id}" is registered twice.`,
          id,
        ),
      );
    else byId.set(id, m);
    if (!parseVersion(version)) {
      issues.push(
        issue(
          "error",
          "registry.bad-version",
          `Module "${id}" version "${version}" is not x.y.z.`,
          id,
        ),
      );
    }
  }

  const pointOwner = new Map<string, string>(
    KERNEL_POINTS.map((p) => [p, KERNEL_MODULE_ID]),
  );
  for (const { manifest } of byId.values()) {
    for (const point of manifest.provides.extensionPoints ?? []) {
      if (!point.startsWith(`${manifest.id}.`)) {
        issues.push(
          issue(
            "error",
            "registry.point-namespace",
            `Point "${point}" must start with "${manifest.id}.".`,
            manifest.id,
          ),
        );
      } else if (pointOwner.has(point)) {
        issues.push(
          issue(
            "error",
            "registry.duplicate-point",
            `Point "${point}" is published twice.`,
            manifest.id,
          ),
        );
      } else {
        pointOwner.set(point, manifest.id);
      }
    }
  }

  for (const { manifest } of byId.values()) {
    const required = new Set(manifest.requires.map((r) => r.id));
    for (const { id: dep, range } of manifest.requires) {
      const target = byId.get(dep);
      if (!isValidRange(range)) {
        issues.push(
          issue(
            "error",
            "registry.bad-range",
            `"${manifest.id}" requires "${dep}@${range}", an invalid range.`,
            manifest.id,
          ),
        );
      } else if (!target) {
        issues.push(
          issue(
            "error",
            "registry.missing-dependency",
            `"${manifest.id}" requires "${dep}", which is not registered.`,
            manifest.id,
          ),
        );
      } else if (!satisfies(target.manifest.version, range)) {
        issues.push(
          issue(
            "error",
            "registry.version-mismatch",
            `"${manifest.id}" requires "${dep}@${range}" but ${target.manifest.version} is registered.`,
            manifest.id,
          ),
        );
      }
    }
    for (const point of manifest.extends) {
      const owner = pointOwner.get(point);
      if (owner === undefined) {
        issues.push(
          issue(
            "error",
            "registry.unknown-point",
            `"${manifest.id}" extends "${point}", which no module publishes.`,
            manifest.id,
          ),
        );
      } else if (
        owner !== KERNEL_MODULE_ID &&
        owner !== manifest.id &&
        !required.has(owner)
      ) {
        issues.push(
          issue(
            "error",
            "registry.undeclared-dependency",
            `"${manifest.id}" extends "${point}" from "${owner}" without requiring "${owner}".`,
            manifest.id,
          ),
        );
      }
    }
  }

  const order = topologicalOrder(byId, issues);
  if (issues.length > 0 || order === undefined) return fail(issues);

  const collected = new Map<
    string,
    { item: unknown; order: number; seq: number }[]
  >();
  let seq = 0;
  for (const id of order) {
    const module = byId.get(id) as KernelModule;
    const allowed = new Set(module.manifest.extends);
    module.setup?.({
      extend(pointId, contribution, rank = 0) {
        if (!allowed.has(pointId)) {
          issues.push(
            issue(
              "error",
              "registry.undeclared-extension",
              `"${id}" contributed to "${pointId}" without listing it in "extends".`,
              id,
            ),
          );
          return;
        }
        const list = collected.get(pointId) ?? [];
        list.push({ item: contribution, order: rank, seq: seq++ });
        collected.set(pointId, list);
      },
    });
  }
  if (issues.length > 0) return fail(issues);

  const manifests = new Map(
    [...byId].map(([id, m]) => [id, m.manifest] as const),
  );
  return ok({
    modules: manifests,
    contributions<T>(pointId: string) {
      return (collected.get(pointId) ?? [])
        .sort((a, b) => a.order - b.order || a.seq - b.seq)
        .map((c) => c.item as T);
    },
    hasModule: (id) => byId.has(id),
  });
}

function topologicalOrder(
  byId: ReadonlyMap<string, KernelModule>,
  issues: Issue[],
): string[] | undefined {
  const done = new Set<string>();
  const visiting = new Set<string>();
  const out: string[] = [];
  let cyclic = false;
  const visit = (id: string, path: string[]) => {
    if (done.has(id) || !byId.has(id)) return;
    if (visiting.has(id)) {
      cyclic = true;
      issues.push(
        issue(
          "error",
          "registry.cycle",
          `Dependency cycle: ${[...path, id].join(" → ")}.`,
          id,
        ),
      );
      return;
    }
    visiting.add(id);
    for (const dep of (byId.get(id) as KernelModule).manifest.requires)
      visit(dep.id, [...path, id]);
    visiting.delete(id);
    done.add(id);
    out.push(id);
  };
  for (const id of byId.keys()) visit(id, []);
  return cyclic ? undefined : out;
}
