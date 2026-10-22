// `pnpm seed`: adds the hand-entered content (core definitions, VRLulu's account content and
// Carol) to the running Firestore emulator. Records that already exist are skipped and listed,
// so edits made in the app are never overwritten (user decision, 2026-10-22).

import { carolElfnein, coreContent, vrluluContent } from "@hearthtable/content";
import { firestoreRepository } from "@hearthtable/storage";
import { deleteApp, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const app = initializeApp({ projectId: "demo-hearthtable" });
const db = getFirestore(app);
// `firebase emulators:exec` sets FIRESTORE_EMULATOR_HOST; otherwise use the local default.
const [host = "127.0.0.1", port = "8080"] = (
  process.env["FIRESTORE_EMULATOR_HOST"] ?? "127.0.0.1:8080"
).split(":");
connectFirestoreEmulator(db, host, Number(port));
const repo = firestoreRepository(db);

const all = [...coreContent, ...vrluluContent, ...carolElfnein];
const missing = [];
const skipped = [];
for (const record of all) {
  const found = await repo.get(record.id);
  if (!found.ok) {
    console.error(
      `Could not reach the emulator. Is "pnpm emulators" running?\n${found.errors.map((e) => e.message).join("\n")}`,
    );
    process.exit(1);
  }
  if (found.value) skipped.push(record.id);
  else missing.push(record);
}

if (missing.length > 0) {
  const saved = await repo.save(missing);
  if (!saved.ok) {
    console.error(saved.errors.map((e) => e.message).join("\n"));
    process.exit(1);
  }
}
console.log(
  `Added ${missing.length} record(s); skipped ${skipped.length} that already exist.`,
);
for (const id of skipped) console.log(`  skipped ${id}`);
await deleteApp(app);
