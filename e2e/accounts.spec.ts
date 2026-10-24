// Milestone 4, S1: Google sign-in on the Auth emulator, choosing an Alias and the pending state.

import { expect, test, type Page } from "@playwright/test";
import { signInAs, TEST_PLAYER, VR_LULU } from "./signIn";

// Names unique to each run, so the tests can repeat against one emulator.
const unique = () => Date.now().toString(36) + Math.floor(Math.random() * 1e4);

const account = (page: Page) => page.getByRole("region", { name: "Account" });

test("a guest signs in, chooses an Alias and waits for approval", async ({
  page,
}) => {
  const name = `First_${unique()}`;
  await page.goto("/");
  await expect(account(page)).toContainText("Browsing as a guest");
  // Guests browse public content.
  await expect(page.getByRole("link", { name: "Carol Elfnein" })).toBeVisible();

  await signInAs(page, `${name}@example.com`, true);
  const form = page.getByRole("form", { name: "Choose your Alias" });
  await expect(form).toBeVisible();

  const alias = form.getByRole("textbox", { name: "Alias" });
  await alias.fill("abc");
  await expect(form).toContainText("at least 4 characters");
  await alias.fill("First Player");
  await expect(form).toContainText("Use only letters");
  await expect(form.getByRole("button", { name: /Choose/ })).toBeDisabled();

  await alias.fill(name);
  await form.getByRole("button", { name: `Choose ${name}` }).click();

  await expect(page.getByTestId("account-alias")).toHaveText(name);
  await expect(account(page)).toContainText("awaiting approval");
  await expect(page.getByRole("status")).toContainText(
    "waiting for an administrator's approval",
  );
  await expect(form).toBeHidden();
  // Nothing from the Google account is shown.
  await expect(page.locator("body")).not.toContainText("@example.com");
  await expect(page.locator("body")).not.toContainText("Private Google Name");

  // Pending accounts still browse public content, and sign-in survives a reload.
  await page.getByRole("link", { name: "Carol Elfnein" }).click();
  await expect(page.getByTestId("armor-class")).toBeVisible();
  await expect(page.getByTestId("account-alias")).toHaveText(name);

  await account(page).getByRole("button", { name: "Sign out" }).click();
  await expect(account(page)).toContainText("Browsing as a guest");
});

test("an Alias already taken is refused, ignoring capitals and _ versus -", async ({
  browser,
}) => {
  const taken = `Taken_${unique()}`;
  const first = await (await browser.newContext()).newPage();
  await first.goto("/");
  await signInAs(first, `${taken}.a@example.com`, true);
  await first.getByRole("textbox", { name: "Alias" }).fill(taken);
  await first.getByRole("button", { name: `Choose ${taken}` }).click();
  await expect(first.getByTestId("account-alias")).toHaveText(taken);
  await first.context().close();

  const second = await (await browser.newContext()).newPage();
  await second.goto("/");
  await signInAs(second, `${taken}.b@example.com`, true);
  const form = second.getByRole("form", { name: "Choose your Alias" });
  await form
    .getByRole("textbox", { name: "Alias" })
    .fill(taken.toLowerCase().replace("_", "-"));
  await form
    .getByRole("button", {
      name: `Choose ${taken.toLowerCase().replace("_", "-")}`,
    })
    .click();
  await expect(form).toContainText(`${taken} is already taken`);
  await expect(second.getByTestId("account-alias")).toHaveCount(0);

  await form.getByRole("textbox", { name: "Alias" }).fill(`${taken}_2`);
  await form.getByRole("button", { name: `Choose ${taken}_2` }).click();
  await expect(second.getByTestId("account-alias")).toHaveText(`${taken}_2`);
  await second.context().close();
});

test("the site administrator approves a waiting account", async ({
  browser,
}) => {
  const name = `Waiting_${unique()}`;
  const waiting = await (await browser.newContext()).newPage();
  await waiting.goto("/");
  await signInAs(waiting, `${name}@example.com`, true);
  await waiting.getByRole("textbox", { name: "Alias" }).fill(name);
  await waiting.getByRole("button", { name: `Choose ${name}` }).click();
  await expect(account(waiting)).toContainText("awaiting approval");

  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/");
  await signInAs(admin, VR_LULU);
  await expect(admin.getByTestId("account-alias")).toHaveText("VR_Lulu");
  await expect(account(admin)).toContainText("administrator");
  await account(admin).getByRole("link", { name: "Approvals" }).click();
  await expect(admin).toHaveURL(/\/Admin$/);
  const list = admin.getByRole("list", {
    name: "Accounts waiting for approval",
  });
  await expect(list).toContainText("Test_Pending");
  await list.getByRole("button", { name: `Approve ${name}` }).click();
  await expect(list).not.toContainText(name);

  // The waiting account sees its approval without reloading.
  await expect(account(waiting)).toContainText("approved");
  await expect(account(waiting)).not.toContainText("awaiting approval");
  await expect(waiting.getByRole("status")).toHaveCount(0);

  await waiting.context().close();
  await admin.context().close();
});

test("only site administrators see approvals", async ({ page }) => {
  await page.goto("/");
  await signInAs(page, TEST_PLAYER);
  await expect(page.getByTestId("account-alias")).toHaveText("Test_Player");
  await expect(
    account(page).getByRole("link", { name: "Approvals" }),
  ).toHaveCount(0);
  await page.goto("/Admin");
  await expect(
    page.getByText("This page is for site administrators"),
  ).toBeVisible();
});

test("old addresses that began with the Alias open nothing", async ({
  page,
}) => {
  await page.goto("/VR_Lulu/Characters/Carol_Elfnein");
  await expect(page.getByText("There is no page at")).toBeVisible();
  await page.goto(
    "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein/Edit",
  );
  await expect(page.getByTestId("armor-class")).toBeVisible();
});
