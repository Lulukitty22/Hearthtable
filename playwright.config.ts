import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Tests share one emulator, so they run one at a time.
  workers: 1,
  // Its own dev server and emulator ports (firebase.test.json), so a running local session is untouched.
  use: { baseURL: "http://localhost:5174" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1600, height: 1000 },
      },
    },
  ],
  webServer: {
    command: "pnpm --filter @hearthtable/web dev --port 5174 --strictPort",
    env: {
      VITE_FIRESTORE_EMULATOR_PORT: "8180",
      VITE_AUTH_EMULATOR_PORT: "9100",
    },
    url: "http://localhost:5174",
    reuseExistingServer: false,
  },
});
