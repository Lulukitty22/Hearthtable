// Runs the repository contract against the Firestore emulator (`pnpm test:emulator`).

import { deleteApp, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { afterAll } from "vitest";
import { repositoryContract } from "./contract.test-helpers";
import { firestoreRepository } from "./firestore";

const PROJECT = "demo-hearthtable";
const HOST = "127.0.0.1";
const PORT = 8080;

const app = initializeApp({ projectId: PROJECT }, "storage-contract");
const db = getFirestore(app);
connectFirestoreEmulator(db, HOST, PORT);

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
