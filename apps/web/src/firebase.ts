// Milestone 2 connects only to the local Firebase emulator under the offline `demo-hearthtable`
// project, so nothing can reach a real Firebase project (Architecture and Hosting).

import { firestoreRepository, type Repository } from "@hearthtable/storage";
import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const app = initializeApp({
  projectId: "demo-hearthtable",
  apiKey: "demo-key",
});
const db = getFirestore(app);
// Tests point the app at their own emulator port, so they never touch your local data.
const port = Number(import.meta.env["VITE_FIRESTORE_EMULATOR_PORT"] ?? 8080);
connectFirestoreEmulator(db, "127.0.0.1", port);

export const repository: Repository = firestoreRepository(db);
