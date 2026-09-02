# Backup Architecture

## Purpose

Ensure customer data is safe against hardware failure, corruption, or theft, completely separate from live production constraints.

## Flow & Schedule

- **Schedule:** Every 2 hours while the application is running.
- **Workflow:**
  1. Create a consistent SQLite snapshot.
  2. Encrypt the backup using AES-256-GCM. The tenant-specific backup encryption key is protected by a server-controlled key-management mechanism (e.g. GCP KMS) and held only temporarily in memory. Each backup uses a unique IV/nonce, an authentication tag, and includes backup format/version metadata.
  3. Upload to NovoPharma cloud storage (e.g., S3/Cloud Storage).
  4. Upload to client's Google Drive.
  5. Record backup metadata and status in Firestore.
- **Constraints:**
  - NEVER block billing or application usage while backing up.
  - Silently retry failures (e.g., transient network issues).
  - DO NOT store raw SQLite database backups as fragmented Firestore documents. Use cloud object/file storage for actual files.

## Supported Operations

- Manual backup.
- Automatic background backup.
- Retry mechanisms.
- Reporting of failure status to the user.
- End-to-end restore workflow from cloud object storage.
- Integrity validation of backup files.
