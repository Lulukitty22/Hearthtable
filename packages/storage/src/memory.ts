// An in-memory Repository for tests. It stores serialized envelopes, exactly as Firestore
// would, so tests exercise the same lossless round trip.

import {
  parseEnvelope,
  serializeEnvelope,
  type RecordEnvelope,
  type RecordId,
} from "@hearthtable/kernel";
import {
  conflict,
  nestedListPath,
  undefinedPath,
  type Repository,
  type StorageError,
  type StorageResult,
} from "./repository";

export function memoryRepository(
  initial: readonly RecordEnvelope[] = [],
): Repository {
  const stored = new Map<string, Record<string, unknown>>();
  for (const r of initial) stored.set(r.id, serializeEnvelope(r));
  const watchers = new Set<() => void>();
  const notify = () => {
    for (const w of watchers) w();
  };

  const read = (
    raw: Record<string, unknown>,
  ): StorageResult<RecordEnvelope> => {
    const parsed = parseEnvelope(structuredClone(raw));
    return parsed.ok
      ? { ok: true, value: parsed.value }
      : {
          ok: false,
          errors: [
            {
              code: "invalid",
              id: String(raw["id"]),
              message: parsed.issues.map((i) => i.message).join("; "),
            },
          ],
        };
  };

  return {
    async get(id) {
      const raw = stored.get(id);
      return raw ? read(raw) : { ok: true, value: undefined };
    },

    async listUnder(path) {
      const out: RecordEnvelope[] = [];
      for (const [id, raw] of stored) {
        if (id !== path && !id.startsWith(`${path}/`)) continue;
        const r = read(raw);
        if (!r.ok) return r;
        out.push(r.value);
      }
      return { ok: true, value: out };
    },

    async save(records, options) {
      const now = options?.now ?? new Date().toISOString();
      const errors: StorageError[] = [];
      const seen = new Set<string>();
      for (const r of records) {
        if (seen.has(r.id))
          errors.push({
            code: "invalid",
            id: r.id,
            message: `${r.id} appears twice in one save.`,
          });
        seen.add(r.id);
        const current = stored.get(r.id);
        const actual = current ? (current["revision"] as number) : undefined;
        if (
          (actual === undefined && r.revision !== 0) ||
          (actual !== undefined && actual !== r.revision)
        ) {
          errors.push(conflict(r.id, r.revision, actual));
        }
        const missing = undefinedPath(r.data);
        if (missing)
          errors.push({
            code: "invalid",
            id: r.id,
            message: `${r.id}: data.${missing} is undefined; remove the field instead of setting it to undefined.`,
          });
        const nested = nestedListPath(r.data);
        if (nested)
          errors.push({
            code: "invalid",
            id: r.id,
            message: `${r.id}: data.${nested} is a list inside a list, which cannot be stored.`,
          });
      }
      if (errors.length > 0) return { ok: false, errors };
      const saved = records.map((r) => {
        const next = serializeEnvelope({
          ...r,
          revision: r.revision + 1,
          updatedAt: now,
        });
        stored.set(r.id, next);
        return next;
      });
      const out: RecordEnvelope[] = [];
      for (const raw of saved) {
        const r = read(raw);
        if (!r.ok) return r;
        out.push(r.value);
      }
      notify();
      return { ok: true, value: out };
    },

    async delete(id: RecordId, expectedRevision: number) {
      return this.deleteAll([{ id, revision: expectedRevision }]);
    },

    watchUnder(path, onChange, onError) {
      const send = () =>
        void this.listUnder(path).then((r) =>
          r.ok
            ? onChange(r.value)
            : onError(r.errors.map((e) => e.message).join(" ")),
        );
      watchers.add(send);
      send();
      return () => {
        watchers.delete(send);
      };
    },

    async deleteAll(items) {
      const conflicts = items.flatMap(({ id, revision }) => {
        const current = stored.get(id);
        const actual = current ? (current["revision"] as number) : undefined;
        return actual === revision ? [] : [conflict(id, revision, actual)];
      });
      if (conflicts.length > 0) return { ok: false, errors: conflicts };
      for (const { id } of items) stored.delete(id);
      notify();
      return { ok: true, value: undefined };
    },
  };
}
