// Security Rules for the table: the play state and the campaign log (Milestone 5, S2), against
// the Firestore emulator (`pnpm test:emulator`).

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { clockFrom } from "@hearthtable/play";
import {
  firestoreRepository,
  normalizeAlias,
  openTable,
  postToLog,
  setClock,
  titleScene,
} from "@hearthtable/storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const [host = "127.0.0.1", port = "8180"] = (
  process.env["FIRESTORE_EMULATOR_HOST"] ?? "127.0.0.1:8180"
).split(":");

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-hearthtable",
    firestore: {
      host,
      port: Number(port),
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
afterAll(() => env.cleanup());

const as = (uid: string) =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;
const guest = () =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;

const ACCOUNTS = [
  { uid: "dm", alias: "Test_DM", status: "approved" },
  { uid: "player", alias: "Test_Player", status: "approved" },
  { uid: "outsider", alias: "Test_Joiner", status: "approved" },
] as const;
const ID = "moonlit_coast";
const C = "campaign/Moonlit_Coast";
const SCENE = `${C}/Downtime/Day_1_Downtime`;

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    for (const a of ACCOUNTS) {
      await setDoc(doc(db, "accounts", a.uid), {
        alias: a.alias,
        status: a.status,
        admin: false,
      });
      await setDoc(doc(db, "accounts-by-alias", normalizeAlias(a.alias)), {
        uid: a.uid,
        alias: a.alias,
      });
    }
    await setDoc(doc(db, "campaigns", ID), {
      name: "Moonlit Coast",
      dms: ["dm"],
      players: ["player"],
      createdAt: serverTimestamp(),
    });
  });
});

const opened = async () => {
  expect(
    await openTable(as("dm"), firestoreRepository(as("dm")), C, "dm"),
  ).toBeUndefined();
};
const log = async () =>
  (await getDocs(collection(guest(), "campaigns", ID, "log"))).docs.map((d) =>
    d.data(),
  );
const entry = (by: string, kind: string, text = "Hello") => ({
  kind,
  by,
  clock: 0,
  text,
  at: serverTimestamp(),
});

describe("opening the table", () => {
  it("starts a downtime scene at Day 1, readable by everyone", async () => {
    await opened();
    expect(
      (await getDoc(doc(guest(), "campaigns", ID, "play", "state"))).data(),
    ).toEqual({
      clock: 0,
      scene: SCENE,
    });
    const scene = await firestoreRepository(guest()).get(SCENE as never);
    expect(scene.ok && scene.value?.kind).toBe("downtime");
    expect(await log()).toEqual([
      expect.objectContaining({ kind: "scene", text: "Day 1 Downtime began." }),
    ]);
  });

  it("only a DM writes the play state", async () => {
    await opened();
    const state = doc(as("player"), "campaigns", ID, "play", "state");
    await assertFails(updateDoc(state, { clock: 60 }));
    await assertFails(
      setDoc(doc(as("dm"), "campaigns", ID, "play", "state"), {
        clock: 0,
        scene: "campaign/Other/Downtime/X",
      }),
    );
    await assertFails(
      setDoc(doc(as("dm"), "campaigns", ID, "play", "state"), {
        clock: -5,
        scene: SCENE,
      }),
    );
    await assertFails(
      deleteDoc(doc(as("dm"), "campaigns", ID, "play", "state")),
    );
  });
});

describe("the clock and scene titles", () => {
  it("the DM sets the clock, logged with both times", async () => {
    await opened();
    const at = clockFrom(1, 8, 0) as number;
    expect(
      await setClock(as("dm"), ID, "dm", { clock: 0, scene: SCENE }, at),
    ).toBeUndefined();
    expect(
      (await getDoc(doc(guest(), "campaigns", ID, "play", "state"))).data()?.[
        "clock"
      ],
    ).toBe(at);
    expect(await log()).toContainEqual(
      expect.objectContaining({
        kind: "clock",
        text: "The DM set the clock from Day 1, 12:00 am to Day 1, 8:00 am.",
      }),
    );
  });

  it("the DM titles a scene; the path stays", async () => {
    await opened();
    const repo = firestoreRepository(as("dm"));
    const got = await repo.get(SCENE as never);
    if (!got.ok || !got.value) throw new Error("no scene");
    expect(
      await titleScene(as("dm"), repo, ID, "dm", 0, got.value, "Market day"),
    ).toBeUndefined();
    const again = await repo.get(SCENE as never);
    expect(again.ok && again.value?.data).toMatchObject({
      title: "Market day",
    });
  });
});

describe("the campaign log", () => {
  it("members post; others cannot", async () => {
    await opened();
    expect(
      await postToLog(as("player"), ID, "player", 0, "I keep watch."),
    ).toBeUndefined();
    expect(
      await postToLog(as("dm"), ID, "dm", 0, "Rain begins."),
    ).toBeUndefined();
    await assertFails(
      addDoc(
        collection(as("outsider"), "campaigns", ID, "log"),
        entry("outsider", "post"),
      ),
    );
    await assertFails(
      addDoc(
        collection(guest(), "campaigns", ID, "log"),
        entry("player", "post"),
      ),
    );
  });

  it("players cannot record events, sign as someone else or post too much", async () => {
    await opened();
    const col = collection(as("player"), "campaigns", ID, "log");
    await assertFails(addDoc(col, entry("player", "clock")));
    await assertFails(addDoc(col, entry("dm", "post")));
    await assertFails(addDoc(col, entry("player", "post", "x".repeat(2001))));
    await assertFails(addDoc(col, entry("player", "post", "")));
    await assertSucceeds(addDoc(col, entry("player", "post")));
  });

  it("nothing in the log is changed or removed", async () => {
    await opened();
    const id = (await getDocs(collection(guest(), "campaigns", ID, "log")))
      .docs[0]?.id as string;
    await assertFails(
      updateDoc(doc(as("dm"), "campaigns", ID, "log", id), { text: "Changed" }),
    );
    await assertFails(deleteDoc(doc(as("dm"), "campaigns", ID, "log", id)));
  });
});
