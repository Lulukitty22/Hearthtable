// The end-to-end run starts a fresh, empty emulator; seed Carol into it first.

import { execSync } from "node:child_process";

export default function globalSetup() {
  execSync("pnpm seed", { stdio: "inherit" });
}
