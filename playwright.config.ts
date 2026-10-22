import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Tests share one emulator, so they run one at a time.
  workers: 1,
  use: { baseURL: "http://localhost:5173" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm --filter @hearthtable/web dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env["CI"],
  },
});
