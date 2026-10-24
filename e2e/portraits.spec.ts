// Milestone 4, S11: a portrait is uploaded (PNG, JPEG, WebP or GIF up to 2 MB, kept as is) or
// given as a link, saved with the sheet, and shown to everyone.

import { expect, test, type Page } from "@playwright/test";
import { signInAs, VR_LULU } from "./signIn";

const CAROL = "/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein";
// A 1×1 PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const portrait = (page: Page) =>
  page.getByRole("img", { name: "Portrait of Carol Elfnein" });

async function save(page: Page) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Unsaved changes" }),
  ).toBeHidden();
}

test("a portrait is uploaded, linked and removed, and everyone sees it", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await signInAs(page, VR_LULU);
  await page.goto(`${CAROL}/Edit`);
  const upload = page.getByLabel("Upload a portrait");

  // Too large: refused before uploading.
  await upload.setInputFiles({
    name: "huge.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("status")).toContainText("over 2 MB");

  await upload.setInputFiles({
    name: "carol.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(portrait(page)).toHaveAttribute("src", /127\.0\.0\.1:9299/);
  await save(page);

  // A guest sees the uploaded portrait, and it loads.
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(CAROL);
  await expect(portrait(guest)).toBeVisible();
  await expect
    .poll(() =>
      portrait(guest).evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  const uploaded = await portrait(guest).getAttribute("src");

  // A link instead.
  await page
    .getByRole("textbox", { name: "Image link" })
    .fill(`${uploaded}&as=link`);
  await page.getByRole("button", { name: "Use link" }).click();
  await save(page);
  await guest.reload();
  await expect(portrait(guest)).toHaveAttribute("src", /&as=link$/);

  // And removed again.
  await page.getByRole("button", { name: "Remove portrait" }).click();
  await save(page);
  await guest.reload();
  await expect(guest.getByTestId("armor-class")).toBeVisible();
  await expect(portrait(guest)).toHaveCount(0);
  await guest.context().close();
});
