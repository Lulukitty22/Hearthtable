// Runs the repository contract against the Firestore emulator (`pnpm test:emulator`).

import { deleteApp, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { afterAll } from "vitest";
import { repositoryContract } from "./contract.test-helpers";
import { firestoreRepository } from "./firestore";

const PROJECT = "demo-hearthtable";
const [HOST = "127.0.0.1", PORT_TEXT = "8180"] = (
  process.env["FIRESTORE_EMULATOR_HOST"] ?? "127.0.0.1:8180"
).split(":");
const PORT = Number(PORT_TEXT);

const app = initializeApp({ projectId: PROJECT }, "storage-contract");
const db = getFirestore(app);
// These tests check storage, not Security Rules (tests/rules does), so they connect with the
// emulator's "owner" token, which switches Rules off.
connectFirestoreEmulator(db, HOST, PORT, { mockUserToken: "owner" });

afterAll(() => deleteApp(app));

async function clearEmulator() {
  const response = await fetch(
    `http://${HOST}:${PORT}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok)
    throw new Error(
      `Could not clear the Firestore emulator: ${response.status}`,
    );
}

repositoryContract("Firestore (emulator)", async () => {
  await clearEmulator();
  return firestoreRepository(db);
});
