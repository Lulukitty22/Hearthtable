// The app connects only to the local Firebase emulator under the offline `demo-hearthtable`
// project, so nothing can reach a real Firebase project (Architecture and Hosting).

import { firestoreRepository, type Repository } from "@hearthtable/storage";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const app = initializeApp({
  projectId: "demo-hearthtable",
  apiKey: "demo-key",
  authDomain: "demo-hearthtable.firebaseapp.com",
});
export const db = getFirestore(app);
export const auth = getAuth(app);
// Tests point the app at their own emulator ports, so they never touch your local data.
const port = Number(import.meta.env["VITE_FIRESTORE_EMULATOR_PORT"] ?? 8080);
connectFirestoreEmulator(db, "127.0.0.1", port);
const authPort = Number(import.meta.env["VITE_AUTH_EMULATOR_PORT"] ?? 9099);
connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, {
  disableWarnings: true,
});

export const repository: Repository = firestoreRepository(db);
