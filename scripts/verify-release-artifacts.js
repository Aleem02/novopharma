const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

console.log('=== RELEASE ARTIFACT & PACKAGED MODULE VERIFICATION ===');

const projectRoot = path.join(__dirname, '..');
const pkgPath = path.join(projectRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

console.log(`[Artifact Check] Target Release Version: ${version}`);

const releaseDir = path.join(projectRoot, 'release');
const installerName = `NovoPharma-Setup-${version}.exe`;
const blockmapName = `NovoPharma-Setup-${version}.exe.blockmap`;
const latestYmlPath = path.join(releaseDir, 'latest.yml');

const installerPath = path.join(releaseDir, installerName);
const blockmapPath = path.join(releaseDir, blockmapName);

// 1. Verify installer executable
if (!fs.existsSync(installerPath)) {
  console.error(`[Artifact Check] ERROR: Installer file not found at: ${installerPath}`);
  process.exit(1);
}
const installerStat = fs.statSync(installerPath);
if (installerStat.size < 1000000) {
  console.error(`[Artifact Check] ERROR: Installer size is suspiciously small (${installerStat.size} bytes).`);
  process.exit(1);
}
console.log(`[Artifact Check] PASS: Installer binary exists (${installerName}, ${(installerStat.size / (1024 * 1024)).toFixed(2)} MB).`);

// 2. Verify blockmap file
if (!fs.existsSync(blockmapPath)) {
  console.error(`[Artifact Check] ERROR: Blockmap file not found at: ${blockmapPath}`);
  process.exit(1);
}
console.log(`[Artifact Check] PASS: Blockmap file exists (${blockmapName}).`);

// 3. Verify latest.yml metadata
if (!fs.existsSync(latestYmlPath)) {
  console.error(`[Artifact Check] ERROR: latest.yml metadata file not found at: ${latestYmlPath}`);
  process.exit(1);
}
const latestYmlContent = fs.readFileSync(latestYmlPath, 'utf-8');
console.log(`[Artifact Check] Inspecting latest.yml:\n${latestYmlContent}`);

if (!latestYmlContent.includes(`version: ${version}`)) {
  console.error(`[Artifact Check] ERROR: latest.yml version does not match package.json version ${version}.`);
  process.exit(1);
}

if (!latestYmlContent.includes(`path: ${installerName}`)) {
  console.error(`[Artifact Check] ERROR: latest.yml path does not reference installer ${installerName}.`);
  process.exit(1);
}
console.log('[Artifact Check] PASS: latest.yml metadata matches package version and installer path.');

// 4. Verify packaged native module ABI (Electron 31.4.0 / ABI 125)
const packagedNativePath = path.join(
  releaseDir,
  'win-unpacked',
  'resources',
  'app.asar.unpacked',
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
);

if (!fs.existsSync(packagedNativePath)) {
  console.error(`[Artifact Check] ERROR: Packaged native module better_sqlite3.node not found at: ${packagedNativePath}`);
  process.exit(1);
}

try {
  const normPath = packagedNativePath.replace(/\\/g, '/');
  execSync(
    `npx electron -e "const b = require('${normPath}'); console.log('PACKAGED_ABI_OK', typeof b); process.exit(0);"`,
    {
      cwd: projectRoot,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      encoding: 'utf-8'
    }
  );
  console.log('[Artifact Check] PASS: Packaged better_sqlite3.node is confirmed ABI 125 compatible with Electron 31.4.0.');
} catch (err) {
  console.error('\n=========================================================');
  console.error('[Artifact Check] CRITICAL FAILURE: Packaged better_sqlite3.node ABI DOES NOT MATCH Electron 31.4.0!');
  console.error('The packaged binary will fail on startup in customer environment.');
  console.error('=========================================================\n');
  process.exit(1);
}

// 5. Run packaged application startup smoke test
console.log('\n[Artifact Check] Executing packaged startup smoke test...');
try {
  execSync(`node "${path.join(__dirname, 'smoke-test-packaged-app.js')}"`, {
    cwd: projectRoot,
    stdio: 'inherit'
  });
} catch (err) {
  console.error('[Artifact Check] ERROR: Packaged startup smoke test failed.');
  process.exit(1);
}

console.log('=== RELEASE ARTIFACT & PACKAGED MODULE VERIFICATION PASSED ===\n');
process.exit(0);
