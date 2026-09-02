# Module Map

The NovoPharma desktop application is divided into several logical modules, completely decoupled between the Main Process (Backend/Domain) and Renderer Process (UI).

## Main Process Modules

1. **Auth & Identity Manager:** Handles Firebase Auth, installation key generation, identity verification.
2. **Database Engine:** Manages SQLite connections, migrations, transactions.
3. **Billing/Sales Module:** Handles atomic sale transactions.
4. **Inventory Module:** Product management, stock, batches, expiry tracking.
5. **Purchases Module:** Purchase entry, returns, supplier management.
6. **Backup Engine:** Automated snapshotting, encryption, Google Drive & Cloud upload.
7. **IPC Router:** Secures and routes events from Renderer.
8. **Updater:** Application update mechanism.

## Renderer Modules (React UI)

1. **Onboarding & Auth Flow:** Login, provisioning screens.
2. **Point of Sale (POS):** High-speed billing interface, barcode scanning, cart.
3. **Inventory Dashboard:** Stock levels, product configuration.
4. **Reporting:** Sales, expenses, expiry reports.
5. **Settings:** Backup configuration, printer setup.

## Super Admin Project (Separate)

- Completely independent web application or backend tool.
- Manages clients, client provisioning, owner account provisioning, lifetime entitlement, active/suspended status, installations (release/replacement), backup metadata, audit logs.
- Does NOT interact with the local SQLite database.
