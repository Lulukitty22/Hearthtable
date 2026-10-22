// `pnpm emulators`: starts the Firebase emulators, loading saved data from .emulator-data when
// it exists and saving it there on a clean stop (Ctrl+C). Data survives between runs (user
// decision, 2026-10-22). Delete the folder to start fresh.

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const DIR = ".emulator-data";
const args = ["emulators:start", `--export-on-exit=${DIR}`];
if (existsSync(`${DIR}/firebase-export-metadata.json`))
  args.push(`--import=${DIR}`);
else
  console.log(
    `No saved emulator data yet; starting empty. Run "pnpm seed" to add Carol.`,
  );

const child = spawn("firebase", args, { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
