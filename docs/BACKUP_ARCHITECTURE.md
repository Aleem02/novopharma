# Backup Architecture

## Purpose

Ensure customer data is safe against hardware failure, corruption, or theft, completely separate from live production constraints.

## Local Backup Architecture

- **Schedule:** Every 2 hours while application is running + manual "Backup Now" trigger + app-close backup.
- **Workflow:**
  1. Flush WAL log pages using `PRAGMA wal_checkpoint(TRUNCATE)`.
  2. Create a point-in-time snapshot using `better-sqlite3` `db.backup()`.
  3. Validate database integrity using `PRAGMA integrity_check` (must be `=== "ok"`) and `PRAGMA foreign_key_check` (must have 0 violations).
  4. Enforce local 30-file retention (`MAX_RETENTION = 30`), deleting oldest files locally beyond 30.

## Firebase Cloud Backup Architecture (v1.6 Feature)

- **Storage Location:** Private Firebase Cloud Storage bucket.
- **Target Path:** `backups/{tenantId}/NovoPharma_YYYY-MM-DD_HH-mm-ss.sqlite`
- **Identity & Authorization:**
  - `tenantId` is retrieved strictly from the authenticated user's Firebase Auth ID token custom claims (`tokenResult.claims.tenantId`).
  - `tenantId` is the sole cloud ownership and access boundary.
  - `installationId` is used for licensing and device identity only; it may appear as optional custom metadata for diagnostics, but is **NOT** part of the Storage path and does **NOT** affect cloud authorization or retrieval.
  - Storage Security Rules enforce `request.auth.token.tenantId == tenantId`.
- **Integrity Verification:**
  - SHA-256 checksum calculated from the exact `.sqlite` file uploaded.
  - Custom metadata attached to cloud object (`sha256`, `appVersion`, `installationId`, `tenantId`, `createdAt`).
- **Cloud Retention:**
  - **7 Calendar Days Only** (UTC timestamp boundary).
  - Cleanup operates tenant-wide over all backups in `backups/{tenantId}/`.
  - SQLite live database historical data and local 30-file retention are **never modified or deleted** by cloud retention cleanup.
- **File Format:**
  - Cloud backups are stored as raw `.sqlite` files (application-level AES-256-GCM encryption is intentionally not used for cloud backups).
  - Enables authorized administrators to manually download and verify checksum & SQLite integrity prior to restoring.
- **Offline & Error Resilience:**
  - Firebase or network failures do NOT fail or corrupt successful local backups.
  - UI/settings track `backup_last_cloud_success` and `backup_last_cloud_error` independently from local backup status.

## PC Replacement & Disaster Recovery Flow

1. Existing PC creates regular cloud backups under `backups/{tenantId}/{fileName}`.
2. Super Admin replaces active installation (e.g., when customer migrates to a new PC or hardware crashes).
3. Customer installs NovoPharma on the new PC.
4. Customer signs in using their Firebase Auth credentials.
5. Firebase Auth issues an ID token containing the customer's `tenantId`.
6. The new PC queries `backups/{tenantId}/` and lists all existing cloud backups for that tenant (regardless of which previous installation created them).
7. Customer selects and restores a verified cloud backup.
8. The new PC creates future cloud backups under the same `backups/{tenantId}/{fileName}` path.

## Supported Operations

- Manual "Backup Now" (creates verified local backup + uploads to Firebase Cloud Storage if enabled).
- Automatic background backup (local + cloud).
- Manual Cloud Backup Download & Integrity Verification (downloads raw `.sqlite`, verifies SHA-256 and SQLite pragmas).
- End-to-end restore workflow with pre-restore safety backup and automatic recovery rollback.

