// Security Rules for the DM review queue (Milestone 4, S7), against the Firestore emulator
// (`pnpm test:emulator`). Includes the Milestone 4 acceptance check that a revoked delegate is
// refused while a current one is allowed.

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { carolElfnein, CAROL_ID } from "@hearthtable/content";
import type { RecordId } from "@hearthtable/kernel";
import {
  normalizeAlias,
  propose,
  setDelegates,
  type Proposal,
} from "@hearthtable/storage";
import {
  collection,
  getDocs,
  doc,
  setDoc,
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

const ACCOUNTS = [
  { uid: "lulu", alias: "VR_Lulu" },
  { uid: "dm", alias: "Test_DM" },
  { uid: "player", alias: "Test_Player" },
  { uid: "outsider", alias: "Test_Other_DM" },
] as const;
const ID = "riverbed_of_strings";

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    for (const a of ACCOUNTS) {
      await setDoc(doc(db, "accounts", a.uid), {
        alias: a.alias,
        status: "approved",
        admin: false,
      });
      await setDoc(doc(db, "accounts-by-alias", normalizeAlias(a.alias)), {
        uid: a.uid,
        alias: a.alias,
      });
    }
    // Carol's owner VR_Lulu is a player here, so her edits need a DM.
    await setDoc(doc(db, "campaigns", ID), {
      name: "Riverbed of Strings",
      dms: ["dm"],
      players: ["lulu", "player"],
    });
  });
});

const carol = carolElfnein.find((r) => r.id === CAROL_ID);
if (!carol) throw new Error("Carol's character record is missing.");

const edit = (by: string): Omit<Proposal, "id" | "at"> => ({
  kind: "edit",
  by,
  target: CAROL_ID,
  note: "Took 15 damage",
  writes: [{ ...carol, revision: 1 }],
  deletes: [],
});

describe("proposing changes to a campaign character", () => {
  it("is allowed for its owner, and refused to other players", async () => {
    expect(await propose(as("lulu"), ID, edit("lulu"))).toBeUndefined();
    expect(await propose(as("player"), ID, edit("player"))).toBeDefined();
    expect(await propose(as("outsider"), ID, edit("outsider"))).toBeDefined();
  });

  it("is allowed for a current delegate and refused once control is revoked", async () => {
    await setDelegates(as("lulu"), ID, CAROL_ID, ["player"]);
    expect(await propose(as("player"), ID, edit("player"))).toBeUndefined();
    await setDelegates(as("lulu"), ID, CAROL_ID, []);
    expect(await propose(as("player"), ID, edit("player"))).toBeDefined();
  });

  it("lets only the owner propose deleting or replacing it", async () => {
    await setDelegates(as("lulu"), ID, CAROL_ID, ["player"]);
    const remove = (by: string): Omit<Proposal, "id" | "at"> => ({
      ...edit(by),
      kind: "delete",
      writes: [],
      deletes: [{ id: CAROL_ID as RecordId, revision: 1 }],
    });
    expect(await propose(as("lulu"), ID, remove("lulu"))).toBeUndefined();
    expect(await propose(as("player"), ID, remove("player"))).toBeDefined();
  });
});

describe("proposing library entries", () => {
  const entry = (by: string, target: string): Omit<Proposal, "id" | "at"> => ({
    kind: "entry",
    by,
    target,
    note: "",
    writes: [],
    deletes: [],
  });

  it("is open to members, outside Characters", async () => {
    expect(
      await propose(
        as("player"),
        ID,
        entry("player", "campaign/Riverbed_of_Strings/Items/Moon_Charm"),
      ),
    ).toBeUndefined();
    expect(
      await propose(
        as("player"),
        ID,
        entry("player", "campaign/Riverbed_of_Strings/Characters/X/Y"),
      ),
    ).toBeDefined();
    expect(
      await propose(
        as("outsider"),
        ID,
        entry("outsider", "campaign/Riverbed_of_Strings/Items/Moon_Charm"),
      ),
    ).toBeDefined();
  });
});

describe("the queue", () => {
  it("is read by DMs and by each proposal's author only", async () => {
    await propose(as("lulu"), ID, edit("lulu"));
    const proposals = (uid: string) =>
      getDocs(collection(as(uid), "campaigns", ID, "proposals"));
    await assertSucceeds(proposals("dm"));
    await assertFails(proposals("player"));
  });
});
