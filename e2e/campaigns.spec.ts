// Milestone 4, S5: campaigns, invite codes, join requests and DM roles.

import { expect, test, type Browser, type Page } from "@playwright/test";
import { signInAs, TEST_PLAYER, VR_LULU } from "./signIn";

const TEST_OTHER_DM = "test_other_dm@example.com";
const TEST_PENDING = "test_pending@example.com";
const unique = () => Date.now().toString(36).slice(-5);
const members = (page: Page) => page.getByRole("list", { name: "Members" });
const member = (page: Page, alias: string) =>
  members(page).getByRole("listitem", { name: alias });

async function signedIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await signInAs(page, email);
  return page;
}

test("VR_Lulu opens Riverbed of Strings from home and approves Test_Joiner", async ({
  page,
}) => {
  await page.goto("/");
  await signInAs(page, VR_LULU);
  await page.getByRole("link", { name: "My home" }).click();
  await page
    .getByRole("list", { name: "Contents of VR_Lulu's home" })
    .getByRole("link", { name: "Riverbed of Strings" })
    .click();
  await expect(page).toHaveURL(/\/Campaigns\/Riverbed_of_Strings$/);
  await expect(member(page, "VR_Lulu")).toContainText("DM");
  await expect(member(page, "Test_DM")).toContainText("DM");
  await expect(member(page, "Test_Player")).toContainText("player");

  const requests = page.getByRole("list", { name: "Join requests" });
  await requests.getByRole("button", { name: "Approve Test_Joiner" }).click();
  await expect(member(page, "Test_Joiner")).toContainText("player");
  await expect(page.getByText("No one is waiting to join.")).toBeVisible();
});

test("a new campaign: invite, request, approval, DM roles and the last DM", async ({
  browser,
}) => {
  const name = `Camp ${unique()}`;
  const dm = await signedIn(browser, TEST_PLAYER);
  await dm.getByRole("link", { name: "My home" }).click();
  await dm.getByRole("button", { name: "New campaign" }).click();
  const form = dm.getByRole("form", { name: "New campaign" });
  await form.getByRole("textbox", { name: "Name" }).fill(name);
  await form.getByRole("button", { name: "Create" }).click();
  await expect(dm).toHaveURL(
    new RegExp(`/Campaigns/${name.replace(" ", "_")}$`),
  );
  await expect(member(dm, "Test_Player")).toContainText("DM");
  await expect(member(dm, "Test_Player")).toContainText(
    "The last DM cannot leave",
  );
  await expect(dm.getByTestId("invite-code")).toHaveText(/^[A-Z0-9]{8}$/);
  const link = await dm.getByTestId("invite-link").innerText();
  const code = await dm.getByTestId("invite-code").innerText();

  // Test_Other_DM follows the invite link; the code is filled in.
  const joiner = await signedIn(browser, TEST_OTHER_DM);
  await joiner.goto(link);
  const ask = joiner.getByRole("form", { name: "Ask to join" });
  await expect(ask.getByRole("textbox", { name: "Invite code" })).toHaveValue(
    code,
  );
  await ask.getByRole("button", { name: "Ask to join" }).click();
  await expect(joiner.getByRole("status")).toContainText("waiting for a DM");

  await dm
    .getByRole("list", { name: "Join requests" })
    .getByRole("button", { name: "Approve Test_Other_DM" })
    .click();
  await expect(member(joiner, "Test_Other_DM")).toContainText("player");

  // DMs are equal: a new DM can revoke the first one, who stays as a player.
  await member(dm, "Test_Other_DM")
    .getByRole("button", { name: "Make DM" })
    .click();
  await member(joiner, "Test_Player")
    .getByRole("button", { name: "Revoke DM" })
    .click();
  await expect(member(dm, "Test_Player")).toContainText("player");
  await expect(member(joiner, "Test_Other_DM")).toContainText(
    "The last DM cannot leave",
  );
  await expect(dm.getByRole("region", { name: "DM tools" })).toHaveCount(0);

  // A player leaves.
  await member(dm, "Test_Player")
    .getByRole("button", { name: "Leave campaign" })
    .click();
  await member(dm, "Test_Player")
    .getByRole("button", { name: "Leave" })
    .click();
  await expect(member(joiner, "Test_Player")).toHaveCount(0);

  await dm.context().close();
  await joiner.context().close();
});

test("a wrong code is refused, and pending accounts cannot ask to join", async ({
  browser,
}) => {
  const player = await signedIn(browser, TEST_OTHER_DM);
  await player.goto("/Campaigns/Riverbed_of_Strings?invite=WRONG123");
  const ask = player.getByRole("form", { name: "Ask to join" });
  await ask.getByRole("button", { name: "Ask to join" }).click();
  await expect(ask).toContainText("does not work for this campaign");
  await player.context().close();

  const pending = await signedIn(browser, TEST_PENDING);
  await pending.goto("/Campaigns/Riverbed_of_Strings");
  await expect(
    pending.getByText("needs an administrator's approval before it can join"),
  ).toBeVisible();
  await pending.context().close();
});

test("the front page finds a campaign from its code", async ({ browser }) => {
  const dm = await signedIn(browser, VR_LULU);
  await dm.goto("/Campaigns/Riverbed_of_Strings");
  await expect(dm.getByTestId("invite-code")).toHaveText(/^[A-Z0-9]{8}$/);
  const code = await dm.getByTestId("invite-code").innerText();
  await dm.context().close();

  const other = await signedIn(browser, TEST_OTHER_DM);
  const join = other.getByRole("form", { name: "Join a campaign" });
  await join.getByRole("textbox", { name: "Invite code" }).fill(code);
  await join.getByRole("button", { name: "Find the campaign" }).click();
  await expect(other).toHaveURL(/\/Campaigns\/Riverbed_of_Strings\?invite=/);
  await expect(
    other
      .getByRole("form", { name: "Ask to join" })
      .getByRole("textbox", { name: "Invite code" }),
  ).toHaveValue(code);
  await other.context().close();
});
