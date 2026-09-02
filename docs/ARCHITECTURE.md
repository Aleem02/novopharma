# Core Architecture

## Desktop Application

- **Platform:** Windows desktop application
- **Framework:** Electron
- **Renderer:** React-based UI
- **Language:** TypeScript
- **Security:** Secure Electron preload/IPC architecture

## Production Database

- **Engine:** SQLite
- **Deployment:** One local database per installation
- **Role:** SQLite is the source of truth for live pharmacy operations.

**CRITICAL RULE:** The renderer must NEVER directly access SQLite. Database access must go through secure application/domain services via IPC.

## Authentication Flow

Firebase Authentication is used for user identification. Firestore is NOT the password database. No plaintext passwords stored.

**Authentication Concept:**
Firebase Authentication -> Authenticated UID -> Tenant lookup -> Entitlement check -> Installation authorization -> Application session -> Local SQLite

- Client receives credentials securely from NovoPharma administrator.
- Super Admin provisions the client account.

## Super Admin & Backend Boundary

- **Hosting:** Vercel
- **Frontend:** Next.js / React (Firebase Client SDK)
- **Backend:** Vercel Server Functions (Node.js/TypeScript + Firebase Admin SDK)
- **Rule:** The Firebase Admin SDK MUST exist ONLY within Vercel Server Functions. It must never be bundled into the Electron application, the Super Admin browser frontend, or the git repository secrets. The Electron app connects only using the Firebase Client SDK.

## Tenant / Client Model

Each pharmacy is represented by a unique tenant/client ID (e.g., `NP-000001`).

- The authenticated Firebase UID must be associated with the correct tenant.
- The client application must NEVER trust a tenant ID supplied by the renderer.
- Tenant authorization must be enforced server-side.

**Tenant Properties:**

- Client information, status, entitlement (LIFETIME), product, edition (SINGLE_PC_V1), owner Firebase UID, installation record, backup metadata, application metadata.

## Installation Authorization

V1 allows exactly ONE ACTIVE production installation per tenant. This is achieved via an asymmetric cryptographic installation identity, NOT via hardware fingerprinting (CPU, HDD, MAC address, etc.).

**Authorization Flow:**

1. Authenticate owner.
2. Verify tenant entitlement.
3. Check whether an active installation already exists.
4. If no installation exists, generate an Ed25519 asymmetric key pair via Node.js crypto.
5. Keep the private key on the Windows machine, protected using Electron's asynchronous `safeStorage` APIs (which wrap Windows DPAPI), securely anchoring it to the local OS installation. TPM is optional, not required for V1.
6. The desktop prompts for a one-time **Activation Code** (provided out-of-band by the Super Admin).
7. The desktop registers its public key using the activation code, transitioning the key state to `PENDING_APPROVAL`.
8. Once approved by the Super Admin, the desktop successfully answers cryptographic challenges and the server atomically activates the installation.

_(Note: PHASE 3.5 implements the complete end-to-end cryptographic installation activation. A 2-step challenge-response proves possession of the local Ed25519 private key to the Vercel backend. The backend enforces single-active installation limits atomically.)_

Subsequent logins must verify:

1. Firebase authentication
2. Tenant entitlement
3. Installation authorization
4. Cryptographic proof from the authorized installation

## Logout / Login

- **Logout:** Happens ONLY when the owner explicitly selects Logout.
- Logout MUST: clear the application user session.
- Logout MUST NOT: delete SQLite data, release the installation, delete the installation key, deactivate the client, modify lifetime entitlement.

If the user is already authenticated and production mode is active, temporary internet loss must NOT interrupt normal local production. If explicitly logged out, internet may be required for the next authentication.

## Production Data

Live pharmacy operations (product search, barcode scanning, cart, billing, stock, purchase, returns, reports) MUST use SQLite and MUST NOT require network round trips. The primary goal is extremely fast workflow.

## Future Architecture (V2)

The codebase should be modular enough that V2 can introduce multi-PC, staff users, cloud db sync, etc. DO NOT implement those features in V1. DO NOT over-engineer V1 for hypothetical requirements.
