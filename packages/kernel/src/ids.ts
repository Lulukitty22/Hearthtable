// Record identities are readable and derived from the name (user decision, 2026-10-22).
// A name is the identity: renaming means duplicating under the new name, and nothing that
// referenced the old name is rewritten. Capitalization and spaces versus underscores do not
// distinguish two names (the duplicate-name rule), so both normalize to the same key.

import { fail, issue, ok, type Result } from "./validation";

/** `<scope>:<key>`, e.g. `core:fireball` or `campaign:aetherlock`. */
export type RecordId = `${string}:${string}`;

const SCOPE = /^[a-z0-9][a-z0-9-]*$/;

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

export function makeId(scope: string, name: string): Result<RecordId> {
  const key = nameKey(name);
  if (!SCOPE.test(scope)) {
    return fail([
      issue(
        "error",
        "id.bad-scope",
        `Scope "${scope}" must be lowercase letters, digits or hyphens.`,
      ),
    ]);
  }
  if (key === "")
    return fail([issue("error", "id.empty-name", "A name cannot be empty.")]);
  // Firestore document IDs cannot contain "/" and cannot be "." or "..".
  if (key.includes("/") || key === "." || key === "..") {
    return fail([
      issue(
        "error",
        "id.bad-name",
        `Name "${name}" cannot contain "/" or be "." or "..".`,
      ),
    ]);
  }
  return ok(`${scope}:${key}` as RecordId);
}

export function parseId(id: string): Result<{ scope: string; key: string }> {
  const at = id.indexOf(":");
  if (at <= 0 || at === id.length - 1) {
    return fail([
      issue(
        "error",
        "id.malformed",
        `"${id}" is not a "<scope>:<name>" identity.`,
      ),
    ]);
  }
  return ok({ scope: id.slice(0, at), key: id.slice(at + 1) });
}
