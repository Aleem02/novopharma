import { Database } from "better-sqlite3";
import { Logger } from "../infrastructure/logger";

export class DatabaseIntegrity {
  static check(db: Database): void {
    try {
      Logger.info("Database", "Starting database integrity checks...");

      // 1. PRAGMA integrity_check
      const integrityResult = db.prepare("PRAGMA integrity_check;").get() as {
        integrity_check: string;
      };
      if (integrityResult.integrity_check !== "ok") {
        Logger.error(
          "Database",
          "SQLite PRAGMA integrity_check failed",
          integrityResult,
        );
        throw new Error(
          "Database corruption detected via PRAGMA integrity_check.",
        );
      }

      // 2. PRAGMA foreign_key_check
      const fkResults = db.prepare("PRAGMA foreign_key_check;").all();
      if (fkResults.length > 0) {
        Logger.error("Database", "SQLite PRAGMA foreign_key_check failed", {
          violations: fkResults.length,
        });
        throw new Error("Database relational integrity violation detected.");
      }

      Logger.info("Database", "All integrity checks passed successfully.");
    } catch (error: any) {
      Logger.error("Database", "Integrity check encountered a fatal error", {
        error: error.message,
      });
      throw error;
    }
  }
}
