// A record's identity is its full path (user decisions, 2026-10-22): owner, folders and name,
// such as `account/vrlulu/carol_elfnein`, `campaign/moonlit_coast/characters/vrlulu/carol_elfnein`
// or `core/fireball`. Each segment is normalized by the duplicate-name rule, so capitalization
// and spaces versus underscores do not distinguish two names. Renaming means duplicating under
// the new name and moving means copying; nothing that referenced the old path is rewritten.

import { fail, issue, ok, type Result } from "./validation";

/** `<scope>/…/<name>`, e.g. `core/fireball` or `account/vrlulu/carol_elfnein`. */
export type RecordId = `${string}/${string}`;

export const ID_SCOPES = ["core", "account", "campaign"] as const;

/** Normalizes a display name to its identity key. */
export function nameKey(name: string): string {
  return name
    .trim()
    .replace(/[\s_]+/g, "_")
    .toLowerCase();
}

/** Names two entries would collide on, under the duplicate-name rule. */
export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

/** Builds an identity from display names, e.g. `makeId(["account", "VRLulu"], "Carol Elfnein")`. */
export function makeId(
  path: readonly string[],
  name: string,
): Result<RecordId> {
  const segments = [...path, name].map(nameKey);
  const bad = segments.find(
    (s) => s === "" || s.includes("/") || s === "." || s === "..",
  );
  if (bad !== undefined) {
    return fail([
      issue(
        "error",
        "id.bad-segment",
        `"${[...path, name].join(" / ")}": names cannot be empty, contain "/", or be "." or "..".`,
      ),
    ]);
  }
  const id = segments.join("/");
  const parsed = parseId(id);
  return parsed.ok ? ok(id as RecordId) : fail(parsed.issues);
}

export function parseId(
  id: string,
): Result<{ scope: string; segments: readonly string[]; name: string }> {
  const segments = id.split("/");
  const scope = segments[0] as string;
  const bad = (why: string) =>
    fail<never>([issue("error", "id.malformed", `"${id}" ${why}.`)]);
  if (segments.length < 2) return bad("must be a path such as core/fireball");
  if (!(ID_SCOPES as readonly string[]).includes(scope))
    return bad(`must start with ${ID_SCOPES.join(", ")}`);
  if (scope !== "core" && segments.length < 3)
    return bad(`needs the owning ${scope} after "${scope}/"`);
  if (segments.some((s) => s === "" || s !== nameKey(s)))
    return bad("has a segment that is empty or not normalized");
  return ok({ scope, segments, name: segments[segments.length - 1] as string });
}
