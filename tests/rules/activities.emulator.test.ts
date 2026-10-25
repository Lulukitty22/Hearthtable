// Security Rules for downtime activities (Milestone 5, S5), against the Firestore emulator
// (`pnpm test:emulator`): who submits, cancels, approves and rolls Hit Point Dice.

import { readFileSync } from "node:fs";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doneSpending,
  normalizeAlias,
  rollHitDie,
  setActivityStatus,
  submitActivity,
  updateActivities,
} from "@hearthtable/storage";
import {
  collection,
  doc,
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

const BRAM = `${C}/Characters/Test_Player/Bram`;
const DMS_OWN = `${C}/Characters/Test_DM/Ilse`;
const activity = (character: string) => ({
  character,
  type: "short-rest",
  seconds: 3600,
  scene: SCENE,
});
const only = async () =>
  (await getDocs(collection(guest(), "campaigns", ID, "activities"))).docs[0];

describe("downtime activities", () => {
  it("a player adds their own character's activity, not someone else's", async () => {
    expect(
      await submitActivity(
        as("player"),
        ID,
        activity(BRAM),
        "player",
        0,
        "Bram rests.",
      ),
    ).toBeUndefined();
    expect(
      await submitActivity(
        as("player"),
        ID,
        activity(DMS_OWN),
        "player",
        0,
        "x",
      ),
    ).toBeDefined();
    expect(
      await submitActivity(
        as("outsider"),
        ID,
        activity(BRAM),
        "outsider",
        0,
        "x",
      ),
    ).toBeDefined();
    expect((await only())?.data()).toMatchObject({
      status: "pending",
      progress: 0,
    });
  });

  it("only the DM approves; the player cancels their own", async () => {
    await submitActivity(
      as("player"),
      ID,
      activity(BRAM),
      "player",
      0,
      "Bram rests.",
    );
    const id = (await only())?.id as string;
    expect(
      await setActivityStatus(
        as("player"),
        ID,
        id,
        "approved",
        "player",
        0,
        "x",
      ),
    ).toBeDefined();
    expect(
      await setActivityStatus(as("dm"), ID, id, "approved", "dm", 0, "ok"),
    ).toBeUndefined();
    expect(
      await setActivityStatus(
        as("player"),
        ID,
        id,
        "cancelled",
        "player",
        0,
        "never mind",
      ),
    ).toBeUndefined();
    expect((await only())?.data()["status"]).toBe("cancelled");
  });

  it("Hit Point Dice are rolled only while spending is open", async () => {
    await submitActivity(
      as("player"),
      ID,
      activity(BRAM),
      "player",
      0,
      "Bram rests.",
    );
    const id = (await only())?.id as string;
    const roll = { die: 8, face: 5, con: 1, total: 6 };
    expect(
      await rollHitDie(as("player"), ID, id, roll, "player", 0, "x"),
    ).toBeDefined();
    expect(
      await updateActivities(as("dm"), ID, [
        { id, change: { status: "done", spend: "open" } },
      ]),
    ).toBeUndefined();
    expect(
      await rollHitDie(as("player"), ID, id, roll, "player", 0, "Bram rolls."),
    ).toBeUndefined();
    expect(await doneSpending(as("player"), ID, id)).toBeUndefined();
    expect(
      await rollHitDie(as("player"), ID, id, roll, "player", 0, "x"),
    ).toBeDefined();
    await assertFails(
      updateDoc(doc(as("player"), "campaigns", ID, "activities", id), {
        applied: 1,
      }),
    );
  });
});
