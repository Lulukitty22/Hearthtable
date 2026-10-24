// A character's address shows it read-only, with an Edit button for its owner; its /Edit address
// is the editor, which shows read-only with a note to anyone else (user decision, 2026-10-24).

import { expect, test } from "@playwright/test";
import { signInAs, TEST_PLAYER, VR_LULU } from "./signIn";

const CAROL = "/Accounts/VR_Lulu/Characters/Carol_Elfnein";

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
    "Only VR_Lulu can edit this character",
  );
  await expect(
    page.getByRole("spinbutton", { name: "Current hit points" }),
  ).toHaveCount(0);
});

test("Carol's owner opens the editor with Edit and leaves with Done", async ({
  page,
}) => {
  await page.goto("/");
  await signInAs(page, VR_LULU);
  await page.goto(CAROL);
  await expect(
    page.getByRole("spinbutton", { name: "Current hit points" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(new RegExp(`${CAROL}/Edit$`));
  await expect(
    page.getByRole("spinbutton", { name: "Current hit points" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL(new RegExp(`${CAROL}$`));
});

test("another account sees Carol's editor read-only", async ({ page }) => {
  await page.goto("/");
  await signInAs(page, TEST_PLAYER);
  await page.goto(CAROL);
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await page.goto(`${CAROL}/Edit`);
  await expect(page.getByRole("note")).toContainText(
    "Only VR_Lulu can edit this character",
  );
  await expect(
    page.getByRole("spinbutton", { name: "Current hit points" }),
  ).toHaveCount(0);
});
