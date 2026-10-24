// The emulator's seeded campaigns (Milestone 4 Plan, topics B and I): the user's real campaign,
// Riverbed of Strings (named by the user 2026-10-24, replacing the placeholder Moonlit Coast), with
// VR_Lulu and Test_DM as DMs, Test_Player as a player and Test_Joiner's join request waiting;
// Carol and its items are content seeded with it. Test Campaign has Test_Other_DM as its DM, to
// show several campaigns side by side; its name is a placeholder chosen by the engine chat. Each
// creator's home gets a link to its campaign. A campaign that already exists is left as it is.

import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import {
  CAMPAIGNS,
  campaignIdFor,
  INVITES,
  newInviteCode,
  type Repository,
} from "@hearthtable/storage";
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { SEEDED_ACCOUNTS } from "./accounts";

const uidOf = (alias: string) => {
  const found = SEEDED_ACCOUNTS.find((a) => a.alias === alias);
  if (!found) throw new Error(`No seeded account ${alias}.`);
  return found.uid;
};

interface SeededCampaign {
  readonly name: string;
  readonly segment: string;
  /** The account whose home links to it. */
  readonly creator: string;
  readonly dms: readonly string[];
  readonly players: readonly string[];
  readonly requests: readonly string[];
}

export const SEEDED_CAMPAIGNS: readonly SeededCampaign[] = [
  {
    name: "Riverbed of Strings",
    segment: "Riverbed_of_Strings",
    creator: "VR_Lulu",
    dms: ["VR_Lulu", "Test_DM"],
    players: ["Test_Player"],
    requests: ["Test_Joiner"],
  },
  {
    name: "Test Campaign",
    segment: "Test_Campaign",
    creator: "Test_Other_DM",
    dms: ["Test_Other_DM"],
    players: [],
    requests: [],
  },
];

function linkRecord(c: SeededCampaign): RecordEnvelope {
  return {
    id: `account/${c.creator}/${c.segment}` as RecordId,
    kind: "campaign-link",
    moduleId: "account",
    schemaVersion: 1,
    origin: { scope: "account", ownerId: c.creator },
    source: { status: "homebrew" },
    revision: 0,
    updatedAt: new Date().toISOString(),
    data: { name: c.name, campaign: `campaign/${c.segment}` },
    raw: {},
  };
}

/** Adds the seeded campaigns that are missing, with their invite codes and home links. */
export async function seedCampaigns(
  db: Firestore,
  repo: Repository,
): Promise<{ added: string[]; kept: string[] }> {
  const added: string[] = [];
  const kept: string[] = [];
  for (const c of SEEDED_CAMPAIGNS) {
    const id = campaignIdFor(c.segment);
    if ((await getDoc(doc(db, CAMPAIGNS, id))).exists()) {
      kept.push(c.name);
      continue;
    }
    const code = newInviteCode();
    const batch = writeBatch(db);
    batch.set(doc(db, CAMPAIGNS, id), {
      name: c.name,
      dms: c.dms.map(uidOf),
      players: c.players.map(uidOf),
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, CAMPAIGNS, id, "private", "invite"), { code });
    batch.set(doc(db, INVITES, code), { campaign: id, name: c.name });
    for (const alias of c.requests)
      batch.set(doc(db, CAMPAIGNS, id, "requests", uidOf(alias)), {
        code,
        at: serverTimestamp(),
      });
    await batch.commit();
    const link = linkRecord(c);
    const existing = await repo.get(link.id);
    if (existing.ok && !existing.value) {
      const saved = await repo.save([link]);
      if (!saved.ok)
        throw new Error(saved.errors.map((e) => e.message).join(" "));
    }
    added.push(c.name);
  }
  return { added, kept };
}
