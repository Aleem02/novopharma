# Native Dependencies & Build Process

## Overview

NovoPharma uses Electron 31, which bundles Node.js v20.16.0 (ABI 125).
Some dependencies, like `better-sqlite3`, include native C++ bindings that must be compiled specifically for the target Node.js runtime ABI.

## The ABI Mismatch Problem

If you run `npm rebuild better-sqlite3` directly from your terminal, it will use your **system Node.js** to compile the bindings.
If your system Node.js is newer (e.g., v22.23.1, ABI 127), the resulting native module will be incompatible with Electron's internal Node.js.

This causes the following startup error during development:
`The module ... was compiled against a different Node.js version using NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 125.`

## How Native Modules Are Rebuilt

To prevent this, the project relies on `@electron/rebuild` (bundled inside `electron-builder`) to compile native dependencies for the correct Electron ABI.

- **`postinstall` Hook**: The `package.json` includes `"postinstall": "electron-builder install-app-deps"`. After running `npm install`, this hook automatically triggers `electron-builder` to download and compile native modules for the Electron version specified in `devDependencies`.
- **Manual Rebuild**: If you ever need to manually rebuild for Electron, run:
  `npm run rebuild:electron`

## Development vs. Testing

- **`npm run dev`**: Launches Electron. It requires the `better-sqlite3` native module to be compiled for **Electron (ABI 125)**. The `postinstall` script guarantees this setup.
- **`npm run test`**: Runs Vitest, which executes in your **system Node.js** (e.g., ABI 127). The `test` script in `package.json` is configured to run `npm run rebuild:node` before tests, recompiling the native module for your system Node.js so tests can pass, and subsequently relies on the fact that any future `npm run dev` may need `npm run rebuild:electron` if Vitest alters it, or you simply run `npm install` again.

## Production Packaging

- **`npm run build:win`**: The production packaging process automatically calls `electron-builder install-app-deps` as part of its pipeline. It ensures that the packaged Windows NSIS installer contains the correct native `.node` binary for the target Electron runtime.
