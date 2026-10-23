import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "packages/**/src/**/*.test.ts",
            "content/src/**/*.test.ts",
            "apps/*/src/**/*.test.{ts,tsx}",
          ],
          exclude: ["**/*.emulator.test.ts", "**/node_modules/**"],
        },
      },
      {
        test: {
          name: "emulator",
          include: [
            "packages/**/src/**/*.emulator.test.ts",
            "tests/**/*.emulator.test.ts",
          ],
          // Every file clears the same emulator, so they run one at a time.
          fileParallelism: false,
        },
      },
    ],
  },
});
