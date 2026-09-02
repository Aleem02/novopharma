# Update Strategy

## Application Updates

- Handled via `electron-updater` querying GitHub Releases.
- The next release containing this feature is v1.2.0.
- The desktop app performs background polls for updates on startup and handles them safely.

## Database Updates (Migrations)

- When a new application version contains database changes, a deterministic migration runs on application startup.
- The migration process MUST take an automatic local backup before executing schema changes.
- If a migration fails, the database must roll back to the previous state, and the application must alert the user.

## Constraints

- Do NOT bypass database migrations.
- Altering existing data must be logged and handled explicitly.
- Super Admin cannot force remote migrations; they are triggered locally upon application update.

---

## Production Auto-Updater System (v1.2.0+)

### 1. Supported UI States (State Machine)

The auto-updater utilizes an explicit state model to prevent invalid combinations:

- **IDLE**: The system is waiting. No updates are currently checking or downloading.
- **CHECKING**: The main process is querying the GitHub Release metadata.
- **UP_TO_DATE**: Confirmed that the current running version is the latest. A subtle 10-second toast notification is displayed to the user.
- **UPDATE_AVAILABLE**: A valid newer release has been detected. A non-blocking panel shows the current and new version, along with a "Download Update" button.
- **DOWNLOADING**: The update package is being downloaded in the background. Visual progress shows the percentage, speed (MB/s), and transferred/total sizes (MB). Progress updates are throttled.
- **DOWNLOADED**: The update download has completed successfully. A brief notice is displayed.
- **INSTALLING**: A full-screen blocking overlay is displayed while the application prepares the install, creates a safety database backup, and restarts.
- **ERROR**: The check, download, or backup failed. A retryable error panel is shown allowing the user to retry or dismiss.

---

### 2. Development vs. Production Behavior

- **Development**: Update checks are bypassed. The `UpdateService` logs that updates are disabled. If checking is manually requested, it simulates an `UP_TO_DATE` response.
- **Production**: A background update check is triggered asynchronously 10 seconds after normal application startup.

---

### 3. Offline and Error Resilience

- Startup network errors (e.g. DNS resolve failures or no internet connection) are caught and suppressed silently, reverting the state machine back to `IDLE` to prevent spamming the user.
- If the user manually triggers a check while offline, the error is displayed as "Network connection unavailable."
- The update process never blocks the normal startup of the application.

---

### 4. How to Test Updates Locally (Two-Build Setup)

To test the update workflow locally before publishing to production:

1. Generate a mock update config `dev-app-update.yml` in the project root:
   ```yaml
   owner: Aleem02
   repo: novopharma
   provider: github
   ```
2. Build an older version (e.g. change version temporarily to `1.1.9` in `package.json` and build). Install this build.
3. Build a newer version (e.g. version `1.2.0`). Put the setup `.exe`, `.blockmap`, and `latest.yml` in a local static file server (or mock server), or publish it as a draft/pre-release on GitHub.
4. Launch the installed `1.1.9` application. It will query the repository/mock server, detect `1.2.0`, and trigger the download/update flow.
