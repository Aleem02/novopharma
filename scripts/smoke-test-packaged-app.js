const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

console.log('=== PACKAGED APPLICATION STARTUP SMOKE TEST ===');

const projectRoot = path.join(__dirname, '..');
const unpackedAppDir = path.join(projectRoot, 'release', 'win-unpacked');
const packagedModulePath = path.join(unpackedAppDir, 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3');

if (!fs.existsSync(unpackedAppDir)) {
  console.error(`[Smoke Test] ERROR: Packaged application directory not found at: ${unpackedAppDir}`);
  console.error('[Smoke Test] Run electron-builder before running the smoke test.');
  process.exit(1);
}

if (!fs.existsSync(packagedModulePath)) {
  console.error(`[Smoke Test] ERROR: Packaged better-sqlite3 module not found at: ${packagedModulePath}`);
  process.exit(1);
}

// Ensure scratch directory exists for isolated DB and runner script
const scratchDir = path.join(projectRoot, 'scratch');
if (!fs.existsSync(scratchDir)) {
  fs.mkdirSync(scratchDir, { recursive: true });
}

const isolatedDbPath = path.join(scratchDir, 'smoke_test_isolated_runtime.sqlite');
if (fs.existsSync(isolatedDbPath)) {
  try {
    fs.unlinkSync(isolatedDbPath);
  } catch (e) {
    // ignore
  }
}

const runnerScriptPath = path.join(scratchDir, 'temp_smoke_runner.js');

console.log(`[Smoke Test] Isolated Test Database Path: ${isolatedDbPath}`);
console.log(`[Smoke Test] Packaged better-sqlite3 Path: ${packagedModulePath}`);

const runnerContent = `
const path = require('path');
const fs = require('fs');

const dbPath = ${JSON.stringify(isolatedDbPath)};
const modulePath = ${JSON.stringify(packagedModulePath.replace(/\\/g, '/'))};

try {
  console.log('[Runtime Test] Loading packaged better-sqlite3...');
  const Database = require(modulePath);
  console.log('[Runtime Test] Packaged better-sqlite3 loaded successfully.');

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  const integrity = db.pragma('integrity_check');
  console.log('[Runtime Test] PRAGMA integrity_check:', JSON.stringify(integrity));
  if (!integrity || integrity[0].integrity_check !== 'ok') {
    throw new Error('SQLite integrity_check failed: ' + JSON.stringify(integrity));
  }

  db.exec('CREATE TABLE smoke_test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  db.prepare('INSERT INTO smoke_test (name) VALUES (?)').run('Isolated Smoke Test Item');

  const row = db.prepare('SELECT * FROM smoke_test WHERE id = 1').get();
  console.log('[Runtime Test] Database query result:', row);

  db.close();

  if (row && row.name === 'Isolated Smoke Test Item') {
    console.log('PACKAGED_STARTUP_SMOKE_TEST: SUCCESS');
    process.exit(0);
  } else {
    throw new Error('Unexpected query result from isolated test database');
  }
} catch (err) {
  console.error('[Runtime Test] FAILURE:', err.stack || err.message);
  process.exit(1);
}
`;

fs.writeFileSync(runnerScriptPath, runnerContent, 'utf-8');

try {
  const output = execSync(
    `npx electron "${runnerScriptPath.replace(/\\/g, '/')}"`,
    {
      cwd: projectRoot,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf-8'
    }
  );
  console.log(output.trim());
  if (output.includes('PACKAGED_STARTUP_SMOKE_TEST: SUCCESS')) {
    console.log('=== PACKAGED APPLICATION STARTUP SMOKE TEST PASSED ===\n');
    process.exit(0);
  } else {
    console.error('[Smoke Test] ERROR: Smoke test did not report SUCCESS.');
    process.exit(1);
  }
} catch (err) {
  console.error('\n=========================================================');
  console.error('[Smoke Test] BUILD FAILURE: Packaged application startup smoke test failed!');
  if (err.stdout) console.error('STDOUT:', err.stdout);
  if (err.stderr) console.error('STDERR:', err.stderr);
  console.error('=========================================================\n');
  process.exit(1);
}
