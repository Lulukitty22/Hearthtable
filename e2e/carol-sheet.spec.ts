// Milestone 2 acceptance: open Carol's sheet, edit HP and an inventory quantity, save, reload,
// and see both values persist in the emulator.

import { expect, test } from "@playwright/test";

test("edits to HP and an inventory quantity persist after reload", async ({
  page,
}) => {
  await page.goto("/VRLulu/Characters/Carol_Elfnein");
  await expect(
    page.getByRole("heading", { name: "Carol Elfnein" }),
  ).toBeVisible();
  await expect(page.getByTestId("armor-class")).toHaveText("13");

  await page.getByLabel("Current hit points").fill("61");
  await page.getByRole("tab", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Potion of Healing" }).click();
  await page.getByLabel("Quantity of Potion of Healing").fill("3");
  await page.getByRole("button", { name: "Close" }).click();
  await page
    .getByLabel("Save note")
    .fill("Took 34 fire damage; drank a potion");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toBeHidden();

  await page.reload();
  await expect(page.getByLabel("Current hit points")).toHaveValue("61");
  await page.getByRole("tab", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Potion of Healing" }).click();
  await expect(page.getByLabel("Quantity of Potion of Healing")).toHaveValue(
    "3",
  );
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByText(/History \(1 saves?\)/).click();
  await expect(
    page.getByText("Took 34 fire damage; drank a potion"),
  ).toBeVisible();
});

test("Mage Armor and Shield change AC from active state, and the Wand only spell attacks", async ({
  page,
}) => {
  await page.goto("/VRLulu/Characters/Carol_Elfnein");
  await expect(page.getByTestId("armor-class")).toHaveText("13");
  await page.getByRole("button", { name: "Mage Armor" }).click();
  await expect(page.getByTestId("armor-class")).toHaveText("16");
  await page.getByRole("button", { name: "Shield", exact: true }).click();
  await expect(page.getByTestId("armor-class")).toHaveText("21");

  await page.getByRole("tab", { name: "Inventory" }).click();
  await expect(page.getByTestId("spell-attack-wizard")).toHaveText("+11");
  await page.getByRole("button", { name: "Wand of the War Mage +1" }).click();
  await page.getByRole("button", { name: "Stowed" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("spell-attack-wizard")).toHaveText("+12");
  await page.getByRole("button", { name: "Aetherlock" }).click();
  await expect(page.getByText(/Aim: \+11/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByTestId("armor-class")).toHaveText("13");
});

test("ending and restoring an attunement changes the item's bonus", async ({
  page,
}) => {
  await page.goto("/VRLulu/Characters/Carol_Elfnein");
  const int = page.getByTestId("ability-int");
  await expect(int).toHaveText("22");
  await page.getByRole("tab", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Indomitable (INT)" }).click();
  await expect(
    page.getByText("Attuned to Carol Elfnein, slot 4"),
  ).toBeVisible();
  await page.getByRole("button", { name: "End attunement" }).click();
  await expect(page.getByText("Not attuned")).toBeVisible();
  await page.getByRole("button", { name: "Attune", exact: true }).click();
  await expect(
    page.getByText("Attuned to Carol Elfnein, slot 4"),
  ).toBeVisible();
  await page.getByRole("button", { name: "End attunement" }).click();
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("tab", { name: "Stats" }).click();
  await expect(int).toHaveText("20");
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(int).toHaveText("22");
});

test("rounds drag into chambers and items into bags, and stay there after saving", async ({
  page,
}) => {
  await page.goto("/VRLulu/Characters/Carol_Elfnein");
  await page.getByRole("tab", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Aetherlock" }).click();
  const topLeft = page.getByLabel("Top left: empty");
  await expect(topLeft).toBeVisible();
  await page
    .getByRole("button", { name: "Basic Round" })
    .first()
    .dragTo(topLeft);
  await expect(page.getByLabel("Top left: Basic Round")).toBeVisible();
  await expect(
    page
      .getByLabel("Carried items")
      .getByRole("button", { name: "Basic Round" }),
  ).toContainText("×17");

  await page.getByRole("button", { name: "Close" }).click();
  // Earlier tests share this emulator, so read how many potions there are now.
  const potions = page
    .getByLabel("Carried items")
    .getByRole("button", { name: "Potion of Healing" });
  const before = Number(
    (await potions.textContent())?.match(/×(\d+)/)?.[1] ?? 1,
  );
  await page
    .getByLabel("Carried items")
    .getByRole("button", { name: "Bag of Holding" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Potion of Healing" })
    .dragTo(page.getByLabel("Contents of Bag of Holding"));
  await expect(
    page
      .getByLabel("Contents of Bag of Holding")
      .getByRole("button", { name: "Potion of Healing" }),
  ).toBeVisible();

  await page.getByLabel("Save note").fill("Loaded a round; packed a potion");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toBeHidden();
  await page.reload();
  await page.getByRole("tab", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Aetherlock" }).click();
  await expect(page.getByLabel("Top left: Basic Round")).toBeVisible();
  await expect(
    page
      .getByLabel("Carried items")
      .getByRole("button", { name: "Potion of Healing" }),
  ).toContainText(`×${before - 1}`);
});

test("a potion cannot be dropped into a chamber", async ({ page }) => {
  await page.goto("/VRLulu/Characters/Carol_Elfnein");
  await page.getByRole("tab", { name: "Inventory" }).click();
  await page.getByRole("button", { name: "Aetherlock" }).click();
  await page
    .getByLabel("Carried items")
    .getByRole("button", { name: "Potion of Healing" })
    .dragTo(page.getByLabel("Bottom right: empty"));
  await expect(page.getByLabel("Bottom right: empty")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toBeHidden();
});

test("the header and every tab show the same numbers from one resolved state", async ({
  page,
}) => {
  await page.goto("/VRLulu/Characters/Carol_Elfnein");
  const header = async () => ({
    ac: await page.getByTestId("armor-class").textContent(),
    attack: await page.getByTestId("spell-attack-wizard").textContent(),
  });
  await page.getByRole("button", { name: "Mage Armor" }).click();
  const first = await header();
  expect(first.ac).toBe("16");
  for (const tab of ["Inventory", "Spells & Books", "Features", "Stats"]) {
    await page.getByRole("tab", { name: tab }).click();
    expect(await header()).toEqual(first);
  }
  await page.getByRole("tab", { name: "Spells & Books" }).click();
  await expect(
    page.locator(".vital-label", { hasText: /^Level 1$/ }).first(),
  ).toBeVisible();
  const slots = await page
    .locator(".vital", { hasText: /^Level \d/ })
    .allTextContents();
  expect(
    slots.map((t) => t.replace(/\s+/g, " ").match(/(\d+) \/ (\d+)/)?.[2]),
  ).toEqual(["7", "3", "3", "3", "2", "1"]);
  await page.getByRole("button", { name: "Discard" }).click();
});

// Milestone 3, S3: a spell panel shows the summary, the facts and the credited SRD text.
test("spell panels show summary, facts and the expandable SRD text", async ({
  page,
}) => {
  await page.goto("/VRLulu/Characters/Carol_Elfnein");
  await page.getByRole("tab", { name: "Spells & Books" }).click();
  await page.getByRole("button", { name: "Fireball", exact: true }).click();
  const facts = page.locator(".spell-facts");
  await expect(facts).toContainText("150 feet");
  await expect(facts).toContainText("DEX save, half on success");
  await expect(facts).toContainText("8d6 Fire");
  await expect(facts).toContainText("+1d6 damage per slot level above 3");
  await expect(page.locator(".spell-summary")).toContainText("20-foot-radius");
  await page.getByText("Full text (SRD 5.2.1)").click();
  await expect(page.getByText(/^A bright streak flashes/)).toBeVisible();
  await expect(page.locator(".srd-text .credit")).toContainText(
    "Creative Commons Attribution 4.0",
  );
  await page.getByRole("button", { name: "Close" }).click();

  await page
    .getByRole("button", { name: "Teleportation Circle", exact: true })
    .click();
  await expect(page.locator(".spell-facts")).toContainText("50+ gp, consumed");
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Mind Sliver", exact: true }).click();
  await expect(page.getByText(/Not in the SRD 5\.2\.1/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
});

// Milestone 3, S4: a scroll mounts into a book (taking an entry), shows its cost, can be marked
// spent, and comes back out as the same scroll. Nothing is saved, so other tests are unaffected.
test("a scroll mounts into a spellbook and comes back out", async ({
  page,
}) => {
  await page.goto("/VRLulu/Characters/Carol_Elfnein");
  await page.getByRole("tab", { name: "Inventory" }).click();
  const carried = page.getByLabel("Carried items");
  await carried.getByRole("button", { name: "Scroll: Fireball" }).click();
  await expect(page.locator(".scroll-facts").first()).toContainText(
    "Mounting it: 13.379 gp and 32.11 minutes",
  );
  await page.getByRole("button", { name: "Close" }).click();

  await carried
    .getByRole("button", { name: "Scroll: Fireball" })
    .dragTo(carried.getByRole("button", { name: "Overflow (test spells)" }));
  await expect(
    carried.getByRole("button", { name: "Scroll: Fireball" }),
  ).toHaveCount(0);

  await page.getByRole("tab", { name: "Spells & Books" }).click();
  const overflow = page.getByLabel("Book Overflow (test spells)");
  await expect(overflow).toContainText("9 / 16 entries");
  await overflow.getByRole("button", { name: /Fireball/ }).click();
  await expect(
    page.getByRole("heading", { name: "Mounted scroll" }),
  ).toBeVisible();
  await expect(page.locator(".scroll-facts")).toContainText("Removing it:");
  await page.getByRole("button", { name: "Mark spent" }).click();
  await expect(page.getByText(/the scroll is spent/).first()).toBeVisible();
  await page
    .getByRole("button", {
      name: "Take the scroll out of Overflow (test spells)",
    })
    .click();
  await expect(overflow).toContainText("8 / 16 entries");

  await page.getByRole("tab", { name: "Inventory" }).click();
  await expect(
    carried.getByRole("button", { name: "Scroll: Fireball" }),
  ).toContainText("spent");
  await page.getByRole("button", { name: "Discard" }).click();
});
