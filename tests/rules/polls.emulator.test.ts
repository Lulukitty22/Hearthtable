// Security Rules for response polls (Milestone 5, S9), against the Firestore emulator
// (`pnpm test:emulator`): opening, skipping a round, repolling and force-skipping.

import { readFileSync } from "node:fs";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  closePoll,
  normalizeAlias,
  openPoll,
  repoll,
  skipPoll,
  submitAction,
  watchActions,
  watchPolls,
  type ActionRequest,
  type Poll,
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
const once = <T>(
  watch: (db: Firestore, cb: (l: readonly T[]) => void) => () => void,
) =>
  new Promise<readonly T[]>((resolve) => {
    const stop = watch(guest(), (l) => {
      stop();
      resolve(l);
    });
  });
const polls = () => once<Poll>((db, cb) => watchPolls(db, ID, cb, () => {}));
const actions = () =>
  once<ActionRequest>((db, cb) => watchActions(db, ID, cb, () => {}));

describe("response polls", () => {
  it("players in the poll skip the current round, only for themselves", async () => {
    expect(
      await openPoll(
        as("player"),
        ID,
        "attack-1",
        "A hit",
        ["player"],
        "player",
        0,
      ),
    ).toBeDefined();
    expect(
      await openPoll(
        as("dm"),
        ID,
        "attack-1",
        "Bandit hits Bram",
        ["player"],
        "dm",
        0,
      ),
    ).toBeUndefined();
    const [p] = await polls();
    if (!p) throw new Error("no poll");
    expect(await skipPoll(as("outsider"), ID, p, "outsider")).toBeDefined();
    expect(
      await skipPoll(as("player"), ID, { ...p, round: 2 }, "player"),
    ).toBeDefined();
    expect(await skipPoll(as("player"), ID, p, "player")).toBeUndefined();
    await assertFails(
      updateDoc(doc(as("player"), "campaigns", ID, "polls", "attack-1"), {
        status: "closed",
      }),
    );
    // A response opens a fresh round; the old skip no longer counts.
    expect(
      await repoll(as("dm"), ID, p, "Bram cast Shield", "dm", 0),
    ).toBeUndefined();
    const [again] = await polls();
    expect(again).toMatchObject({ round: 2, skips: { player: 1 } });
  });

  it("a force-skip closes the poll and rejects responses still waiting", async () => {
    await openPoll(
      as("dm"),
      ID,
      "attack-1",
      "Bandit hits Bram",
      ["player"],
      "dm",
      0,
    );
    await submitAction(
      as("player"),
      ID,
      {
        kind: "cast-spell",
        character: BRAM,
        timing: "instant",
        input: { spell: "core/Spells/Shield" },
        holds: { slots: { "1": 1 } },
        summary: "Cast Shield",
        respondsTo: "attack-1",
      },
      "player",
      0,
      "Bram responds with Shield.",
    );
    const [p] = await polls();
    const waiting = await actions();
    if (!p) throw new Error("no poll");
    expect(waiting[0]).toMatchObject({
      respondsTo: "attack-1",
      status: "queued",
    });
    expect(
      await closePoll(as("dm"), ID, p, true, waiting, "dm", 0),
    ).toBeUndefined();
    expect((await polls())[0]).toMatchObject({
      status: "closed",
      forced: true,
    });
    expect((await actions())[0]?.status).toBe("rejected");
  });
});
