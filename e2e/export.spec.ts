// Milestone 4, S10: the live HTML sheet export. The downloaded file, opened from disk, shows the
// character's current sheet and nothing else, follows later saves, and says so when the
// character is no longer at its path.

import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { exportHtml } from "../apps/web/src/export/exportFile";
import { signInAs, VR_LULU } from "./signIn";

const PATH = "campaign/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein";
const CAROL = "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein";

test("an exported sheet opens from disk, shows only the sheet and stays live", async ({
  browser,
  baseURL,
}) => {
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(CAROL);
  const downloading = guest.waitForEvent("download");
  await guest.getByRole("button", { name: "Export HTML" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("Carol Elfnein - Hearthtable.html");
  const file = join(tmpdir(), `hearthtable-export-${Date.now()}.html`);
  await download.saveAs(file);
  expect(readFileSync(file, "utf8")).toContain(`${baseURL}${CAROL}/Export`);

  const reader = await (await browser.newContext()).newPage();
  await reader.goto(pathToFileURL(file).href);
  const sheet = reader.frameLocator("iframe");
  await expect(sheet.getByTestId("armor-class")).toBeVisible();
  // Only the sheet: no account strip, no Edit, no way into the app.
  await expect(sheet.getByRole("region", { name: "Account" })).toHaveCount(0);
  await expect(sheet.getByRole("link")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Export HTML" })).toHaveCount(
    0,
  );
  await expect(sheet.getByRole("tab", { name: "Inventory" })).toBeVisible();

  // A later save shows up in the open export.
  const editor = await (await browser.newContext()).newPage();
  await editor.goto("/");
  await signInAs(editor, VR_LULU);
  await editor.goto(`${CAROL}/Edit`);
  const hp = editor.getByRole("spinbutton", { name: "Current hit points" });
  await hp.fill("61");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sheet.getByLabel("Current hit points")).toHaveText("61");
  await hp.fill("95");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sheet.getByLabel("Current hit points")).toHaveText("95");

  for (const page of [guest, reader, editor]) await page.context().close();
});

test("an export of a character no longer at its path says so", async ({
  page,
  baseURL,
}) => {
  const file = join(tmpdir(), `hearthtable-export-gone-${Date.now()}.html`);
  writeFileSync(
    file,
    exportHtml(`${PATH}_Gone`, "Gone", baseURL ?? "http://localhost:5174"),
  );
  await page.goto(pathToFileURL(file).href);
  await expect(
    page.frameLocator("iframe").getByText("There is no character at"),
  ).toBeVisible();
});
