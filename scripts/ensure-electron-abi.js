const { execSync } = require("child_process");

function checkAndRebuild() {
  try {
    // We run Electron strictly as a Node process to check if the CURRENT better-sqlite3 binary
    // is fully compatible with Electron's ABI (125 for Electron 31).
    // If it throws, it means it's missing or compiled for standard Node (127) instead.
    execSync("npx electron -e \"require('better-sqlite3')(':memory:')\"", {
      stdio: "ignore",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    });

    console.log(
      "[ABI Check] better-sqlite3 is already compiled for Electron. Skipping rebuild.",
    );
    process.exit(0);
  } catch (e) {
    console.log(
      "[ABI Check] better-sqlite3 is NOT compiled for Electron. Rebuilding...",
    );
    rebuild();
  }
}

function rebuild() {
  try {
    console.log("Running @electron/rebuild...");
    execSync("npx @electron/rebuild -f -w better-sqlite3", {
      stdio: "inherit",
    });
    console.log("[ABI Check] Rebuild complete.");
    process.exit(0);
  } catch (err) {
    console.error(
      "\n---------------------------------------------------------",
    );
    console.error("[ABI Check] ERROR: Rebuild failed (usually EPERM).");
    console.error(
      "An existing Electron process is likely locking the file better_sqlite3.node.",
    );
    console.error(
      "Please close NovoPharma or kill lingering electron.exe processes in Task Manager.",
    );
    console.error(
      "---------------------------------------------------------\n",
    );
    process.exit(1);
  }
}

checkAndRebuild();
