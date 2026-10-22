import { expect, test } from "@playwright/test";

test("web app loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hearthtable" }),
  ).toBeVisible();
});
