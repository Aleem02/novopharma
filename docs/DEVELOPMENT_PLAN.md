# Development Plan

## Phase 1: Foundation & Scaffolding
- Initialize Electron & React with TypeScript.
- Setup secure IPC and preload scripts.
- Establish SQLite local database with basic migration framework.

## Phase 2: Security & Identity
- Integrate Firebase Client Auth.
- Implement Tenant/Entitlement authorization via backend rules.
- Implement Cryptographic Installation Identity generation and Windows secure storage.
- Validate copy protection requirements.

## Phase 3: Core Database & Domain Services
- Design comprehensive SQLite schema for products, inventory, sales, purchases.
- Implement atomic transaction wrappers.
- Build internal domain services for CRUD operations.

## Phase 4: Primary Features (UI + IPC integration)
- Point of Sale / Billing (offline capable).
- Inventory Management (Batches, Expiry).
- Purchases and Returns.
- Reports and Exports.

## Phase 5: Reliability & Infrastructure
- Implement automated backup engine (2-hour snapshots, encryption, Drive/Cloud upload).
- Implement manual backup/restore workflows.
- Implement application Updater.

## Phase 6: Super Admin Project
- Build separate Super Admin tool to manage clients, provisions, and release installations.
