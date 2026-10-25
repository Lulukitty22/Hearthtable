// Milestone 5, S2: the table pages. The DM's first visit opens Riverbed of Strings' table in a
// downtime scene; players see the scene, the clock, who is present and the log, live.

import { expect, test, type Browser } from "@playwright/test";
import { signInAs, TEST_PLAYER, VR_LULU } from "./signIn";

const TABLE = "/Campaigns/Riverbed_of_Strings/Table";

async function signedIn(browser: Browser, email: string, path: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await signInAs(page, email);
  await page.goto(path);
  return page;
}

test("the DM opens the table; the clock, title and log reach the players live", async ({
  browser,
}) => {
  const dm = await signedIn(browser, VR_LULU, `${TABLE}/Dungeon_Master`);
  await expect(
    dm.getByRole("heading", { name: "Day 1 Downtime", level: 1 }),
  ).toBeVisible();
  const present = dm.getByRole("region", { name: "Present" });
  await expect(present).toContainText("Carol Elfnein");
  await expect(present).toContainText("Wizard 12 / Artificer 3");
  await expect(dm.getByTestId("hp-Carol Elfnein")).toContainText("/ 95");

  const player = await signedIn(browser, TEST_PLAYER, TABLE);
  await expect(player.getByTestId("game-clock")).toHaveText("Day 1, 12:00 am");
  await expect(player.getByRole("region", { name: "DM controls" })).toHaveCount(
    0,
  );

  await dm.getByLabel("Time of day").fill("08:00");
  await dm.getByRole("button", { name: "Set the clock" }).click();
  await expect(player.getByTestId("game-clock")).toHaveText("Day 1, 8:00 am");
  await expect(
    player.getByRole("region", { name: "Campaign log" }),
  ).toContainText(
    "The DM set the clock from Day 1, 12:00 am to Day 1, 8:00 am.",
  );

  await dm.getByLabel("Scene title").fill("Market day");
  await dm.getByRole("button", { name: "Save title" }).click();
  await expect(
    player.getByRole("heading", { name: "Market day (Day 1 Downtime)" }),
  ).toBeVisible();

  await player.getByLabel("Write to the log").fill("I keep watch.");
  await player.getByRole("button", { name: "Post" }).click();
  await expect(dm.getByRole("region", { name: "Campaign log" })).toContainText(
    "Test_Player: I keep watch.",
  );
});

test("only DMs open the DM's view; guests read the table without posting", async ({
  browser,
  page,
}) => {
  const player = await signedIn(
    browser,
    TEST_PLAYER,
    `${TABLE}/Dungeon_Master`,
  );
  await expect(player.getByText("Only this campaign's DMs")).toBeVisible();

  await page.goto(TABLE);
  await expect(page.getByTestId("game-clock")).toBeVisible();
  await expect(page.getByLabel("Write to the log")).toHaveCount(0);
});

test("the campaign page links to the table", async ({ page }) => {
  await page.goto("/");
  await signInAs(page, VR_LULU);
  await page.goto("/Campaigns/Riverbed_of_Strings");
  await page.getByRole("link", { name: "Open the DM's view" }).click();
  await expect(page).toHaveURL(/\/Table\/Dungeon_Master$/);
});
