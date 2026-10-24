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

  it("is nobody for campaign records until campaigns exist", () => {
    expect(
      canEditRecord(viewer("VR_Lulu"), "campaign/Moonlit/Characters/Carol"),
    ).toBe(false);
  });
});
