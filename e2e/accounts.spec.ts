// Milestone 4, S1: Google sign-in on the Auth emulator, choosing an Alias and the pending state.

import { expect, test, type Page } from "@playwright/test";

/**
 * The emulator's sign-in result reaches the app through a hidden helper frame that loads Google's
 * `api.js`. In a fresh test browser that first load can hang and the result is lost, so load the
 * helper page once on its own first; afterwards it loads at once.
 */
async function warmGoogleScript(page: Page) {
  const warm = await page.context().newPage();
  await warm.goto(
    "http://127.0.0.1:9100/emulator/auth/iframe?apiKey=demo-key&appName=warm",
  );
  await warm.close();
}

/** Signs in through the Auth emulator's Google page as a new fake Google account. */
async function signInAs(page: Page, email: string) {
  await warmGoogleScript(page);
  const popupOpened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  const popup = await popupOpened;
  await popup.waitForLoadState("load");
  // The page can show its button before its script listens for clicks, so try again until the
  // form opens.
  await expect(async () => {
    await popup.getByText("Add new account").click();
    await expect(popup.locator("#email-input")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await popup.locator("#email-input").fill(email);
  await popup.locator("#display-name-input").fill("Private Google Name");
  const closed = popup.waitForEvent("close");
  await popup.locator("#sign-in").click();
  await closed;
}

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

  await signInAs(page, `${name}@example.com`);
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
  await signInAs(first, `${taken}.a@example.com`);
  await first.getByRole("textbox", { name: "Alias" }).fill(taken);
  await first.getByRole("button", { name: `Choose ${taken}` }).click();
  await expect(first.getByTestId("account-alias")).toHaveText(taken);
  await first.context().close();

  const second = await (await browser.newContext()).newPage();
  await second.goto("/");
  await signInAs(second, `${taken}.b@example.com`);
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
