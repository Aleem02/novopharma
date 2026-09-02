import { autoUpdater, UpdateCheckResult } from "electron-updater";
import { BrowserWindow, app } from "electron";
import { Logger } from "../infrastructure/logger";
import { DatabaseManager } from "../database/connection";
import { BackupService } from "./backupService";
import * as path from "path";
import * as fs from "fs";
import Database from "better-sqlite3";

export type UpdateState =
  | "IDLE"
  | "CHECKING"
  | "UP_TO_DATE"
  | "UPDATE_AVAILABLE"
  | "DOWNLOADING"
  | "DOWNLOADED"
  | "INSTALLING"
  | "ERROR";

export class UpdateService {
  private static currentState: UpdateState = "IDLE";
  private static updateReady: boolean = false;
  private static backupInProgress: boolean = false;
  private static isManual: boolean = false;
  private static downloadedVersion: string = "";
  private static readonly restartDelayMs: number = 2500;

  // Throttling properties for download progress
  private static lastProgressTime = 0;
  private static lastProgressPercent = -1;

  static initialize() {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    // Avoid duplicate checks during development
    if (!app.isPackaged) {
      Logger.info("UpdateService", "Updates are disabled in development mode.");
      return;
    }

    autoUpdater.on("checking-for-update", () => {
      this.setState("CHECKING");
    });

    autoUpdater.on("update-available", (info) => {
      this.setState("UPDATE_AVAILABLE", {
        version: info.version,
        currentVersion: app.getVersion(),
      });
      Logger.info("UpdateService", `Update available: ${info.version}`);
    });

    autoUpdater.on("update-not-available", () => {
      this.setState("UP_TO_DATE", {
        currentVersion: app.getVersion(),
      });
      Logger.info("UpdateService", "No update available.");
    });

    autoUpdater.on("download-progress", (progress) => {
      const now = Date.now();
      const percent = Math.round(progress.percent);

      // Throttle IPC state changes to avoid clogging UI thread
      if (
        percent !== this.lastProgressPercent &&
        (percent - this.lastProgressPercent >= 1 ||
          now - this.lastProgressTime >= 500)
      ) {
        this.lastProgressPercent = percent;
        this.lastProgressTime = now;

        const mbTransferred = (progress.transferred / (1024 * 1024)).toFixed(2);
        const mbTotal = (progress.total / (1024 * 1024)).toFixed(2);
        const speedMb = (progress.bytesPerSecond / (1024 * 1024)).toFixed(2);

        this.setState("DOWNLOADING", {
          version: this.downloadedVersion || "Update",
          percent,
          transferred: mbTransferred,
          total: mbTotal,
          speed: speedMb,
        });
      }
    });

    autoUpdater.on("update-downloaded", (info) => {
      this.updateReady = true;
      this.downloadedVersion = info.version;
      this.setState("DOWNLOADED", { version: info.version });
      Logger.info("UpdateService", `Update downloaded: ${info.version}`);

      // Automatically restart and install after a brief user-visible delay
      setTimeout(() => {
        this.applyUpdate().catch((err) => {
          Logger.error("UpdateService", `Auto install failed: ${err.message}`);
        });
      }, this.restartDelayMs);
    });

    autoUpdater.on("error", (err) => {
      Logger.error("UpdateService", `Update error: ${err.message}`);

      const errStr = err.message || "";
      const isNetworkError =
        errStr.includes("net::") ||
        errStr.includes("ENOTFOUND") ||
        errStr.includes("EAI_AGAIN") ||
        errStr.includes("offline");

      if (!this.isManual && isNetworkError) {
        Logger.info(
          "UpdateService",
          "Suppressing background update check error due to offline/network status.",
        );
        this.setState("IDLE");
      } else {
        this.setState("ERROR", {
          message: isNetworkError
            ? "Network connection unavailable."
            : "Failed to download or apply update.",
        });
      }
    });

    // Check for updates on startup
    setTimeout(() => {
      this.checkForUpdates(false);
    }, 10000); // Delay by 10s to let app initialize smoothly
  }

  static async checkForUpdates(
    isManual = false,
  ): Promise<UpdateCheckResult | null> {
    if (!app.isPackaged) {
      // Simulate state transition in dev mode if manually requested
      if (isManual) {
        this.setState("UP_TO_DATE", { currentVersion: app.getVersion() });
      }
      return null;
    }

    if (
      this.currentState === "CHECKING" ||
      this.currentState === "DOWNLOADING" ||
      this.currentState === "DOWNLOADED"
    ) {
      return null;
    }

    this.isManual = isManual;
    this.setState("CHECKING");

    try {
      return await autoUpdater.checkForUpdates();
    } catch (err: any) {
      Logger.error(
        "UpdateService",
        `Failed to check for updates: ${err.message}`,
      );
      const isNetworkError =
        err.message.includes("net::") ||
        err.message.includes("ENOTFOUND") ||
        err.message.includes("EAI_AGAIN") ||
        err.message.includes("offline");

      if (!this.isManual && isNetworkError) {
        this.setState("IDLE");
      } else {
        this.setState("ERROR", {
          message: isNetworkError
            ? "Network connection unavailable."
            : "Failed to check for updates.",
        });
      }
      return null;
    }
  }

  static async downloadUpdate(): Promise<any> {
    if (!app.isPackaged) {
      return null;
    }

    if (
      this.currentState === "DOWNLOADING" ||
      this.currentState === "DOWNLOADED"
    ) {
      return null;
    }

    try {
      Logger.info("UpdateService", "Starting manual update download...");
      this.lastProgressPercent = -1;
      this.lastProgressTime = 0;
      this.setState("DOWNLOADING", { percent: 0 });
      return await autoUpdater.downloadUpdate();
    } catch (err: any) {
      Logger.error("UpdateService", `Failed to start download: ${err.message}`);
      this.setState("ERROR", { message: "Failed to start download." });
      return null;
    }
  }

  static async applyUpdate(): Promise<boolean> {
    if (!this.updateReady) {
      Logger.error(
        "UpdateService",
        "Attempted to apply update but none is downloaded.",
      );
      throw new Error("No update is ready to install.");
    }

    if (this.backupInProgress) {
      throw new Error("Update preparation is already in progress.");
    }

    this.backupInProgress = true;
    this.setState("INSTALLING", { version: this.downloadedVersion });

    try {
      // 1. Verify no active transactions
      const db = DatabaseManager.getInstance();
      if (db.inTransaction) {
        throw new Error(
          "Active database transaction prevents safe update. Please complete your current action.",
        );
      }

      // 2. Create safety backup
      const userDataPath = app.getPath("userData");
      const backupsDir = path.join(userDataPath, "update_safety_backups");

      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }

      const backupFilename = `safety_backup_pre_update_${Date.now()}.sqlite`;
      const backupPath = path.join(backupsDir, backupFilename);

      await BackupService.createBackup(backupPath);

      // 3. Verify backup integrity
      if (!fs.existsSync(backupPath)) {
        throw new Error("Backup file was not created successfully.");
      }

      let testDb: Database.Database | null = null;
      try {
        testDb = new Database(backupPath, { readonly: true });
        testDb.pragma("foreign_keys = ON");

        const integrity = testDb.pragma("integrity_check", {
          simple: true,
        }) as string;
        if (integrity !== "ok") {
          throw new Error("Backup database integrity check failed.");
        }

        const fkViolations = testDb.pragma("foreign_key_check") as any[];
        if (fkViolations && fkViolations.length > 0) {
          throw new Error("Backup database contains foreign key violations.");
        }
      } catch (err: any) {
        throw new Error(`Invalid backup snapshot: ${err.message}`);
      } finally {
        if (testDb) testDb.close();
      }

      Logger.info(
        "UpdateService",
        `Safety backup created and verified at ${backupPath}. Proceeding with update.`,
      );

      // 4. Install update
      autoUpdater.quitAndInstall(false, true);
      return true;
    } catch (err: any) {
      this.backupInProgress = false;
      Logger.error("UpdateService", `Failed to apply update: ${err.message}`);
      this.setState("ERROR", {
        message: err.message || "Failed to install update.",
      });
      throw err;
    }
  }

  private static setState(state: UpdateState, payload?: any) {
    this.currentState = state;
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("api:update:onStateChange", { state, ...payload });
    });
  }

  static getCurrentState(): UpdateState {
    return this.currentState;
  }
}
