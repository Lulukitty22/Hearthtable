// Milestone 5, S2: the table pages. The DM's first visit opens Riverbed of Strings' table in a
// downtime scene; players see the scene, the clock, who is present and the log, live.

import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { signInAs, TEST_PLAYER, VR_LULU } from "./signIn";

const TABLE = "/Campaigns/Riverbed_of_Strings/Table";

/**
 * Every action asks for responses before it resolves (S9): the DM opens the poll, each given
 * page's player passes, and the poll closes.
 */
async function everyonePasses(requests: Locator, ...pages: readonly Page[]) {
  await requests.getByRole("button", { name: "Ask for responses" }).click();
  for (const page of pages) {
    const pass = page
      .getByRole("region", { name: "Responses" })
      .getByRole("button", { name: "Pass" });
    await pass.click();
  }
  await expect(
    requests.getByRole("button", { name: "Approve and resolve" }),
  ).toBeVisible();
}

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

// Milestone 5, S4: an effect runs on the game clock and ends at the same step one round later.
test("Shield cast in an encounter ends one round later and the log says so", async ({
  browser,
}) => {
  const dm = await signedIn(browser, VR_LULU, `${TABLE}/Dungeon_Master`);
  dm.on("dialog", (d) => void d.accept());
  const start = dm.getByRole("form", { name: "Start an encounter" });
  // Only Carol takes part. Unticking one changes the list, so take the first ticked each time.
  const characters = start.getByRole("group", { name: "Characters" });
  await expect(
    characters.getByRole("checkbox", { name: "Carol Elfnein", exact: true }),
  ).toBeVisible();
  const ticked = characters.getByRole("checkbox", { checked: true });
  while ((await ticked.count()) > 0) await ticked.first().uncheck();
  await start
    .getByRole("group", { name: "Characters" })
    .getByRole("checkbox", { name: "Carol Elfnein", exact: true })
    .check();
  await start.getByRole("button", { name: "Start the encounter" }).click();
  const order = dm.getByRole("region", { name: "Turn order" });
  await order.getByLabel("Carol Elfnein's initiative").fill("12");
  await order.getByLabel("Carol Elfnein's initiative").press("Enter");
  await dm.getByRole("button", { name: "Begin round 1" }).click();
  await expect(dm.getByTestId("round")).toHaveText(
    "Round 1 · Carol Elfnein's turn",
  );

  const sheet = await dm.context().newPage();
  await sheet.goto(
    "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein/Edit",
  );
  await sheet.getByRole("button", { name: "Shield" }).click();
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    sheet.getByRole("button", { name: /Shield · 1 round/ }),
  ).toBeVisible();

  const effects = order.getByLabel("Carol Elfnein's effects");
  await expect(effects).toContainText("Shield · 1 round");
  await expect(order).toContainText("AC 18");

  // Round 2 begins with Carol's turn: the same step as Shield began, so it ends.
  await dm.getByRole("button", { name: "End Carol Elfnein's turn" }).click();
  await expect(dm.getByTestId("round")).toHaveText(
    "Round 2 · Carol Elfnein's turn",
  );
  await expect(order.getByLabel("Carol Elfnein's effects")).toHaveCount(0);
  await expect(order).toContainText("AC 13");
  await expect(dm.getByRole("region", { name: "Campaign log" })).toContainText(
    "Shield on Carol Elfnein ended.",
  );
  await dm.getByRole("button", { name: "End the encounter" }).click();
});

// Milestone 5, S5: conditions applied at the table, their automated parts and concentration.
test("the DM applies conditions; saves fail, Exhaustion stacks, and Stunned breaks concentration", async ({
  browser,
}) => {
  const dm = await signedIn(browser, VR_LULU, `${TABLE}/Dungeon_Master`);
  const card = dm
    .getByRole("region", { name: "Present" })
    .getByRole("listitem")
    .filter({ hasText: "Carol Elfnein" });
  const add = card.getByRole("form", {
    name: "Add a condition to Carol Elfnein",
  });
  await add
    .getByLabel("Condition for Carol Elfnein")
    .selectOption({ label: "Paralyzed" });
  await add.getByLabel("Repeat save").selectOption("wis");
  await add.getByLabel("Save DC").fill("15");
  await add.getByRole("button", { name: "Apply" }).click();
  const conditions = card.getByLabel("Carol Elfnein's conditions");
  await expect(conditions).toContainText("Paralyzed");
  await expect(conditions).toContainText("Incapacitated");
  await expect(dm.getByRole("region", { name: "Campaign log" })).toContainText(
    "The DM gave Carol Elfnein Paralyzed (Wisdom save DC 15 to end it).",
  );

  const sheet = await dm.context().newPage();
  await sheet.goto(
    "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein",
  );
  const saves = sheet.getByRole("table").filter({ hasText: "DEX" }).first();
  await expect(sheet.getByText("fails automatically").first()).toBeVisible();
  await expect(saves).toBeVisible();

  // Remove Paralyzed; two levels of Exhaustion lower initiative by 4.
  await conditions.getByText("Paralyzed", { exact: true }).click();
  await card.getByRole("button", { name: "Remove Paralyzed" }).click();
  await expect(conditions).toHaveCount(0);
  for (let i = 0; i < 2; i++) {
    await add
      .getByLabel("Condition for Carol Elfnein")
      .selectOption({ label: "Exhaustion (+1 level)" });
    await add.getByRole("button", { name: "Apply" }).click();
    await expect(card.getByLabel("Carol Elfnein's conditions")).toContainText(
      `Exhaustion ${i + 1}`,
    );
  }
  await sheet.reload();
  await expect(
    sheet.locator(".vital").filter({ hasText: "Initiative" }),
  ).toContainText("+4");

  // Concentration: Tasha's Otherworldly Guise is broken by Stunned.
  await sheet.goto(
    "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein/Edit",
  );
  await sheet.getByRole("button", { name: /Otherworldly Guise/ }).click();
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.getByLabel("Carol Elfnein's effects")).toContainText(
    "Guise",
  );
  await add
    .getByLabel("Condition for Carol Elfnein")
    .selectOption({ label: "Stunned" });
  await add.getByRole("button", { name: "Apply" }).click();
  await expect(dm.getByRole("region", { name: "Campaign log" })).toContainText(
    "Carol Elfnein lost concentration on Tasha's Otherworldly Guise.",
  );
  await expect(card.getByLabel("Carol Elfnein's effects")).toHaveCount(0);

  // Stunned would break concentration in the tests that follow.
  await conditions.getByText("Stunned", { exact: true }).click();
  await card.getByRole("button", { name: "Remove Stunned" }).click();
  await expect(card.getByLabel("Carol Elfnein's conditions")).not.toContainText(
    "Stunned",
  );
});

// Milestone 5, S5: downtime. Activities are planned, approved and run when the DM ends it.
test("downtime: a Long Rest and a note run when the DM ends it; a Short Rest spends Hit Point Dice", async ({
  browser,
}) => {
  const dm = await signedIn(browser, VR_LULU, `${TABLE}/Dungeon_Master`);
  const sheet = await dm.context().newPage();
  const hurt = async () => {
    await sheet.goto(
      "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein/Edit",
    );
    await sheet.getByLabel("Current hit points").fill("40");
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      sheet.getByRole("region", { name: "Unsaved changes" }),
    ).toBeHidden();
    await expect(dm.getByTestId("hp-Carol Elfnein")).toContainText("HP 40 /");
  };
  await hurt();

  const panel = dm.getByRole("region", { name: "Downtime" });
  const add = panel.getByRole("form", { name: "Add an activity" });
  // Other tests may have added characters; the DM controls them all, so pick Carol.
  const pickCarol = async () => {
    const choose = add.getByLabel("Character");
    if (await choose.count())
      await choose.selectOption({ label: "Carol Elfnein" });
  };
  await pickCarol();
  await add.getByLabel("Activity").selectOption({ label: "Long Rest (8 h)" });
  await add.getByRole("button", { name: "Add" }).click();
  await pickCarol();
  await add.getByLabel("Activity").selectOption({ label: "Note" });
  await add.getByLabel("What they do").fill("keep watch");
  await add.getByLabel("Hours").fill("2");
  await add.getByRole("button", { name: "Add" }).click();
  await expect(panel.getByLabel("As planned")).toContainText(
    "Carol Elfnein: Long Rest 8 h, Note 2 h (keep watch) → HP 95 / 95",
  );

  const list = panel.getByRole("list", { name: "Activities" });
  for (let i = 0; i < 2; i++)
    await list.getByRole("button", { name: "approve" }).first().click();
  await expect(list.getByText("pending")).toHaveCount(0);
  const end = panel.getByRole("form", { name: "End the downtime" });
  await end.getByLabel("Hours that passed").fill("10");
  await end.getByRole("button", { name: "End the downtime" }).click();
  const log = dm.getByRole("region", { name: "Campaign log" });
  await expect(log).toContainText(
    "Carol Elfnein finished Long Rest: hit points",
  );
  await expect(log).toContainText("Carol Elfnein finished Note: done");
  await expect(dm.getByTestId("hp-Carol Elfnein")).toContainText("HP 95 / 95");

  // A Short Rest, then one Hit Point Die (d8 or d6).
  await hurt();
  await pickCarol();
  await add.getByLabel("Activity").selectOption({ label: "Short Rest (1 h)" });
  await add.getByRole("button", { name: "Add" }).click();
  await list.getByRole("button", { name: "approve" }).click();
  await end.getByLabel("Hours that passed").fill("1");
  await end.getByRole("button", { name: "End the downtime" }).click();
  const spend = panel.getByLabel("Carol Elfnein's Hit Point Dice");
  await spend.getByRole("button", { name: /Roll a d8/ }).click();
  await expect(log).toContainText("Carol Elfnein spent a Hit Point Die: d8");
  await expect(dm.getByTestId("hp-Carol Elfnein")).not.toContainText("HP 40 /");
  await spend.getByRole("button", { name: "Done spending" }).click();
  await expect(spend).toHaveCount(0);
});

// Milestone 5, S6: requests hold their costs; revising keeps the place; cancelling and
// rejecting return the holds.
test("a cast request holds its slot; revise, cancel and reject return holds once", async ({
  browser,
}) => {
  const dm = await signedIn(browser, VR_LULU, `${TABLE}/Dungeon_Master`);
  const sheet = await dm.context().newPage();
  await sheet.goto(
    "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein",
  );
  await sheet.getByRole("tab", { name: "Spells & Books" }).click();
  const level = (n: number) => sheet.getByTestId(`slots-${n}`);
  await expect(level(1)).toContainText("7 / 7");
  await expect(level(2)).toContainText("3 / 3");

  const cast = async () => {
    await sheet
      .getByRole("button", { name: /^Mage Armor/ })
      .first()
      .click();
    await sheet.getByRole("button", { name: "Cast…" }).click();
    const review = sheet.getByRole("form", { name: "Cast Mage Armor" });
    await expect(review).toContainText(
      "Holds one level-1 spell slot; uses Action",
    );
    await review.getByRole("button", { name: "Confirm" }).click();
  };
  await cast();
  await expect(level(1)).toContainText("6 / 7");
  const requests = sheet.getByRole("region", { name: "Requests" });
  await expect(requests).toContainText("Cast Mage Armor at level 1 from");
  await expect(requests).toContainText("ready for the DM");
  await expect(dm.getByRole("region", { name: "Requests" })).toContainText(
    "Carol Elfnein: Cast Mage Armor at level 1",
  );

  // Revise to level 2: the level-1 slot comes back and a level-2 slot is held instead.
  await requests.getByRole("button", { name: "revise" }).click();
  await requests.getByLabel("Cast level").selectOption("2");
  await requests.getByRole("button", { name: "Save the revision" }).click();
  await expect(requests).toContainText("revision 2");
  await expect(level(1)).toContainText("7 / 7");
  await expect(level(2)).toContainText("2 / 3");

  await requests.getByRole("button", { name: "cancel" }).click();
  await expect(level(2)).toContainText("3 / 3");
  await expect(requests).toHaveCount(0);

  // The DM rejects the next one; the slot returns once.
  await sheet.getByRole("button", { name: "Close" }).click();
  await cast();
  await expect(level(1)).toContainText("6 / 7");
  await dm
    .getByRole("region", { name: "Requests" })
    .getByRole("button", { name: "reject" })
    .click();
  await expect(level(1)).toContainText("7 / 7");
  await expect(dm.getByRole("region", { name: "Campaign log" })).toContainText(
    "The DM rejected Carol Elfnein's request: Cast Mage Armor at level 1",
  );
});

// Milestone 5, S7: approval at the eligible moment and resolution. Mage Armor (Next Turn) is
// approved at Carol's turn: her AC becomes 16 and the effect ends on the clock. Hold Person
// paralyzes a bandit.
test("Mage Armor resolves at Carol's turn; Hold Person paralyzes; effects end on the clock", async ({
  browser,
}) => {
  const dm = await signedIn(browser, VR_LULU, `${TABLE}/Dungeon_Master`);
  dm.on("dialog", (d) => void d.accept());
  const start = dm.getByRole("form", { name: "Start an encounter" });
  const characters = start.getByRole("group", { name: "Characters" });
  await expect(
    characters.getByRole("checkbox", { name: "Carol Elfnein", exact: true }),
  ).toBeVisible();
  const ticked = characters.getByRole("checkbox", { checked: true });
  while ((await ticked.count()) > 0) await ticked.first().uncheck();
  await characters
    .getByRole("checkbox", { name: "Carol Elfnein", exact: true })
    .check();
  await start.getByLabel("How many Bandit Scout").fill("1");
  await start.getByRole("button", { name: "Start the encounter" }).click();
  const order = dm.getByRole("region", { name: "Turn order" });
  // Carol goes last (a bandit rolls at least 2).
  await order.getByLabel("Carol Elfnein's initiative").fill("1");
  await order.getByLabel("Carol Elfnein's initiative").press("Enter");
  await expect(order.getByTestId("initiative-Carol Elfnein")).toHaveText(/1/);

  const sheet = await dm.context().newPage();
  await sheet.goto(
    "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein",
  );
  await sheet.getByRole("tab", { name: "Spells & Books" }).click();
  await sheet
    .getByRole("button", { name: /^Mage Armor/ })
    .first()
    .click();
  await sheet.getByRole("button", { name: "Cast…" }).click();
  const review = sheet.getByRole("form", { name: "Cast Mage Armor" });
  await expect(review.getByRole("radio", { name: "Next Turn" })).toBeChecked();
  await expect(
    review.getByRole("checkbox", { name: "Carol Elfnein" }),
  ).toBeChecked();
  await review.getByRole("button", { name: "Confirm" }).click();
  await expect(sheet.getByTestId("slots-1")).toContainText("6 / 7");

  await dm.getByRole("button", { name: "Begin round 1" }).click();
  const requests = dm.getByRole("region", { name: "Requests" });
  await expect(requests).toContainText("waits for its turn");
  await expect(requests.getByRole("button", { name: "resolve…" })).toHaveCount(
    0,
  );
  await dm.getByRole("button", { name: "End Bandit Scout's turn" }).click();
  await expect(requests).toContainText("ready for the DM");
  await requests.getByRole("button", { name: "resolve…" }).click();
  await everyonePasses(requests, dm);
  await requests.getByRole("button", { name: "Approve and resolve" }).click();
  await expect(
    order.getByRole("listitem", { name: "Carol Elfnein" }),
  ).toContainText("AC 16");
  await expect(order.getByLabel("Carol Elfnein's effects")).toContainText(
    "Mage Armor",
  );
  await expect(sheet.getByTestId("slots-1")).toContainText("6 / 7");
  await expect(dm.getByRole("region", { name: "Campaign log" })).toContainText(
    "The DM approved it. Carol Elfnein: cast Mage Armor at level 1",
  );

  // Hold Person, Instant, on the bandit, who fails the save.
  await sheet.getByRole("button", { name: "Close" }).click();
  await sheet
    .getByRole("button", { name: /^Hold Person/ })
    .first()
    .click();
  await sheet.getByRole("button", { name: "Cast…" }).click();
  const hold = sheet.getByRole("form", { name: "Cast Hold Person" });
  await hold.getByRole("radio", { name: "Instant" }).check();
  await hold.getByRole("checkbox", { name: "Bandit Scout" }).check();
  await hold.getByRole("button", { name: "Confirm" }).click();
  await requests.getByRole("button", { name: "resolve…" }).click();
  await expect(requests.getByLabel("Bandit Scout: result")).toHaveValue(
    "failed",
  );
  await everyonePasses(requests, dm);
  await requests.getByRole("button", { name: "Approve and resolve" }).click();
  const bandit = order.getByRole("listitem", { name: "Bandit Scout" });
  await expect(bandit.getByLabel("Bandit Scout's conditions")).toContainText(
    "Paralyzed",
  );
  await expect(bandit.getByLabel("Bandit Scout's conditions")).toContainText(
    "Incapacitated",
  );

  // The encounter ends; nine hours of downtime end Mage Armor (8 hours) and Hold Person.
  await dm.getByRole("button", { name: "End the encounter" }).click();
  const end = dm.getByRole("form", { name: "End the downtime" });
  await end.getByLabel("Hours that passed").fill("9");
  await end.getByRole("button", { name: "End the downtime" }).click();
  const log = dm.getByRole("region", { name: "Campaign log" });
  await expect(log).toContainText("Mage Armor on Carol Elfnein ended.");
  await expect(dm.getByRole("region", { name: "Present" })).toContainText(
    "AC 13",
  );
});

// Milestone 5, S8: rolls. A player answers their own save; the DM takes over another; rolling
// in the app, own dice and a typed total all count and are logged; Fireball resolves from a save
// prompt and a damage prompt.
test("roll prompts: the player rolls, the DM takes over, and Fireball resolves from rolls", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const name = `Bram ${Date.now().toString(36).slice(-5)}`;
  const player = await signedIn(browser, TEST_PLAYER, "/");
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
  const copy = player.getByRole("form", { name: "Copy into a campaign" });
  await copy
    .getByRole("combobox", { name: "Campaign" })
    .selectOption({ label: "Riverbed of Strings" });
  await copy.getByRole("button", { name: "Ask to add" }).click();
  await expect(copy.getByRole("status")).toContainText("a DM approves it");

  const dm = await signedIn(browser, VR_LULU, "/Campaigns/Riverbed_of_Strings");
  await dm.getByRole("button", { name: `Add ${name}` }).click();
  await expect(
    dm
      .getByRole("list", { name: "Campaign characters" })
      .getByRole("link", { name }),
  ).toBeVisible();
  await dm.goto(`${TABLE}/Dungeon_Master`);
  await player.goto(TABLE);
  const ask = dm.getByRole("form", { name: "Ask for a roll" });
  const log = dm.getByRole("region", { name: "Campaign log" });

  // The player answers their own Wisdom save, rolled in the app.
  await ask.getByLabel("Who rolls").selectOption({ label: name });
  await ask.getByLabel("Which roll").selectOption({ label: "Wisdom save" });
  await ask.getByLabel("DC").fill("12");
  await ask.getByRole("button", { name: "Ask" }).click();
  const prompt = player.getByRole("form", {
    name: `Roll: ${name}, Wisdom save`,
  });
  await prompt.getByRole("button", { name: "Roll" }).click();
  await expect(log).toContainText(
    new RegExp(
      `${name}: Wisdom save: \\d+ \\(1d20\\+0: \\d+\\), (success|failure)\\.`,
    ),
  );

  // The DM takes over the next one with a typed total; the player can no longer answer it.
  await ask.getByRole("button", { name: "Ask" }).click();
  await expect(
    player.getByRole("form", { name: `Roll: ${name}, Wisdom save` }),
  ).toBeVisible();
  const takeover = dm.getByRole("form", {
    name: `Roll: ${name}, Wisdom save`,
  });
  await takeover.getByLabel("How to roll").selectOption("manual");
  await takeover.getByLabel("Total").fill("17");
  await takeover.getByRole("button", { name: "Roll for them" }).click();
  await expect(log).toContainText(
    `${name}: Wisdom save: 17 (typed), success (rolled by the DM).`,
  );
  await expect(
    player.getByRole("form", { name: `Roll: ${name}, Wisdom save` }),
  ).toHaveCount(0);

  // Carol's own dice.
  await ask.getByLabel("Who rolls").selectOption({ label: "Carol Elfnein" });
  await ask.getByLabel("Which roll").selectOption({ label: "Wisdom save" });
  await ask.getByLabel("DC").fill("10");
  await ask.getByRole("button", { name: "Ask" }).click();
  const own = dm.getByRole("form", {
    name: "Roll: Carol Elfnein, Wisdom save",
  });
  await own.getByLabel("How to roll").selectOption("custom");
  await own.getByLabel("Dice").fill("1d4+20");
  await own.getByRole("button", { name: "Roll", exact: true }).click();
  await expect(log).toContainText(
    /Carol Elfnein: Wisdom save: 2[1-4] \(1d4\+20: [1-4]\), success\./,
  );

  // Fireball on the player's character: a save prompt, then Carol's damage roll.
  const sheet = await dm.context().newPage();
  await sheet.goto(
    "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein",
  );
  await sheet.getByRole("tab", { name: "Spells & Books" }).click();
  await sheet
    .getByRole("button", { name: /^Fireball/ })
    .first()
    .click();
  await sheet.getByRole("button", { name: "Cast…" }).click();
  const review = sheet.getByRole("form", { name: "Cast Fireball" });
  await review.getByRole("checkbox", { name }).check();
  await review.getByRole("button", { name: "Confirm" }).click();
  const requests = dm.getByRole("region", { name: "Requests" });
  await requests.getByRole("button", { name: "resolve…" }).click();
  await requests.getByRole("button", { name: "Ask for saves" }).click();
  const save = player.getByRole("form", {
    name: `Roll: ${name}, Dexterity save against Fireball`,
  });
  // At 0 hit points the character is down, so Dexterity saves fail automatically.
  await expect(save).toContainText("Fails automatically.");
  await save.getByRole("button", { name: "Roll" }).click();
  await expect(requests.getByTestId(`roll-${name}`)).toContainText(
    "rolled an automatic failure",
  );
  await expect(requests.getByLabel(`${name}: result`)).toHaveValue("failed");
  await requests
    .getByRole("button", { name: "Ask for the damage roll" })
    .click();
  const damage = dm.getByRole("form", {
    name: "Roll: Carol Elfnein, Fireball damage",
  });
  await damage.getByLabel("How to roll").selectOption("manual");
  await damage.getByLabel("Total").fill("30");
  await damage.getByRole("button", { name: "Roll" }).click();
  await expect(requests.getByLabel("Total")).toHaveValue("30");
  await everyonePasses(requests, dm, player);
  await requests.getByRole("button", { name: "Approve and resolve" }).click();
  await expect(log).toContainText(`${name} failed the save: 30 Fire damage`);
});

// Milestone 5, S9: the Shield example end to end. An attack would hit; a poll opens; Shield
// comes in as an Instant response; the hit is rechecked against the new Armor Class; a fresh
// poll closes when everyone passes, and only then does the attack resolve, with no damage.
test("Shield as a response turns a hit into a miss before damage", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const dm = await signedIn(browser, VR_LULU, `${TABLE}/Dungeon_Master`);
  dm.on("dialog", (d) => void d.accept());
  const start = dm.getByRole("form", { name: "Start an encounter" });
  const characters = start.getByRole("group", { name: "Characters" });
  await expect(
    characters.getByRole("checkbox", { name: "Carol Elfnein", exact: true }),
  ).toBeVisible();
  const ticked = characters.getByRole("checkbox", { checked: true });
  while ((await ticked.count()) > 0) await ticked.first().uncheck();
  await characters
    .getByRole("checkbox", { name: "Carol Elfnein", exact: true })
    .check();
  await start.getByLabel("How many Bandit Scout").fill("1");
  await start.getByRole("button", { name: "Start the encounter" }).click();
  await expect(dm.getByRole("region", { name: "Turn order" })).toContainText(
    "AC 13",
  );

  // The bandit attacks Carol: 15 against AC 13 would hit.
  const requests = dm.getByRole("region", { name: "Requests" });
  const make = requests.getByRole("form", { name: "Make an attack" });
  await make.getByLabel("Attacker").selectOption({ label: "Bandit Scout" });
  await make.getByLabel("Weapon").fill("scimitar");
  await make.getByLabel("Target").selectOption({ label: "Carol Elfnein" });
  await make.getByRole("button", { name: "Queue the attack" }).click();
  const attackItem = requests
    .getByRole("listitem")
    .filter({ hasText: "Attack: Bandit Scout's scimitar" });
  await attackItem.getByRole("button", { name: "resolve…" }).click();
  await requests
    .getByRole("button", { name: "Ask for the attack roll" })
    .click();
  const roll = dm.getByRole("form", {
    name: "Roll: Bandit Scout, Bandit Scout's scimitar against Carol Elfnein",
  });
  await roll.getByLabel("How to roll").selectOption("manual");
  await roll.getByLabel("Total").fill("15");
  await roll.getByRole("button", { name: "Roll" }).click();
  await expect(requests.getByLabel("Carol Elfnein: result")).toHaveValue("hit");
  await requests.getByRole("button", { name: "Ask for responses" }).click();
  await expect(dm.getByRole("region", { name: "Responses" })).toContainText(
    "Bandit Scout's scimitar would hit Carol Elfnein",
  );
  await expect(
    requests.getByRole("button", { name: "Approve and resolve" }),
  ).toBeHidden();

  // Carol answers with Shield, an Instant response.
  const sheet = await dm.context().newPage();
  await sheet.goto(
    "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein",
  );
  await sheet.getByRole("tab", { name: "Spells & Books" }).click();
  await sheet
    .getByRole("button", { name: /^Shield/ })
    .first()
    .click();
  await sheet.getByRole("button", { name: "Cast…" }).click();
  const review = sheet.getByRole("form", { name: "Cast Shield" });
  await expect(
    review.getByRole("checkbox", { name: /As a response to/ }),
  ).toBeChecked();
  await review.getByRole("button", { name: "Confirm" }).click();
  const shieldItem = requests
    .getByRole("listitem")
    .filter({ hasText: "Cast Shield" });
  await expect(shieldItem).toContainText("response to");
  await shieldItem.getByRole("button", { name: "resolve…" }).click();
  await requests.getByRole("button", { name: "Approve and resolve" }).click();
  await expect(dm.getByRole("region", { name: "Turn order" })).toContainText(
    "AC 18",
  );
  await expect(dm.getByRole("region", { name: "Responses" })).toContainText(
    "round 2",
  );

  // Back to the attack: 15 against AC 18 now misses; everyone passes; it resolves.
  await attackItem.getByRole("button", { name: "resolve…" }).click();
  await expect(requests.getByLabel("Carol Elfnein: result")).toHaveValue(
    "miss",
  );
  await dm
    .getByRole("region", { name: "Responses" })
    .getByRole("button", { name: "Pass" })
    .click();
  await requests.getByRole("button", { name: "Approve and resolve" }).click();
  const log = dm.getByRole("region", { name: "Campaign log" });
  await expect(log).toContainText("Everyone passed; no more responses.");
  await expect(log).toContainText("Carol Elfnein missed: no damage.");
  await dm.getByRole("button", { name: "End the encounter" }).click();
});

// Milestone 5, S10: items and weapons go through the same request, hold, poll and resolution.
// Carol drinks a potion and fires a two-round burst from the Aetherlock (rounds and charges are
// held, then used up); a Skeleton shoots back with its shortbow, nocking an arrow as it fires.
test("a potion, the Aetherlock and a Skeleton's shortbow resolve like any action", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const dm = await signedIn(browser, VR_LULU, `${TABLE}/Dungeon_Master`);
  dm.on("dialog", (d) => void d.accept());
  const start = dm.getByRole("form", { name: "Start an encounter" });
  const characters = start.getByRole("group", { name: "Characters" });
  await expect(
    characters.getByRole("checkbox", { name: "Carol Elfnein", exact: true }),
  ).toBeVisible();
  const ticked = characters.getByRole("checkbox", { checked: true });
  while ((await ticked.count()) > 0) await ticked.first().uncheck();
  await characters
    .getByRole("checkbox", { name: "Carol Elfnein", exact: true })
    .check();
  await start.getByLabel("How many Skeleton").fill("1");
  await start.getByRole("button", { name: "Start the encounter" }).click();
  await expect(dm.getByRole("region", { name: "Turn order" })).toContainText(
    "AC 14",
  );
  const requests = dm.getByRole("region", { name: "Requests" });
  const log = dm.getByRole("region", { name: "Campaign log" });

  // A potion: held while queued, then drunk.
  const sheet = await dm.context().newPage();
  await sheet.goto(
    "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein",
  );
  await sheet.getByRole("tab", { name: "Inventory" }).click();
  const potions = sheet
    .getByLabel("Carried items")
    .getByRole("button", { name: "Potion of Healing" });
  const before = Number(
    (await potions.textContent())?.match(/×(\d+)/)?.[1] ?? 1,
  );
  await potions.click();
  await sheet.getByRole("button", { name: "Use…" }).click();
  const use = sheet.getByRole("form", { name: "Use Potion of Healing" });
  await use.getByRole("radio", { name: "Instant" }).check();
  await expect(use).toContainText("uses Bonus Action");
  await use.getByRole("button", { name: "Confirm" }).click();
  await expect(potions).toContainText("1 in a request");
  await requests
    .getByRole("listitem")
    .filter({ hasText: "Use Potion of Healing" })
    .getByRole("button", { name: "resolve…" })
    .click();
  await requests
    .getByRole("button", { name: "Ask for the healing roll" })
    .click();
  const healing = dm.getByRole("form", {
    name: "Roll: Carol Elfnein, Potion of Healing healing",
  });
  await healing.getByLabel("How to roll").selectOption("manual");
  await healing.getByLabel("Total").fill("7");
  await healing.getByRole("button", { name: "Roll" }).click();
  await expect(requests.getByLabel("Total")).toHaveValue("7");
  await everyonePasses(requests, dm);
  await requests.getByRole("button", { name: "Approve and resolve" }).click();
  await expect(log).toContainText(/Carol Elfnein: healed 7, HP \d+\./);
  // A single item shows no count.
  if (before > 2) await expect(potions).toContainText(`×${before - 1}`);
  else await expect(potions).not.toContainText("×");

  // The Aetherlock: a two-round burst at the Skeleton.
  await sheet.getByRole("button", { name: "Close" }).click();
  await sheet
    .getByLabel("Carried items")
    .getByRole("button", { name: "Aetherlock" })
    .click();
  await expect(sheet.getByText(/Canister: 12\/12 charges/)).toBeVisible();
  // Earlier tests may leave Exhaustion, so read the aim the rifle shows now.
  const aim = (await sheet.getByText(/^Aim: \+\d+/).textContent())?.match(
    /\+(\d+)/,
  )?.[1];
  await sheet.getByRole("button", { name: "Attack…" }).click();
  const attack = sheet.getByRole("form", { name: "Attack with Aetherlock" });
  await attack.getByLabel("Attack action").selectOption({ label: "2 rounds" });
  await attack.getByLabel("Target").selectOption({ label: "Skeleton" });
  await expect(attack.getByLabel("Attack bonus")).toHaveValue(aim ?? "");
  await expect(attack.getByRole("list", { name: "Rounds" })).toContainText(
    "2d10+6 Piercing",
  );
  await expect(attack).toContainText("2 charges from Charge canister");
  await attack.getByRole("radio", { name: "Instant" }).check();
  await attack.getByRole("button", { name: "Confirm" }).click();
  await expect(sheet.getByText(/Canister: 10\/12 charges/)).toBeVisible();
  const burst = requests
    .getByRole("listitem")
    .filter({ hasText: "Attack: Aetherlock: 2 rounds" });
  await burst.getByRole("button", { name: "resolve…" }).click();
  await requests
    .getByRole("button", { name: "Ask for the attack rolls" })
    .click();
  for (const [shot, total] of [
    [1, "20"],
    [2, "5"],
  ] as const) {
    const roll = dm.getByRole("form", {
      name: `Roll: Carol Elfnein, Aetherlock: 2 rounds, shot ${shot} against Skeleton`,
    });
    await roll.getByLabel("How to roll").selectOption("manual");
    await roll.getByLabel("Total").fill(total);
    await roll.getByRole("button", { name: "Roll" }).click();
  }
  await expect(requests.getByLabel("Shot 1: result")).toHaveValue("hit");
  await expect(requests.getByLabel("Shot 2: result")).toHaveValue("miss");
  await requests
    .getByRole("button", { name: "Ask for the damage rolls" })
    .click();
  const damage = dm.getByRole("form", {
    name: "Roll: Carol Elfnein, Aetherlock: 2 rounds, shot 1: Piercing damage",
  });
  await damage.getByLabel("How to roll").selectOption("manual");
  await damage.getByLabel("Total").fill("12");
  await damage.getByRole("button", { name: "Roll" }).click();
  await expect(requests.getByLabel("Shot 1: Piercing total")).toHaveValue("12");
  await everyonePasses(requests, dm);
  await requests.getByRole("button", { name: "Approve and resolve" }).click();
  await expect(log).toContainText(
    "Carol Elfnein fired Basic Round, Basic Round, spending 2 charges.",
  );
  await expect(log).toContainText(
    "Shot 1 at Skeleton hit: 12 Piercing damage, HP 1.",
  );
  await expect(log).toContainText("Shot 2 at Skeleton missed: no damage.");
  await expect(sheet.getByText(/Canister: 10\/12 charges/)).toBeVisible();

  // The Skeleton's shortbow from its stat block: an arrow is nocked and fired.
  const statBlock = requests.getByRole("form", { name: "Stat block attack" });
  await statBlock.getByLabel("NPC attack").selectOption({ index: 1 });
  await statBlock
    .getByLabel("NPC target")
    .selectOption({ label: "Carol Elfnein" });
  await statBlock.getByRole("button", { name: "Queue Shortbow" }).click();
  const shot = requests
    .getByRole("listitem")
    .filter({ hasText: "Attack: Skeleton: Shortbow" });
  await expect(shot).toContainText("holds Arrow");
  await shot.getByRole("button", { name: "resolve…" }).click();
  await requests
    .getByRole("button", { name: "Ask for the attack rolls" })
    .click();
  const bow = dm.getByRole("form", {
    name: "Roll: Skeleton, Skeleton: Shortbow against Carol Elfnein",
  });
  await bow.getByLabel("How to roll").selectOption("manual");
  await bow.getByLabel("Total").fill("25");
  await bow.getByRole("button", { name: "Roll" }).click();
  await requests
    .getByRole("button", { name: "Ask for the damage rolls" })
    .click();
  const arrow = dm.getByRole("form", {
    name: "Roll: Skeleton, Skeleton: Shortbow: Piercing damage",
  });
  await arrow.getByLabel("How to roll").selectOption("manual");
  await arrow.getByLabel("Total").fill("6");
  await arrow.getByRole("button", { name: "Roll" }).click();
  await everyonePasses(requests, dm);
  await requests.getByRole("button", { name: "Approve and resolve" }).click();
  await expect(log).toContainText("Skeleton fired Arrow.");
  await expect(log).toContainText(/Carol Elfnein hit: 6 Piercing damage/);

  // Casting from a loose scroll uses the numbers stored on it, and spends it.
  await sheet.getByRole("button", { name: "Close" }).click();
  await sheet
    .getByLabel("Carried items")
    .getByRole("button", { name: "Scroll: Fireball" })
    .click();
  await sheet.getByRole("button", { name: "Cast from this scroll…" }).click();
  const cast = sheet.getByRole("form", { name: "Cast Fireball" });
  await expect(cast).toContainText("uses the numbers stored on the scroll");
  await cast.getByRole("checkbox", { name: "Skeleton" }).check();
  await cast.getByRole("radio", { name: "Instant" }).check();
  await cast.getByRole("button", { name: "Confirm" }).click();
  await requests
    .getByRole("listitem")
    .filter({ hasText: "Cast Fireball at level 3 from a scroll" })
    .getByRole("button", { name: "resolve…" })
    .click();
  await expect(requests).toContainText("Save DC 19 (stored on the scroll)");
  await requests.getByLabel("Skeleton: result").selectOption("failed");
  await requests.getByLabel("Total").fill("20");
  await everyonePasses(requests, dm);
  await requests.getByRole("button", { name: "Approve and resolve" }).click();
  await expect(log).toContainText("Skeleton failed the save: 20 Fire damage");
  await expect(
    sheet.getByRole("button", { name: "Cast from this scroll…" }),
  ).toHaveCount(0);
  await dm.getByRole("button", { name: "End the encounter" }).click();
});
