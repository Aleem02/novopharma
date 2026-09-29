import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BackupManager } from "../main/services/backupService";
import { CloudBackupService } from "../main/services/cloudBackupService";
import { SettingService } from "../main/services/settingService";
import { DatabaseManager } from "../main/database/connection";
import { MigrationRunner } from "../main/database/migrations";
import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn().mockReturnValue(__dirname),
    getAppPath: vi.fn().mockReturnValue(__dirname),
    getVersion: vi.fn().mockReturnValue("1.6.0"),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([{ reload: vi.fn() }]),
  },
}));

vi.mock("../main/infrastructure/logger", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Focused Backup Flow (Single Action & Error Clearing)", () => {
  const testDir = path.join(__dirname, "focused_test_temp");
  const activeDbPath = path.join(testDir, "active.sqlite");
  const backupDir = path.join(testDir, "backups");

  beforeEach(async () => {
    vi.clearAllMocks();

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(backupDir, { recursive: true });

    vi.spyOn(app, "getPath").mockReturnValue(testDir);
    const db = DatabaseManager.initialize(activeDbPath);
    await MigrationRunner.run(db);
    SettingService.initializeDefaults();

    SettingService.setSetting("backup_location", backupDir);
    SettingService.setSetting("backup_cloud_enabled", "true");
  });

  afterEach(() => {
    DatabaseManager.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("1. Single Backup Now action creates exactly ONE backup file and ONE cloud upload", async () => {
    const uploadSpy = vi.spyOn(CloudBackupService, "uploadBackup").mockImplementation(async () => {
      SettingService.setSetting("backup_last_cloud_success", new Date().toISOString());
      SettingService.setSetting("backup_last_cloud_error", "");
      return {
        success: true,
        cloudPath: "backups/NP-000001/NovoPharma_test.sqlite",
      };
    });

    // Inject stale error
    SettingService.setSetting("backup_last_cloud_error", "NETWORK_UNAVAILABLE: Stale error message");

    // Execute single Backup Now action
    await BackupManager.runManualBackup();

    // Verify local backup file created
    const files = fs.readdirSync(backupDir).filter((f) => f.startsWith("NovoPharma_") && f.endsWith(".db"));
    expect(files.length).toBe(1);

    // Verify CloudBackupService.uploadBackup called EXACTLY ONCE
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith(path.join(backupDir, files[0]));

    // Verify stale error was cleared
    expect(SettingService.getSetting("backup_last_cloud_error")).toBe("");
    expect(SettingService.getSetting("backup_last_cloud_success")).toBeDefined();
    expect(SettingService.getSetting("backup_last_cloud_success")?.length).toBeGreaterThan(0);
  });
});
