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

// Milestone 5, S3: an encounter from start to end. Runs after the table was opened above.
test("the DM runs an encounter: NPCs, initiative, turns, rounds, the budget and the end", async ({
  browser,
}) => {
  const dm = await signedIn(browser, VR_LULU, `${TABLE}/Dungeon_Master`);
  dm.on("dialog", (d) => void d.accept());
  const npc = dm.getByRole("form", { name: "New NPC template" });
  await npc.getByLabel("NPC name").fill("Bandit Scout");
  await npc.getByLabel("NPC HP").fill("11");
  await npc.getByLabel("NPC AC").fill("13");
  await npc.getByLabel("NPC initiative bonus").fill("1");
  await npc.getByRole("button", { name: "Make template" }).click();

  const start = dm.getByRole("form", { name: "Start an encounter" });
  await start.getByLabel("How many Bandit Scout").fill("2");
  await start.getByLabel("Hours passed").fill("1");
  await start.getByRole("button", { name: "Start the encounter" }).click();
  await expect(
    dm.getByRole("heading", { name: /Day 1 Encounter 1/, level: 1 }),
  ).toBeVisible();
  await expect(dm.getByTestId("game-clock")).toHaveText("Day 1, 9:00 am");
  // Entries written together keep their order.
  const logText = await dm
    .getByRole("region", { name: "Campaign log" })
    .innerText();
  expect(logText.indexOf("Day 1 Downtime ended after 1 h.")).toBeLessThan(
    logText.indexOf("Day 1 Encounter 1 began"),
  );

  const order = dm.getByRole("region", { name: "Turn order" });
  await expect(order.getByTestId("initiative-Bandit Scout 1")).toBeVisible();
  await expect(order.getByTestId("initiative-Bandit Scout 2")).toBeVisible();

  // A player who does not control Carol cannot enter her initiative.
  const player = await signedIn(browser, TEST_PLAYER, TABLE);
  const carolRow = player
    .getByRole("region", { name: "Turn order" })
    .getByRole("listitem", { name: "Carol Elfnein" });
  await expect(carolRow).toContainText("waiting");
  await expect(
    carolRow.getByRole("button", { name: "Roll initiative" }),
  ).toHaveCount(0);

  await order.getByLabel("Carol Elfnein's initiative").fill("30");
  await order.getByLabel("Carol Elfnein's initiative").press("Enter");
  await expect(order.getByTestId("initiative-Carol Elfnein")).toHaveText(/30/);
  await dm.getByRole("button", { name: "Begin round 1" }).click();
  await expect(player.getByTestId("round")).toHaveText(
    "Round 1 · Carol Elfnein's turn",
  );

  const budget = order.getByLabel("Carol Elfnein's budget");
  await budget.getByLabel("Action", { exact: true }).click();
  await expect(budget.getByLabel("Action", { exact: true })).toBeChecked();
  await dm
    .getByRole("button", { name: "Carol Elfnein uses another Action" })
    .click();
  await expect(order.getByRole("status")).toContainText(
    "Carol Elfnein has used 2 × Action this turn",
  );

  // Through the round: after the last participant a new round adds six seconds.
  // Other tests may have added characters to the campaign, so end turns until round 2.
  for (let i = 0; i < 12; i++) {
    const before = await dm.getByTestId("round").innerText();
    if (before.startsWith("Round 2")) break;
    await dm.getByRole("button", { name: /^End .*'s turn$/ }).click();
    await expect(dm.getByTestId("round")).not.toHaveText(before);
  }
  await expect(dm.getByTestId("round")).toHaveText(
    "Round 2 · Carol Elfnein's turn",
  );
  await expect(player.getByTestId("game-clock")).toHaveText(
    "Day 1, 9:00:06 am",
  );
  // Carol's Action is fresh in her new turn.
  await expect(budget.getByLabel("Action", { exact: true })).not.toBeChecked();

  await order.getByRole("button", { name: "Remove Bandit Scout 2" }).click();
  await expect(
    order.getByRole("listitem", { name: "Bandit Scout 2" }),
  ).toHaveCount(0);
  await expect(dm.getByRole("region", { name: "Campaign log" })).toContainText(
    "The DM removed Bandit Scout 2 from the encounter.",
  );

  await dm.getByRole("button", { name: "End the encounter" }).click();
  await expect(
    player.getByRole("heading", { name: "Day 1 Downtime 2", level: 1 }),
  ).toBeVisible();
  await expect(player.getByTestId("game-clock")).toHaveText(
    "Day 1, 9:00:12 am",
  );
  await expect(
    player.getByRole("region", { name: "Campaign log" }),
  ).toContainText("Day 1 Encounter 1 ended after 2 rounds.");
});
