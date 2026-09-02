# NovoPharma

Windows desktop pharmacy billing and inventory management application.

## Technology Stack

- **Runtime:** Electron 31 (Chromium + Node.js)
- **Frontend:** React 18, React Router, TailwindCSS, Lucide Icons
- **Backend:** SQLite (via better-sqlite3), IPC-based service layer
- **Build:** electron-vite, electron-builder (NSIS installer)
- **Auth:** Firebase Authentication (client SDK)
- **Updater:** electron-updater (GitHub Releases)
- **Security:** Ed25519 cryptographic installation identity, Windows DPAPI

## Prerequisites

- Node.js 20+ (LTS)
- npm 9+
- Windows 10/11 (production target)
- Git

## Quick Start

```bash
# Clone
git clone https://github.com/Aleem02/novopharma.git
cd novopharma

# Install dependencies
npm install

# Copy environment template
copy .env.example .env
# Fill in Firebase and backend configuration values

# Start development
npm run dev
```

## Project Structure

```
src/
├── main/              # Electron main process
│   ├── database/      # SQLite connection, migrations, schema
│   ├── ipc/           # IPC handler registration
│   ├── infrastructure/# Logger
│   ├── security/      # Installation identity (Ed25519/DPAPI)
│   ├── services/      # Business logic services
│   └── windows/       # BrowserWindow creation
├── preload/           # Context bridge (secure IPC exposure)
├── renderer/          # React frontend
│   └── src/
│       ├── components/# UI components by module
│       ├── pages/     # Route pages
│       └── styles/    # CSS
└── shared/            # Types shared between main & renderer
```

## Scripts

| Command             | Description                                 |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Start in development mode                   |
| `npm run build`     | Typecheck + build (main, preload, renderer) |
| `npm run build:win` | Build + generate Windows NSIS installer     |
| `npm run typecheck` | Run TypeScript type checking                |
| `npm run lint`      | Run ESLint with auto-fix                    |
| `npm run test`      | Run Vitest unit tests                       |
| `npm run pack`      | Build + package (unpacked, for testing)     |

## Database

SQLite database is stored in the user's AppData directory:

```
%APPDATA%/NovoPharma/novopharma_v1.sqlite
```

This is **outside** the installation directory, ensuring application updates never overwrite user data.

Migrations run automatically on application start. See [docs/DATABASE.md](docs/DATABASE.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Security](docs/SECURITY_ARCHITECTURE.md)
- [Development](DEVELOPMENT.md)
- [Release Process](RELEASE.md)
- [Testing](TESTING.md)
- [Client Guide](CLIENT_GUIDE.md)

## License

UNLICENSED — Proprietary software.
