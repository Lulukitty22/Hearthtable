// Signing in through the Auth emulator's Google page, shared by the browser tests.

import { expect, type Page } from "@playwright/test";

/** Seeded accounts' fake Google emails (scripts/accounts.ts). */
export const VR_LULU = "vr_lulu@example.com";
export const TEST_PLAYER = "test_player@example.com";

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

/**
 * Signs in through the Auth emulator's Google page: as a seeded account (picked by its email) or,
 * with `create`, as a new fake Google account.
 */
export async function signInAs(page: Page, email: string, create = false) {
  await warmGoogleScript(page);
  const popupOpened = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  const popup = await popupOpened;
  await popup.waitForLoadState("load");
  const closed = popup.waitForEvent("close");
  // The page can show its buttons before its script listens for clicks, so try again until the
  // click takes effect.
  if (create) {
    await expect(async () => {
      await popup.getByText("Add new account").click();
      await expect(popup.locator("#email-input")).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 10000 });
    await popup.locator("#email-input").fill(email);
    await popup.locator("#display-name-input").fill("Private Google Name");
    await popup.locator("#sign-in").click();
  } else {
    await expect(async () => {
      if (!popup.isClosed())
        await popup.getByText(email).click({ timeout: 1000 });
      await expect.poll(() => popup.isClosed(), { timeout: 1500 }).toBe(true);
    }).toPass({ timeout: 10000 });
  }
  await closed;
}
