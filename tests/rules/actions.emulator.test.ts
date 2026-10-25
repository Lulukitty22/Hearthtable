// Security Rules for requests (Milestone 5, S6), against the Firestore emulator
// (`pnpm test:emulator`): confirming with holds, revising in place, cancelling and rejecting.

import { readFileSync } from "node:fs";
import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  endAction,
  firestoreRepository,
  normalizeAlias,
  resolveAction,
  reviseAction,
  submitAction,
  watchActions,
  type ActionRequest,
} from "@hearthtable/storage";
import {
  doc,
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
const draft = (character: string) => ({
  kind: "cast-spell",
  character,
  timing: "next-turn" as const,
  input: { spell: "core/Spells/Shield", castLevel: 1 },
  holds: { slots: { "1": 1 } },
  budget: "reaction" as const,
  summary: "Cast Shield at level 1 from Combat",
});
const list = (db: Firestore) =>
  new Promise<readonly ActionRequest[]>((resolve) => {
    const stop = watchActions(
      db,
      ID,
      (l) => {
        stop();
        resolve(l);
      },
      () => {},
    );
  });

describe("requests", () => {
  it("a player confirms a request for their own character, not another's", async () => {
    expect(
      await submitAction(
        as("player"),
        ID,
        draft(BRAM),
        "player",
        0,
        "Bram queues Shield.",
      ),
    ).toBeUndefined();
    expect(
      await submitAction(as("player"), ID, draft(DMS_OWN), "player", 0, "x"),
    ).toBeDefined();
    expect(
      await submitAction(as("outsider"), ID, draft(BRAM), "outsider", 0, "x"),
    ).toBeDefined();
    expect((await list(guest()))[0]).toMatchObject({
      status: "queued",
      revision: 1,
      holds: { slots: { "1": 1 } },
    });
  });

  it("a revision is the same request in the same place, with its new holds", async () => {
    await submitAction(as("player"), ID, draft(BRAM), "player", 0, "first");
    const [first] = await list(guest());
    if (!first) throw new Error("no request");
    expect(
      await reviseAction(
        as("player"),
        ID,
        first,
        {
          ...draft(BRAM),
          holds: { slots: { "2": 1 } },
          summary: "Cast Shield at level 2 from Combat",
        },
        "player",
        0,
        "revised",
      ),
    ).toBeUndefined();
    const [again] = await list(guest());
    expect(again).toMatchObject({
      id: first.id,
      revision: 2,
      holds: { slots: { "2": 1 } },
    });
    expect(again?.at?.getTime()).toBe(first.at?.getTime());
    // A stale revision is refused.
    expect(
      await reviseAction(
        as("player"),
        ID,
        first,
        draft(BRAM),
        "player",
        0,
        "x",
      ),
    ).toBeDefined();
  });

  it("cancel or reject once; nothing comes back from either", async () => {
    await submitAction(as("player"), ID, draft(BRAM), "player", 0, "first");
    const [r] = await list(guest());
    if (!r) throw new Error("no request");
    expect(
      await endAction(as("player"), ID, r, "rejected", "player", 0, "x"),
    ).toBeDefined();
    expect(
      await endAction(as("dm"), ID, r, "cancelled", "dm", 0, "x"),
    ).toBeDefined();
    expect(
      await endAction(
        as("player"),
        ID,
        r,
        "cancelled",
        "player",
        0,
        "Bram cancels.",
      ),
    ).toBeUndefined();
    expect(
      await endAction(as("dm"), ID, r, "rejected", "dm", 0, "x"),
    ).toBeDefined();
    expect(
      await reviseAction(
        as("player"),
        ID,
        { ...r, status: "cancelled" },
        draft(BRAM),
        "player",
        0,
        "x",
      ),
    ).toBeDefined();
    await assertFails(
      updateDoc(doc(as("player"), "campaigns", ID, "actions", r.id), {
        status: "queued",
      }),
    );
  });

  it("the DM rejects a queued request", async () => {
    await submitAction(as("player"), ID, draft(BRAM), "player", 0, "first");
    const [r] = await list(guest());
    if (!r) throw new Error("no request");
    expect(
      await endAction(
        as("dm"),
        ID,
        r,
        "rejected",
        "dm",
        0,
        "The DM rejects it.",
      ),
    ).toBeUndefined();
    expect((await list(guest()))[0]?.status).toBe("rejected");
  });
});

describe("approving and resolving", () => {
  const sheet = (revision = 0): RecordEnvelope => ({
    id: BRAM as RecordId,
    kind: "character",
    moduleId: "dnd5e-2024",
    schemaVersion: 1,
    origin: { scope: "campaign", ownerId: "Moonlit_Coast" },
    source: { status: "homebrew" },
    revision,
    updatedAt: "2026-10-25T00:00:00.000Z",
    data: { name: "Bram", spellcasting: { expended: {} } },
    raw: {},
  });

  it("the DM resolves a queued request once, with its records, in one step", async () => {
    const repo = firestoreRepository(as("dm"));
    expect((await repo.save([sheet()])).ok).toBe(true);
    await submitAction(
      as("player"),
      ID,
      draft(BRAM),
      "player",
      0,
      "Bram queues Shield.",
    );
    const [r] = await list(guest());
    if (!r) throw new Error("no request");
    const spent = {
      ...sheet(1),
      data: { name: "Bram", spellcasting: { expended: { "1": 1 } } },
    };
    const outcome = {
      records: [spent],
      result: "Bram cast Shield",
      logs: ["Bram cast Shield."],
    };
    expect(
      await resolveAction(as("player"), ID, r, outcome, "player", 0),
    ).toBeDefined();
    expect(
      await resolveAction(as("dm"), ID, r, outcome, "dm", 0),
    ).toBeUndefined();
    const after = await repo.get(BRAM as RecordId);
    expect(after.ok && after.value?.data).toMatchObject({
      spellcasting: { expended: { "1": 1 } },
    });
    expect((await list(guest()))[0]?.status).toBe("resolved");
    // Retrying cannot apply it twice.
    expect(await resolveAction(as("dm"), ID, r, outcome, "dm", 0)).toBe(
      "This request is no longer queued.",
    );
  });

  it("is refused when the request was revised or a record changed meanwhile", async () => {
    const repo = firestoreRepository(as("dm"));
    await repo.save([sheet()]);
    await submitAction(as("player"), ID, draft(BRAM), "player", 0, "first");
    const [r] = await list(guest());
    if (!r) throw new Error("no request");
    await reviseAction(
      as("player"),
      ID,
      r,
      draft(BRAM),
      "player",
      0,
      "revised",
    );
    const outcome = { records: [sheet(1)], result: "x", logs: [] };
    expect(await resolveAction(as("dm"), ID, r, outcome, "dm", 0)).toBe(
      "This request was revised; review it again.",
    );
    const [again] = await list(guest());
    if (!again) throw new Error("no request");
    expect(
      await resolveAction(
        as("dm"),
        ID,
        again,
        { ...outcome, records: [sheet(5)] },
        "dm",
        0,
      ),
    ).toMatch(/changed meanwhile/);
  });
});
