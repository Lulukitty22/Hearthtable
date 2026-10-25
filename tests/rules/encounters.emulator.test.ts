// Security Rules and storage for encounters (Milestone 5, S3), against the Firestore emulator
// (`pnpm test:emulator`): starting one with deployed NPC instances, initiative, passing turns,
// the budget, delegates, and ending it as read-only history.

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import {
  beginRound1,
  changeParticipants,
  endEncounter,
  enterInitiative,
  firestoreRepository,
  normalizeAlias,
  openTable,
  passTurn,
  setUse,
  startEncounter,
  type EncounterState,
} from "@hearthtable/storage";
import {
  doc,
  getDoc,
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

const ACCOUNTS = [
  { uid: "dm", alias: "Test_DM" },
  { uid: "player", alias: "Test_Player" },
  { uid: "helper", alias: "Test_Joiner" },
] as const;
const ID = "moonlit_coast";
const C = "campaign/Moonlit_Coast";
const BRAM = `${C}/Characters/Test_Player/Bram`;
const SCENE = `${C}/Encounters/Day_1_Encounter_1`;
const GOBLIN_1 = `${SCENE}/Goblin_1`;

const envelope = (id: string, kind: string, data: object): RecordEnvelope => ({
  id: id as RecordId,
  kind,
  moduleId: "dnd5e-2024",
  schemaVersion: 1,
  origin: { scope: "campaign", ownerId: "Moonlit_Coast" },
  source: { status: "homebrew" },
  revision: 0,
  updatedAt: "2026-10-25T00:00:00.000Z",
  data,
  raw: {},
});
const GOBLIN = [
  envelope(`${C}/NPCs/Goblin`, "character", {
    name: "Goblin",
    authored: { "hit-points.max": 10, "initiative.total": 2 },
  }),
  envelope(`${C}/NPCs/Goblin/Inventory`, "inventory", { lines: [] }),
];

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
      name: "Moonlit Coast",
      dms: ["dm"],
      players: ["player", "helper"],
      createdAt: serverTimestamp(),
    });
  });
});

const encounter = async (): Promise<EncounterState> => {
  const d = (
    await getDoc(
      doc(as("dm"), "campaigns", ID, "encounters", "Day_1_Encounter_1"),
    )
  ).data() as Omit<EncounterState, "id">;
  return { id: "Day_1_Encounter_1", ...d };
};

/** Opens the table and starts an encounter: Bram and two goblins, an hour after Day 1 began. */
async function started() {
  const repo = firestoreRepository(as("dm"));
  expect(await openTable(as("dm"), repo, C, "dm")).toBeUndefined();
  expect((await repo.save(GOBLIN)).ok).toBe(true);
  const downtime = await repo.get(`${C}/Downtime/Day_1_Downtime` as RecordId);
  if (!downtime.ok || !downtime.value) throw new Error("no downtime");
  expect(
    await startEncounter(as("dm"), repo, {
      campaign: ID,
      campaignPath: C,
      uid: "dm",
      state: { clock: 0, scene: `${C}/Downtime/Day_1_Downtime` },
      downtime: downtime.value,
      elapsed: 3600,
      characters: [BRAM],
      deployments: [
        {
          template: GOBLIN,
          names: ["Goblin 1", "Goblin 2"],
          rolls: [
            { total: 15, detail: "d20 (13) + 2" },
            { total: 9, detail: "d20 (7) + 2" },
          ],
        },
      ],
      surprised: [],
      names: new Map([[BRAM, "Bram"]]),
    }),
  ).toBeUndefined();
  return repo;
}

describe("starting an encounter", () => {
  it("ends the downtime, starts the encounter and deploys numbered instances", async () => {
    const repo = await started();
    expect(
      (
        await getDoc(doc(as("player"), "campaigns", ID, "play", "state"))
      ).data(),
    ).toEqual({ clock: 3600, scene: SCENE });
    const downtime = await repo.get(`${C}/Downtime/Day_1_Downtime` as RecordId);
    expect(downtime.ok && downtime.value?.data).toMatchObject({
      endedAt: 3600,
    });
    const goblin = await repo.get(GOBLIN_1 as RecordId);
    expect(goblin.ok && goblin.value?.data).toMatchObject({
      name: "Goblin 1",
      template: `${C}/NPCs/Goblin`,
    });
    const inventory = await repo.get(`${GOBLIN_1}/Inventory` as RecordId);
    expect(inventory.ok && inventory.value?.kind).toBe("inventory");
    expect(await encounter()).toMatchObject({
      round: 0,
      participants: [BRAM, GOBLIN_1, `${SCENE}/Goblin_2`],
    });
  });
});

describe("initiative and turns", () => {
  it("a player enters their own character's initiative, not an NPC's", async () => {
    await started();
    expect(
      await enterInitiative(
        as("player"),
        ID,
        SCENE,
        BRAM,
        17,
        "typed",
        "player",
        3600,
        "Bram",
      ),
    ).toBeUndefined();
    expect(
      await enterInitiative(
        as("player"),
        ID,
        SCENE,
        GOBLIN_1,
        20,
        "typed",
        "player",
        3600,
        "Goblin 1",
      ),
    ).toBeDefined();
    expect(
      await enterInitiative(
        as("helper"),
        ID,
        SCENE,
        BRAM,
        1,
        "typed",
        "helper",
        3600,
        "Bram",
      ),
    ).toBeDefined();
  });

  it("only the current participant's controller passes the turn, one step at a time", async () => {
    await started();
    const order = [GOBLIN_1, BRAM, `${SCENE}/Goblin_2`];
    expect(
      await beginRound1(as("dm"), ID, await encounter(), order, "dm"),
    ).toBeUndefined();
    // Goblin 1 is current: the player cannot pass its turn; the DM can.
    const next = { round: 1, current: BRAM };
    expect(
      await passTurn(
        as("player"),
        ID,
        await encounter(),
        next,
        "player",
        3600,
        "x",
      ),
    ).toBeDefined();
    expect(
      await passTurn(
        as("dm"),
        ID,
        await encounter(),
        next,
        "dm",
        3600,
        "Goblin 1 ended its turn.",
      ),
    ).toBeUndefined();
    // Bram is current: the player passes it on.
    expect(
      await passTurn(
        as("player"),
        ID,
        await encounter(),
        { round: 1, current: `${SCENE}/Goblin_2` },
        "player",
        3600,
        "Bram ended his turn.",
      ),
    ).toBeUndefined();
    const now = await encounter();
    expect(now).toMatchObject({
      round: 1,
      seq: 3,
      current: `${SCENE}/Goblin_2`,
    });
    // Players cannot rearrange the encounter.
    await assertFails(
      updateDoc(
        doc(as("player"), "campaigns", ID, "encounters", "Day_1_Encounter_1"),
        {
          order: [BRAM],
        },
      ),
    );
    expect(
      await changeParticipants(
        as("player"),
        ID,
        now,
        { participants: [BRAM] },
        "player",
        3600,
        "x",
      ),
    ).toBeDefined();
  });

  it("a delegate ticks the budget for the character they were given", async () => {
    await started();
    expect(
      await setUse(as("helper"), ID, SCENE, BRAM, "action", {
        count: 1,
        seq: 0,
      }),
    ).toBeDefined();
    await assertSucceeds(
      setDoc(
        doc(as("player"), "campaigns", ID, "control", encodeURIComponent(BRAM)),
        {
          delegates: ["helper"],
        },
      ),
    );
    expect(
      await setUse(as("helper"), ID, SCENE, BRAM, "action", {
        count: 1,
        seq: 0,
      }),
    ).toBeUndefined();
  });
});

describe("ending an encounter", () => {
  it("keeps the record as read-only history and starts downtime", async () => {
    const repo = await started();
    const order = [GOBLIN_1, BRAM, `${SCENE}/Goblin_2`];
    await beginRound1(as("dm"), ID, await encounter(), order, "dm");
    const record = await repo.get(SCENE as RecordId);
    if (!record.ok || !record.value) throw new Error("no encounter record");
    expect(
      await endEncounter(as("dm"), repo, {
        campaign: ID,
        campaignPath: C,
        uid: "dm",
        encounter: await encounter(),
        record: record.value,
        order,
        initiative: new Map([[GOBLIN_1, 15]]),
      }),
    ).toBeUndefined();
    expect(
      (
        await getDoc(doc(as("player"), "campaigns", ID, "play", "state"))
      ).data(),
    ).toEqual({ clock: 3606, scene: `${C}/Downtime/Day_1_Downtime_2` });
    const ended = await repo.get(SCENE as RecordId);
    if (!ended.ok || !ended.value) throw new Error("no encounter record");
    expect(ended.value.data).toMatchObject({ endedAt: 3606, rounds: 1 });
    // Nothing in it changes any more, not even for the DM.
    expect(
      (await repo.save([{ ...ended.value, data: { title: "Changed" } }])).ok,
    ).toBe(false);
    const goblin = await repo.get(GOBLIN_1 as RecordId);
    if (!goblin.ok || !goblin.value) throw new Error("no goblin");
    expect(
      (await repo.save([{ ...goblin.value, data: { name: "Changed" } }])).ok,
    ).toBe(false);
    expect(
      await enterInitiative(
        as("dm"),
        ID,
        SCENE,
        BRAM,
        3,
        "typed",
        "dm",
        3606,
        "Bram",
      ),
    ).toBeDefined();
  });
});
