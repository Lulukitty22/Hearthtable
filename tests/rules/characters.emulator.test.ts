// Security Rules for characters in campaigns (Milestone 4, S6), against the Firestore emulator
// (`pnpm test:emulator`): asking to add a copy of your own character, a DM approving it, and the
// owner choosing who may control it.

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { carolElfnein, CAROL_ID } from "@hearthtable/content";
import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import {
  firestoreRepository,
  normalizeAlias,
  readInsertion,
  requestInsertion,
  setDelegates,
} from "@hearthtable/storage";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
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
  { uid: "dm", alias: "Test_DM" },
  { uid: "player", alias: "Test_Player" },
  { uid: "other", alias: "Test_Other_DM" },
] as const;
const ID = "riverbed_of_strings";
const CAMPAIGN = "campaign/Riverbed_of_Strings";

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
    await setDoc(doc(db, "campaigns", ID), {
      name: "Riverbed of Strings",
      dms: ["dm"],
      players: ["player"],
    });
  });
});

/** Carol's records moved to `path`. */
const copyAt = (path: string): RecordEnvelope[] =>
  carolElfnein.map((r) => ({
    ...r,
    id: `${path}${r.id.slice(CAROL_ID.length)}` as RecordId,
    revision: 0,
  }));

const BRAM = `${CAMPAIGN}/Characters/Test_Player/Bram`;

describe("asking to add a character", () => {
  it("is allowed for a member, under their own Alias", async () => {
    expect(
      await requestInsertion(
        as("player"),
        ID,
        "player",
        "Bram",
        BRAM,
        copyAt(BRAM),
      ),
    ).toBeUndefined();
  });

  it("is refused under someone else's Alias, for non-members and for another campaign", async () => {
    const theirs = `${CAMPAIGN}/Characters/Test_DM/Bram`;
    expect(
      await requestInsertion(
        as("player"),
        ID,
        "player",
        "Bram",
        theirs,
        copyAt(theirs),
      ),
    ).toBeDefined();
    const outsider = `${CAMPAIGN}/Characters/Test_Other_DM/Bram`;
    expect(
      await requestInsertion(
        as("other"),
        ID,
        "other",
        "Bram",
        outsider,
        copyAt(outsider),
      ),
    ).toBeDefined();
    const elsewhere = "campaign/Other_Place/Characters/Test_Player/Bram";
    expect(
      await requestInsertion(
        as("player"),
        ID,
        "player",
        "Bram",
        elsewhere,
        copyAt(elsewhere),
      ),
    ).toBeDefined();
  });

  it("is visible to the person and the DMs, and a DM's approval writes the copy", async () => {
    await requestInsertion(
      as("player"),
      ID,
      "player",
      "Bram",
      BRAM,
      copyAt(BRAM),
    );
    const requests = collection(as("dm"), "campaigns", ID, "insertions");
    const seen = await getDocs(requests);
    expect(seen.size).toBe(1);
    const own = collection(as("player"), "campaigns", ID, "insertions");
    await assertSucceeds(getDocs(query(own, where("by", "==", "player"))));
    await assertFails(
      getDocs(collection(as("other"), "campaigns", ID, "insertions")),
    );

    const first = seen.docs[0];
    const insertion = first ? readInsertion(first.id, first.data()) : undefined;
    expect(insertion?.records).toHaveLength(carolElfnein.length);
    // The player cannot write the copy themselves; the DM can.
    expect(
      (await firestoreRepository(as("player")).save(insertion?.records ?? []))
        .ok,
    ).toBe(false);
    expect(
      (await firestoreRepository(as("dm")).save(insertion?.records ?? [])).ok,
    ).toBe(true);
  });
});

describe("delegated control", () => {
  it("is chosen by the character's owner, among the campaign's members", async () => {
    expect(await setDelegates(as("player"), ID, BRAM, ["dm"])).toBeUndefined();
    expect(await setDelegates(as("player"), ID, BRAM, [])).toBeUndefined();
  });

  it("cannot be set by anyone else, or given to a non-member", async () => {
    expect(await setDelegates(as("dm"), ID, BRAM, ["dm"])).toBeDefined();
    expect(await setDelegates(as("player"), ID, BRAM, ["other"])).toBeDefined();
  });
});
