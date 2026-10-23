// The storage boundary. The engine never imports Firebase: views save and load records through
// a Repository, and adapters decide where they live (memory for tests, Firestore for the app).
//
// Saving never loses data (Lessons from Character Manager):
// - records are written from their envelopes, so fields the code does not know survive;
// - every save names the revision it was edited from, and a save against a newer stored
//   revision is refused as a conflict, never applied over it;
// - a save of several records is all or nothing, so a sheet never points at half-written data.

import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";

export type StorageError =
  | {
      readonly code: "conflict";
      readonly id: string;
      /** The revision the save was edited from. */
      readonly expected: number;
      /** The stored revision, or undefined when the record no longer exists. */
      readonly actual: number | undefined;
      readonly message: string;
    }
  | { readonly code: "invalid"; readonly id: string; readonly message: string }
  | { readonly code: "unavailable"; readonly message: string };

export type StorageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly StorageError[] };

export interface SaveOptions {
  /** Timestamp written to `updatedAt`; defaults to now. */
  readonly now?: string;
}

export interface Repository {
  /** One record, or undefined when it does not exist. */
  get(id: RecordId): Promise<StorageResult<RecordEnvelope | undefined>>;
  /** The record at `path` and every record whose path starts with `path/`, such as a sheet's tabs. */
  listUnder(path: string): Promise<StorageResult<readonly RecordEnvelope[]>>;
  /**
   * Saves records together. Each record's `revision` must equal the stored revision; a record
   * that does not exist yet must have revision 0. On success each is stored with revision + 1 and
   * a new `updatedAt`, and the stored versions are returned. Any conflict saves nothing.
   */
  save(
    records: readonly RecordEnvelope[],
    options?: SaveOptions,
  ): Promise<StorageResult<readonly RecordEnvelope[]>>;
  /** Deletes a record, if it is still at `expectedRevision`. */
  delete(id: RecordId, expectedRevision: number): Promise<StorageResult<void>>;
}

export function conflict(
  id: string,
  expected: number,
  actual: number | undefined,
): StorageError {
  const message =
    actual === undefined
      ? `${id} no longer exists (edited from revision ${expected}).`
      : expected === 0
        ? `${id} already exists (revision ${actual}).`
        : `${id} was changed elsewhere: edited from revision ${expected}, stored revision is ${actual}.`;
  return { code: "conflict", id, expected, actual, message };
}

/** Every path a record sits under, e.g. `account`, `account/VRLulu`, `account/VRLulu/Characters`. */
export function ancestorsOf(id: string): readonly string[] {
  const parts = id.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** Firestore cannot store `undefined`; remove the field instead. Reports where one occurs. */
export function undefinedPath(value: unknown, path = ""): string | undefined {
  if (value === undefined) return path || "(the value itself)";
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const inner = undefinedPath(item, `${path}[${i}]`);
      if (inner) return inner;
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      const inner = undefinedPath(v, path ? `${path}.${k}` : k);
      if (inner) return inner;
    }
  }
  return undefined;
}

/** Firestore cannot store a list directly inside a list; report where one occurs. */
export function nestedListPath(value: unknown, path = ""): string | undefined {
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      if (Array.isArray(item)) return `${path}[${i}]`;
      const inner = nestedListPath(item, `${path}[${i}]`);
      if (inner) return inner;
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      const inner = nestedListPath(v, path ? `${path}.${k}` : k);
      if (inner) return inner;
    }
  }
  return undefined;
}
