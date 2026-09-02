# Installation Registration

This document outlines the Phase 3.4 implementation of the one-time Activation Code registration process for NovoPharma Desktop.

## Overview

The Desktop application must securely register its public key with the Vercel backend using a one-time activation code provided by the Super Admin. This securely bootstraps trust, proving hardware ownership intent without relying solely on Firebase credentials.

## Lifecycle

1. **UNREGISTERED**: The initial state.
2. **PENDING_APPROVAL**: Achieved after successfully registering the public key using the valid one-time activation code.
3. **APPROVED**: Set manually by the Super Admin in the web interface.
4. **ACTIVE**: Set automatically by the server when the desktop correctly answers the cryptographic challenge.

## Component Boundaries

### Main Process (Secure Context)

- Owns the `InstallationIdentityService` which loads the Ed25519 identity.
- Executes `InstallationRegistrationService` to orchestrate registration.
- Constructs the registration payload.
- Retrieves the Firebase ID token internally via `ApiClient`.
- Protects the private key; NEVER exposes it to the renderer or the network.

### Renderer Process (Untrusted UI Context)

- Has NO access to the Firebase Admin SDK or Client SDK tokens.
- Has NO access to the tenant ID or installation ID.
- Has NO access to the private key.
- Presents the activation form to the user.
- Dispatches the `window.api.activation.registerKey(activationCode)` IPC command.

### Admin Backend (Authoritative Context)

- Hashes and stores activation codes.
- Validates the submitted activation code against the secure hash.
- Consumes the activation code permanently to prevent replay attacks.
- Transitions the installation to `PENDING_APPROVAL`.

## Security Guarantees

- The plaintext activation code is temporarily processed in memory and never written to disk or logged.
- The ID token and activation code validate the user and the Super Admin's intent simultaneously.
- Even if a malicious actor acquires a pharmacist's Firebase login credentials, they cannot activate their own PC without the one-time activation code.
