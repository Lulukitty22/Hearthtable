// Milestone 2 acceptance: open Carol's sheet, edit HP and an inventory quantity, save, reload,
// and see both values persist in the emulator.

import { expect, test } from "@playwright/test";

test("edits to HP and an inventory quantity persist after reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Carol Elfnein" }),
  ).toBeVisible();
  await expect(page.getByTestId("armor-class")).toHaveText("13");

  await page.getByLabel("Current hit points").fill("61");
  await page.getByRole("tab", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Potion of Healing" }).click();
  await page.getByLabel("Quantity of Potion of Healing").fill("3");
  await page.getByRole("button", { name: "Close" }).click();
  await page
    .getByLabel("Save note")
    .fill("Took 34 fire damage; drank a potion");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toBeHidden();

  await page.reload();
  await expect(page.getByLabel("Current hit points")).toHaveValue("61");
  await page.getByRole("tab", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Potion of Healing" }).click();
  await expect(page.getByLabel("Quantity of Potion of Healing")).toHaveValue(
    "3",
  );
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByText(/History \(1 saves?\)/).click();
  await expect(
    page.getByText("Took 34 fire damage; drank a potion"),
  ).toBeVisible();
});

test("Mage Armor and Shield change AC from active state, and the Wand only spell attacks", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("armor-class")).toHaveText("13");
  await page.getByRole("button", { name: "Mage Armor" }).click();
  await expect(page.getByTestId("armor-class")).toHaveText("16");
  await page.getByRole("button", { name: "Shield", exact: true }).click();
  await expect(page.getByTestId("armor-class")).toHaveText("21");

  await page.getByRole("tab", { name: "Inventory" }).click();
  await expect(page.getByTestId("spell-attack-wizard")).toHaveText("+11");
  await page.getByRole("button", { name: "Wand of the War Mage +1" }).click();
  await page.getByRole("button", { name: "Stowed" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("spell-attack-wizard")).toHaveText("+12");
  await page.getByRole("button", { name: "Aetherlock" }).click();
  await expect(page.getByText(/Aim: \+11/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByTestId("armor-class")).toHaveText("13");
});
