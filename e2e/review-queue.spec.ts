// Milestone 4, S7: the DM review queue. A player's edits to their campaign character, a delegate's
// edits, deleting a character and library entries (new or imported) wait for a DM, who accepts or
// rejects them.

import { expect, test, type Browser, type Page } from "@playwright/test";
import { signInAs, TEST_PLAYER, VR_LULU } from "./signIn";

const TEST_JOINER = "test_joiner@example.com";
const RIVERBED = "/Campaigns/Riverbed_of_Strings";
const unique = () => Date.now().toString(36).slice(-5);

async function signedIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await signInAs(page, email);
  return page;
}

const queue = (page: Page) =>
  page.getByRole("region", { name: "Review queue" });

/** Test_Player makes a blank character and VR_Lulu (a DM) adds it to Riverbed of Strings. */
async function playerCharacter(player: Page, dm: Page, name: string) {
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
  await dm.goto(RIVERBED);
  await dm.getByRole("button", { name: `Add ${name}` }).click();
  await expect(
    dm
      .getByRole("list", { name: "Campaign characters" })
      .getByRole("link", { name }),
  ).toBeVisible();
  return `${RIVERBED}/Characters/Test_Player/${name.replace(" ", "_")}`;
}

async function proposeHp(
  page: Page,
  address: string,
  hp: string,
  note: string,
) {
  await page.goto(address);
  await page.getByRole("link", { name: "Propose changes" }).click();
  await expect(page.getByText("Proposing changes")).toBeVisible();
  await page.getByRole("spinbutton", { name: "Current hit points" }).fill(hp);
  await page.getByRole("textbox", { name: "Save note" }).fill(note);
  await page.getByRole("button", { name: "Send to the DM" }).click();
  await expect(page.getByRole("status")).toContainText("Sent to the DM");
}

test("a player's edits, a delegate's edits and a deletion wait for a DM", async ({
  browser,
}) => {
  const name = `Wren ${unique()}`;
  const player = await signedIn(browser, TEST_PLAYER);
  const dm = await signedIn(browser, VR_LULU);
  const address = await playerCharacter(player, dm, name);

  // The owner proposes; nothing changes until a DM accepts.
  await proposeHp(player, address, "5", "Rested");
  await dm.goto(RIVERBED);
  const edit = queue(dm).getByRole("listitem", { name: `Changes to ${name}` });
  await expect(edit).toContainText("hitPoints.current: 0 → 5");
  await expect(edit).toContainText("Rested");
  await edit.getByRole("button", { name: "Accept" }).click();
  await expect(edit).toHaveCount(0);
  await player.goto(address);
  await expect(player.locator(".hp-edit")).toContainText("5");
  await expect(
    player.getByText("proposed by Test_Player: Rested"),
  ).toBeAttached();

  // A rejected proposal changes nothing.
  await proposeHp(player, address, "9", "Too generous");
  await dm.goto(RIVERBED);
  await queue(dm)
    .getByRole("listitem", { name: `Changes to ${name}` })
    .getByRole("button", { name: "Reject" })
    .click();
  await player.goto(address);
  await expect(player.locator(".hp-edit")).toContainText("5");

  // A delegate proposes too, until control is taken away. Test_Joiner joins first if needed.
  await dm.goto(RIVERBED);
  const members = dm.getByRole("list", { name: "Members" });
  await expect(members).toContainText("Test_Player");
  if (
    (await members.getByRole("listitem", { name: "Test_Joiner" }).count()) === 0
  ) {
    await dm.getByRole("button", { name: "Approve Test_Joiner" }).click();
    await expect(
      members.getByRole("listitem", { name: "Test_Joiner" }),
    ).toBeVisible();
  }
  await player.goto(address);
  const control = player.getByRole("group", {
    name: "Who else may control this character",
  });
  await control.getByRole("checkbox", { name: "Test_Joiner" }).click();
  await expect(
    control.getByRole("checkbox", { name: "Test_Joiner" }),
  ).toBeChecked();
  const joiner = await signedIn(browser, TEST_JOINER);
  await proposeHp(joiner, address, "6", "Delegate edit");
  await control.getByRole("checkbox", { name: "Test_Joiner" }).click();
  await expect(
    control.getByRole("checkbox", { name: "Test_Joiner" }),
  ).not.toBeChecked();
  await joiner.goto(address);
  await expect(
    joiner.getByRole("link", { name: "Propose changes" }),
  ).toHaveCount(0);
  // The delegate's proposal sent while they had control is still there for the DM.
  await dm.goto(RIVERBED);
  await expect(
    queue(dm).getByRole("listitem", { name: `Changes to ${name}` }),
  ).toContainText("Delegate edit");

  // The owner asks to delete the character; it goes once a DM accepts.
  await player.goto(address);
  await player.getByRole("button", { name: "Ask to delete…" }).click();
  await player
    .getByRole("alertdialog", { name: "Ask to delete" })
    .getByRole("button", { name: "Ask to delete" })
    .click();
  await dm.goto(RIVERBED);
  await queue(dm)
    .getByRole("listitem", { name: `Delete ${name}` })
    .getByRole("button", { name: "Accept" })
    .click();
  await expect(
    dm
      .getByRole("list", { name: "Campaign characters" })
      .getByRole("link", { name }),
  ).toHaveCount(0);

  for (const page of [player, dm, joiner]) await page.context().close();
});

test("players propose new and imported library entries; a DM accepts them", async ({
  browser,
}) => {
  const charm = `Star Charm ${unique()}`;
  const map = `Tide Map ${unique()}`;
  const player = await signedIn(browser, TEST_PLAYER);

  // An item in the player's own account, to import.
  await player.getByRole("link", { name: "My home" }).click();
  await player.getByRole("button", { name: "New item" }).click();
  const item = player.getByRole("form", { name: "New item" });
  await item.getByRole("textbox", { name: "Name" }).fill(charm);
  await item.getByRole("textbox", { name: "Description" }).fill("Twinkles.");
  await item.getByRole("button", { name: "Create" }).click();
  await expect(item).toBeHidden();

  await player.goto(RIVERBED);
  const library = player.getByRole("region", { name: "Library" });
  await library.getByRole("button", { name: "Import from my account" }).click();
  const importing = library.getByRole("form", {
    name: "Import from my account",
  });
  await importing
    .getByRole("combobox", { name: "Entry from my account" })
    .selectOption({ label: `item: ${charm}` });
  await importing.getByRole("button", { name: "Propose" }).click();
  await library.getByRole("button", { name: "Propose a new entry" }).click();
  const fresh = library.getByRole("form", { name: "Propose a new entry" });
  await fresh.getByRole("textbox", { name: "Name" }).fill(map);
  await fresh
    .getByRole("textbox", { name: "Description" })
    .fill("Shows tides.");
  await fresh.getByRole("button", { name: "Propose" }).click();
  await expect(library.getByRole("status")).toContainText(`Proposed ${map}`);

  const dm = await signedIn(browser, VR_LULU);
  await dm.goto(RIVERBED);
  for (const entry of [charm, map]) {
    const row = queue(dm).getByRole("listitem", { name: `New entry ${entry}` });
    await row.getByRole("button", { name: "Accept" }).click();
    await expect(row).toHaveCount(0);
  }
  const contents = dm
    .getByRole("region", { name: "Library" })
    .getByRole("list", { name: "Contents of Riverbed of Strings library" });
  await expect(contents.getByRole("link", { name: charm })).toBeVisible();
  await contents.getByRole("link", { name: map }).click();
  await expect(dm.getByText("Shows tides.", { exact: true })).toBeVisible();

  for (const page of [player, dm]) await page.context().close();
});
