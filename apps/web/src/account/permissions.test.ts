import { describe, expect, it } from "vitest";
import { canEditRecord } from "./permissions";
import type { Viewer } from "./useViewer";

const CAROL = "account/VR_Lulu/Characters/Carol_Elfnein";
const viewer = (
  alias: string,
  status: "pending" | "approved" = "approved",
  admin = false,
): Viewer => ({
  status: "account",
  account: { uid: "u", alias, status, admin },
});

describe("who may edit a record", () => {
  it("is the approved owner of an account record", () => {
    expect(canEditRecord(viewer("VR_Lulu"), CAROL)).toBe(true);
    expect(canEditRecord(viewer("vr-lulu"), CAROL)).toBe(true);
  });

  it("is nobody else: guests, other accounts, pending owners, administrators", () => {
    expect(canEditRecord({ status: "guest" }, CAROL)).toBe(false);
    expect(canEditRecord(viewer("Test_Player"), CAROL)).toBe(false);
    expect(canEditRecord(viewer("VR_Lulu", "pending"), CAROL)).toBe(false);
    expect(canEditRecord(viewer("The_Admin", "approved", true), CAROL)).toBe(
      false,
    );
  });

  it("is a DM of the campaign for campaign records", () => {
    const path = "campaign/Riverbed_of_Strings/Characters/VR_Lulu/Carol";
    const campaign = {
      id: "riverbed_of_strings",
      name: "Riverbed of Strings",
      dms: ["dm"],
      players: ["u"],
    };
    const dm: Viewer = {
      status: "account",
      account: {
        uid: "dm",
        alias: "Test_DM",
        status: "approved",
        admin: false,
      },
    };
    expect(canEditRecord(dm, path, campaign)).toBe(true);
    // The character's owner is a player here, so their edits wait for S7's review queue.
    expect(canEditRecord(viewer("VR_Lulu"), path, campaign)).toBe(false);
    expect(canEditRecord(dm, path)).toBe(false);
  });
});
