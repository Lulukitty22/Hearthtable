// `pnpm seed`: adds the hand-entered content (core definitions, VR_Lulu's account content and
// Carol) to the running Firestore emulator. Records that already exist are skipped and listed,
// so edits made in the app are never overwritten (user decision, 2026-10-22).
//
// `pnpm seed --refresh` also updates existing records that nobody has changed since they were
// seeded, so improved content (for example new chamber slots) reaches the emulator. A record
// counts as untouched while its revision still equals `seededRevision`, which seeding writes; a
// record seeded before that marker existed counts as untouched only at revision 1. Changed
// records are listed and left alone.
//
// It also adds the seeded accounts (scripts/accounts.ts) and campaigns (scripts/campaigns.ts)
// that are missing. Seeding writes with
// the emulator's Security Rules switched off, because Rules never let the app itself set an
// account's approval or administrator flag.

import { carolElfnein, coreContent, vrluluContent } from "@hearthtable/content";
import { serializeEnvelope, type RecordEnvelope } from "@hearthtable/kernel";
import { firestoreRepository } from "@hearthtable/storage";
import { deleteApp, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { seedAccounts } from "./accounts";
import { seedCampaigns } from "./campaigns";

const refresh = process.argv.includes("--refresh");
// `firebase emulators:exec` sets these; otherwise use the local defaults.
const [host = "127.0.0.1", port = "8080"] = (
  process.env["FIRESTORE_EMULATOR_HOST"] ?? "127.0.0.1:8080"
).split(":");
const authHost = process.env["FIREBASE_AUTH_EMULATOR_HOST"] ?? "127.0.0.1:9099";
const app = initializeApp({ projectId: "demo-hearthtable" });
const db = getFirestore(app);
// The emulator treats the "owner" token as Rules switched off; real Firebase has no such token.
connectFirestoreEmulator(db, host, Number(port), { mockUserToken: "owner" });
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
try {
  const accounts = await seedAccounts(db, authHost);
  console.log(
    `Accounts: added ${accounts.added.length}, kept ${accounts.kept.length} that already exist.`,
  );
  for (const alias of accounts.added) console.log(`  added account ${alias}`);
  for (const message of accounts.refused)
    console.log(`  not added: ${message}`);
  const campaigns = await seedCampaigns(db, repo);
  console.log(
    `Campaigns: added ${campaigns.added.length}, kept ${campaigns.kept.length} that already exist.`,
  );
  for (const name of campaigns.added) console.log(`  added campaign ${name}`);
} catch (error) {
  console.error(
    `Could not seed accounts or campaigns. Is the Auth emulator running?
${error instanceof Error ? error.message : String(error)}`,
  );
  await deleteApp(app);
  process.exit(1);
}
await deleteApp(app);
