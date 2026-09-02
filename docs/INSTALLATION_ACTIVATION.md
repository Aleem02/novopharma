# Cryptographic Installation Activation (Phase 3.3)

## Architecture

This document describes the two-step challenge-response protocol implemented in Phase 3.3 for the NovoPharma Desktop application. This process allows a legitimate desktop installation to prove its possession of a secure Ed25519 private key to the backend, enabling the activation of the installation.

### 1. Registration (Bootstrap Trust)

1. The desktop application authenticates the user via Firebase Auth.
2. The user is prompted to enter a one-time **Activation Code** (provided out-of-band by the Super Admin).
3. The desktop makes a `POST /api/desktop/activation/register-key` request passing the `installationId`, the `publicKey`, and the `activationCode`.
4. This request is authenticated with a Firebase ID token.
5. The backend validates the token, hashes the activation code, and compares it to the securely stored hash.
6. Upon match, the backend consumes the code, registers the public key, and transitions it to `PENDING_APPROVAL`.
7. The Super Admin manually approves the key in the Admin UI, transitioning it to `APPROVED`.

### 2. Challenge Request

1. Once approved, the desktop makes a `POST /api/desktop/activation/challenge` request using its internally generated `installationId`.
2. The backend generates a random challenge (32 bytes entropy), and stores it with a strict, short expiration time.

### 3. Signing

1. The desktop receives the `challengeId` and the `challenge` string.
2. The desktop constructs a strict canonical UTF-8 payload exactly as follows:
   ```text
   NOVOPHARMA-ACTIVATION-V1\n<challengeId>\n<challenge>\n<installationId>
   ```
3. The desktop signs this canonical string with its local, safeStorage-protected Ed25519 private key.

### 4. Activation Completion

1. The desktop sends a `POST /api/desktop/activation/complete` request to the backend.
2. The payload contains the `challengeId`, the `installationId`, and the `signature` (encoded in base64).
3. The backend:
   - Validates the Firebase ID token.
   - Looks up the challenge and verifies it is `PENDING` and not expired.
   - Looks up the installation and verifies it is `PENDING`.
   - Uses the authoritative _server-side_ public key to verify the `signature` against the reconstructed canonical payload.
   - Inside a strict Firestore transaction, atomically transitions the installation to `ACTIVE`, the tenant's `activeInstallationId` to this installation, and marks the challenge as `USED`.

## Security Boundaries & Rules

- **Private Key Exclusivity**: The Ed25519 private key NEVER leaves the `InstallationIdentityService` within the Electron Main process. It is never exposed to the renderer UI, never transmitted over the network, and never written to plaintext storage.
- **Tenant Authorization**: The desktop does not supply a `tenantId`. The backend inherently resolves the tenant authorization strictly from the verified Firebase UID.
- **Single Active Invariant**: The activation transaction enforces that exactly one active installation is allowed per tenant. Attempting to activate a second installation fails without replacing the original.
- **Offline Behavior**: Offline activation failures are safely mapped and do not mutate local SQLite data, and they definitely do not wipe out the local cryptographic identity.

## Admin Repository Requirements

The Desktop repository delegates backend verification to the Admin (`d:\NovoPharma\novopharma-admin`) backend. The following must exist in the Admin repository:

- Secure binding of the desktop's public key upon provisioning.
- `POST /api/desktop/activation/challenge` endpoint with cryptographically secure PRNG (`crypto.randomBytes`).
- `POST /api/desktop/activation/complete` endpoint with atomic transaction validation.
- Audit operation tracing (`INSTALLATION_ACTIVATED`).
