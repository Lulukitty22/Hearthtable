// Security Rules for campaigns, join requests and invite codes (Milestone 4, S5), against the
// Firestore emulator (`pnpm test:emulator`).

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  approveJoinRequest,
  cancelJoinRequest,
  createCampaign,
  lookUpInvite,
  normalizeAlias,
  removeMember,
  replaceInviteCode,
  requestToJoin,
  setDm,
} from "@hearthtable/storage";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
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
  { uid: "dm", alias: "Test_DM", status: "approved", admin: false },
  { uid: "player", alias: "Test_Player", status: "approved", admin: false },
  { uid: "joiner", alias: "Test_Joiner", status: "approved", admin: false },
  { uid: "pending", alias: "Test_Pending", status: "pending", admin: false },
  { uid: "admin", alias: "The_Admin", status: "approved", admin: true },
] as const;

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    for (const a of ACCOUNTS) {
      await setDoc(doc(db, "accounts", a.uid), {
        alias: a.alias,
        status: a.status,
        admin: a.admin,
      });
      await setDoc(doc(db, "accounts-by-alias", normalizeAlias(a.alias)), {
        uid: a.uid,
        alias: a.alias,
      });
    }
  });
});

const ID = "moonlit_coast";
const campaign = async () =>
  (await getDoc(doc(guest(), "campaigns", ID))).data();
const inviteCode = async () =>
  (await getDoc(doc(as("dm"), "campaigns", ID, "private", "invite"))).data()?.[
    "code"
  ] as string;

/** Test_DM creates Moonlit Coast; returns its invite code. */
async function created() {
  const made = await createCampaign(
    as("dm"),
    "dm",
    "Moonlit_Coast",
    "Moonlit Coast",
  );
  expect(made).toMatchObject({ ok: true, id: ID });
  return inviteCode();
}

describe("creating a campaign", () => {
  it("makes the creator its only DM, with an invite code", async () => {
    const code = await created();
    expect(await campaign()).toMatchObject({
      name: "Moonlit Coast",
      dms: ["dm"],
      players: [],
    });
    expect(await lookUpInvite(as("joiner"), code)).toEqual({
      campaign: ID,
      name: "Moonlit Coast",
    });
  });

  it("refuses a name that is taken, ignoring capitals", async () => {
    await created();
    expect(
      await createCampaign(as("player"), "player", "moonlit_coast", "moonlit"),
    ).toMatchObject({ ok: false });
  });

  it("refuses guests, pending accounts and anyone naming someone else as DM", async () => {
    expect(
      await createCampaign(guest(), "x", "Guest_Camp", "Guest Camp"),
    ).toMatchObject({ ok: false });
    expect(
      await createCampaign(as("pending"), "pending", "Wait", "Wait"),
    ).toMatchObject({ ok: false });
    await assertFails(
      setDoc(doc(as("player"), "campaigns", "framed"), {
        name: "Framed",
        dms: ["dm"],
        players: [],
      }),
    );
  });
});

describe("joining", () => {
  it("goes through a request with the code and a DM's approval", async () => {
    const code = await created();
    expect(
      await requestToJoin(as("joiner"), ID, "joiner", code),
    ).toBeUndefined();
    expect(await approveJoinRequest(as("dm"), ID, "joiner")).toBeUndefined();
    expect(await campaign()).toMatchObject({ players: ["joiner"] });
  });

  it("refuses a request without the right code, or from a pending account", async () => {
    await created();
    expect(
      await requestToJoin(as("joiner"), ID, "joiner", "WRONGCDE"),
    ).toBeDefined();
    expect(
      await requestToJoin(as("pending"), ID, "pending", await inviteCode()),
    ).toBeDefined();
  });

  it("lets only DMs approve, and nobody add themselves", async () => {
    const code = await created();
    await requestToJoin(as("joiner"), ID, "joiner", code);
    expect(await approveJoinRequest(as("joiner"), ID, "joiner")).toBeDefined();
    await assertFails(
      updateDoc(doc(as("player"), "campaigns", ID), {
        players: arrayUnion("player"),
      }),
    );
  });

  it("stops an old code once a DM replaces it", async () => {
    const old = await created();
    expect(
      await replaceInviteCode(as("dm"), ID, "Moonlit Coast", old),
    ).toBeUndefined();
    expect(await lookUpInvite(as("joiner"), old)).toBeUndefined();
    expect(await requestToJoin(as("joiner"), ID, "joiner", old)).toBeDefined();
    expect(
      await requestToJoin(as("joiner"), ID, "joiner", await inviteCode()),
    ).toBeUndefined();
  });

  it("keeps requests and codes from other eyes", async () => {
    const code = await created();
    await requestToJoin(as("joiner"), ID, "joiner", code);
    await assertSucceeds(
      getDoc(doc(as("joiner"), "campaigns", ID, "requests", "joiner")),
    );
    await assertFails(
      getDoc(doc(as("player"), "campaigns", ID, "requests", "joiner")),
    );
    await assertFails(
      getDoc(doc(as("player"), "campaigns", ID, "private", "invite")),
    );
    await assertFails(getDocs(collection(as("player"), "invites")));
    expect(await cancelJoinRequest(as("joiner"), ID, "joiner")).toBeUndefined();
  });
});

describe("members and DMs", () => {
  async function withPlayer() {
    const code = await created();
    await requestToJoin(as("player"), ID, "player", code);
    await approveJoinRequest(as("dm"), ID, "player");
  }

  it("lets a DM grant and revoke DM, but never remove the last DM", async () => {
    await withPlayer();
    expect(await setDm(as("dm"), ID, "player", true)).toBeUndefined();
    expect(await setDm(as("player"), ID, "dm", false)).toBeUndefined();
    expect(await campaign()).toMatchObject({
      dms: ["player"],
      players: ["dm"],
    });
    expect(await setDm(as("player"), ID, "player", false)).toBeDefined();
    expect(await removeMember(as("player"), ID, "player")).toBeDefined();
  });

  it("lets players leave and DMs remove players, but not players remove others", async () => {
    await withPlayer();
    await requestToJoin(as("joiner"), ID, "joiner", await inviteCode());
    await approveJoinRequest(as("dm"), ID, "joiner");
    expect(await removeMember(as("joiner"), ID, "player")).toBeDefined();
    expect(await removeMember(as("joiner"), ID, "joiner")).toBeUndefined();
    expect(await removeMember(as("dm"), ID, "player")).toBeUndefined();
    expect(await campaign()).toMatchObject({ dms: ["dm"], players: [] });
  });

  it("lets a site administrator restore DM", async () => {
    await withPlayer();
    expect(await setDm(as("admin"), ID, "player", true)).toBeUndefined();
    expect(await campaign()).toMatchObject({ dms: ["dm", "player"] });
  });
});
