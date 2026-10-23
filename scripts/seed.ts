// `pnpm seed`: adds the hand-entered content (core definitions, VRLulu's account content and
// Carol) to the running Firestore emulator. Records that already exist are skipped and listed,
// so edits made in the app are never overwritten (user decision, 2026-10-22).
//
// `pnpm seed --refresh` also updates existing records that nobody has changed since they were
// seeded, so improved content (for example new chamber slots) reaches the emulator. A record
// counts as untouched while its revision still equals `seededRevision`, which seeding writes; a
// record seeded before that marker existed counts as untouched only at revision 1. Changed
// records are listed and left alone.

import { carolElfnein, coreContent, vrluluContent } from "@hearthtable/content";
import { serializeEnvelope, type RecordEnvelope } from "@hearthtable/kernel";
import { firestoreRepository } from "@hearthtable/storage";
import { deleteApp, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const refresh = process.argv.includes("--refresh");
const app = initializeApp({ projectId: "demo-hearthtable" });
const db = getFirestore(app);
// `firebase emulators:exec` sets FIRESTORE_EMULATOR_HOST; otherwise use the local default.
const [host = "127.0.0.1", port = "8080"] = (
  process.env["FIRESTORE_EMULATOR_HOST"] ?? "127.0.0.1:8080"
).split(":");
connectFirestoreEmulator(db, host, Number(port));
const repo = firestoreRepository(db);

/** The record as seeding stores it: marked with the revision it will have once saved. */
const seeded = (
  record: RecordEnvelope,
  storedRevision: number,
): RecordEnvelope => ({
  ...record,
  revision: storedRevision,
  raw: { ...record.raw, seededRevision: storedRevision + 1 },
});

/** JSON with object keys sorted, so key order (which storage may change) does not count. */
const stable = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v !== null && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .map(
            (k) =>
              `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`,
          )
          .join(",")}}`
      : JSON.stringify(v);

const same = (a: RecordEnvelope, b: RecordEnvelope) =>
  stable([serializeEnvelope(a)["data"], a.source]) ===
  stable([serializeEnvelope(b)["data"], b.source]);

const all = [...coreContent, ...vrluluContent, ...carolElfnein];
const writes: RecordEnvelope[] = [];
const added: string[] = [];
const refreshed: string[] = [];
const kept: string[] = [];
for (const record of all) {
  const found = await repo.get(record.id);
  if (!found.ok) {
    console.error(
      `Could not reach the emulator. Is "pnpm emulators" running?\n${found.errors.map((e) => e.message).join("\n")}`,
    );
    process.exit(1);
  }
  const stored = found.value;
  if (!stored) {
    writes.push(seeded(record, 0));
    added.push(record.id);
    continue;
  }
  if (!refresh) {
    kept.push(record.id);
    continue;
  }
  const marker = stored.raw["seededRevision"];
  const untouched =
    typeof marker === "number"
      ? stored.revision === marker
      : stored.revision === 1;
  if (same(stored, record)) continue;
  if (untouched) {
    writes.push(
      seeded(
        { ...record, raw: { ...stored.raw, ...record.raw } },
        stored.revision,
      ),
    );
    refreshed.push(record.id);
  } else {
    kept.push(record.id);
  }
}

if (writes.length > 0) {
  const saved = await repo.save(writes);
  if (!saved.ok) {
    console.error(saved.errors.map((e) => e.message).join("\n"));
    process.exit(1);
  }
}
console.log(
  refresh
    ? `Added ${added.length}; refreshed ${refreshed.length} untouched record(s); kept ${kept.length} changed since seeding.`
    : `Added ${added.length} record(s); skipped ${kept.length} that already exist.`,
);
for (const id of refreshed) console.log(`  refreshed ${id}`);
for (const id of kept)
  console.log(
    `  ${refresh ? "kept (changed since seeding)" : "skipped"} ${id}`,
  );
await deleteApp(app);
