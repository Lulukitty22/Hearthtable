import { describe, expect, it } from "vitest";
import { parseRoute, tablePathFor, webPathFor } from "./routes";

const CAROL = "account/VR_Lulu/Characters/Carol_Elfnein";

describe("web addresses", () => {
  it("names the scope first, like the record path", () => {
    expect(parseRoute("/Accounts/VR_Lulu/Characters/Carol_Elfnein")).toEqual({
      kind: "record",
      path: CAROL,
      view: "default",
    });
    expect(parseRoute("/Campaigns/Moonlit_Coast")).toEqual({
      kind: "record",
      path: "campaign/Moonlit_Coast",
      view: "default",
    });
  });

  it("reads a last Edit segment as the view", () => {
    expect(
      parseRoute("/Accounts/VR_Lulu/Characters/Carol_Elfnein/Edit"),
    ).toEqual({ kind: "record", path: CAROL, view: "edit" });
  });

  it("has a home page, an administrators' page and nothing else", () => {
    expect(parseRoute("/")).toEqual({ kind: "home" });
    expect(parseRoute("/Admin")).toEqual({ kind: "admin" });
    // The old addresses that began with the Alias no longer open anything.
    expect(parseRoute("/VR_Lulu/Characters/Carol_Elfnein")).toEqual({
      kind: "unknown",
    });
    expect(parseRoute("/Accounts")).toEqual({ kind: "unknown" });
    expect(parseRoute("/Accounts/Edit")).toEqual({ kind: "unknown" });
  });

  it("round-trips record paths, including spaces and views", () => {
    for (const path of [CAROL, "campaign/Moonlit Coast/Characters/Bram"]) {
      expect(parseRoute(webPathFor(path))).toMatchObject({ path });
      expect(parseRoute(webPathFor(path, "edit"))).toMatchObject({
        path,
        view: "edit",
      });
    }
    expect(webPathFor(CAROL)).toBe(
      "/Accounts/VR_Lulu/Characters/Carol_Elfnein",
    );
    expect(webPathFor("campaign/Moonlit", "edit")).toBe(
      "/Campaigns/Moonlit/Edit",
    );
  });
});

describe("the table addresses", () => {
  it("open the players' and the DM's views of a campaign's game", () => {
    expect(parseRoute("/Campaigns/Riverbed_of_Strings/Table")).toEqual({
      kind: "table",
      campaign: "Riverbed_of_Strings",
      role: "player",
    });
    expect(parseRoute(tablePathFor("Riverbed_of_Strings", "dm"))).toEqual({
      kind: "table",
      campaign: "Riverbed_of_Strings",
      role: "dm",
    });
    expect(
      parseRoute("/Campaigns/Riverbed_of_Strings/Table/Other"),
    ).toMatchObject({ kind: "record" });
  });
});
