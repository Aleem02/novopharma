const { execSync } = require('child_process');
const path = require('path');

console.log('===========================================================');
console.log('=== TESTING RELEASE HARDENING SAFEGUARDS (REQUIREMENT 9) ===');
console.log('===========================================================');

const projectRoot = path.join(__dirname, '..');

// Scenario 1: Incompatible ABI Rejection
console.log('\n--- SCENARIO 1: Incompatible ABI Rejection Test ---');
console.log('Compiling better-sqlite3 for Node runtime (ABI 127)...');
execSync('npm run rebuild:node', { cwd: projectRoot, stdio: 'ignore' });

let scenario1Passed = false;
try {
  console.log('Running verify-electron-abi.js (expecting failure)...');
  execSync('node scripts/verify-electron-abi.js', { cwd: projectRoot, stdio: 'ignore' });
  console.error('FAIL: verify-electron-abi.js did NOT reject Node ABI 127!');
} catch (err) {
  console.log('PASS: verify-electron-abi.js correctly REJECTED Node ABI 127 (Incompatible ABI safeguard verified).');
  scenario1Passed = true;
}

// Scenario 2: Compatible ABI Acceptance
console.log('\n--- SCENARIO 2: Compatible ABI Acceptance Test ---');
console.log('Rebuilding better-sqlite3 for Electron runtime (ABI 125)...');
execSync('npm run rebuild:electron', { cwd: projectRoot, stdio: 'ignore' });

let scenario2Passed = false;
try {
  console.log('Running verify-electron-abi.js (expecting success)...');
  execSync('node scripts/verify-electron-abi.js', { cwd: projectRoot, stdio: 'ignore' });
  console.log('PASS: verify-electron-abi.js ACCEPTED Electron ABI 125.');
  scenario2Passed = true;
} catch (err) {
  console.error('FAIL: verify-electron-abi.js failed on valid Electron ABI 125:', err.message);
}

// Scenario 3: npm test -> npm run build:win pipeline recovery & verification
console.log('\n--- SCENARIO 3: npm test -> npm run build:win Pipeline Recovery Test ---');
console.log('Simulating npm test (compiling better-sqlite3 for Node ABI 127)...');
execSync('npm run rebuild:node', { cwd: projectRoot, stdio: 'ignore' });

let scenario3Passed = false;
try {
  console.log('Executing rebuild:electron & verify-electron-abi.js...');
  execSync('npm run rebuild:electron', { cwd: projectRoot, stdio: 'ignore' });
  execSync('node scripts/verify-electron-abi.js', { cwd: projectRoot, stdio: 'ignore' });
  execSync('node scripts/verify-release-artifacts.js', { cwd: projectRoot, stdio: 'inherit' });
  console.log('PASS: Pipeline successfully restored Electron ABI 125 and verified packaged artifacts!');
  scenario3Passed = true;
} catch (err) {
  console.error('FAIL: Pipeline recovery failed:', err.message);
}

console.log('\n===========================================================');
console.log(`SCENARIO 1 (Incompatible ABI Rejection): ${scenario1Passed ? 'PASS' : 'FAIL'}`);
console.log(`SCENARIO 2 (Compatible ABI Acceptance):  ${scenario2Passed ? 'PASS' : 'FAIL'}`);
console.log(`SCENARIO 3 (npm test -> build recovery): ${scenario3Passed ? 'PASS' : 'FAIL'}`);
console.log('===========================================================');

if (scenario1Passed && scenario2Passed && scenario3Passed) {
  console.log('ALL SAFEGUARD TESTS PASSED SUCCESSFULLY.\n');
  process.exit(0);
} else {
  console.error('SAFEGUARD TESTS FAILED.\n');
  process.exit(1);
}
