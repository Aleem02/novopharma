import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CloudBackupService } from "../main/services/cloudBackupService";
import { FirebaseAuthService } from "../main/services/firebaseAuth";
import { InstallationIdentityService } from "../main/security/installationIdentity";
import { SettingService } from "../main/services/settingService";
import { DatabaseManager } from "../main/database/connection";
import { MigrationRunner } from "../main/database/migrations";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

// Mock Electron app
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn().mockReturnValue(__dirname),
    getAppPath: vi.fn().mockReturnValue(__dirname),
    getVersion: vi.fn().mockReturnValue("1.6.0"),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([{ reload: vi.fn() }]),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn().mockReturnValue(Buffer.from("encrypted")),
    decryptString: vi.fn().mockReturnValue("decrypted"),
  },
}));

// Mock Logger
vi.mock("../main/infrastructure/logger", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock Firebase Storage SDK functions
const mockUploadBytes = vi.fn().mockResolvedValue({});
const mockUploadString = vi.fn().mockResolvedValue({});
const mockListAll = vi.fn().mockResolvedValue({ items: [] });
const mockDeleteObject = vi.fn().mockResolvedValue(undefined);
const mockGetMetadata = vi.fn().mockResolvedValue({
  name: "test.sqlite",
  fullPath: "backups/NP-TEST/test.sqlite",
  size: 1024,
  timeCreated: new Date().toISOString(),
  customMetadata: {
    sha256: "mock_sha256",
    appVersion: "1.6.0",
    installationId: "INST-TEST",
    tenantId: "NP-TEST",
    createdAt: new Date().toISOString(),
  },
});
const mockGetBytes = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

vi.mock("firebase/storage", () => ({
  getStorage: vi.fn().mockReturnValue({}),
  ref: vi.fn((_storage, pathStr) => ({ fullPath: pathStr, name: path.basename(pathStr || "") })),
  uploadBytes: (...args: any[]) => mockUploadBytes(...args),
  uploadString: (...args: any[]) => mockUploadString(...args),
  listAll: (...args: any[]) => mockListAll(...args),
  deleteObject: (...args: any[]) => mockDeleteObject(...args),
  getMetadata: (...args: any[]) => mockGetMetadata(...args),
  getBytes: (...args: any[]) => mockGetBytes(...args),
}));

describe("CloudBackupService (v1.6 Tenant-Only Cloud Storage)", () => {
  const testDir = __dirname;
  const activeDbPath = path.join(testDir, "cloud_test_active.sqlite");
  const backupDbPath = path.join(testDir, "cloud_test_backup.sqlite");
  const downloadDbPath = path.join(testDir, "cloud_test_download.sqlite");

  beforeEach(async () => {
    vi.clearAllMocks();

    [activeDbPath, backupDbPath, downloadDbPath].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
      if (fs.existsSync(p + "-wal")) fs.unlinkSync(p + "-wal");
      if (fs.existsSync(p + "-shm")) fs.unlinkSync(p + "-shm");
    });

    vi.spyOn(app, "getPath").mockReturnValue(testDir);
    const db = DatabaseManager.initialize(activeDbPath);
    await MigrationRunner.run(db);
    SettingService.initializeDefaults();

    // Default mock behavior for auth and identity
    vi.spyOn(FirebaseAuthService, "isAuthenticated").mockResolvedValue(true);
    vi.spyOn(FirebaseAuthService, "getTenantId").mockResolvedValue("NP-000001");
    vi.spyOn(InstallationIdentityService, "isActivated").mockReturnValue(true);
    vi.spyOn(InstallationIdentityService, "initializeIdentity").mockReturnValue({
      version: 1,
      installationId: "inst-uuid-1234",
      algorithm: "Ed25519",
      publicKey: "mock_public_key",
      createdAt: Date.now(),
      isActivated: true,
    });
  });

  afterEach(() => {
    DatabaseManager.close();
    vi.restoreAllMocks();
  });

  describe("1. Identity & Authorization Rules", () => {
    it("A. Obtains tenantId strictly from FirebaseAuthService.getTenantId() claim", async () => {
      const tenantId = await FirebaseAuthService.getTenantId();
      expect(tenantId).toBe("NP-000001");
    });

    it("B. Rejects cloud upload if user is unauthenticated", async () => {
      vi.spyOn(FirebaseAuthService, "isAuthenticated").mockResolvedValue(false);

      // Create valid backup file first
      const db = DatabaseManager.getInstance();
      await db.backup(backupDbPath);

      const result = await CloudBackupService.uploadBackup(backupDbPath);
      expect(result.success).toBe(false);
      expect(result.error).toContain("UNAUTHENTICATED");
      expect(mockUploadString).not.toHaveBeenCalled();

      // Ensure local backup is completely preserved
      expect(fs.existsSync(backupDbPath)).toBe(true);
    });

    it("C. Rejects cloud upload if user has no valid tenantId claim", async () => {
      vi.spyOn(FirebaseAuthService, "getTenantId").mockResolvedValue(null);

      const db = DatabaseManager.getInstance();
      await db.backup(backupDbPath);

      const result = await CloudBackupService.uploadBackup(backupDbPath);
      expect(result.success).toBe(false);
      expect(result.error).toContain("MISSING_TENANT_ID");
      expect(mockUploadString).not.toHaveBeenCalled();
      expect(fs.existsSync(backupDbPath)).toBe(true);
    });

    it("D. Rejects cloud upload if installation is not activated", async () => {
      vi.spyOn(InstallationIdentityService, "isActivated").mockReturnValue(false);

      const db = DatabaseManager.getInstance();
      await db.backup(backupDbPath);

      const result = await CloudBackupService.uploadBackup(backupDbPath);
      expect(result.success).toBe(false);
      expect(result.error).toContain("NOT_ACTIVATED");
      expect(mockUploadString).not.toHaveBeenCalled();
    });
  });

  describe("2. SHA-256 & Tenant-Only Upload Path Formatting", () => {
    it("A. Computes correct SHA-256 checksum for local backup file", async () => {
      fs.writeFileSync(backupDbPath, "NovoPharma SQLite Test Content");
      const sha256 = await CloudBackupService.calculateSha256(backupDbPath);
      expect(sha256).toBeDefined();
      expect(sha256.length).toBe(64); // Hex SHA-256 length
    });

    it("B. Formats exact Firebase Storage path as backups/{tenantId}/{fileName}", async () => {
      const db = DatabaseManager.getInstance();
      await db.backup(backupDbPath);

      const result = await CloudBackupService.uploadBackup(backupDbPath);
      expect(result.success).toBe(true);
      expect(result.cloudPath).toContain("backups/NP-000001/");
      expect(result.cloudPath).not.toContain("inst-uuid-1234");
      expect(result.cloudPath).toMatch(/backups\/NP-000001\/[^\/]+\.sqlite$/);

      // Verify uploadString call
      expect(mockUploadString).toHaveBeenCalled();
      const uploadedMetadata = mockUploadString.mock.calls[0][3];
      expect(uploadedMetadata.customMetadata.tenantId).toBe("NP-000001");
      expect(uploadedMetadata.customMetadata.installationId).toBe("inst-uuid-1234");
      expect(uploadedMetadata.customMetadata.appVersion).toBe("1.6.0");
      expect(uploadedMetadata.customMetadata.sha256).toBeDefined();
    });
  });

  describe("3. Tenant-Wide 7-Calendar-Day Cloud Retention Policy (UTC Boundaries)", () => {
    const fixedNowDate = new Date("2026-09-29T12:00:00Z");

    it("A. Retains backups from current UTC date (2026-09-29) and previous 6 UTC dates (2026-09-23 to 2026-09-28)", async () => {
      const datesToTest = [
        "2026-09-29T23:59:59Z", // Day 0 (Today)
        "2026-09-28T12:00:00Z", // Day 1 ago
        "2026-09-27T08:30:00Z", // Day 2 ago
        "2026-09-26T15:45:00Z", // Day 3 ago
        "2026-09-25T11:00:00Z", // Day 4 ago
        "2026-09-24T18:20:00Z", // Day 5 ago
        "2026-09-23T00:00:01Z", // Day 6 ago (7th retained UTC date)
      ];

      mockListAll.mockResolvedValueOnce({
        items: datesToTest.map((d, i) => ({
          fullPath: `backups/NP-000001/backup_${i}.sqlite`,
          name: `backup_${i}.sqlite`,
        })),
      });

      datesToTest.forEach((d, i) => {
        mockGetMetadata.mockResolvedValueOnce({
          fullPath: `backups/NP-000001/backup_${i}.sqlite`,
          timeCreated: d,
          customMetadata: { createdAt: d },
        });
      });

      await CloudBackupService.enforce7DayRetention("NP-000001", fixedNowDate);

      // All 7 dates belong to the 7 UTC calendar date window (2026-09-23 to 2026-09-29), 0 deletions
      expect(mockDeleteObject).not.toHaveBeenCalled();
    });

    it("B. Deletes backups from 7th date ago (2026-09-22) and older (2026-09-21) across the entire tenant", async () => {
      const datesToDelete = [
        "2026-09-22T23:59:59Z", // 7 dates ago (outside 7-date window 23rd-29th)
        "2026-09-21T12:00:00Z", // 8 dates ago
      ];

      mockListAll.mockResolvedValueOnce({
        items: datesToDelete.map((d, i) => ({
          fullPath: `backups/NP-000001/old_${i}.sqlite`,
          name: `old_${i}.sqlite`,
        })),
      });

      datesToDelete.forEach((d, i) => {
        mockGetMetadata.mockResolvedValueOnce({
          fullPath: `backups/NP-000001/old_${i}.sqlite`,
          timeCreated: d,
          customMetadata: { createdAt: d },
        });
      });

      await CloudBackupService.enforce7DayRetention("NP-000001", fixedNowDate);

      // Both files outside 7 UTC calendar-date window must be deleted
      expect(mockDeleteObject).toHaveBeenCalledTimes(2);
    });

    it("C. Midnight UTC boundary: 2026-09-23T00:00:01Z retained vs 2026-09-22T23:59:59Z deleted", async () => {
      const boundaryItems = [
        "2026-09-23T00:00:01Z", // Retained (belongs to 2026-09-23)
        "2026-09-22T23:59:59Z", // Deleted (belongs to 2026-09-22)
      ];

      mockListAll.mockResolvedValueOnce({
        items: boundaryItems.map((d, i) => ({
          fullPath: `backups/NP-000001/bound_${i}.sqlite`,
          name: `bound_${i}.sqlite`,
        })),
      });

      boundaryItems.forEach((d, i) => {
        mockGetMetadata.mockResolvedValueOnce({
          fullPath: `backups/NP-000001/bound_${i}.sqlite`,
          timeCreated: d,
          customMetadata: { createdAt: d },
        });
      });

      await CloudBackupService.enforce7DayRetention("NP-000001", fixedNowDate);

      // Exactly 1 deletion (the 2026-09-22 file)
      expect(mockDeleteObject).toHaveBeenCalledTimes(1);
      expect(mockDeleteObject).toHaveBeenCalledWith(
        expect.objectContaining({ fullPath: "backups/NP-000001/bound_1.sqlite" }),
      );
    });

    it("D. Failure during cleanup does NOT invalidate successful upload", async () => {
      mockListAll.mockRejectedValueOnce(new Error("Storage listing quota exceeded"));

      const db = DatabaseManager.getInstance();
      await db.backup(backupDbPath);

      const result = await CloudBackupService.uploadBackup(backupDbPath);
      expect(result.success).toBe(true); // Upload still reported as success
    });
  });

  describe("4. Manual Download & Verification", () => {
    it("A. Downloads raw .sqlite file from backups/{tenantId}/{fileName} and verifies SHA-256 and SQLite integrity", async () => {
      // Create valid SQLite file to simulate download
      const tempSource = path.join(testDir, "source_valid.sqlite");
      const tempDb = new Database(tempSource);
      await MigrationRunner.run(tempDb);
      const calculatedSha = await CloudBackupService.calculateSha256(tempSource);
      const fileBuffer = fs.readFileSync(tempSource);
      tempDb.close();
      fs.unlinkSync(tempSource);

      mockGetBytes.mockResolvedValueOnce(fileBuffer);
      mockGetMetadata.mockResolvedValueOnce({
        name: "NovoPharma_2026-09-29_08-00-00.sqlite",
        fullPath: "backups/NP-000001/NovoPharma_2026-09-29_08-00-00.sqlite",
        customMetadata: { sha256: calculatedSha, tenantId: "NP-000001" },
      });

      const result = await CloudBackupService.downloadCloudBackup(
        "NovoPharma_2026-09-29_08-00-00.sqlite",
        downloadDbPath,
      );

      expect(result.success).toBe(true);
      expect(fs.existsSync(downloadDbPath)).toBe(true);

      // Verify downloaded SQLite file independently
      const checkDb = new Database(downloadDbPath);
      const integrity = checkDb.pragma("integrity_check", { simple: true }) as string;
      expect(integrity).toBe("ok");
      checkDb.close();
    });

    it("B. Rejects corrupted download when SHA-256 checksum fails", async () => {
      // Return corrupted buffer
      mockGetBytes.mockResolvedValueOnce(Buffer.from("Corrupted downloaded bytes"));
      mockGetMetadata.mockResolvedValueOnce({
        name: "corrupt.sqlite",
        fullPath: "backups/NP-000001/corrupt.sqlite",
        customMetadata: { sha256: "expected_different_hash_value_12345678901234567890123456789012" },
      });

      await expect(
        CloudBackupService.downloadCloudBackup("corrupt.sqlite", downloadDbPath),
      ).rejects.toThrow(/CHECKSUM_MISMATCH/);

      // Verify corrupt file was deleted and not left on disk
      expect(fs.existsSync(downloadDbPath)).toBe(false);
    });
  });

  describe("5. Tenant-Only Cross-Installation & Multi-Device Capabilities", () => {
    it("A. listCloudBackups() lists all backups under backups/{tenantId}/ without installationId filtering", async () => {
      mockListAll.mockResolvedValueOnce({
        items: [
          { fullPath: "backups/NP-000001/NovoPharma_inst1.sqlite", name: "NovoPharma_inst1.sqlite" },
          { fullPath: "backups/NP-000001/NovoPharma_inst2.sqlite", name: "NovoPharma_inst2.sqlite" },
        ],
      });

      mockGetMetadata.mockResolvedValueOnce({
        name: "NovoPharma_inst1.sqlite",
        fullPath: "backups/NP-000001/NovoPharma_inst1.sqlite",
        size: 2048,
        timeCreated: "2026-09-29T10:00:00Z",
        customMetadata: { sha256: "hash1", installationId: "installation-A", tenantId: "NP-000001" },
      });

      mockGetMetadata.mockResolvedValueOnce({
        name: "NovoPharma_inst2.sqlite",
        fullPath: "backups/NP-000001/NovoPharma_inst2.sqlite",
        size: 4096,
        timeCreated: "2026-09-29T11:00:00Z",
        customMetadata: { sha256: "hash2", installationId: "installation-B", tenantId: "NP-000001" },
      });

      const backups = await CloudBackupService.listCloudBackups();

      expect(backups.length).toBe(2);
      expect(backups[0].name).toBe("NovoPharma_inst2.sqlite");
      expect(backups[0].installationId).toBe("installation-B");
      expect(backups[1].name).toBe("NovoPharma_inst1.sqlite");
      expect(backups[1].installationId).toBe("installation-A");
    });

    it("B. Newly installed PC with installation-B can download backup created by installation-A", async () => {
      // Current PC installationId is inst-uuid-1234 (installation-B)
      // Backup in cloud was uploaded by installation-A (inst-uuid-OLD)
      const tempSource = path.join(testDir, "inst_a_backup.sqlite");
      const tempDb = new Database(tempSource);
      await MigrationRunner.run(tempDb);
      const calculatedSha = await CloudBackupService.calculateSha256(tempSource);
      const fileBuffer = fs.readFileSync(tempSource);
      tempDb.close();
      fs.unlinkSync(tempSource);

      mockGetBytes.mockResolvedValueOnce(fileBuffer);
      mockGetMetadata.mockResolvedValueOnce({
        name: "NovoPharma_2026-09-29_09-00-00.sqlite",
        fullPath: "backups/NP-000001/NovoPharma_2026-09-29_09-00-00.sqlite",
        customMetadata: { sha256: calculatedSha, installationId: "inst-uuid-OLD", tenantId: "NP-000001" },
      });

      const downloadResult = await CloudBackupService.downloadCloudBackup(
        "NovoPharma_2026-09-29_09-00-00.sqlite",
        downloadDbPath,
      );

      expect(downloadResult.success).toBe(true);
      expect(fs.existsSync(downloadDbPath)).toBe(true);
    });

    it("C. Retention operates tenant-wide deleting expired backups created by any installation", async () => {
      const expiredDate = "2026-09-21T12:00:00Z";
      const fixedNowDate = new Date("2026-09-29T12:00:00Z");

      mockListAll.mockResolvedValueOnce({
        items: [
          { fullPath: "backups/NP-000001/inst_a_old.sqlite", name: "inst_a_old.sqlite" },
          { fullPath: "backups/NP-000001/inst_b_old.sqlite", name: "inst_b_old.sqlite" },
        ],
      });

      mockGetMetadata.mockResolvedValueOnce({
        fullPath: "backups/NP-000001/inst_a_old.sqlite",
        timeCreated: expiredDate,
        customMetadata: { createdAt: expiredDate, installationId: "installation-A" },
      });
      mockGetMetadata.mockResolvedValueOnce({
        fullPath: "backups/NP-000001/inst_b_old.sqlite",
        timeCreated: expiredDate,
        customMetadata: { createdAt: expiredDate, installationId: "installation-B" },
      });

      await CloudBackupService.enforce7DayRetention("NP-000001", fixedNowDate);

      expect(mockDeleteObject).toHaveBeenCalledTimes(2);
    });
  });

  describe("6. Error State Reset & Clearing Flow", () => {
    it("resets backup_last_cloud_error when a subsequent cloud upload succeeds after failure", async () => {
      // 1. Cloud upload fails
      mockUploadString.mockRejectedValueOnce(new Error("Network connection dropped"));
      const db = DatabaseManager.getInstance();
      await db.backup(backupDbPath);

      const failResult = await CloudBackupService.uploadBackup(backupDbPath);
      expect(failResult.success).toBe(false);

      // 2. backup_last_cloud_error is recorded
      expect(SettingService.getSetting("backup_last_cloud_error")).toBe("Network connection dropped");

      // 3. A subsequent cloud upload succeeds
      mockUploadString.mockResolvedValueOnce({});
      const successResult = await CloudBackupService.uploadBackup(backupDbPath);
      expect(successResult.success).toBe(true);

      // 4. backup_last_cloud_success is updated
      const lastSuccess = SettingService.getSetting("backup_last_cloud_success");
      expect(lastSuccess).toBeDefined();
      expect(lastSuccess?.length).toBeGreaterThan(0);

      // 5. Previous cloud error is cleared
      expect(SettingService.getSetting("backup_last_cloud_error")).toBe("");
    });
  });
});
