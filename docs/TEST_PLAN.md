# Test Plan

## Core Requirements

- Every major feature requires tests.
- Security-sensitive changes require negative tests.
- Never weaken security to make a test pass.

## Automated Testing

1. **Unit Tests:** For isolated business logic (e.g., tax calculation, expiry date validation).
2. **Database Tests:** Validate all atomic transactions (e.g., test rollback if stock deduction fails).
3. **Migration Tests:** Ensure application updates correctly apply new schema changes to old databases.

## Security & Penetration Testing

1. **Copy Protection Simulation:**
   - Move application files to a simulated new environment and assert failure to access production DB.
   - Assert missing/invalid private key denies access.
2. **IPC Attack Surface:**
   - Attempt to call arbitrary SQLite queries from the renderer (MUST be blocked).
   - Attempt to pass malformed arguments to IPC handlers (MUST validate).

## Backup & Recovery Testing

- Simulate internet loss during backup.
- Simulate application crash during billing.
- End-to-end restore from Google Drive.
- Validate backup integrity through checksums.
