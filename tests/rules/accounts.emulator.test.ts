// Security Rules for accounts and the Alias index (Milestone 4, S1), against the Firestore
// emulator (`pnpm test:emulator`).

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { approveAccount, claimAlias } from "@hearthtable/storage";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
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
beforeEach(() => env.clearFirestore());

const as = (uid: string) =>
  env.authenticatedContext(uid).firestore() as unknown as Firestore;
const guest = () =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;

/** Writes an account and its index entry the way claimAlias does, with overrides. */
function claimBatch(
  db: Firestore,
  uid: string,
  alias: string,
  account: Record<string, unknown> = {},
  index: Record<string, unknown> = {},
  key = alias.toLowerCase().replaceAll("-", "_"),
) {
  const batch = writeBatch(db);
  batch.set(doc(db, "accounts", uid), {
    alias,
    status: "pending",
    admin: false,
    createdAt: serverTimestamp(),
    ...account,
  });
  batch.set(doc(db, "accounts-by-alias", key), { uid, alias, ...index });
  return batch.commit();
}

describe("choosing an Alias", () => {
  it("lets a signed-in user take a free Alias as a pending, non-administrator account", async () => {
    const result = await claimAlias(as("alice"), "alice", "Alice_W");
    expect(result).toMatchObject({ ok: true });
    const stored = await getDoc(doc(guest(), "accounts", "alice"));
    expect(stored.data()).toMatchObject({
      alias: "Alice_W",
      status: "pending",
      admin: false,
    });
    const index = await getDoc(doc(guest(), "accounts-by-alias", "alice_w"));
    expect(index.data()).toEqual({ uid: "alice", alias: "Alice_W" });
  });

  it("refuses an Alias already taken, ignoring capitals and _ versus -", async () => {
    await claimAlias(as("alice"), "alice", "Alice_W");
    const result = await claimAlias(as("bob"), "bob", "alice-w");
    expect(result).toMatchObject({ ok: false, reason: "taken" });
    // And the Rules refuse it even without the app's own check.
    await assertFails(claimBatch(as("bob"), "bob", "alice-w"));
  });

  it("refuses a second Alias for the same account", async () => {
    await claimAlias(as("alice"), "alice", "Alice_W");
    expect(await claimAlias(as("alice"), "alice", "Alice_2")).toMatchObject({
      ok: false,
      reason: "already-chosen",
    });
    await assertFails(claimBatch(as("alice"), "alice", "Alice_2"));
  });

  it("refuses guests and accounts written for someone else", async () => {
    await assertFails(claimBatch(guest(), "alice", "Alice_W"));
    await assertFails(claimBatch(as("bob"), "alice", "Alice_W"));
  });

  it("refuses an account that sets its own approval or administrator flag", async () => {
    await assertFails(
      claimBatch(as("alice"), "alice", "Alice_W", { status: "approved" }),
    );
    await assertFails(
      claimBatch(as("alice"), "alice", "Alice_W", { admin: true }),
    );
    await assertFails(
      claimBatch(as("alice"), "alice", "Alice_W", { email: "a@example.com" }),
    );
  });

  it("refuses badly formed Aliases and index entries that do not match", async () => {
    await assertFails(claimBatch(as("alice"), "alice", "abc"));
    await assertFails(claimBatch(as("alice"), "alice", "Alice W"));
    await assertFails(
      claimBatch(as("alice"), "alice", "Alice_W", {}, {}, "someone_else"),
    );
    await assertFails(
      claimBatch(as("alice"), "alice", "Alice_W", {}, { uid: "bob" }),
    );
  });

  it("refuses an account or an index entry written alone", async () => {
    const db = as("alice");
    await assertFails(
      setDoc(doc(db, "accounts", "alice"), {
        alias: "Alice_W",
        status: "pending",
        admin: false,
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(db, "accounts-by-alias", "alice_w"), {
        uid: "alice",
        alias: "Alice_W",
      }),
    );
  });

  it("does not let an account change its Alias, approval or administrator flag", async () => {
    await claimAlias(as("alice"), "alice", "Alice_W");
    const ref = doc(as("alice"), "accounts", "alice");
    await assertFails(updateDoc(ref, { status: "approved" }));
    await assertFails(updateDoc(ref, { admin: true }));
    await assertFails(updateDoc(ref, { alias: "Alice_X" }));
  });

  it("lets guests read accounts and the Alias index", async () => {
    await claimAlias(as("alice"), "alice", "Alice_W");
    await assertSucceeds(getDoc(doc(guest(), "accounts", "alice")));
    await assertSucceeds(getDoc(doc(guest(), "accounts-by-alias", "alice_w")));
  });
});

describe("approving accounts", () => {
  /** A seeded administrator, written with Rules off as the seed script does. */
  async function seedAdmin(uid = "admin") {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, "accounts", uid), {
        alias: "The_Admin",
        status: "approved",
        admin: true,
      });
    });
  }

  it("lets a site administrator approve a pending account", async () => {
    await seedAdmin();
    await claimAlias(as("alice"), "alice", "Alice_W");
    expect(await approveAccount(as("admin"), "admin", "alice")).toBeUndefined();
    const stored = await getDoc(doc(guest(), "accounts", "alice"));
    expect(stored.data()).toMatchObject({
      status: "approved",
      approvedBy: "admin",
      admin: false,
    });
  });

  it("refuses approval by anyone who is not an administrator", async () => {
    await claimAlias(as("alice"), "alice", "Alice_W");
    await claimAlias(as("bob"), "bob", "Bob_W");
    expect(await approveAccount(as("bob"), "bob", "alice")).toBeDefined();
    expect(await approveAccount(as("alice"), "alice", "alice")).toBeDefined();
    expect(await approveAccount(guest(), "nobody", "alice")).toBeDefined();
  });

  it("lets an administrator change nothing but the approval", async () => {
    await seedAdmin();
    await claimAlias(as("alice"), "alice", "Alice_W");
    const ref = doc(as("admin"), "accounts", "alice");
    await assertFails(updateDoc(ref, { admin: true }));
    await assertFails(updateDoc(ref, { alias: "Alice_X" }));
    await assertFails(
      updateDoc(ref, {
        status: "approved",
        approvedBy: "someone-else",
        approvedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        status: "approved",
        approvedBy: "admin",
        approvedAt: serverTimestamp(),
        admin: true,
      }),
    );
  });
});
