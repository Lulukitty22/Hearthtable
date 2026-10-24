// Storage Rules for portraits (Milestone 4, S11), against the Storage and Firestore emulators
// (`pnpm test:emulator`).

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { normalizeAlias } from "@hearthtable/storage";
import { doc, setDoc, type Firestore } from "firebase/firestore";
import {
  getBytes,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const hostPort = (variable: string, fallback: string) => {
  const [host = "127.0.0.1", port = fallback] = (
    process.env[variable] ?? `127.0.0.1:${fallback}`
  ).split(":");
  return { host, port: Number(port) };
};

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-hearthtable",
    firestore: {
      ...hostPort("FIRESTORE_EMULATOR_HOST", "8180"),
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      ...hostPort("FIREBASE_STORAGE_EMULATOR_HOST", "9299"),
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});
afterAll(() => env.cleanup());

const storageAs = (uid: string | undefined) =>
  (uid
    ? env.authenticatedContext(uid).storage()
    : env.unauthenticatedContext().storage()) as unknown as FirebaseStorage;

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    for (const [uid, alias] of [
      ["lulu", "VR_Lulu"],
      ["dm", "Test_DM"],
      ["player", "Test_Player"],
    ]) {
      await setDoc(doc(db, "accounts", uid as string), {
        alias,
        status: "approved",
        admin: false,
      });
      await setDoc(
        doc(db, "accounts-by-alias", normalizeAlias(alias as string)),
        { uid, alias },
      );
    }
    await setDoc(doc(db, "campaigns", "riverbed_of_strings"), {
      name: "Riverbed of Strings",
      dms: ["dm"],
      players: ["lulu", "player"],
    });
  });
});

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CAROL =
  "portraits/campaign/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein/a.png";
const upload = (
  uid: string | undefined,
  path: string,
  type = "image/png",
  bytes = PNG,
) => uploadBytes(ref(storageAs(uid), path), bytes, { contentType: type });

describe("portrait uploads", () => {
  it("are allowed for the character's owner and the campaign's DMs", async () => {
    await assertSucceeds(upload("lulu", CAROL));
    await assertSucceeds(upload("dm", CAROL));
    await assertSucceeds(
      upload("lulu", "portraits/account/VR_Lulu/Characters/Bram/a.png"),
    );
  });

  it("are refused to other players, guests and other accounts' characters", async () => {
    await assertFails(upload("player", CAROL));
    await assertFails(upload(undefined, CAROL));
    await assertFails(
      upload("player", "portraits/account/VR_Lulu/Characters/Bram/a.png"),
    );
  });

  it("must be images up to 2 MB", async () => {
    await assertFails(upload("lulu", CAROL, "text/plain"));
    await assertFails(
      upload("lulu", CAROL, "image/png", new Uint8Array(2 * 1024 * 1024 + 1)),
    );
  });

  it("are readable by anyone", async () => {
    await upload("lulu", CAROL);
    await assertSucceeds(getBytes(ref(storageAs(undefined), CAROL)));
  });
});
