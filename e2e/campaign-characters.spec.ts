// Milestone 4, S6: characters in campaigns. A member asks to add a copy of their character and
// a DM approves it; DMs edit campaign characters in DM mode; the owner chooses who else may
// control the character; and a campaign character copied to an account keeps working with the
// campaign's items.

import { expect, test, type Browser } from "@playwright/test";
import { signInAs, TEST_PLAYER, VR_LULU } from "./signIn";

const TEST_DM = "test_dm@example.com";
const RIVERBED = "/Campaigns/Riverbed_of_Strings";
const unique = () => Date.now().toString(36).slice(-5);

async function signedIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await signInAs(page, email);
  return page;
}

test("a player's character joins the campaign after a DM adds it; DMs edit it in DM mode", async ({
  browser,
}) => {
  const name = `Bram ${unique()}`;
  const player = await signedIn(browser, TEST_PLAYER);
  await player.getByRole("link", { name: "My home" }).click();
  await player.getByRole("button", { name: "New character" }).click();
  const form = player.getByRole("form", { name: "New character" });
  await form.getByRole("textbox", { name: "Name" }).fill(name);
  await form.getByRole("button", { name: "Create" }).click();
  await player
    .getByRole("list", { name: "Contents of Test_Player's home" })
    .getByRole("link", { name })
    .click();

  await player.getByRole("button", { name: "Copy into a campaign…" }).click();
  const ask = player.getByRole("form", { name: "Copy into a campaign" });
  await ask
    .getByRole("combobox", { name: "Campaign" })
    .selectOption({ label: "Riverbed of Strings" });
  await ask.getByRole("button", { name: "Ask to add" }).click();
  await expect(ask.getByRole("status")).toContainText("a DM approves it");

  // The player sees their request waiting; it is not in the campaign yet.
  await player.goto(RIVERBED);
  const waiting = player.getByRole("list", {
    name: "Characters waiting to be added",
  });
  await expect(waiting).toContainText(name);
  const listed = player.getByRole("list", { name: "Campaign characters" });
  await expect(listed.getByRole("link", { name })).toHaveCount(0);

  const dm = await signedIn(browser, VR_LULU);
  await dm.goto(RIVERBED);
  await dm.getByRole("button", { name: `Add ${name}` }).click();
  const added = dm
    .getByRole("list", { name: "Campaign characters" })
    .getByRole("link", { name });
  await expect(added).toBeVisible();

  // The player cannot edit it directly; the DM can, in DM mode.
  await added.click();
  await expect(dm.getByRole("link", { name: "Edit in DM mode" })).toBeVisible();
  const address = new URL(dm.url()).pathname;
  await player.goto(address);
  await expect(player.getByRole("heading", { name })).toBeVisible();
  await expect(player.getByRole("link", { name: /Edit/ })).toHaveCount(0);

  // The owner grants Test_DM control, then takes it away.
  await player
    .getByRole("group", { name: "Who else may control this character" })
    .getByRole("checkbox", { name: "Test_DM" })
    .click();
  const other = await signedIn(browser, TEST_DM);
  await other.goto(address);
  await expect(other.getByText("You may control this character")).toBeVisible();
  await player
    .getByRole("group", { name: "Who else may control this character" })
    .getByRole("checkbox", { name: "Test_DM" })
    .click();
  await expect(other.getByText("You may control this character")).toHaveCount(
    0,
  );

  for (const page of [player, dm, other]) await page.context().close();
});

test("Carol copied to VR_Lulu's account keeps using the campaign's items", async ({
  page,
}) => {
  const name = `Carol ${unique()}`;
  await page.goto("/");
  await signInAs(page, VR_LULU);
  await page.goto(`${RIVERBED}/Characters/VR_Lulu/Carol_Elfnein`);
  await page.getByRole("button", { name: "Copy to my account…" }).click();
  const copy = page.getByRole("form", { name: "Copy to my account" });
  await copy.getByRole("textbox", { name: "Name in my account" }).fill(name);
  await copy.getByRole("button", { name: "Copy" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/Accounts/VR_Lulu/${name.replace(" ", "_")}$`),
  );
  await expect(page.getByTestId("armor-class")).toContainText("13");
  // Her items still come from the campaign, so the Aetherlock resolves; they stay attuned to
  // the original Carol, so Indomitable's +2 INT waits until the copy attunes it.
  await expect(page.getByTestId("ability-int")).toContainText("20");
  await page.getByRole("tab", { name: "Inventory" }).click();
  await expect(page.getByRole("button", { name: "Aetherlock" })).toBeVisible();
  await expect(page.locator(".tile-bad")).toHaveCount(0);
});
