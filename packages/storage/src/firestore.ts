// A Repository on Cloud Firestore: one document per record (Modules, Systems and Rulesets).
// Milestone 2 mapping, kept inside this adapter because the Firestore schema is a Milestone 4
// decision: every record is a document in `records`, its id the record path with "/" encoded
// (Firestore ids cannot contain "/"). The document holds the serialized envelope under `record`,
// plus `path` and `ancestors` so a sheet's tabs can be listed with one query.

import {
  parseEnvelope,
  serializeEnvelope,
  type RecordEnvelope,
  type RecordId,
} from "@hearthtable/kernel";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
  type DocumentData,
  type Firestore,
} from "firebase/firestore";
import {
  ancestorsOf,
  conflict,
  nestedListPath,
  undefinedPath,
  type Repository,
  type StorageError,
  type StorageResult,
} from "./repository";

const COLLECTION = "records";

export const documentIdFor = (id: string) => encodeURIComponent(id);

function read(
  data: DocumentData | undefined,
  id: string,
): StorageResult<RecordEnvelope> {
  const parsed = parseEnvelope(data?.["record"]);
  return parsed.ok
    ? { ok: true, value: parsed.value }
    : {
        ok: false,
        errors: [
          {
            code: "invalid",
            id,
            message: `${id}: ${parsed.issues.map((i) => i.message).join("; ")}`,
          },
        ],
      };
}

function unavailable(error: unknown): StorageResult<never> {
  return {
    ok: false,
    errors: [
      {
        code: "unavailable",
        message: error instanceof Error ? error.message : String(error),
      },
    ],
  };
}

export function firestoreRepository(db: Firestore): Repository {
  const ref = (id: string) => doc(db, COLLECTION, documentIdFor(id));

  return {
    async get(id) {
      try {
        const snap = await getDoc(ref(id));
        return snap.exists()
          ? read(snap.data(), id)
          : { ok: true, value: undefined };
      } catch (error) {
        return unavailable(error);
      }
    },

    async listUnder(path) {
      try {
        const [self, below] = await Promise.all([
          getDoc(ref(path)),
          getDocs(
            query(
              collection(db, COLLECTION),
              where("ancestors", "array-contains", path),
            ),
          ),
        ]);
        const out: RecordEnvelope[] = [];
        for (const snap of [...(self.exists() ? [self] : []), ...below.docs]) {
          const r = read(snap.data(), String(snap.data()?.["path"]));
          if (!r.ok) return r;
          out.push(r.value);
        }
        return { ok: true, value: out };
      } catch (error) {
        return unavailable(error);
      }
    },

    async save(records, options) {
      const now = options?.now ?? new Date().toISOString();
      const invalid: StorageError[] = [];
      const seen = new Set<string>();
      for (const r of records) {
        if (seen.has(r.id))
          invalid.push({
            code: "invalid",
            id: r.id,
            message: `${r.id} appears twice in one save.`,
          });
        seen.add(r.id);
        const missing = undefinedPath(r.data);
        if (missing)
          invalid.push({
            code: "invalid",
            id: r.id,
            message: `${r.id}: data.${missing} is undefined; remove the field instead of setting it to undefined.`,
          });
        const nested = nestedListPath(r.data);
        if (nested)
          invalid.push({
            code: "invalid",
            id: r.id,
            message: `${r.id}: data.${nested} is a list inside a list, which cannot be stored.`,
          });
      }
      if (invalid.length > 0) return { ok: false, errors: invalid };
      try {
        return await runTransaction(db, async (tx) => {
          const snaps = await Promise.all(
            records.map((r) => tx.get(ref(r.id))),
          );
          const conflicts: StorageError[] = [];
          records.forEach((r, i) => {
            const snap = snaps[i];
            const actual = snap?.exists()
              ? (snap.data()["record"]?.["revision"] as number)
              : undefined;
            if (
              (actual === undefined && r.revision !== 0) ||
              (actual !== undefined && actual !== r.revision)
            ) {
              conflicts.push(conflict(r.id, r.revision, actual));
            }
          });
          if (conflicts.length > 0)
            return { ok: false, errors: conflicts } as const;
          const saved: RecordEnvelope[] = [];
          for (const r of records) {
            const next = serializeEnvelope({
              ...r,
              revision: r.revision + 1,
              updatedAt: now,
            });
            tx.set(ref(r.id), {
              record: next,
              path: r.id,
              ancestors: ancestorsOf(r.id),
            });
            const back = read({ record: next }, r.id);
            if (!back.ok) return back;
            saved.push(back.value);
          }
          return { ok: true, value: saved } as const;
        });
      } catch (error) {
        return unavailable(error);
      }
    },

    async delete(id: RecordId, expectedRevision: number) {
      return this.deleteAll([{ id, revision: expectedRevision }]);
    },

    // One transaction, so at most 500 records; larger deletes would need splitting.
    async deleteAll(items) {
      try {
        return await runTransaction(db, async (tx) => {
          const snaps = await Promise.all(items.map((i) => tx.get(ref(i.id))));
          const conflicts = items.flatMap(({ id, revision }, n) => {
            const snap = snaps[n];
            const actual = snap?.exists()
              ? (snap.data()["record"]?.["revision"] as number)
              : undefined;
            return actual === revision ? [] : [conflict(id, revision, actual)];
          });
          if (conflicts.length > 0)
            return { ok: false, errors: conflicts } as const;
          for (const { id } of items) tx.delete(ref(id));
          return { ok: true, value: undefined } as const;
        });
      } catch (error) {
        return unavailable(error);
      }
    },
  };
}
