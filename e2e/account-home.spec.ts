// Milestone 4, S4: the account home with ordinary folders, New, Copy as and Delete.

import { expect, test, type Page } from "@playwright/test";
import { signInAs, TEST_PLAYER, VR_LULU } from "./signIn";

const unique = () => Date.now().toString(36).slice(-5);
const contents = (page: Page, title: string) =>
  page.getByRole("list", { name: `Contents of ${title}` });

async function create(
  page: Page,
  kind: string,
  name: string,
  description?: string,
) {
  await page.getByRole("button", { name: `New ${kind}` }).click();
  const form = page.getByRole("form", { name: `New ${kind}` });
  await form.getByRole("textbox", { name: "Name" }).fill(name);
  if (description)
    await form.getByRole("textbox", { name: "Description" }).fill(description);
  await form.getByRole("button", { name: "Create" }).click();
  await expect(form).toBeHidden();
}

test("VR_Lulu makes folders, a blank character and an item, copies and deletes", async ({
  page,
}) => {
  const folder = `Mages ${unique()}`;
  await page.goto("/");
  await signInAs(page, VR_LULU);
  await page.getByRole("link", { name: "My home" }).click();
  await expect(page).toHaveURL(/\/Accounts\/VR_Lulu$/);
  const home = contents(page, "VR_Lulu's home");
  // Carol and the items moved into Riverbed of Strings; the home links to it.
  await expect(
    home.getByRole("link", { name: "Riverbed of Strings" }),
  ).toBeVisible();

  // Names: duplicates (ignoring capitals and spaces versus underscores) and address words.
  await create(page, "folder", folder);
  await page.getByRole("button", { name: "New folder" }).click();
  const form = page.getByRole("form", { name: "New folder" });
  await form
    .getByRole("textbox", { name: "Name" })
    .fill(folder.toLowerCase().replace(" ", "_"));
  await expect(form).toContainText("is already here");
  await form.getByRole("textbox", { name: "Name" }).fill("Edit");
  await expect(form).toContainText("used in web addresses");
  await form.getByRole("button", { name: "Cancel" }).click();

  // Inside the new folder: a blank character and a custom item.
  await home.getByRole("link", { name: folder }).click();
  await create(page, "character", "Blank Hero");
  await create(page, "item", "Moon Charm", "Glows faintly at night.");
  const inside = contents(page, folder);
  await inside.getByRole("link", { name: "Moon Charm" }).click();
  await expect(
    page.getByText("Glows faintly at night.", { exact: true }),
  ).toBeVisible();
  await page.goBack();
  await inside.getByRole("link", { name: "Blank Hero" }).click();
  await expect(page.getByRole("heading", { name: "Blank Hero" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();

  // Copy the blank character to the home; the copy is 1:1.
  const hero = `Hero ${unique()}`;
  await page.goBack();
  const heroRow = inside
    .getByRole("listitem")
    .filter({ hasText: "Blank Hero" });
  await heroRow.getByRole("button", { name: "Copy as…" }).click();
  const copy = page.getByRole("form", { name: "Copy Blank Hero as" });
  await copy.getByRole("textbox", { name: "New name" }).fill(hero);
  await copy
    .getByRole("combobox", { name: "Destination folder" })
    .selectOption({ label: "Home" });
  await copy.getByRole("button", { name: "Copy" }).click();
  await expect(copy).toBeHidden();
  await page.goto(`/Accounts/VR_Lulu/${hero.replace(" ", "_")}`);
  // A 1:1 copy: the sheet keeps the name it had inside; the folder lists it by its new name.
  await expect(page.getByRole("heading", { name: "Blank Hero" })).toBeVisible();

  // Deleting a folder with entries needs its name typed.
  await page.goto("/Accounts/VR_Lulu");
  const row = home.getByRole("listitem").filter({ hasText: folder });
  await row.getByRole("button", { name: "Delete…" }).click();
  const dialog = page.getByRole("alertdialog", { name: `Delete ${folder}` });
  await expect(dialog).toContainText("1 character, 1 item");
  const confirm = dialog.getByRole("button", { name: "Delete" });
  await expect(confirm).toBeDisabled();
  await dialog
    .getByRole("textbox", { name: "Folder name to confirm" })
    .fill(folder);
  await confirm.click();
  await expect(home.getByRole("link", { name: folder })).toHaveCount(0);
  // The copy outside the folder is untouched.
  await expect(home.getByRole("link", { name: hero })).toBeVisible();
});

test("other accounts can look at VR_Lulu's home but not change it", async ({
  page,
}) => {
  await page.goto("/");
  await signInAs(page, TEST_PLAYER);
  await page.goto("/Accounts/VR_Lulu");
  await expect(
    contents(page, "VR_Lulu's home").getByRole("link", {
      name: "Riverbed of Strings",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^New / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy as…" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete…" })).toHaveCount(0);
});
