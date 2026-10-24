// A character's address shows it read-only, with an Edit button for whoever may edit it; its
// /Edit address is the editor, which shows read-only with a note to anyone else (user decision,
// 2026-10-24). Carol is a campaign character, so her DMs edit her, in DM mode (S6).

import { expect, test } from "@playwright/test";
import { signInAs, TEST_PLAYER, VR_LULU } from "./signIn";

const CAROL = "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein";

test("guests see Carol read-only, with no Edit button", async ({ page }) => {
  await page.goto(CAROL);
  await expect(page.getByTestId("armor-class")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(
    page.getByRole("spinbutton", { name: "Current hit points" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Wand of the War Mage +1" }).click();
  await expect(
    page.getByRole("button", { name: "End attunement" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark lost" })).toHaveCount(0);

  await page.goto(`${CAROL}/Edit`);
  await expect(page.getByRole("note")).toContainText(
    "Only the campaign's DMs can edit its characters",
  );
  await expect(
    page.getByRole("spinbutton", { name: "Current hit points" }),
  ).toHaveCount(0);
});

test("a DM of Carol's campaign opens DM mode with Edit and leaves with Done", async ({
  page,
}) => {
  await page.goto("/");
  await signInAs(page, VR_LULU);
  await page.goto(CAROL);
  await expect(
    page.getByRole("spinbutton", { name: "Current hit points" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Edit in DM mode" }).click();
  await expect(page).toHaveURL(new RegExp(`${CAROL}/Edit$`));
  await expect(page.getByText("DM mode", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "Current hit points" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL(new RegExp(`${CAROL}$`));
});

test("a player of Carol's campaign sees her editor read-only", async ({
  page,
}) => {
  await page.goto("/");
  await signInAs(page, TEST_PLAYER);
  await page.goto(CAROL);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await page.goto(`${CAROL}/Edit`);
  await expect(page.getByRole("note")).toContainText(
    "Only the campaign's DMs can edit its characters",
  );
  await expect(
    page.getByRole("spinbutton", { name: "Current hit points" }),
  ).toHaveCount(0);
});
