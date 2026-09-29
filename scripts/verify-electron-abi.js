const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('=== BUILD-TIME ELECTRON ABI VERIFICATION ===');

// 1. Verify Electron version from package.json & node_modules
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const expectedElectronVer = pkg.devDependencies.electron || '31.4.0';

console.log(`[ABI Check] Expected Electron Version: ${expectedElectronVer}`);

// Check installed Electron version & Node ABI in Electron
let electronABI = '';
let electronVer = '';
try {
  const output = execSync(
    'npx electron -e "console.log(process.versions.electron + \':\' + process.versions.modules); process.exit(0);"',
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf-8' }
  ).trim();
  const parts = output.split(':');
  electronVer = parts[0];
  electronABI = parts[1];
  console.log(`[ABI Check] Detected Electron Version: ${electronVer}, Node ABI: ${electronABI}`);
} catch (err) {
  console.error('[ABI Check] ERROR: Failed to query Electron runtime version and ABI:', err.message);
  process.exit(1);
}

if (electronABI !== '125') {
  console.error(`[ABI Check] CRITICAL ERROR: Electron ABI is expected to be 125, but detected ${electronABI}.`);
  process.exit(1);
}

// 2. Verify better-sqlite3 native binary compatibility with Electron ABI 125
try {
  execSync('npx electron -e "require(\'better-sqlite3\')(\':memory:\'); process.exit(0);"', {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'ignore'
  });
  console.log('[ABI Check] PASS: better-sqlite3 in workspace is compiled for Electron ABI 125.');
} catch (err) {
  console.error('\n=========================================================');
  console.error('[ABI Check] BUILD FAILURE: better-sqlite3 native module is NOT compiled for Electron (ABI 125).');
  console.error('It was likely compiled for standard Node.js (ABI 127) during npm test.');
  console.error('The build pipeline must run "npm run rebuild:electron" before packaging.');
  console.error('=========================================================\n');
  process.exit(1);
}

console.log('=== ELECTRON ABI VERIFICATION PASSED ===\n');
process.exit(0);
