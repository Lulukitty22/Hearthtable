import {
  carolElfnein,
  CAROL_ID,
  coreContent,
  riverbedItems,
} from "@hearthtable/content";
import { describe, expect, it } from "vitest";
import { engine } from "../useSheet";
import {
  childrenOf,
  copiedRecords,
  foldersIn,
  newRecords,
  subtree,
} from "./entries";

const ROOT = "account/VR_Lulu";
const CAMPAIGN = "campaign/Riverbed_of_Strings";
/** An account holding a Characters folder with Carol and an Items folder, built from content. */
const account = [
  ...copiedRecords(riverbedItems, `${CAMPAIGN}/Items`, `${ROOT}/Items`),
  ...copiedRecords(carolElfnein, CAROL_ID, `${ROOT}/Characters/Carol_Elfnein`),
];
const ACCOUNT_CAROL = `${ROOT}/Characters/Carol_Elfnein`;

describe("folder contents", () => {
  it("shows VR_Lulu's Characters and Items as ordinary folders", () => {
    expect(childrenOf(ROOT, account)).toMatchObject([
      { path: `${ROOT}/Characters`, name: "Characters", kind: "folder" },
      { path: `${ROOT}/Items`, name: "Items", kind: "folder" },
    ]);
  });

  it("shows a character as one entry, not its tabs", () => {
    expect(childrenOf(`${ROOT}/Characters`, account)).toEqual([
      {
        path: ACCOUNT_CAROL,
        segment: "Carol_Elfnein",
        name: "Carol Elfnein",
        kind: "character",
      },
    ]);
  });

  it("lists every folder for choosing a destination, never inside a character", () => {
    const withFolder = [
      ...account,
      ...newRecords("folder", `${ROOT}/Characters`, "VR_Lulu", "Mages", ""),
    ];
    expect(foldersIn(ROOT, withFolder)).toEqual([
      ROOT,
      `${ROOT}/Characters`,
      `${ROOT}/Characters/Mages`,
      `${ROOT}/Items`,
    ]);
  });
});

describe("Copy as", () => {
  it("copies a character and everything under it 1:1 to the new path", () => {
    const to = `${ROOT}/Characters/Carol_Copy`;
    const copies = copiedRecords(account, ACCOUNT_CAROL, to);
    expect(copies).toHaveLength(carolElfnein.length);
    expect(copies.map((r) => r.id).sort()).toEqual(
      carolElfnein.map((r) => r.id.replace(CAROL_ID, to)).sort(),
    );
    for (const copy of copies) {
      const source = subtree(ACCOUNT_CAROL, account).find(
        (r) => r.id.replace(ACCOUNT_CAROL, to) === copy.id,
      );
      expect(copy.data).toEqual(source?.data);
      expect(copy.revision).toBe(0);
    }
  });
});

describe("New", () => {
  it("makes a blank character that resolves without errors in the engine", () => {
    const records = newRecords(
      "character",
      `${ROOT}/Characters`,
      "VR_Lulu",
      "Blank Hero",
      "",
    );
    expect(records.map((r) => r.id)).toEqual([
      `${ROOT}/Characters/Blank_Hero`,
      `${ROOT}/Characters/Blank_Hero/Inventory`,
    ]);
    const resolved = engine.resolve([...coreContent, ...records]);
    expect(resolved.get("abilities.int.score")).toMatchObject({
      kind: "known",
      value: 10,
    });
    expect(resolved.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("makes a custom entry with only a name and a description", () => {
    const [spell] = newRecords("spell", ROOT, "VR_Lulu", "Moon Bolt", " Pew. ");
    expect(spell).toMatchObject({
      id: `${ROOT}/Moon_Bolt`,
      kind: "spell",
      data: { name: "Moon Bolt", description: "Pew." },
    });
  });
});
