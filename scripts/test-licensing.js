const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEV_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIC5N8VjKNSecgOowXvbNDQXnm/RddZwEXj4jYfC337Ux
-----END PRIVATE KEY-----`;

const appDataPath =
  process.env.APPDATA ||
  (process.platform === "darwin"
    ? process.env.HOME + "/Library/Application Support"
    : process.env.HOME + "/.config");
const identityPath = path.join(appDataPath, "novopharma", "identity.json");

function backupIdentity() {
  if (fs.existsSync(identityPath)) {
    fs.copyFileSync(identityPath, identityPath + ".bak");
  }
}

function restoreIdentity() {
  if (fs.existsSync(identityPath + ".bak")) {
    fs.copyFileSync(identityPath + ".bak", identityPath);
    fs.unlinkSync(identityPath + ".bak");
  }
}

function writeIdentity(data) {
  fs.mkdirSync(path.dirname(identityPath), { recursive: true });
  fs.writeFileSync(identityPath, JSON.stringify(data, null, 2));
}

function generateMockToken(installationId, mutate = null) {
  const payload = {
    installationId: mutate?.installationId || installationId,
    entitlementType: mutate?.entitlementType || "PERMANENT",
    activationTimestamp: Date.now(),
  };
  let payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  if (mutate?.tamperPayload) payloadBase64 += "x";

  let signatureBuffer = crypto.sign(
    undefined,
    Buffer.from(payloadBase64, "utf8"),
    { key: DEV_PRIVATE_KEY, format: "pem", type: "pkcs8" },
  );
  let signatureBase64 = signatureBuffer.toString("base64");
  if (mutate?.tamperSignature) signatureBase64 += "x";

  return JSON.stringify({ payloadBase64, signatureBase64 });
}

async function runTests() {
  console.log("Starting Security Licensing Tests...\n");
  backupIdentity();

  try {
    // Load the actual compiled TS files
    const {
      InstallationIdentityService,
    } = require("../dist/main/security/installationIdentity.js");
    const {
      ActivationService,
    } = require("../dist/main/services/activationService.js");

    let passCount = 0;
    let failCount = 0;

    function assert(condition, testName, expected) {
      if (condition) {
        console.log(`[PASS] ${testName}`);
        passCount++;
      } else {
        console.log(`[FAIL] ${testName} (Expected: ${expected})`);
        failCount++;
      }
    }

    const fakeInstallationId = crypto.randomUUID();
    const baseIdentity = {
      version: 1,
      installationId: fakeInstallationId,
      algorithm: "Ed25519",
      publicKey: "fake_pub",
      createdAt: Date.now(),
      encryptedPrivateKey: "fake_priv",
    };

    // 1. Fresh installation
    writeIdentity(baseIdentity);
    assert(
      !InstallationIdentityService.isActivated(),
      "1. Fresh installation",
      "Unactivated",
    );

    // 4, 18. Existing activated installation (legacy)
    writeIdentity({ ...baseIdentity, isActivated: true });
    assert(
      InstallationIdentityService.isActivated() === true,
      "18. Test existing isActivated=true legacy installation",
      "Activated",
    );

    const migrationState = InstallationIdentityService.getMigrationState();
    assert(
      migrationState.isLegacy === true,
      "4. Existing activated installation enters legacy mode",
      "Legacy=true",
    );

    // 20. Legacy -> successful migration
    // We will mock ApiClient here
    const { ApiClient } = require("../dist/main/services/apiClient.js");
    const originalRequest = ApiClient.request;
    ApiClient.request = async () => {
      return {
        activated: true,
        licenseToken: generateMockToken(fakeInstallationId),
      };
    };
    const {
      FirebaseAuthService,
    } = require("../dist/main/services/firebaseAuth.js");
    FirebaseAuthService.isAuthenticated = async () => true;

    await ActivationService.performLegacyMigration();
    const updatedIdentity = JSON.parse(fs.readFileSync(identityPath, "utf8"));
    assert(
      !!updatedIdentity.licenseToken,
      "20. Legacy installation when internet becomes available",
      "Token fetched and saved",
    );

    // 24, 25. Test application after migration completely offline
    assert(
      InstallationIdentityService.isActivated() === true,
      "24. Test application after migration",
      "Activated",
    );
    assert(
      InstallationIdentityService.getMigrationState().isLegacy === false,
      "25. Test migrated installation completely offline",
      "Legacy=false",
    );

    // 21. Invalid licenseToken
    writeIdentity({ ...baseIdentity, licenseToken: "not-a-json-string" });
    assert(
      !InstallationIdentityService.isActivated(),
      "21. Test invalid licenseToken",
      "Fails",
    );

    // 22. Modified licenseToken (tampered signature)
    writeIdentity({
      ...baseIdentity,
      licenseToken: generateMockToken(fakeInstallationId, {
        tamperSignature: true,
      }),
    });
    assert(
      !InstallationIdentityService.isActivated(),
      "22. Test modified licenseToken",
      "Fails",
    );

    // 23. Wrong installationId
    writeIdentity({
      ...baseIdentity,
      licenseToken: generateMockToken("wrong-id-here"),
    });
    assert(
      !InstallationIdentityService.isActivated(),
      "23. Test wrong installationId",
      "Fails",
    );

    // 19. Legacy without internet
    writeIdentity({ ...baseIdentity, isActivated: true });
    ApiClient.request = async () => {
      throw new Error("NETWORK_UNAVAILABLE");
    };
    await ActivationService.performLegacyMigration();
    const legacyIdentity = JSON.parse(fs.readFileSync(identityPath, "utf8"));
    assert(
      !legacyIdentity.licenseToken && InstallationIdentityService.isActivated(),
      "19. Test legacy installation with no internet",
      "Remains active in legacy mode",
    );

    // Restore
    ApiClient.request = originalRequest;

    console.log(`\nTests Completed: ${passCount} Passed, ${failCount} Failed.`);
  } catch (e) {
    console.error("Test execution failed:", e);
  } finally {
    restoreIdentity();
  }
}

runTests();
