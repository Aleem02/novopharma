# Database Architecture

## Overview
- **Database Engine:** SQLite (Local) using `better-sqlite3` in WAL mode with a single main-process connection.
- **Location:** Managed exclusively by the Main Process via `app.getPath('userData')` resolving to `novopharma_v1.sqlite`. The Renderer never controls the database path.
- **Native Compatibility:** `better-sqlite3` is externalized safely via `electron-vite` and loaded natively in the Electron process.
- **Role:** The sole source of truth for all live production transactions.
- **Access:** Only accessible via secure backend domain services (Main process). The React renderer has zero direct access to the database. All IPC responses are strictly bounded with pagination (max ~500 records per paginated request), utilizing virtualized UI lists for large datasets to prevent loading unbounded datasets into renderer memory.

## Schema Conventions
- **Identifiers:** `INTEGER PRIMARY KEY` is the default identifier. `AUTOINCREMENT` is omitted unless explicitly required, favoring standard SQLite ROWID behavior.
- **Money Strategy:** Financial values are strictly recorded as INTEGER minor units (e.g., paise for INR). Floating point floats are strictly banned for authoritative financial calculations.
- **Date/Timestamp Strategy:**
  - Absolute Timestamps (created_at, updated_at, sold_at): `INTEGER` Unix milliseconds UTC.
  - Business Dates (expiry date, invoice date): `TEXT` YYYY-MM-DD.

## Durability & Configuration (PRAGMAs)
- `journal_mode = WAL`: Optimized concurrency and crash resistance.
- `synchronous = FULL`: Ensures maximum durability for financial records. While `NORMAL` provides higher throughput, NovoPharma handles critical accounting and inventory ledgers; absolute durability prevents silent corruption on unexpected power loss.
- `foreign_keys = ON`: Strict relational integrity immediately upon connection initialization.
- `busy_timeout = 5000`: Safely wait 5 seconds before emitting `SQLITE_BUSY` when facing temporary contention.

## Migration System
- **Schema versioning:** Explicit version tracking in the `_migrations` database table.
- **Migrations:** Automated, deterministic migration scripts execute inside atomic transactions (where supported by SQLite).
- A failed migration explicitly rolls back, preventing inconsistent schema states. Migrations run precisely once.

## Transaction Architecture
Business-critical operations must be atomic. The underlying abstraction wraps `better-sqlite3`'s `.transaction()` hook. Repositories must never commit partial chunks of a unified financial workflow; a dedicated Service layer acts as the transaction boundary.

**Example - Sale Workflow:**
1. Stock validation
2. Invoice generation
3. Sale items insertion
4. Payment recording
5. Stock deduction

**Requirement:** All steps MUST succeed together or all must roll back. Incomplete states (e.g., invoice generated but stock not deducted) are unacceptable.

## Integrity Checks
- **Initialization:** `PRAGMA integrity_check` and `PRAGMA foreign_key_check` are available as manual and startup constraints to ensure the database schema holds valid relations and blocks corruption propagation.
