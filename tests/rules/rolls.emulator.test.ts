// Security Rules for roll prompts (Milestone 5, S8), against the Firestore emulator
// (`pnpm test:emulator`): asking, answering once, the DM taking over, cancelling.

import { readFileSync } from "node:fs";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  answerRoll,
  askRolls,
  cancelRoll,
  markRollApplied,
  normalizeAlias,
  watchRolls,
  type RollPrompt,
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
const NPC = `${C}/Encounters/Day_1_Encounter_1/Goblin_1`;
const save = (character: string) => ({
  character,
  purpose: "Dexterity save against Fireball (DC 19)",
  spec: { kind: "save" as const, key: "saves.dex.total", bonus: 2, target: 19 },
});
const rolls = (db: Firestore) =>
  new Promise<readonly RollPrompt[]>((resolve) => {
    const stop = watchRolls(
      db,
      ID,
      (l) => {
        stop();
        resolve(l);
      },
      () => {},
    );
  });
const answer = { mode: "manual" as const, total: 12 };

describe("roll prompts", () => {
  it("the controller answers their own roll once; the DM cannot then take it over", async () => {
    expect(
      await askRolls(as("dm"), ID, [save(BRAM)], "dm", 0, "Saves, please."),
    ).toBeUndefined();
    const [r] = await rolls(guest());
    if (!r) throw new Error("no roll");
    expect(
      await answerRoll(
        as("outsider"),
        ID,
        r,
        answer,
        "failure",
        "outsider",
        false,
        0,
        "x",
      ),
    ).toBeDefined();
    expect(
      await answerRoll(
        as("player"),
        ID,
        r,
        answer,
        "failure",
        "player",
        false,
        0,
        "Bram: 12.",
      ),
    ).toBeUndefined();
    expect(
      await answerRoll(as("dm"), ID, r, answer, "failure", "dm", true, 0, "x"),
    ).toBe("This roll was already answered.");
    expect((await rolls(guest()))[0]).toMatchObject({
      status: "answered",
      answer: { by: "player", total: 12 },
    });
  });

  it("only the DM rolls for an NPC, takes over, cancels or marks a roll applied", async () => {
    await askRolls(
      as("dm"),
      ID,
      [save(NPC), save(BRAM)],
      "dm",
      0,
      "Saves, please.",
    );
    const [npc, bram] = await rolls(guest());
    if (!npc || !bram) throw new Error("no rolls");
    expect(
      await answerRoll(
        as("player"),
        ID,
        npc,
        answer,
        "failure",
        "player",
        false,
        0,
        "x",
      ),
    ).toBeDefined();
    expect(
      await answerRoll(
        as("dm"),
        ID,
        npc,
        answer,
        "failure",
        "dm",
        true,
        0,
        "Goblin 1: 12.",
      ),
    ).toBeUndefined();
    expect(await markRollApplied(as("player"), ID, npc.id)).toBeDefined();
    expect(await markRollApplied(as("dm"), ID, npc.id)).toBeUndefined();
    expect(await cancelRoll(as("player"), ID, bram.id)).toBeDefined();
    expect(await cancelRoll(as("dm"), ID, bram.id)).toBeUndefined();
    expect(
      await answerRoll(
        as("player"),
        ID,
        bram,
        answer,
        undefined,
        "player",
        false,
        0,
        "x",
      ),
    ).toBeDefined();
  });

  it("an answer must be signed by whoever gives it", async () => {
    await askRolls(as("dm"), ID, [save(BRAM)], "dm", 0, "Saves, please.");
    const [r] = await rolls(guest());
    if (!r) throw new Error("no roll");
    await assertFails(
      updateDoc(doc(as("player"), "campaigns", ID, "rolls", r.id), {
        status: "answered",
        answer: { ...answer, by: "dm", takeover: true },
      }),
    );
  });
});
