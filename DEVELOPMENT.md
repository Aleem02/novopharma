# NovoPharma — Development Guide

## Environment Setup

### 1. Prerequisites
- Node.js 20+ (LTS recommended)
- npm 9+
- Windows 10/11
- Git
- A code editor (VS Code recommended)

### 2. Clone & Install

```bash
git clone https://github.com/Aleem02/novopharma.git
cd novopharma
npm install
```

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
copy .env.example .env
```

| Variable | Description | Secret? |
|----------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase client API key | No (public client key) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | No |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | No |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | No |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender | No |
| `VITE_FIREBASE_APP_ID` | Firebase app ID | No |
| `VITE_BACKEND_URL` | NovoPharma Admin backend URL | No |

> **Note:** Firebase client SDK keys are designed to be public. They are restricted by Firebase Security Rules and domain restrictions, not by secrecy. However, do NOT commit service-account private keys, admin SDK credentials, or signing certificates.

### 4. Running Locally

```bash
npm run dev
```

This rebuilds the native SQLite module for the current Electron ABI and starts the development server with hot-reload.

## Database

### Location
- **Development:** `%APPDATA%/NovoPharma/novopharma_v1.sqlite`
- **Test:** In-memory or `.test_userdata/` (when `VITEST` is set)

The database is always stored in the user's AppData, never inside the project or installation directory.

### Migrations

Migrations are in `src/main/database/schema/` and registered in `src/main/database/migrations.ts`.

- Migrations run automatically on app startup.
- Each migration runs in a transaction with rollback on failure.
- The `_migrations` table tracks which migrations have been applied.
- Migration IDs must be unique and sequential.

### Adding a Migration

1. Create `src/main/database/schema/NNNN_description.sql`
2. Import it in `migrations.ts`
3. Add it to the `MIGRATIONS` array with the next sequential ID
4. Test with both fresh and existing databases

## Architecture

- **Main Process:** Database, business logic, IPC handlers, security, updater
- **Preload:** Secure context bridge (`contextBridge.exposeInMainWorld`)
- **Renderer:** React SPA with client-side routing
- **Communication:** Explicit IPC channels only. No generic `ipcRenderer.invoke` exposed.

### Security Boundaries
- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`
- No arbitrary navigation or window opening
- All IPC arguments validated at the handler boundary
- Private keys encrypted with Windows DPAPI

## Troubleshooting

### Native Module Errors
If `better-sqlite3` fails to load, the native module may need rebuilding:
```bash
npm run rebuild:electron
```

### Database Locked
The app uses single-instance locking. If the app appears locked, ensure no other NovoPharma instance is running.

### Firebase Auth Issues
Ensure `.env` values match your Firebase project configuration. The app requires network connectivity for initial authentication.
