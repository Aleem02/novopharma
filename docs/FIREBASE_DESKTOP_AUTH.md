# Firebase Desktop Authentication Architecture

## Phase 3.2: Client SDK Integration

This document outlines the authentication boundary established in Phase 3.2 for the NovoPharma Desktop application. 
**Note:** This phase establishes only the authentication structure; public key registration and installation activation are intentionally deferred.

## 1. Firebase Client SDK Exclusivity
The Desktop application strictly employs the Firebase **Client SDK** (`firebase/app` and `firebase/auth`). 
It **never** incorporates the `firebase-admin` SDK. No service-account JSONs, `FIREBASE_ADMIN_PRIVATE_KEY`, or any server-privileged credentials are permitted in the Electron repository.

## 2. Main-Process Architectural Boundary
The Firebase Client SDK is isolated exclusively within the Electron **Main Process** (`src/main/services/firebaseAuth.ts`).
- **Renderer Isolation**: The React renderer possesses zero direct access to the Firebase SDK, Firestore objects, or network clients.
- **IPC Funnel**: The renderer communicates authentication intent via strictly typed IPC channels (`window.api.auth.signIn`, `window.api.auth.signOut`, etc.) exposed safely through the preload script.
- **ID Token Concealment**: ID tokens produced by Firebase Auth are securely retained in Main-process memory. They are explicitly withheld from IPC responses; the renderer never receives or handles the raw JWT.

## 3. Ephemeral Session & In-Memory Persistence
While the cryptographic Ed25519 identity (Phase 3.1) represents the permanent PC installation, the Firebase user session is ephemeral.
- Firebase Auth is explicitly configured with `inMemoryPersistence`. 
- No passwords, refresh tokens, or ID tokens are persisted to disk (not in SQLite, `identity.json`, `localStorage`, or elsewhere).
- Upon application restart, the user must re-authenticate. (Future phases may explore specific refresh flows if strictly required by UX, but currently the session dies with the process).

## 4. Backend Communication Contract
A typed internal HTTP Client (`ApiClient`) manages requests to the Vercel backend.
- Before executing a protected request, the client synchronously asks the Firebase SDK for the current ID token (`user.getIdToken()`). 
- The token is attached to the `Authorization: Bearer <token>` header.
- The desktop does NOT provide arbitrary assertions of authority (e.g., `tenantId`, `ownerUid`, `installationId`) in the HTTP request body to establish access rights. The Vercel backend remains entirely authoritative in extracting the UID from the verified token and resolving the corresponding Tenant and Entitlement from Firestore.

## 5. Offline & Network Resilience
The architecture distinguishes Local vs. Cloud operations.
- SQLite remains authoritative for local transactional consistency.
- Network timeouts, DNS failures, and Firebase authentication outages are mapped to safe UI error strings (e.g., "Network is unavailable").
- Authentication failures do NOT mutate local SQLite data or destroy the cryptographic installation identity.

## 6. Security Limitations
This layer handles the *User* identity. It does not independently prove the *Installation* identity. A subsequent Phase will bridge the two by orchestrating a cryptographic challenge/response protocol where the backend demands an Ed25519 signature corroborating the installation's physical authorization.
