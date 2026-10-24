// Milestone 4, S9: when someone else saves a sheet that is being edited, a difference window
// shows only what differs and lets the editor choose theirs or mine per item; viewers just see
// saved changes arrive.

import { expect, test, type Browser, type Page } from "@playwright/test";
import { signInAs, VR_LULU } from "./signIn";

const CAROL = "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein";

async function editor(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await signInAs(page, VR_LULU);
  await page.goto(`${CAROL}/Edit`);
  await expect(page.getByText("DM mode", { exact: true })).toBeVisible();
  return page;
}

const hp = (page: Page) =>
  page.getByRole("spinbutton", { name: "Current hit points" });
const temp = (page: Page) =>
  page.getByRole("spinbutton", { name: "Temporary hit points" });
const window = (page: Page) =>
  page.getByRole("dialog", { name: "Someone else saved this sheet" });

async function saveWith(page: Page, note: string) {
  await page.getByRole("textbox", { name: "Save note" }).fill(note);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toBeHidden();
}

test("a save elsewhere shows only what differs; the editor keeps their own edit", async ({
  browser,
}) => {
  const a = await editor(browser);
  const b = await editor(browser);
  const viewer = await (await browser.newContext()).newPage();
  await viewer.goto(CAROL);
  await expect(viewer.getByTestId("armor-class")).toBeVisible();

  // A edits HP but has not saved. B saves temporary HP.
  await hp(a).fill("50");
  await temp(b).fill("7");
  await saveWith(b, "Got some temporary HP");

  // A is asked about the one item B changed, not about A's own HP edit.
  const dialog = window(a);
  await expect(dialog).toContainText("Got some temporary HP");
  const rows = dialog.locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Sheet › hitPoints › temporary");
  const apply = dialog.getByRole("button", { name: "Apply" });
  await expect(apply).toBeDisabled();
  await dialog.getByRole("button", { name: "Use all theirs" }).click();
  await apply.click();
  await expect(dialog).toBeHidden();
  await expect(temp(a)).toHaveValue("7");
  await expect(hp(a)).toHaveValue("50");

  // A's save goes through without a conflict, and keeps both changes.
  await saveWith(a, "Took damage");

  // The viewer saw the saves arrive without reloading.
  await expect(viewer.getByLabel("Current hit points")).toHaveText("50");
  await expect(viewer.getByText("Temp 7")).toBeVisible();

  // Both changed the same value: A keeps theirs, B's arrives, A chooses mine.
  await expect(window(b)).toBeVisible();
  await window(b).getByRole("button", { name: "Use all theirs" }).click();
  await window(b).getByRole("button", { name: "Apply" }).click();
  await hp(a).fill("40");
  await hp(b).fill("60");
  await saveWith(b, "Healed");
  const again = window(a);
  await expect(again.locator("tbody tr")).toHaveCount(1);
  await expect(again).toContainText("Sheet › hitPoints › current");
  await again.getByRole("radio", { name: /Keep mine/ }).check();
  await again.getByRole("button", { name: "Apply" }).click();
  await expect(hp(a)).toHaveValue("40");
  await saveWith(a, "Actually still hurt");
  await expect(viewer.getByLabel("Current hit points")).toHaveText("40");

  // Put Carol back as she was for the other tests.
  await expect(window(b)).toBeVisible();
  await window(b).getByRole("button", { name: "Use all theirs" }).click();
  await window(b).getByRole("button", { name: "Apply" }).click();
  await hp(b).fill("95");
  await temp(b).fill("0");
  await saveWith(b, "Reset after the test");
  for (const page of [a, b, viewer]) await page.context().close();
});
