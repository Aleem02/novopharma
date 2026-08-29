# Update Strategy

## Application Updates
- Handled via Electron's built-in auto-updater capabilities.
- New releases are signed and published.
- The desktop app polls for updates and applies them seamlessly.

## Database Updates (Migrations)
- When a new application version contains database changes, a deterministic migration runs on application startup.
- The migration process MUST take an automatic local backup before executing schema changes.
- If a migration fails, the database must roll back to the previous state, and the application must alert the user.

## Constraints
- Do NOT bypass database migrations.
- Altering existing data must be logged and handled explicitly.
- Super Admin cannot force remote migrations; they are triggered locally upon application update.
