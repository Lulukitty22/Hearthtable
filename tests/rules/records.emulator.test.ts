// Security Rules for records (Milestone 4, S3), against the Firestore emulator
// (`pnpm test:emulator`): an account's approved owner writes its records, a campaign's DM writes
// the campaign's records, and everyone may read.

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
  documentIdFor,
  firestoreRepository,
  normalizeAlias,
} from "@hearthtable/storage";
import {
  deleteDoc,
  doc,
  getDoc,
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
const guest = () =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;

const ACCOUNTS = [
  { uid: "lulu", alias: "VR_Lulu", status: "approved" },
  { uid: "player", alias: "Test_Player", status: "approved" },
  { uid: "dm", alias: "Test_DM", status: "approved" },
  { uid: "pending", alias: "Test_Pending", status: "pending" },
] as const;

/** Accounts, Alias index entries and a campaign's members, written with Rules off. */
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
    await setDoc(doc(db, "campaigns", "Moonlit_Coast", "members", "dm"), {
      role: "dm",
    });
    await setDoc(doc(db, "campaigns", "Moonlit_Coast", "members", "player"), {
      role: "player",
    });
    await setDoc(doc(db, "campaigns", "Moonlit_Coast", "members", "lulu"), {
      role: "dm",
    });
  });
});

const carol = carolElfnein.find((r) => r.id === CAROL_ID);
if (!carol)
  throw new Error("Carol's character record is missing from content.");
/** A new record at `id`, built from Carol's character record. */
const recordAt = (id: string): RecordEnvelope => ({
  ...carol,
  id: id as RecordId,
  revision: 0,
});

async function saveAs(db: Firestore, id: string) {
  return firestoreRepository(db).save([recordAt(id)]);
}

describe("account records", () => {
  it("are written by their approved owner", async () => {
    expect(await saveAs(as("lulu"), CAROL_ID)).toMatchObject({ ok: true });
    expect(
      await saveAs(as("lulu"), `${CAROL_ID}/History/20261024T050000Z`),
    ).toMatchObject({ ok: true });
  });

  it("are refused to guests, other accounts and a pending owner", async () => {
    expect(await saveAs(guest(), CAROL_ID)).toMatchObject({ ok: false });
    expect(await saveAs(as("player"), CAROL_ID)).toMatchObject({ ok: false });
    expect(
      await saveAs(as("pending"), "account/Test_Pending/Characters/Bram"),
    ).toMatchObject({ ok: false });
  });

  it("cannot be claimed by writing another owner into the path field", async () => {
    await saveAs(as("lulu"), CAROL_ID);
    const ref = doc(as("player"), "records", documentIdFor(CAROL_ID));
    await assertFails(
      setDoc(ref, {
        record: {},
        path: "account/Test_Player/Characters/Carol_Elfnein",
        ancestors: [],
      }),
    );
    // Nor can an owner write a record whose path names someone else.
    const own = doc(
      as("player"),
      "records",
      documentIdFor("account/Test_Player/Characters/Bram"),
    );
    await assertFails(
      setDoc(own, { record: {}, path: CAROL_ID, ancestors: [] }),
    );
  });

  it("are deleted only by their owner", async () => {
    await saveAs(as("lulu"), CAROL_ID);
    const id = documentIdFor(CAROL_ID);
    await assertFails(deleteDoc(doc(as("player"), "records", id)));
    await assertSucceeds(deleteDoc(doc(as("lulu"), "records", id)));
  });

  it("are readable by everyone, guests included", async () => {
    await saveAs(as("lulu"), CAROL_ID);
    await assertSucceeds(
      getDoc(doc(guest(), "records", documentIdFor(CAROL_ID))),
    );
  });
});

describe("campaign records", () => {
  const BRAM = "campaign/Moonlit_Coast/Characters/Test_Player/Bram";

  it("are written by a DM of the campaign", async () => {
    expect(await saveAs(as("dm"), BRAM)).toMatchObject({ ok: true });
  });

  it("are refused to players and non-members", async () => {
    expect(await saveAs(as("player"), BRAM)).toMatchObject({ ok: false });
    expect(
      await saveAs(as("player"), "campaign/Other_Campaign/Characters/X"),
    ).toMatchObject({ ok: false });
  });

  it("are refused once a DM's role is revoked", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, "campaigns", "Moonlit_Coast", "members", "dm"), {
        role: "player",
      });
    });
    expect(await saveAs(as("dm"), BRAM)).toMatchObject({ ok: false });
  });
});

describe("core records", () => {
  it("are written by nobody through the app", async () => {
    expect(await saveAs(as("lulu"), "core/Fireball_Copy")).toMatchObject({
      ok: false,
    });
  });
});
