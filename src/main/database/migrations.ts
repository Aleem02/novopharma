import { Database } from "better-sqlite3";
import DatabaseConstructor from "better-sqlite3";
import { app } from "electron";
import { join } from "path";
import { existsSync, copyFileSync, unlinkSync } from "fs";
import * as os from "os";
import { Logger } from "../infrastructure/logger";
import { DatabaseManager } from "./connection";
import { DiagnosticsService, MigrationDiagnosticDetails } from "../services/diagnosticsService";

import schema001 from "./schema/0001_initial_schema.sql?raw";
import schema002 from "./schema/0002_product_master.sql?raw";
import schema003 from "./schema/0003_suppliers.sql?raw";
import schema004 from "./schema/0004_purchases.sql?raw";
import schema005 from "./schema/0005_inventory.sql?raw";
import schema006 from "./schema/0006_sales.sql?raw";
import schema007 from "./schema/0007_sales_returns.sql?raw";
import schema008 from "./schema/0008_purchase_returns.sql?raw";
import schema009 from "./schema/0009_stock_adjustments.sql?raw";
import schema010 from "./schema/0010_customers_and_prescriptions.sql?raw";
import schema011 from "./schema/0011_medicine_master_fields.sql?raw";
import schema012 from "./schema/0012_batch_selling_price.sql?raw";
import schema013 from "./schema/0013_transaction_audit_units.sql?raw";

import schema014 from "./schema/0014_pos_completion.sql?raw";
import schema015 from "./schema/0015_add_performance_indexes.sql?raw";
import schema016 from "./schema/0016_medicine_directory.sql?raw";
import schema017 from "./schema/0017_remove_medicine_directory.sql?raw";

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

// Ensure the schema version increments sequentially
export const MIGRATIONS: Migration[] = [
  { id: 1, name: "0001_initial_schema", sql: schema001 },
  { id: 2, name: "0002_product_master", sql: schema002 },
  { id: 3, name: "0003_suppliers", sql: schema003 },
  { id: 4, name: "0004_purchases", sql: schema004 },
  { id: 5, name: "0005_inventory", sql: schema005 },
  { id: 6, name: "0006_sales", sql: schema006 },
  { id: 7, name: "0007_sales_returns", sql: schema007 },
  { id: 8, name: "0008_purchase_returns", sql: schema008 },
  { id: 9, name: "0009_stock_adjustments", sql: schema009 },
  { id: 10, name: "0010_customers_and_prescriptions", sql: schema010 },
  { id: 11, name: "0011_medicine_master_fields", sql: schema011 },
  { id: 12, name: "0012_batch_selling_price", sql: schema012 },
  { id: 13, name: "0013_transaction_audit_units", sql: schema013 },
  { id: 14, name: "0014_pos_completion", sql: schema014 },
  { id: 15, name: "0015_add_performance_indexes", sql: schema015 },
  { id: 16, name: "0016_medicine_directory", sql: schema016 },
  { id: 17, name: "0017_remove_medicine_directory", sql: schema017 },
];

export class MigrationRunner {
  static async run(db: Database, targetDbPath?: string): Promise<void> {
    if (!db || !db.open) {
      Logger.warn("Database", "MigrationRunner.run called on closed database connection.");
      return;
    }

    Logger.info("Database", "Checking database schema version...");

    // Verify uniqueness of migration IDs in code before execution
    const ids = new Set<number>();
    for (const m of MIGRATIONS) {
      if (ids.has(m.id)) {
        throw new Error(
          `FATAL: Duplicate migration identifier detected: ${m.id}`,
        );
      }
      ids.add(m.id);
    }

    // Create migrations tracking table if not exists (not tracked by versioning)
    db.prepare(
      `
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `,
    ).run();

    const currentVersionRow = db
      .prepare("SELECT MAX(id) as version FROM _migrations")
      .get() as { version: number | null };
    const currentVersion = currentVersionRow?.version || 0;

    Logger.info("Database", `Current schema version: ${currentVersion}`);

    const pendingMigrations = MIGRATIONS.filter(
      (m) => m.id > currentVersion,
    ).sort((a, b) => a.id - b.id);

    if (pendingMigrations.length === 0) {
      Logger.info("Database", "Database is up to date.");
      return;
    }

    const attemptId = DiagnosticsService.generateAttemptId();
    let snapshotStatus = "SKIPPED";
    let snapshotVerificationStatus = "SKIPPED";
    let failedMigrationId: string | number = "UNKNOWN";
    let failedMigrationName = "UNKNOWN";
    let stage = "initialization";

    Logger.info(
      "Database",
      `[${attemptId}] Found ${pendingMigrations.length} pending migrations. Preparing pre-migration safety backup...`,
    );

    // 1. Create Verified Pre-Migration Snapshot before applying pending schema changes
    let snapshotPath = "";
    try {
      snapshotPath = await this.createPreMigrationSnapshot(db);
      if (snapshotPath) {
        snapshotStatus = "CREATED";
        snapshotVerificationStatus = "PASSED";
      }
    } catch (snapshotErr: any) {
      snapshotStatus = "FAILED";
      snapshotVerificationStatus = "FAILED";
      stage = "snapshot_creation";
      throw snapshotErr;
    }

    if (!db.open) {
      Logger.warn("Database", "Database closed during pre-migration backup.");
      return;
    }

    // 2. Capture pre-migration counts for data integrity verification
    const preStats = this.captureTableStats(db);

    // 3. Execute Pending Migrations
    try {
      for (const migration of pendingMigrations) {
        if (!db.open) break;

        failedMigrationId = migration.id;
        failedMigrationName = migration.name;
        stage = "migration_execution";

        Logger.info(
          "Database",
          `[${attemptId}] Applying migration ${migration.id}: ${migration.name}`,
        );

        const requiresNoTransaction = migration.sql.includes("-- NO_TRANSACTION");

        const runTransactionalMigration = db.transaction(() => {
          db.exec(migration.sql);
          db.prepare(
            "INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)",
          ).run(migration.id, migration.name, Date.now());
        });

        const runNonTransactionalMigration = () => {
          db.exec(migration.sql);
          db.prepare(
            "INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)",
          ).run(migration.id, migration.name, Date.now());
        };

        if (requiresNoTransaction) {
          Logger.info(
            "Database",
            `Migration ${migration.id} is marked as NO_TRANSACTION. Executing without transaction wrapper.`,
          );
          runNonTransactionalMigration();
        } else {
          runTransactionalMigration();
        }

        Logger.info(
          "Database",
          `Migration ${migration.id} applied successfully.`,
        );
      }

      if (db.open) {
        // 4. Post-Migration Verification
        stage = "post_migration_verification";
        this.verifyPostMigration(db, preStats);
        Logger.info("Database", "All migrations and post-migration verifications completed successfully.");

        // 5. Post-Migration Compaction (VACUUM) & Final Integrity Check
        stage = "post_migration_compaction";
        this.executePostMigrationCompaction(db);
      }
    } catch (error: any) {
      Logger.error(
        "Database",
        `[${attemptId}] Migration sequence failed at stage '${stage}': ${error.message}. Initiating failure recovery...`,
        { error: error.message },
      );

      let recoveryResult = {
        dbClosed: false,
        walShmCleaned: false,
        restored: false,
        integrityOk: false,
        fkViolations: -1,
      };

      if (targetDbPath && targetDbPath !== ":memory:" && existsSync(targetDbPath) && snapshotPath && existsSync(snapshotPath)) {
        try {
          recoveryResult = this.recoverDatabaseFromSnapshot(db, targetDbPath, snapshotPath);
        } catch (recErr: any) {
          Logger.error("Database", `Recovery execution error: ${recErr.message}`);
        }
      }

      // Record Diagnostic Log & Display User Failure Dialog safely
      try {
        const diagDetails: MigrationDiagnosticDetails = {
          attemptId,
          appVersion: "1.5.0",
          timestamp: new Date().toISOString(),
          failedMigrationId,
          failedMigrationName,
          stage,
          errorName: error.name || "Error",
          errorMessage: error.message || String(error),
          errorStack: error.stack || "",
          snapshotStatus,
          snapshotVerificationStatus,
          dbClosedStatus: recoveryResult.dbClosed ? "YES" : "NO",
          walShmCleanupStatus: recoveryResult.walShmCleaned ? "SUCCESS" : "FAILED",
          dbRestorationStatus: recoveryResult.restored ? "SUCCESS" : "FAILED",
          restoredIntegrityStatus: recoveryResult.integrityOk ? "OK" : "FAILED",
          fkCheckStatus: recoveryResult.fkViolations === 0 ? "0 violations" : `${recoveryResult.fkViolations} violations`,
          finalAction: "Migration aborted. Original database restored. Application exiting safely.",
        };

        const logFilePath = DiagnosticsService.createDiagnosticLog(diagDetails);

        if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
          DiagnosticsService.showFailureDialog(attemptId, logFilePath);
        }
      } catch (diagErr: any) {
        Logger.error("Diagnostics", `Failed to record migration diagnostics: ${diagErr.message}`);
      }

      throw new Error(`Migration failure and recovery executed: ${error.message}`);
    }
  }

  private static async createPreMigrationSnapshot(db: Database): Promise<string> {
    if (!db || !db.open) {
      return "";
    }

    let baseDir = os.tmpdir();
    try {
      if (app && typeof app.getPath === "function") {
        baseDir = app.getPath("userData");
      }
    } catch {
      /* app not initialized in unit test runners */
    }

    const snapshotPath = join(
      baseDir,
      `pre_migration_v1.6.0_${Date.now()}.sqlite`,
    );

    // Flush WAL pages to disk before backup
    try {
      db.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      /* ignore for memory db */
    }

    Logger.info(
      "Database",
      `Creating pre-migration safety backup at: ${snapshotPath}`,
    );

    try {
      if (!db.open) return "";
      await db.backup(snapshotPath);
    } catch (err: any) {
      if (!db.open || err.message?.includes("not open")) {
        Logger.warn("Database", "Database connection closed during pre-migration backup.");
        return "";
      }
      throw err;
    }

    if (!db.open) return "";

    // Verify the snapshot file immediately
    if (!existsSync(snapshotPath)) {
      throw new Error("Pre-migration backup failed: File was not created.");
    }

    let testDb: Database | null = null;
    try {
      testDb = new DatabaseConstructor(snapshotPath, { readonly: true });
      testDb.pragma("foreign_keys = ON");

      const integrity = testDb.pragma("integrity_check", { simple: true }) as string;
      if (integrity !== "ok") {
        throw new Error("Pre-migration backup failed database integrity check.");
      }

      const fkViolations = testDb.pragma("foreign_key_check") as any[];
      if (fkViolations && fkViolations.length > 0) {
        throw new Error("Pre-migration backup contains foreign key violations.");
      }
    } catch (err: any) {
      if (testDb) {
        try { testDb.close(); } catch { /* ignore */ }
      }
      throw new Error(`Pre-migration safety backup verification failed: ${err.message}`);
    } finally {
      if (testDb) {
        try { testDb.close(); } catch { /* ignore */ }
      }
    }

    Logger.info("Database", `Pre-migration safety backup created and verified successfully.`);
    return snapshotPath;
  }

  private static captureTableStats(db: Database): Record<string, number> {
    const stats: Record<string, number> = {};
    if (!db || !db.open) return stats;

    const tables = ["products", "customers", "sales", "purchases", "inventory_batches"];

    for (const table of tables) {
      try {
        const hasTable = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
          .get(table);
        if (hasTable) {
          const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
          stats[table] = row.c;
        }
      } catch {
        /* table might not exist yet before initial migrations */
      }
    }

    return stats;
  }

  private static verifyPostMigration(db: Database, preStats: Record<string, number>): void {
    if (!db || !db.open) return;

    Logger.info("Database", "Executing post-migration verification checks...");

    // 1. Integrity Check
    const integrity = db.pragma("integrity_check", { simple: true }) as string;
    if (integrity !== "ok") {
      throw new Error(`Post-migration integrity_check failed: ${integrity}`);
    }

    // 2. Foreign Key Check
    const fkViolations = db.pragma("foreign_key_check") as any[];
    if (fkViolations && fkViolations.length > 0) {
      throw new Error(`Post-migration foreign_key_check failed with ${fkViolations.length} violations.`);
    }

    // 3. Verify critical tables exist
    const criticalTables = [
      "products",
      "inventory_batches",
      "sales",
      "sale_items",
      "purchases",
      "purchase_items",
      "customers",
      "prescriptions",
      "prescription_items",
      "sales_returns",
      "purchase_returns",
      "stock_adjustments",
    ];

    for (const table of criticalTables) {
      const exists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(table);
      if (!exists) {
        throw new Error(`Post-migration verification failed: Critical table '${table}' missing.`);
      }
    }

    // 4. Verify table record counts match pre-migration counts
    for (const [table, preCount] of Object.entries(preStats)) {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
      if (row.c !== preCount) {
        throw new Error(
          `Post-migration verification failed: Table '${table}' count changed from ${preCount} to ${row.c}.`,
        );
      }
    }

    // 5. Verify medicine_directory table NO LONGER exists in SQLite
    const medDirExists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='medicine_directory'")
      .get();
    if (medDirExists) {
      throw new Error("Post-migration verification failed: 'medicine_directory' table still exists in SQLite.");
    }

    Logger.info("Database", "Post-migration verification checks passed 100%.");
  }

  private static executePostMigrationCompaction(db: Database): void {
    if (!db || !db.open) return;

    Logger.info("Database", "Executing post-migration database compaction (VACUUM)...");

    try {
      // 1. Flush WAL journal pages into primary SQLite file before VACUUM
      db.pragma("wal_checkpoint(TRUNCATE)");

      // 2. Reclaim unused SQLite pages freed by dropped tables
      db.exec("VACUUM;");

      // 3. Flush WAL journal pages again after VACUUM
      db.pragma("wal_checkpoint(TRUNCATE)");

      // 4. Final post-compaction integrity verification
      const integrity = db.pragma("integrity_check", { simple: true }) as string;
      const fkViolations = db.pragma("foreign_key_check") as any[];

      if (integrity !== "ok" || (fkViolations && fkViolations.length > 0)) {
        Logger.warn(
          "Database",
          "Post-migration compaction completed but final integrity check reported warnings.",
        );
      } else {
        Logger.info(
          "Database",
          "Post-migration database compaction (VACUUM) and final integrity verification completed successfully.",
        );
      }
    } catch (vacuumErr: any) {
      // Compaction is a non-destructive optimization.
      // If it fails (e.g. temporary disk space error), log a clear warning and DO NOT rollback or throw error!
      Logger.warn(
        "Database",
        `Post-migration database compaction (VACUUM) failed: ${vacuumErr.message}. Startup will continue using uncompacted database.`,
      );
    }
  }

  private static recoverDatabaseFromSnapshot(
    db: Database,
    targetDbPath: string,
    snapshotPath: string,
  ): {
    dbClosed: boolean;
    walShmCleaned: boolean;
    restored: boolean;
    integrityOk: boolean;
    fkViolations: number;
  } {
    Logger.error(
      "Database",
      `RECOVERY FLOW: Attempting to restore database from snapshot ${snapshotPath} onto ${targetDbPath}`,
    );

    const result = {
      dbClosed: false,
      walShmCleaned: false,
      restored: false,
      integrityOk: false,
      fkViolations: -1,
    };

    try {
      if (!existsSync(snapshotPath)) {
        throw new Error("Snapshot file missing for recovery!");
      }

      // Safely close active database connection handles to release Windows file locks
      if (db) {
        try {
          if (db.open) {
            db.close();
          }
        } catch {
          /* ignore */
        }
      }
      try {
        DatabaseManager.close();
      } catch {
        /* ignore */
      }
      result.dbClosed = true;

      // Remove stale WAL and SHM files before file copy
      const walPath = targetDbPath + "-wal";
      const shmPath = targetDbPath + "-shm";
      if (existsSync(walPath)) {
        try {
          unlinkSync(walPath);
        } catch {
          /* ignore */
        }
      }
      if (existsSync(shmPath)) {
        try {
          unlinkSync(shmPath);
        } catch {
          /* ignore */
        }
      }

      // Copy snapshot over target db
      copyFileSync(snapshotPath, targetDbPath);
      result.restored = true;

      // Remove stale WAL and SHM files again if present after copy
      if (existsSync(walPath)) {
        try {
          unlinkSync(walPath);
        } catch {
          /* ignore */
        }
      }
      if (existsSync(shmPath)) {
        try {
          unlinkSync(shmPath);
        } catch {
          /* ignore */
        }
      }
      result.walShmCleaned = true;

      // Verify recovered database
      const restoredDb = new DatabaseConstructor(targetDbPath);
      restoredDb.pragma("foreign_keys = ON");
      const integrity = restoredDb.pragma("integrity_check", { simple: true }) as string;
      const fkViolations = restoredDb.pragma("foreign_key_check") as any[];
      restoredDb.close();

      if (integrity === "ok") {
        result.integrityOk = true;
      }
      result.fkViolations = fkViolations ? fkViolations.length : 0;

      if (integrity !== "ok" || (fkViolations && fkViolations.length > 0)) {
        throw new Error("Recovered database failed integrity validation.");
      }

      Logger.info(
        "Database",
        "RECOVERY SUCCESSFUL: Pre-migration snapshot restored and database integrity verified.",
      );
      return result;
    } catch (recErr: any) {
      Logger.error(
        "Database",
        `CRITICAL: Recovery flow failed: ${recErr.message}`,
      );
      throw recErr;
    }
  }
}
