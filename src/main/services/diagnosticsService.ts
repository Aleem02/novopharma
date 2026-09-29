import { app, dialog, shell } from "electron";
import * as fs from "fs";
import { join, basename } from "path";
import * as os from "os";
import * as crypto from "crypto";
import { Logger } from "../infrastructure/logger";

export interface MigrationDiagnosticDetails {
  attemptId: string;
  appVersion?: string;
  timestamp?: string;
  failedMigrationId?: string | number;
  failedMigrationName?: string;
  stage?: string;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  snapshotStatus?: string;
  snapshotVerificationStatus?: string;
  dbClosedStatus?: string;
  walShmCleanupStatus?: string;
  dbRestorationStatus?: string;
  restoredIntegrityStatus?: string;
  fkCheckStatus?: string;
  finalAction?: string;
}

export class DiagnosticsService {
  private static readonly MAX_LOG_RETENTION = 20;

  /**
   * Returns the directory path where diagnostic logs are stored.
   * Defaults to app.getPath("userData")/logs/ with fallback for unit tests.
   */
  static getLogsDir(): string {
    let baseDir = os.tmpdir();
    try {
      if (app && typeof app.getPath === "function") {
        baseDir = app.getPath("userData");
      }
    } catch {
      /* app not initialized in unit test runners */
    }

    const logsDir = join(baseDir, "logs");
    if (!fs.existsSync(logsDir)) {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
      } catch {
        /* ignore */
      }
    }
    return logsDir;
  }

  /**
   * Generates a unique, human-readable migration attempt ID.
   * Example: MIG-20260928-125600-A7F3
   */
  static generateAttemptId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const secs = String(now.getSeconds()).padStart(2, "0");

    const randomSuffix = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `MIG-${year}${month}${day}-${hours}${mins}${secs}-${randomSuffix}`;
  }

  /**
   * Sanitizes text to remove any potential patient, customer, or transaction data,
   * passwords, SQL data values, tokens, or secret keys.
   */
  static sanitizeText(input: string): string {
    if (!input) return "";

    let sanitized = input;

    // 1. Redact Email addresses
    sanitized = sanitized.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "[REDACTED_EMAIL]",
    );

    // 2. Redact Phone numbers (international and local formats)
    sanitized = sanitized.replace(
      /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      "[REDACTED_PHONE]",
    );

    // 3. Redact SQL INSERT / UPDATE values to prevent database row contents from leaking
    sanitized = sanitized.replace(
      /(VALUES\s*\()[^)]+(\))/gi,
      "$1[REDACTED_SQL_VALUES]$2",
    );
    sanitized = sanitized.replace(
      /(SET\s+)[a-zA-Z0-9_]+\s*=\s*'[^']+'/gi,
      "$1[REDACTED_SQL_SET]",
    );

    // 4. Redact API keys, Bearer tokens, and auth secrets
    sanitized = sanitized.replace(
      /(bearer\s+[a-zA-Z0-9._-]+|key-[a-zA-Z0-9]+|token[=:]\s*[^\s]+)/gi,
      "[REDACTED_SECRET]",
    );

    // 5. Redact Passwords & secrets
    sanitized = sanitized.replace(
      /(password[=:]\s*)[^\s&,]+/gi,
      "$1[REDACTED_PASSWORD]",
    );

    // 6. Redact absolute local user directory names for privacy
    sanitized = sanitized.replace(/C:\\Users\\[^\\]+\\/gi, "C:\\Users\\[USER]\\");
    sanitized = sanitized.replace(/\/home\/[^\/]+\//gi, "/home/[USER]/");
    sanitized = sanitized.replace(/\/Users\/[^\/]+\//gi, "/Users/[USER]/");

    return sanitized;
  }

  /**
   * Formats diagnostic details into a clean, human-readable report string.
   */
  static formatReport(details: MigrationDiagnosticDetails): string {
    const timestamp = details.timestamp || new Date().toISOString().replace("T", " ").substring(0, 19);
    const appVersion = details.appVersion || (app && typeof app.getVersion === "function" ? app.getVersion() : "1.6.0");

    const sanitizedMessage = this.sanitizeText(details.errorMessage || "Unknown migration error");
    const sanitizedStack = this.sanitizeText(details.errorStack || "");

    return `NovoPharma Migration Diagnostic Report
====================================================

Application Version: ${appVersion}
Migration Attempt ID: ${details.attemptId}
Timestamp: ${timestamp}

Migration Details:
  Failed Migration ID: ${details.failedMigrationId ?? "N/A"}
  Migration Name: ${details.failedMigrationName || "N/A"}
  Stage: ${details.stage || "migration_execution"}

Error Details:
  Name: ${details.errorName || "Error"}
  Message: ${sanitizedMessage}
  Stack Trace:
${sanitizedStack ? sanitizedStack.split("\n").map(line => "    " + line).join("\n") : "    (No stack trace available)"}

Recovery Operations:
  Pre-migration snapshot: ${details.snapshotStatus || "SKIPPED"}
  Snapshot verification: ${details.snapshotVerificationStatus || "SKIPPED"}
  Database connection closed: ${details.dbClosedStatus || "NO"}
  WAL/SHM cleanup: ${details.walShmCleanupStatus || "SKIPPED"}
  Database restoration: ${details.dbRestorationStatus || "SKIPPED"}
  Restored database integrity: ${details.restoredIntegrityStatus || "UNKNOWN"}
  Foreign key check: ${details.fkCheckStatus || "UNKNOWN"}

Final Action:
  ${details.finalAction || "Migration aborted. Original database restored. Application exiting safely."}
====================================================
`;
  }

  /**
   * Creates a diagnostic log file in appData/logs/ and enforces retention.
   * Fail-safe: Returns log file path on success or empty string on failure. Never throws.
   */
  static createDiagnosticLog(details: MigrationDiagnosticDetails): string {
    try {
      const logsDir = this.getLogsDir();
      const now = new Date();
      const dateStr = now.toISOString().replace(/T/, "_").replace(/:/g, "-").split(".")[0];
      const fileName = `migration-error-${dateStr}.log`;
      const fullPath = join(logsDir, fileName);

      const reportContent = this.formatReport(details);
      fs.writeFileSync(fullPath, reportContent, "utf8");

      Logger.info("Diagnostics", `Created migration failure diagnostic report at ${fullPath}`);

      // Enforce log retention (keep max 20 diagnostic logs)
      this.enforceRetention(logsDir);

      return fullPath;
    } catch (err: any) {
      Logger.error("Diagnostics", `Failed to create diagnostic log file: ${err.message}`);
      return "";
    }
  }

  /**
   * Returns the path of the most recent diagnostic log file, if any exists.
   */
  static getLatestReportPath(): string | null {
    try {
      const logsDir = this.getLogsDir();
      if (!fs.existsSync(logsDir)) return null;

      const files = fs.readdirSync(logsDir);
      const logFiles = files
        .filter((f) => f.startsWith("migration-error-") && f.endsWith(".log"))
        .map((f) => {
          const fullPath = join(logsDir, f);
          const stats = fs.statSync(fullPath);
          return { file: fullPath, time: stats.mtime.getTime() };
        })
        .sort((a, b) => b.time - a.time);

      return logFiles.length > 0 ? logFiles[0].file : null;
    } catch {
      return null;
    }
  }

  /**
   * Exports a diagnostic report using Electron's native save dialog (if available)
   * or copies to destination path.
   */
  static async exportReport(reportPath?: string, attemptId?: string): Promise<string | null> {
    try {
      const sourceFile = reportPath || this.getLatestReportPath();
      if (!sourceFile || !fs.existsSync(sourceFile)) {
        throw new Error("No diagnostic report found to export.");
      }

      const defaultFileName = `NovoPharma-Diagnostic-${attemptId || "Report"}.log`;

      let destPath: string | undefined;

      if (dialog && typeof dialog.showSaveDialog === "function") {
        const result = await dialog.showSaveDialog({
          title: "Export Migration Diagnostic Report",
          defaultPath: defaultFileName,
          filters: [{ name: "Log Files", extensions: ["log", "txt"] }],
        });

        if (result.canceled || !result.filePath) {
          return null;
        }
        destPath = result.filePath;
      } else {
        destPath = join(os.tmpdir(), defaultFileName);
      }

      const content = fs.readFileSync(sourceFile, "utf8");
      const sanitizedContent = this.sanitizeText(content);
      fs.writeFileSync(destPath, sanitizedContent, "utf8");

      Logger.info("Diagnostics", `Diagnostic report exported to ${destPath}`);
      return destPath;
    } catch (err: any) {
      Logger.error("Diagnostics", `Failed to export diagnostic report: ${err.message}`);
      throw err;
    }
  }

  /**
   * Opens the logs directory using Electron's shell module.
   */
  static async openLogsFolder(): Promise<boolean> {
    try {
      const logsDir = this.getLogsDir();
      if (shell && typeof shell.openPath === "function") {
        await shell.openPath(logsDir);
        return true;
      }
      return false;
    } catch (err: any) {
      Logger.error("Diagnostics", `Failed to open logs folder: ${err.message}`);
      return false;
    }
  }

  /**
   * Shows a user-facing failure message dialog via Electron dialog module,
   * allowing the user to export the diagnostic report or open the logs folder.
   */
  static showFailureDialog(attemptId: string, logFilePath: string): void {
    if (!dialog || typeof dialog.showMessageBoxSync !== "function") {
      return;
    }

    let userSelection = 0;
    while (userSelection === 0 || userSelection === 1) {
      userSelection = dialog.showMessageBoxSync({
        type: "error",
        title: "NovoPharma Update Could Not Be Completed",
        message: "NovoPharma could not complete the database update.\n\nYour existing pharmacy data has been safely restored.\n\nPlease contact NovoPharma support and provide the diagnostic report.",
        detail: `Diagnostic ID: ${attemptId}`,
        buttons: ["Export Diagnostic Report", "Open Logs Folder", "Close"],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      });

      if (userSelection === 0) {
        // Export Diagnostic Report
        try {
          if (dialog.showSaveDialogSync) {
            const destPath = dialog.showSaveDialogSync({
              title: "Export Diagnostic Report",
              defaultPath: `NovoPharma-Diagnostic-${attemptId}.log`,
              filters: [{ name: "Log Files", extensions: ["log"] }],
            });
            if (destPath && fs.existsSync(logFilePath)) {
              const content = fs.readFileSync(logFilePath, "utf8");
              fs.writeFileSync(destPath, this.sanitizeText(content), "utf8");
              dialog.showMessageBoxSync({
                type: "info",
                title: "Report Exported",
                message: `Diagnostic report exported successfully to:\n${destPath}`,
                buttons: ["OK"],
              });
            }
          }
        } catch (exportErr: any) {
          Logger.error("Diagnostics", `Export error in failure dialog: ${exportErr.message}`);
        }
      } else if (userSelection === 1) {
        // Open Logs Folder
        try {
          if (shell && typeof shell.openPath === "function") {
            shell.openPath(this.getLogsDir());
          }
        } catch (shellErr: any) {
          Logger.error("Diagnostics", `Shell open error in failure dialog: ${shellErr.message}`);
        }
      }
    }
  }

  /**
   * Keeps at most MAX_LOG_RETENTION diagnostic log files in the specified logs directory.
   * Deletes ONLY diagnostic log files starting with "migration-error-" and ending with ".log".
   * Never touches database files, snapshots, safety backups, or normal user backups.
   */
  private static enforceRetention(logsDir: string): void {
    try {
      if (!fs.existsSync(logsDir)) return;

      const files = fs.readdirSync(logsDir);
      const diagnosticFiles = files
        .filter((f) => f.startsWith("migration-error-") && f.endsWith(".log"))
        .map((f) => {
          const fullPath = join(logsDir, f);
          const stats = fs.statSync(fullPath);
          return { file: fullPath, time: stats.mtime.getTime() };
        })
        .sort((a, b) => b.time - a.time); // Newest first

      if (diagnosticFiles.length > this.MAX_LOG_RETENTION) {
        const filesToDelete = diagnosticFiles.slice(this.MAX_LOG_RETENTION);
        for (const item of filesToDelete) {
          try {
            fs.unlinkSync(item.file);
            Logger.info("Diagnostics", `Deleted old diagnostic log: ${item.file}`);
          } catch {
            /* ignore unlink error */
          }
        }
      }
    } catch (err: any) {
      Logger.error("Diagnostics", `Failed to enforce diagnostic log retention: ${err.message}`);
    }
  }
}
