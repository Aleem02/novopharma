-- NovoPharma V1 Initial Schema
-- Adhering strictly to DATABASE.md domains. No business logic assumptions.
-- Identifiers: INTEGER PRIMARY KEY (RowID)
-- Monetary values: INTEGER (paise)
-- Timestamps: INTEGER (Unix milliseconds UTC)
-- Date-only values: TEXT (YYYY-MM-DD)

-- 1. Pharmacy Settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. Audit Records
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    changes TEXT, -- JSON diff
    timestamp INTEGER NOT NULL -- Unix ms
);
