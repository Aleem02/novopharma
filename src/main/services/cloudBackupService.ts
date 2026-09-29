import {
  getStorage,
  ref,
  uploadBytes,
  uploadString,
  listAll,
  deleteObject,
  getMetadata,
  getBytes,
} from "firebase/storage";
import { FirebaseAuthService } from "./firebaseAuth";
import { InstallationIdentityService } from "../security/installationIdentity";
import { SettingService } from "./settingService";
import { Logger } from "../infrastructure/logger";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import Database from "better-sqlite3";
import { CloudBackupItem, CloudBackupStatus } from "../../shared/types";

export class CloudBackupService {
  private static readonly RETENTION_DAYS = 7;

  /**
   * Calculates the SHA-256 checksum of a local file.
   */
  static async calculateSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);
      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", (err) => reject(err));
    });
  }

  /**
   * Uploads a verified local SQLite backup file to Firebase Storage under tenant-only scope.
   * Path format: backups/{tenantId}/{fileName}
   */
  static async uploadBackup(
    localFilePath: string,
  ): Promise<{ success: boolean; cloudPath?: string; error?: string }> {
    Logger.info("CloudBackup", `Starting cloud backup upload for ${localFilePath}`);

    try {
      if (!fs.existsSync(localFilePath)) {
        throw new Error("LOCAL_FILE_MISSING: Backup file does not exist locally.");
      }

      // 1. Check Firebase Authentication
      if (!(await FirebaseAuthService.isAuthenticated())) {
        const msg = "UNAUTHENTICATED: User is not signed in to Firebase.";
        Logger.warn("CloudBackup", msg);
        SettingService.setSetting("backup_last_cloud_error", msg);
        return { success: false, error: msg };
      }

      // 2. Check Installation Activation
      if (!InstallationIdentityService.isActivated()) {
        const msg = "NOT_ACTIVATED: Installation is not activated.";
        Logger.warn("CloudBackup", msg);
        SettingService.setSetting("backup_last_cloud_error", msg);
        return { success: false, error: msg };
      }

      // 3. Obtain tenantId strictly from Firebase Auth Custom Claims
      const tenantId = await FirebaseAuthService.getTenantId();
      if (!tenantId) {
        const msg = "MISSING_TENANT_ID: Authenticated user lacks an authorized tenantId claim.";
        Logger.error("CloudBackup", msg);
        SettingService.setSetting("backup_last_cloud_error", msg);
        return { success: false, error: msg };
      }

      // Optional local installationId for metadata diagnostics only
      let installationId = "UNKNOWN";
      try {
        const identity = InstallationIdentityService.initializeIdentity();
        if (identity && identity.installationId) {
          installationId = identity.installationId;
        }
      } catch {
        /* optional diagnostic metadata */
      }

      // 4. Calculate SHA-256 checksum of the exact local file
      const sha256 = await this.calculateSha256(localFilePath);

      // 5. Formulate standard cloud object name with .sqlite extension
      let baseName = path.basename(localFilePath);
      if (baseName.endsWith(".db")) {
        baseName = baseName.substring(0, baseName.length - 3) + ".sqlite";
      } else if (!baseName.endsWith(".sqlite")) {
        baseName = `${baseName}.sqlite`;
      }

      // Storage path format: backups/{tenantId}/NovoPharma_YYYY-MM-DD_HH-mm-ss.sqlite (TENANT-ONLY SCOPE)
      const cloudStoragePath = `backups/${tenantId}/${baseName}`;

      // Application version from app.getVersion()
      let appVersion = "1.6.0";
      try {
        if (app && typeof app.getVersion === "function") {
          const ver = app.getVersion();
          if (ver) appVersion = ver;
        }
      } catch {
        /* test fallback */
      }

      const fileBuffer = fs.readFileSync(localFilePath);
      const storage = getStorage(FirebaseAuthService.getApp());
      const fileRef = ref(storage, cloudStoragePath);

      const metadata = {
        contentType: "application/x-sqlite3",
        customMetadata: {
          sha256,
          appVersion,
          installationId,
          tenantId,
          createdAt: new Date().toISOString(),
        },
      };

      Logger.info("CloudBackup", `Uploading to Firebase Storage path: ${cloudStoragePath}`);
      await uploadString(fileRef, fileBuffer.toString("base64"), "base64", metadata);

      // Update cloud success settings
      const nowIso = new Date().toISOString();
      SettingService.setSetting("backup_last_cloud_success", nowIso);
      SettingService.setSetting("backup_last_cloud_error", "");

      Logger.info("CloudBackup", `Cloud backup uploaded successfully to ${cloudStoragePath}`);

      // 6. Execute 7-Calendar-Day Cloud Retention Cleanup (Non-blocking for upload status)
      try {
        await this.enforce7DayRetention(tenantId);
      } catch (cleanupErr: any) {
        Logger.warn(
          "CloudBackup",
          `Retention cleanup warning: ${cleanupErr.message}`,
        );
      }

      return { success: true, cloudPath: cloudStoragePath };
    } catch (err: any) {
      const errorMsg = this.mapStorageError(err);
      Logger.error("CloudBackup", `Upload failed: ${errorMsg}`);
      SettingService.setSetting("backup_last_cloud_error", errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Enforces 7-UTC-calendar-day cloud retention across the ENTIRE tenant.
   * Retains backups created on the current UTC calendar date plus the previous 6 UTC calendar dates (7 UTC calendar dates total).
   * Restricted STRICTLY to backups/{tenantId}/.
   */
  static async enforce7DayRetention(
    tenantId: string,
    referenceDate: Date = new Date(),
  ): Promise<void> {
    try {
      const storage = getStorage(FirebaseAuthService.getApp());
      const dirPath = `backups/${tenantId}/`;
      const dirRef = ref(storage, dirPath);

      const result = await listAll(dirRef);
      if (!result.items || result.items.length === 0) return;

      // Cutoff is midnight UTC of 6 calendar days before current UTC date
      // (Current date + 6 previous days = 7 UTC calendar dates retained total)
      const cutoffUtcMidnight = Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate() - 6,
      );

      for (const itemRef of result.items) {
        try {
          const meta = await getMetadata(itemRef);
          const createdAtStr =
            meta.customMetadata?.createdAt || meta.timeCreated;
          const createdDate = new Date(createdAtStr);
          const createdTime = createdDate.getTime();

          if (!isNaN(createdTime)) {
            const createdUtcMidnight = Date.UTC(
              createdDate.getUTCFullYear(),
              createdDate.getUTCMonth(),
              createdDate.getUTCDate(),
            );

            if (createdUtcMidnight < cutoffUtcMidnight) {
              await deleteObject(itemRef);
              Logger.info(
                "CloudBackup",
                `Deleted cloud backup outside 7 UTC calendar-day window: ${itemRef.fullPath}`,
              );
            }
          }
        } catch (itemErr: any) {
          Logger.warn(
            "CloudBackup",
            `Failed to inspect or delete cloud object ${itemRef.fullPath}: ${itemErr.message}`,
          );
        }
      }
    } catch (err: any) {
      Logger.warn("CloudBackup", `Failed retention cleanup: ${err.message}`);
    }
  }

  /**
   * Lists all cloud backups for the current authenticated tenant across ALL installations.
   */
  static async listCloudBackups(): Promise<CloudBackupItem[]> {
    if (!(await FirebaseAuthService.isAuthenticated())) {
      throw new Error("UNAUTHENTICATED: User is not signed in.");
    }
    const tenantId = await FirebaseAuthService.getTenantId();
    if (!tenantId) {
      throw new Error("MISSING_TENANT_ID: Authenticated user lacks authorized tenantId claim.");
    }

    const storage = getStorage(FirebaseAuthService.getApp());
    const dirRef = ref(storage, `backups/${tenantId}/`);

    const result = await listAll(dirRef);
    const items: CloudBackupItem[] = [];

    for (const itemRef of result.items) {
      try {
        const meta = await getMetadata(itemRef);
        items.push({
          name: meta.name,
          fullPath: meta.fullPath,
          size: meta.size,
          createdAt: meta.customMetadata?.createdAt || meta.timeCreated,
          sha256: meta.customMetadata?.sha256,
          appVersion: meta.customMetadata?.appVersion,
          installationId: meta.customMetadata?.installationId,
          tenantId: meta.customMetadata?.tenantId,
        });
      } catch {
        items.push({
          name: itemRef.name,
          fullPath: itemRef.fullPath,
          size: 0,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Downloads a cloud backup file to a local path and validates SHA-256 and SQLite integrity.
   * Path format: backups/{tenantId}/{fileName}
   */
  static async downloadCloudBackup(
    cloudFileName: string,
    destinationPath: string,
  ): Promise<{ success: boolean; filePath: string }> {
    if (!(await FirebaseAuthService.isAuthenticated())) {
      throw new Error("UNAUTHENTICATED: User is not signed in.");
    }
    const tenantId = await FirebaseAuthService.getTenantId();
    if (!tenantId) {
      throw new Error("MISSING_TENANT_ID: Authenticated user lacks authorized tenantId claim.");
    }

    const fileName = path.basename(cloudFileName);
    const cloudStoragePath = `backups/${tenantId}/${fileName}`;

    const storage = getStorage(FirebaseAuthService.getApp());
    const fileRef = ref(storage, cloudStoragePath);

    Logger.info("CloudBackup", `Downloading cloud backup from ${cloudStoragePath} to ${destinationPath}`);

    // Download bytes & write to destination
    const bytes = await getBytes(fileRef);
    const buffer = Buffer.from(bytes);
    fs.writeFileSync(destinationPath, buffer);

    // 1. Verify SHA-256 Checksum against object metadata
    try {
      const meta = await getMetadata(fileRef);
      const expectedSha256 = meta.customMetadata?.sha256;
      if (expectedSha256) {
        const downloadedSha256 = await this.calculateSha256(destinationPath);
        if (downloadedSha256 !== expectedSha256) {
          if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
          throw new Error("CHECKSUM_MISMATCH: Downloaded file corrupted during transit.");
        }
      }
    } catch (err: any) {
      if (err.message.includes("CHECKSUM_MISMATCH")) throw err;
      Logger.warn("CloudBackup", `Metadata checksum check skipped: ${err.message}`);
    }

    // 2. Validate SQLite Integrity
    let testDb: Database.Database | null = null;
    try {
      testDb = new Database(destinationPath, { readonly: true });
      testDb.pragma("foreign_keys = ON");
      const integrity = testDb.pragma("integrity_check", { simple: true }) as string;
      if (integrity !== "ok") {
        throw new Error("Database integrity check failed on downloaded file.");
      }
      const fkViolations = testDb.pragma("foreign_key_check") as any[];
      if (fkViolations && fkViolations.length > 0) {
        throw new Error("Downloaded backup contains foreign key violations.");
      }
    } catch (dbErr: any) {
      if (testDb) {
        try { testDb.close(); } catch { /* ignore */ }
      }
      if (fs.existsSync(destinationPath)) fs.unlinkSync(destinationPath);
      throw new Error(`INTEGRITY_FAILED: Downloaded cloud backup failed validation (${dbErr.message}).`);
    } finally {
      if (testDb) {
        try { testDb.close(); } catch { /* ignore */ }
      }
    }

    Logger.info("CloudBackup", `Cloud backup downloaded and verified successfully at ${destinationPath}`);
    return { success: true, filePath: destinationPath };
  }

  /**
   * Returns current cloud backup configuration and status.
   */
  static getStatus(): CloudBackupStatus {
    return {
      enabled: SettingService.getSetting("backup_cloud_enabled") === "true",
      lastSuccess: SettingService.getSetting("backup_last_cloud_success"),
      lastError: SettingService.getSetting("backup_last_cloud_error"),
    };
  }

  private static mapStorageError(err: any): string {
    const code = err?.code || "";
    if (code === "storage/unauthorized" || err.message?.includes("unauthorized")) {
      return "PERMISSION_DENIED: Access to cloud storage denied for this tenant.";
    }
    if (code === "storage/canceled") {
      return "UPLOAD_CANCELLED: Cloud upload was cancelled.";
    }
    if (code === "storage/unknown" || err.message?.includes("network")) {
      return "NETWORK_UNAVAILABLE: Network or Firebase Storage is unavailable.";
    }
    return err.message || "An error occurred during cloud backup upload.";
  }
}
