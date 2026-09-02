# Cryptographic Installation Identity

## Overview

NovoPharma V1 employs an asymmetric cryptographic identity for each authorized Windows installation to enforce the single-PC licensing model. This prevents bypassing the license through mere copying of the application directory or SQLite database.

**Phase 3.1 Status**: The identity generation and local Windows secure storage are implemented. **Firebase registration and remote activation challenge/response are NOT YET CONNECTED.**

## Ed25519 Decision

We use the Ed25519 algorithm generated via Node.js native `crypto`. Ed25519 is chosen for its speed, high security margin, and compact signature size.

## Windows safeStorage / DPAPI Protection

The private key is strictly protected at rest using Electron's `safeStorage.encryptString()` API. On Windows, `safeStorage` natively hooks into the **Data Protection API (DPAPI)**.

- DPAPI encrypts the payload using a symmetric key derived from the current Windows user's login credentials.
- **Security Limitation**: This provides robust protection against ordinary copying of the application files. It does NOT claim to be "impossible to extract," "hardware locked," or "unbreakable." A sufficiently privileged malicious administrator or targeted malware running within the same user session may still be able to interact with DPAPI to decrypt the payload. This boundary is acceptable and deliberate for V1.

## Local Identity Lifecycle

### First Launch

1. Application queries `safeStorage.isEncryptionAvailable()`. If false, fails closed.
2. Generates an Ed25519 key pair in the Main process.
3. Encrypts the private PKCS#8 PEM string via `safeStorage`.
4. Saves metadata and the encrypted payload to `identity.json` inside the Electron `userData` directory.

### Application Restart

1. Reads `identity.json`.
2. Decrypts the payload via `safeStorage`.
3. Derives the public key from the loaded private key.
4. Mathematically compares the derived public key against the stored public key.
5. If they mismatch, throws a fatal error and fails closed.

### Logout

The installation identity is bound to the Windows PC, **not** the Firebase user session. Explicitly logging out of NovoPharma does **not** delete, regenerate, or invalidate `identity.json`.

### Application Update

Because `identity.json` is safely stored in the OS-managed `userData` directory (e.g., `%APPDATA%\novopharma`), normal application updates (replacing the `.exe` or installation directory) do **not** touch the identity. The same key pair survives updates.

### Uninstall

For V1, no automatic license-reset mechanism fires on uninstall. If the user explicitly wipes their `%APPDATA%` and destroys the protected local identity, the installation key is permanently lost. A future Super Admin recovery/replacement workflow will be required to reauthorize the PC.

### Corruption & Recovery

If the identity file is missing, structurally malformed, or if `safeStorage` fails to decrypt the private key (e.g., the Windows user password was externally reset and DPAPI keys were lost), the application **FAILS CLOSED**. It will **never** silently regenerate a new identity to replace the corrupted one, as that would orphan the cloud-registered authorized key.

## Public / Private Key Boundary

- **Private Key**: Never leaves the Main process. Never enters the renderer JavaScript. Never exposed via IPC. Never sent to Firestore. Never logged.
- **Public Key**: Represented as canonical SPKI DER base64. It is safe to expose and will eventually be uploaded to the backend during activation.
