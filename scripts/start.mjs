// `pnpm start`, also what "Hearthtable Launcher.exe" runs: one window for local development.
// Starts the emulators, waits until Firestore answers, runs `pnpm seed --refresh`, then starts
// the web app and opens it in the browser. Ctrl+C stops everything: the console passes it to
// every process, so the emulators save their data on the way out, and this script waits for
// them before closing. Closing the window with its X button does not leave time to save.

import { spawn } from "node:child_process";
import { connect } from "node:net";

const FIRESTORE = { host: "127.0.0.1", port: 8080 };
const WEB = "http://localhost:5173/";
const children = new Set();

/** Runs a command, prefixing each output line with its name. */
function run(name, command, { onLine } = {}) {
  const child = spawn(command, {
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
  });
  children.add(child);
  for (const stream of [child.stdout, child.stderr]) {
    let rest = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split(/\r?\n/);
      rest = lines.pop() ?? "";
      for (const line of lines) {
        console.log(`[${name}] ${line}`);
        onLine?.(line);
      }
    });
  }
  const done = new Promise((resolve) =>
    child.on("exit", (code) => {
      children.delete(child);
      resolve(code ?? 0);
    }),
  );
  return { child, done };
}

const portOpen = ({ host, port }) =>
  new Promise((resolve) => {
    const socket = connect(port, host);
    socket.once("connect", () => (socket.end(), resolve(true)));
    socket.once("error", () => resolve(false));
  });

async function waitForPort(target, seconds) {
  for (let i = 0; i < seconds && !emulatorsExited; i++) {
    if (await portOpen(target)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

let stopping = false;
process.on("SIGINT", () => {
  // The children received Ctrl+C too; wait for them (the emulators are saving).
  if (!stopping)
    console.log("\nStopping... waiting for the emulators to save their data.");
  stopping = true;
});

if (await portOpen(FIRESTORE)) {
  console.log(
    "Something is already using port 8080 (are the emulators already running in another window?).\nStop it first, then start again.",
  );
  process.exit(1);
}

const emulators = run("emulators", "pnpm emulators");
let emulatorsExited = false;
emulators.done.then((code) => {
  emulatorsExited = true;
  if (!stopping)
    console.log(`The emulators stopped unexpectedly (exit code ${code}).`);
});

console.log("Waiting for the emulators to start...");
if (!(await waitForPort(FIRESTORE, 180))) {
  console.log(
    emulatorsExited
      ? "The emulators could not start; see the messages above."
      : "The emulators did not start within three minutes; see the messages above.",
  );
  process.exit(1);
}

if (!stopping) {
  const seed = await run("seed", "pnpm seed --refresh").done;
  if (seed !== 0)
    console.log(
      "Seeding failed; the app still starts. See the messages above.",
    );
}

if (!stopping) {
  let opened = false;
  run("web", "pnpm dev", {
    onLine: (line) => {
      if (!opened && line.includes("Local:")) {
        opened = true;
        if (!process.env["HEARTHTABLE_NO_BROWSER"])
          spawn("cmd", ["/c", "start", "", WEB], {
            stdio: "ignore",
            detached: true,
          });
        console.log(
          `\nHearthtable is running at ${WEB}\nPress Ctrl+C in this window to stop everything.\n`,
        );
      }
    },
  });
}

// Exit once every process has stopped. The wrappers (pnpm, cmd) can exit on Ctrl+C before the
// Firebase process underneath has finished exporting, so also wait until every emulator port
// is free again: only then has the save finished.
const EMULATOR_PORTS = [4000, 4400, 5000, 8080, 9099, 9199];
const portsBusy = async () =>
  (
    await Promise.all(
      EMULATOR_PORTS.map((port) => portOpen({ host: "127.0.0.1", port })),
    )
  ).some(Boolean);

const timer = setInterval(async () => {
  if (children.size > 0) return;
  clearInterval(timer);
  for (let i = 0; i < 120 && (await portsBusy()); i++) {
    if (i === 0) console.log("Waiting for the emulators to finish saving...");
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(
    (await portsBusy())
      ? "The emulators are still running after two minutes; check for a leftover java process."
      : "Everything has stopped.",
  );
  process.exit(0);
}, 500);
