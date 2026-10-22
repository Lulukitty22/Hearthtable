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
connectFirestoreEmulator(db, "127.0.0.1", 8080);

export const repository: Repository = firestoreRepository(db);
