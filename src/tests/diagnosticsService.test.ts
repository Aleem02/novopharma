// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DiagnosticsService } from "../main/services/diagnosticsService";
import { MigrationRunner, MIGRATIONS } from "../main/database/migrations";
import { DatabaseManager } from "../main/database/connection";
import DatabaseConstructor, { Database } from "better-sqlite3";
import * as fs from "fs";
import { join } from "path";
import * as os from "os";

describe("v1.5.0 Migration Diagnostics Service", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(join(os.tmpdir(), "novo_diag_test_"));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it("1. generates a valid, unique, human-readable migration attempt ID", () => {
    const id1 = DiagnosticsService.generateAttemptId();
    const id2 = DiagnosticsService.generateAttemptId();

    expect(id1).toMatch(/^MIG-\d{8}-\d{6}-[A-F0-9]{4}$/);
    expect(id2).toMatch(/^MIG-\d{8}-\d{6}-[A-F0-9]{4}$/);
    expect(id1).not.toBe(id2);
  });

  it("2. sanitizes sensitive customer, SQL, password, email, and path data", () => {
    const rawText = `User john@clinic.com with phone +1-555-123-4567 ran query: INSERT INTO customers (name, phone, email) VALUES ('John Doe', '+1-555-123-4567', 'john@clinic.com') with password=SecretPassword123 and token=bearer ABC123XYZ in C:\\Users\\Administrator\\AppData\\Roaming\\novopharma`;

    const sanitized = DiagnosticsService.sanitizeText(rawText);

    expect(sanitized).not.toContain("john@clinic.com");
    expect(sanitized).not.toContain("+1-555-123-4567");
    expect(sanitized).not.toContain("SecretPassword123");
    expect(sanitized).not.toContain("'John Doe'");
    expect(sanitized).not.toContain("C:\\Users\\Administrator\\");

    expect(sanitized).toContain("[REDACTED_EMAIL]");
    expect(sanitized).toContain("[REDACTED_PHONE]");
    expect(sanitized).toContain("[REDACTED_SQL_VALUES]");
    expect(sanitized).toContain("[REDACTED_PASSWORD]");
    expect(sanitized).toContain("C:\\Users\\[USER]\\");
  });

  it("3. formats technical diagnostic report correctly", () => {
    const report = DiagnosticsService.formatReport({
      attemptId: "MIG-20260928-120000-TEST",
      appVersion: "1.5.0",
      timestamp: "2026-09-28 12:00:00",
      failedMigrationId: 17,
      failedMigrationName: "remove_medicine_directory",
      stage: "migration_execution",
      errorName: "SqliteError",
      errorMessage: "near 'INVALID_SQL': syntax error",
      errorStack: "SqliteError: near 'INVALID_SQL': syntax error\n  at db.exec",
      snapshotStatus: "CREATED",
      snapshotVerificationStatus: "PASSED",
      dbClosedStatus: "YES",
      walShmCleanupStatus: "SUCCESS",
      dbRestorationStatus: "SUCCESS",
      restoredIntegrityStatus: "OK",
      fkCheckStatus: "0 violations",
      finalAction: "Migration aborted. Original database restored.",
    });

    expect(report).toContain("Application Version: 1.5.0");
    expect(report).toContain("Migration Attempt ID: MIG-20260928-120000-TEST");
    expect(report).toContain("Failed Migration ID: 17");
    expect(report).toContain("Migration Name: remove_medicine_directory");
    expect(report).toContain("Stage: migration_execution");
    expect(report).toContain("Pre-migration snapshot: CREATED");
    expect(report).toContain("Snapshot verification: PASSED");
    expect(report).toContain("Restored database integrity: OK");
    expect(report).toContain("Foreign key check: 0 violations");
  });

  it("4. creates diagnostic log file and enforces retention limit of 20 logs", () => {
    const logsDir = DiagnosticsService.getLogsDir();

    // Create 25 dummy diagnostic log files
    for (let i = 0; i < 25; i++) {
      const path = DiagnosticsService.createDiagnosticLog({
        attemptId: `MIG-TEST-${i}`,
        errorMessage: `Simulated error ${i}`,
      });
      expect(fs.existsSync(path)).toBe(true);
    }

    const files = fs.readdirSync(logsDir).filter((f) => f.startsWith("migration-error-") && f.endsWith(".log"));
    expect(files.length).toBeLessThanOrEqual(20);
  });

  it("5. E2E Simulation: Migration failure generates diagnostic log & restores database with integrity OK", async () => {
    const targetDbPath = join(testDir, "migration_failure_test.sqlite");

    // 1. Create a DB at migration 16 with dummy product data
    const db = new DatabaseConstructor(targetDbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.prepare("CREATE TABLE _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);").run();

    const migrationsUpTo16 = MIGRATIONS.filter((m) => m.id <= 16);
    for (const m of migrationsUpTo16) {
      db.exec(m.sql);
      db.prepare("INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)").run(m.id, m.name, Date.now());
    }

    db.prepare("INSERT INTO products (name, selling_price, tax_rate, created_at, updated_at) VALUES ('Test Product', 10000, 1200, 1000, 1000)").run();
    const countBefore = db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number };
    expect(countBefore.c).toBe(1);

    // 2. Inject a failing migration 0017 into MIGRATIONS array temporarily
    const originalMigration17 = MIGRATIONS.find((m) => m.id === 17)!;
    const failingMigration17 = {
      id: 17,
      name: "0017_remove_medicine_directory",
      sql: "SYNTAX_ERROR_FAIL_MIGRATION;",
    };

    const index = MIGRATIONS.findIndex((m) => m.id === 17);
    MIGRATIONS[index] = failingMigration17;

    let thrownError: any = null;
    try {
      await MigrationRunner.run(db, targetDbPath);
    } catch (err: any) {
      thrownError = err;
    } finally {
      // Restore original migration 17
      MIGRATIONS[index] = originalMigration17;
    }

    // 3. Assert migration failed & threw recovery error
    expect(thrownError).not.toBeNull();
    expect(thrownError.message).toContain("Migration failure and recovery executed");

    // 4. Assert diagnostic log was generated
    const latestReportPath = DiagnosticsService.getLatestReportPath();
    expect(latestReportPath).not.toBeNull();
    expect(fs.existsSync(latestReportPath!)).toBe(true);

    const reportContent = fs.readFileSync(latestReportPath!, "utf8");
    expect(reportContent).toContain("NovoPharma Migration Diagnostic Report");
    expect(reportContent).toContain("Failed Migration ID: 17");
    expect(reportContent).toContain("Pre-migration snapshot: CREATED");
    expect(reportContent).toContain("Database restoration: SUCCESS");
    expect(reportContent).toContain("Restored database integrity: OK");

    // 5. Verify target database was restored to intact state
    const restoredDb = new DatabaseConstructor(targetDbPath);
    const integrity = restoredDb.pragma("integrity_check", { simple: true }) as string;
    const fkViolations = restoredDb.pragma("foreign_key_check") as any[];
    const countAfter = restoredDb.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number };
    restoredDb.close();

    expect(integrity).toBe("ok");
    expect(fkViolations.length).toBe(0);
    expect(countAfter.c).toBe(1);
  });

  it("6. Diagnostic logging failure does NOT prevent database recovery", async () => {
    const targetDbPath = join(testDir, "diag_failure_resiliency.sqlite");

    const db = new DatabaseConstructor(targetDbPath);
    db.prepare("CREATE TABLE _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);").run();

    // Mock createDiagnosticLog to throw an unexpected filesystem error
    const spy = DiagnosticsService.createDiagnosticLog;
    DiagnosticsService.createDiagnosticLog = () => {
      throw new Error("Disk Write Permission Denied");
    };

    const originalMigration17 = MIGRATIONS.find((m) => m.id === 17)!;
    MIGRATIONS[MIGRATIONS.findIndex((m) => m.id === 17)] = {
      id: 17,
      name: "0017_remove_medicine_directory",
      sql: "SYNTAX_ERROR_FAIL;",
    };

    let thrownError: any = null;
    try {
      await MigrationRunner.run(db, targetDbPath);
    } catch (err: any) {
      thrownError = err;
    } finally {
      DiagnosticsService.createDiagnosticLog = spy;
      MIGRATIONS[MIGRATIONS.findIndex((m) => m.id === 17)] = originalMigration17;
    }

    // Database recovery must succeed despite diagnostic log write failure
    expect(thrownError).not.toBeNull();
    expect(thrownError.message).toContain("Migration failure and recovery executed");

    const restoredDb = new DatabaseConstructor(targetDbPath);
    const integrity = restoredDb.pragma("integrity_check", { simple: true }) as string;
    restoredDb.close();

    expect(integrity).toBe("ok");
  });
});
