import { deleteApp, initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
} from "firebase/firestore";
import { afterAll, expect, test } from "vitest";

// Confirms the Firestore emulator is reachable; storage adapter tests replace this in Step G.
const app = initializeApp({ projectId: "demo-hearthtable" });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);

afterAll(() => deleteApp(app));

test("writes and reads a document in the Firestore emulator", async () => {
  const ref = doc(db, "scaffold", "check");
  await setDoc(ref, { quantity: 0, nested: { kept: true } });
  const snapshot = await getDoc(ref);
  expect(snapshot.data()).toEqual({ quantity: 0, nested: { kept: true } });
});
