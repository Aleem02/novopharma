# Decisions Log

1. **Local SQLite for V1**
   - *Decision:* Use SQLite instead of a cloud database (Firestore/Postgres).
   - *Reason:* Extremely fast local pharmacy operations, unaffected by internet outages. Offline production operation after successful authentication is a hard requirement.

2. **Firebase for Authentication & Metadata Only**
   - *Decision:* Use Firebase Authentication for user sessions, and Firestore strictly for tenant entitlement/backup metadata.
   - *Reason:* Keeps the core billing engine decoupled from cloud dependencies.

3. **Asymmetric Cryptographic Installation Identity**
   - *Decision:* Generate a local public/private key pair anchored to Windows instead of CPU/MAC fingerprinting.
   - *Reason:* Avoids false positives with hardware changes, provides cryptographically secure proof of installation that cannot be trivially copied by moving files.

4. **No Real-Time Cloud Sync**
   - *Decision:* Explicitly out of scope for V1.
   - *Reason:* Drastically reduces complexity, enforces the "Single Windows PC" model strictly.

5. **Manual Logout Design**
   - *Decision:* Logout requires explicit user action. Temporary internet drops do not revoke the local session.
   - *Reason:* Pharmacist workflow must not be disrupted by intermittent internet connectivity.

6. **Cryptographic Installation Identity (Windows Storage)**
   - *Decision:* Use an Ed25519 asymmetric key pair generated via Node.js `crypto`. The private key is protected locally using Electron's `safeStorage` asynchronous APIs (which natively use Windows DPAPI). TPM is optional, not required for V1.
   - *Reason:* Provides native OS-level protection tied to the specific Windows user/machine. The private key never leaves the Windows installation, never enters Firestore, never enters renderer JavaScript, never enters logs, and is not stored as plaintext. *(Note: PHASE 3.5 implements the complete end-to-end cryptographic challenge protocol.)*

7. **Backup Encryption**
   - *Decision:* AES-256-GCM. A tenant-specific backup encryption key must be protected by a server-controlled key-management mechanism (e.g., GCP KMS, to be verified during implementation). The desktop app only receives authorized key material temporarily in memory during backup/restore.
   - *Reason:* Ensures backups are secure. The key is never hardcoded, logged, or placed in source code. Each backup payload is encrypted with a unique IV/nonce, an authentication tag, and backup format/version metadata. Restore capabilities are preserved for legitimate PC replacements.

8. **Initial Client Credential Delivery**
   - *Decision:* Super Admin creates the Firebase Auth account -> generates a secure random temporary password -> sends Firebase password-reset email -> client establishes a permanent password -> client logs into NovoPharma.
   - *Reason:* Super Admin never handles the plaintext password permanently, no custom password database is built, and the supported Firebase password-reset mechanism is utilized. (Note: actual password-reset email link delivery mechanism must be verified during implementation).

9. **IPC Pagination & SQLite Concurrency**
   - *Decision:* Use `better-sqlite3` with a single main-process SQLite connection in WAL mode. Financial operations must use atomic transactions with serialized write operations.
   - *Reason:* Guarantees consistency. Unbounded datasets must not be loaded into renderer memory. IPC responses are strictly bounded with pagination for large datasets (maximum ~500 records per paginated request), utilizing virtualized UI lists where required.

10. **Super Admin & Backend Deployment (Vercel Server Functions)**
   - *Decision:* The Vercel Server Functions environment is exclusively designated as the privileged backend execution context.
   - *Reason:* Ensures the absolute segregation of the `firebase-admin` SDK from the Electron desktop clients. The desktop app maintains its strict zero-trust posture, communicating solely over HTTPS API boundaries, while the Vercel backend safely wields Firestore Super Admin permissions to manage tenant provisioning and cryptographic verification.

11. **Firebase Desktop Authentication (Phase 3.2)**
   - *Decision:* The Firebase Client SDK runs strictly in the Electron Main process with `inMemoryPersistence`. It is accessed by the renderer only via narrow IPC (`window.api.auth.signIn()`). ID tokens are generated on-demand by the Main process for Vercel API calls and never exposed to the renderer.
   - *Reason:* Contains all credential handling (email/passwords, ID tokens) securely in the Main process. Ephemeral in-memory persistence ensures the Firebase session clears upon exit without polluting disk storage, distinguishing the user session distinctly from the permanent Ed25519 installation identity.

12. **Cryptographic Activation Protocol (Phase 3.5)**
   - *Decision:* A multi-step challenge-response protocol completes activation. The desktop performs public-key registration using a one-time activation code. After successful registration (transitioning server-side key state to `PENDING_APPROVAL`), a human Super Admin explicitly reviews and approves the key (`APPROVED`). The desktop then requests a server-generated challenge (32 bytes), constructs a strictly ordered canonical string (`NOVOPHARMA-ACTIVATION-V1\n...`), and signs it using the Ed25519 private key.
   - *Reason:* The one-time activation code prevents an attacker with compromised credentials from registering their own PC's key. The Super Admin approval step adds a human verification layer. The challenge-response ensures absolute proof of possession of the physical PC's credential manager-bound key. The Vercel backend atomically enforces the single-active-installation rule within a Firestore transaction.
