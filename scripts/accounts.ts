// The emulator's seeded accounts (Milestone 4 Plan, topic B, user decision 2026-10-23): fake
// Google accounts in the Auth emulator, each with its account document and Alias index entry.
// VR_Lulu is the user, approved and the first site administrator. The test Aliases are
// placeholders chosen by the engine chat. Campaign membership is seeded with campaigns (S5).
//
// Rules never let the app set approval or the administrator flag, so seeding writes these with
// Rules switched off, which only the emulator allows.

import { normalizeAlias, ACCOUNTS, ALIAS_INDEX } from "@hearthtable/storage";
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

export interface SeededAccount {
  readonly uid: string;
  readonly alias: string;
  readonly email: string;
  readonly status: "pending" | "approved";
  readonly admin: boolean;
}

const seededAccount = (
  alias: string,
  status: SeededAccount["status"],
  admin = false,
): SeededAccount => ({
  uid: `seed-${normalizeAlias(alias).replaceAll("_", "-")}`,
  alias,
  email: `${normalizeAlias(alias)}@example.com`,
  status,
  admin,
});

export const SEEDED_ACCOUNTS: readonly SeededAccount[] = [
  seededAccount("VR_Lulu", "approved", true),
  seededAccount("Test_DM", "approved"),
  seededAccount("Test_Player", "approved"),
  seededAccount("Test_Joiner", "approved"),
  seededAccount("Test_Other_DM", "approved"),
  seededAccount("Test_Pending", "pending"),
];

const PROJECT = "demo-hearthtable";

async function authRequest(
  authHost: string,
  method: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/${method}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner",
      },
      body: JSON.stringify(body),
    },
  );
  const json = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(
      `Auth emulator ${method} failed (${response.status}): ${JSON.stringify(json)}`,
    );
  return json;
}

/** Adds the seeded accounts that are missing; existing ones are left exactly as they are. */
export async function seedAccounts(
  db: Firestore,
  authHost: string,
): Promise<{ added: string[]; kept: string[]; refused: string[] }> {
  const added: string[] = [];
  const kept: string[] = [];
  const refused: string[] = [];

  const found = await authRequest(authHost, "accounts:lookup", {
    localId: SEEDED_ACCOUNTS.map((a) => a.uid),
  });
  const existing = new Set(
    ((found["users"] ?? []) as { localId: string }[]).map((u) => u.localId),
  );
  const missing = SEEDED_ACCOUNTS.filter((a) => !existing.has(a.uid));
  if (missing.length > 0)
    await authRequest(authHost, "accounts:batchCreate", {
      users: missing.map((a) => ({
        localId: a.uid,
        email: a.email,
        emailVerified: true,
        displayName: a.alias,
        providerUserInfo: [
          {
            providerId: "google.com",
            rawId: a.uid,
            email: a.email,
            displayName: a.alias,
          },
        ],
      })),
    });

  for (const account of SEEDED_ACCOUNTS) {
    const accountRef = doc(db, ACCOUNTS, account.uid);
    const indexRef = doc(db, ALIAS_INDEX, normalizeAlias(account.alias));
    const [stored, index] = await Promise.all([
      getDoc(accountRef),
      getDoc(indexRef),
    ]);
    if (stored.exists()) {
      kept.push(account.alias);
      continue;
    }
    if (index.exists()) {
      refused.push(
        `${account.alias}: the Alias is already taken by another account (${String(index.data()["uid"])}) in this emulator`,
      );
      continue;
    }
    const batch = writeBatch(db);
    batch.set(accountRef, {
      alias: account.alias,
      status: account.status,
      admin: account.admin,
      createdAt: serverTimestamp(),
    });
    batch.set(indexRef, { uid: account.uid, alias: account.alias });
    await batch.commit();
    added.push(account.alias);
  }
  return { added, kept, refused };
}
