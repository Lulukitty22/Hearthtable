// A record's identity is its full path (user decisions, 2026-10-22): owner, folders and name,
// keeping the chosen capitalization, such as `account/VR_Lulu/Characters/Carol_Elfnein`,
// `account/VR_Lulu/Items/Aetherlock` or `core/Fireball`. Spaces become underscores. Two names
// that differ only in capitalization or spaces versus underscores are still the same name
// (the duplicate-name rule): compare with `sameName` or `nameKey`, never with `===` on input.
// Renaming means duplicating under the new name and moving means copying; nothing that
// referenced the old path is rewritten.

import { fail, issue, ok, type Result } from "./validation";

/** `<scope>/…/<Name>`, e.g. `core/Fireball` or `account/VR_Lulu/Characters/Carol_Elfnein`. */
export type RecordId = `${string}/${string}`;

export const ID_SCOPES = ["core", "account", "campaign"] as const;

/** The key two names are compared by: lowercased, spaces and underscores the same. */
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

/** A name as it appears in a path: capitals kept, spaces as underscores. */
export function pathSegment(name: string): string {
  return name.trim().replace(/[\s_]+/g, "_");
}

/** Builds an identity from display names, e.g. `makeId(["account", "VR_Lulu", "Characters"], "Carol Elfnein")`. */
export function makeId(
  path: readonly string[],
  name: string,
): Result<RecordId> {
  const segments = [...path, name].map(pathSegment);
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
  if (segments.length < 2) return bad("must be a path such as core/Fireball");
  if (!(ID_SCOPES as readonly string[]).includes(scope))
    return bad(`must start with ${ID_SCOPES.join(", ")}`);
  if (scope !== "core" && segments.length < 3)
    return bad(`needs the owning ${scope} after "${scope}/"`);
  if (
    segments.some(
      (s) => s === "" || s !== pathSegment(s) || s === "." || s === "..",
    )
  ) {
    return bad("has a segment that is empty or contains spaces");
  }
  return ok({ scope, segments, name: segments[segments.length - 1] as string });
}

/** Whether two paths name the same record under the duplicate-name rule. */
export function samePath(a: string, b: string): boolean {
  const as = a.split("/");
  const bs = b.split("/");
  return (
    as.length === bs.length && as.every((s, i) => sameName(s, bs[i] as string))
  );
}
