# NovoPharma — Release Guide

This document describes the process of packaging, releasing, and updating the NovoPharma desktop application.

## Versioning Strategy

NovoPharma follows [Semantic Versioning (SemVer)](https://semver.org/):
- **Major (X.0.0):** Architectural changes or breaking backend changes.
- **Minor (1.Y.0):** New feature releases (e.g., Multi-branch support).
- **Patch (1.0.Z):** Bug fixes, optimizations, or security patches.

Ensure version numbers are consistent in:
1. `package.json` (`"version": "X.Y.Z"`)
2. Git tag (`vX.Y.Z`)
3. GitHub Release title (`vX.Y.Z`)

## Build Process & Windows Installer

The application is packaged using `electron-builder` as an NSIS Installer for Windows.

### Prerequisites for Building
1. Windows 10/11 machine.
2. Production `.env` file configured.
3. Node.js environment.

### Steps to Build:
```bash
# 1. Standardize types and clean code
npm run typecheck
npm run lint

# 2. Build binaries & generate NSIS installer
npm run build:win
```

This compiles the main process (`out/main`), preload scripts (`out/preload`), and bundles the React renderer (`out/renderer`), before packaging it all into:
- `release/NovoPharma-Setup-X.Y.Z.exe` (The offline installer)
- `release/latest.yml` (The auto-update metadata descriptor file)

## GitHub Release Process

NovoPharma uses GitHub Releases to distribute builds and power the automatic application updater.

### Automated Publishing via CI/CD (or local builder)
If you have a GitHub Personal Access Token (`GH_TOKEN`) with `repo` scope set in your environment:
```bash
# Run electron-builder publish (configures publish parameters and uploads to GitHub automatically)
npx electron-builder --win --publish always
```

### Manual Publishing (Fallback)
If publishing credentials are not configured locally:
1. Run `npm run build:win` locally to generate the files.
2. Go to [https://github.com/Aleem02/novopharma/releases](https://github.com/Aleem02/novopharma/releases).
3. Click **Draft a new release**.
4. Set the tag name to `vX.Y.Z` (e.g., `v1.0.0`) and target the `main` branch.
5. Title the release `vX.Y.Z`.
6. Drag and drop the following files from the `release/` directory into the binary upload section:
   - `NovoPharma-Setup-X.Y.Z.exe`
   - `latest.yml`
7. Click **Publish release**.

## Automatic Update Mechanism

The app uses `electron-updater` configured to poll the GitHub repository.

### How it works:
1. **Poll:** When the app launches, `UpdateService` checks for updates by reading `latest.yml` from the GitHub Release page.
2. **Download:** If `version` in `latest.yml` is greater than the running app's version, the setup file is downloaded in the background.
3. **Safety Backup:** Before applying the update, `UpdateService` performs a consistent database backup to `%APPDATA%/NovoPharma/update_safety_backups/`.
4. **Install & Restart:** The app restarts, runs the installer silently, performs database migrations if needed, and boots the new version.

## Data Safety & Rollback Considerations

- **Data Isolation:** The database (`novopharma_v1.sqlite`) is stored outside the application binaries folder in AppData (`%APPDATA%/NovoPharma`). Re-installing or updating the app **will not** overwrite or delete this file.
- **Rollback Procedure:** If an update fails or introduces critical defects, the user can manually download a previous setup file and run it. The database schema is backward-compatible with older builds unless destructive structural schema updates were made (which are banned in patch versions).
