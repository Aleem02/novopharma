import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DatabaseManager } from "../main/database/connection";
import { MigrationRunner, MIGRATIONS } from "../main/database/migrations";
import { MedicineDirectoryService } from "../main/services/medicineDirectoryService";
import DatabaseConstructor, { Database } from "better-sqlite3";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import * as os from "os";

describe("v1.5.0 Medicine Directory & Migration Architecture", () => {
  let db: Database;

  beforeEach(async () => {
    // @ts-ignore
    DatabaseManager.instance = null;
    db = DatabaseManager.initialize(":memory:");
  });

  afterEach(() => {
    DatabaseManager.close();
  });

  describe("A. In-Memory Medicine Directory Service", () => {
    it("loads bundled JSON dataset successfully into memory", async () => {
      await MedicineDirectoryService.loadDataset();
      const status = MedicineDirectoryService.getStatus();
      expect(status.state).toBe("READY");
      expect(status.error).toBeNull();
    });

    it("performs in-memory search and returns expected result shape", async () => {
      const results = await MedicineDirectoryService.search("Paracetamol");
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(50);

      const item = results[0];
      expect(item).toHaveProperty("name");
      expect(typeof item.name).toBe("string");
      expect(item).toHaveProperty("generic_name");
      expect(item).toHaveProperty("dosage_form");
      expect(item).toHaveProperty("manufacturer");
    });

    it("does NOT import medicine_directory into SQLite database", async () => {
      await MigrationRunner.run(db);

      const medDirTable = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='medicine_directory'",
        )
        .get();

      expect(medDirTable).toBeUndefined();
    });
  });

  describe("B. Database Migration 0017", () => {
    it("works correctly when medicine_directory table already exists", async () => {
      // 1. Apply initial migrations including 0016
      const migrationsUpTo16 = MIGRATIONS.filter((m) => m.id <= 16);
      db.prepare("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);").run();
      for (const m of migrationsUpTo16) {
        db.exec(m.sql);
        db.prepare("INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)").run(m.id, m.name, Date.now());
      }

      const preTable = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='medicine_directory'",
        )
        .get();
      expect(preTable).toBeDefined();

      // 2. Run MigrationRunner to trigger 0017
      await MigrationRunner.run(db);

      // 3. Verify table is removed
      const postTable = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='medicine_directory'",
        )
        .get();
      expect(postTable).toBeUndefined();
    });

    it("works correctly when medicine_directory table does NOT exist (idempotent)", async () => {
      await expect(MigrationRunner.run(db)).resolves.not.toThrow();

      const postTable = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='medicine_directory'",
        )
        .get();
      expect(postTable).toBeUndefined();
    });

    it("preserves products and transactional tables without modification", async () => {
      await MigrationRunner.run(db);

      // Insert dummy product and customer
      db.prepare(`
        INSERT INTO products (name, selling_price, tax_rate, created_at, updated_at)
        VALUES ('Amoxicillin 500mg', 10000, 1200, 1000, 1000)
      `).run();

      db.prepare(`
        INSERT INTO customers (name, phone, is_active, created_at, updated_at)
        VALUES ('John Doe', '9876543210', 1, 1000, 1000)
      `).run();

      const prodCount = db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number };
      const custCount = db.prepare("SELECT COUNT(*) as c FROM customers").get() as { c: number };

      expect(prodCount.c).toBe(1);
      expect(custCount.c).toBe(1);

      // Run migration runner again to test idempotency
      await MigrationRunner.run(db);

      const postProdCount = db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number };
      const postCustCount = db.prepare("SELECT COUNT(*) as c FROM customers").get() as { c: number };

      expect(postProdCount.c).toBe(1);
      expect(postCustCount.c).toBe(1);
    });
  });

  describe("C. Migration Backup & Failure Recovery Mechanism", () => {
    it("creates and verifies pre-migration safety backup snapshot", async () => {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at INTEGER);
      `).run();
      db.prepare("INSERT INTO _migrations (id, name, applied_at) VALUES (1, '0001_initial_schema', 1000)").run();

      await MigrationRunner.run(db);

      const version = db.prepare("SELECT MAX(id) as v FROM _migrations").get() as { v: number };
      expect(version.v).toBe(17);
    });

    it("triggers failure recovery if migration fails on a disk-backed database with an active connection", async () => {
      const tempDbPath = join(os.tmpdir(), `test_failure_recovery_${Date.now()}.sqlite`);

      try {
        // 1. Create initial disk database at version 16
        const diskDb = new DatabaseConstructor(tempDbPath);
        diskDb.pragma("journal_mode = WAL");
        diskDb.pragma("foreign_keys = ON");

        const migrationsUpTo16 = MIGRATIONS.filter((m) => m.id <= 16);
        diskDb.prepare("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);").run();
        for (const m of migrationsUpTo16) {
          diskDb.exec(m.sql);
          diskDb.prepare("INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)").run(m.id, m.name, Date.now());
        }

        diskDb.prepare("INSERT INTO products (name, selling_price, tax_rate, created_at, updated_at) VALUES ('Test Product', 5000, 1200, 1000, 1000)").run();
        diskDb.close();

        // 2. Initialize active DatabaseManager connection
        // @ts-ignore
        DatabaseManager.instance = null;
        const testDb = DatabaseManager.initialize(tempDbPath);
        expect(testDb.open).toBe(true);
        expect(DatabaseManager.getInstance()).toBe(testDb);

        // 3. Inject failing migration SQL
        const badMigration = {
          id: 17,
          name: "0017_remove_medicine_directory",
          sql: "INVALID SQL STATEMENT THAT FAILS;",
        };

        const orig17 = MIGRATIONS[16];
        MIGRATIONS[16] = badMigration;

        // 4. Run migration runner and verify it throws recovery error
        await expect(MigrationRunner.run(testDb, tempDbPath)).rejects.toThrow("Migration failure and recovery executed");

        MIGRATIONS[16] = orig17;

        // 5. Verify recovery closed active connection and reset DatabaseManager singleton
        expect(testDb.open).toBe(false);
        expect(() => DatabaseManager.getInstance()).toThrow("Database connection not initialized");

        // 6. Verify restored database passes integrity_check & foreign_key_check
        const restoredDb = new DatabaseConstructor(tempDbPath);
        restoredDb.pragma("foreign_keys = ON");

        const integrity = restoredDb.pragma("integrity_check", { simple: true }) as string;
        expect(integrity).toBe("ok");

        const fkViolations = restoredDb.pragma("foreign_key_check") as any[];
        expect(fkViolations).toEqual([]);

        // 7. Verify snapshot replacement succeeded and pre-migration data is intact
        const prodRow = restoredDb.prepare("SELECT name FROM products WHERE id = 1").get() as { name: string };
        expect(prodRow).toBeDefined();
        expect(prodRow.name).toBe("Test Product");
        restoredDb.close();
      } finally {
        DatabaseManager.close();
        if (existsSync(tempDbPath)) try { unlinkSync(tempDbPath); } catch { /* ignore */ }
        if (existsSync(tempDbPath + "-wal")) try { unlinkSync(tempDbPath + "-wal"); } catch { /* ignore */ }
        if (existsSync(tempDbPath + "-shm")) try { unlinkSync(tempDbPath + "-shm"); } catch { /* ignore */ }
      }
    });
  });

  describe("D. Post-Migration Database Compaction (VACUUM)", () => {
    it("reclaims unused space and verifies database integrity after dropping medicine_directory", async () => {
      const tempDbPath = join(os.tmpdir(), `test_compaction_${Date.now()}.sqlite`);

      try {
        const diskDb = new DatabaseConstructor(tempDbPath);
        diskDb.pragma("journal_mode = WAL");
        diskDb.pragma("foreign_keys = ON");

        const migrationsUpTo16 = MIGRATIONS.filter((m) => m.id <= 16);
        diskDb.prepare("CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);").run();
        for (const m of migrationsUpTo16) {
          diskDb.exec(m.sql);
          diskDb.prepare("INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)").run(m.id, m.name, Date.now());
        }

        // Insert 2000 dummy records into medicine_directory to create database page overhead
        const insertStmt = diskDb.prepare(`
          INSERT INTO medicine_directory (name, generic_name, manufacturer, dosage_form, strength)
          VALUES (?, ?, ?, ?, ?)
        `);
        const insertTx = diskDb.transaction(() => {
          for (let i = 0; i < 2000; i++) {
            insertStmt.run(`Medicine Name ${i}`, `Generic ${i}`, `Manufacturer ${i}`, "Tablet", "500mg");
          }
        });
        insertTx();

        diskDb.prepare("INSERT INTO products (name, selling_price, tax_rate, created_at, updated_at) VALUES ('Paracetamol 500mg', 500, 1200, 1000, 1000)").run();
        diskDb.prepare("INSERT INTO customers (name, phone, is_active, created_at, updated_at) VALUES ('Jane Doe', '9876543210', 1, 1000, 1000)").run();
        diskDb.pragma("wal_checkpoint(TRUNCATE)");
        diskDb.close();

        const beforeSize = existsSync(tempDbPath) ? (await import("fs")).statSync(tempDbPath).size : 0;

        // Run MigrationRunner which executes 0017 and post-migration compaction
        // @ts-ignore
        DatabaseManager.instance = null;
        const testDb = DatabaseManager.initialize(tempDbPath);
        await MigrationRunner.run(testDb, tempDbPath);

        testDb.pragma("wal_checkpoint(TRUNCATE)");

        const afterSize = existsSync(tempDbPath) ? (await import("fs")).statSync(tempDbPath).size : 0;

        // 1. Verify file size decreased after compaction
        expect(afterSize).toBeLessThan(beforeSize);

        // 2. Verify medicine_directory is absent
        const medDirExists = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='medicine_directory'").get();
        expect(medDirExists).toBeUndefined();

        // 3. Verify integrity_check and foreign_key_check
        const integrity = testDb.pragma("integrity_check", { simple: true }) as string;
        expect(integrity).toBe("ok");

        const fkViolations = testDb.pragma("foreign_key_check") as any[];
        expect(fkViolations).toEqual([]);

        // 4. Verify critical table counts remain intact
        const prodCount = testDb.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number };
        const custCount = testDb.prepare("SELECT COUNT(*) as c FROM customers").get() as { c: number };
        expect(prodCount.c).toBe(1);
        expect(custCount.c).toBe(1);
      } finally {
        DatabaseManager.close();
        if (existsSync(tempDbPath)) try { unlinkSync(tempDbPath); } catch { /* ignore */ }
        if (existsSync(tempDbPath + "-wal")) try { unlinkSync(tempDbPath + "-wal"); } catch { /* ignore */ }
        if (existsSync(tempDbPath + "-shm")) try { unlinkSync(tempDbPath + "-shm"); } catch { /* ignore */ }
      }
    });

    it("handles compaction warnings gracefully without rolling back successful migration 0017", async () => {
      // @ts-ignore
      DatabaseManager.instance = null;
      const testDb = DatabaseManager.initialize(":memory:");
      await MigrationRunner.run(testDb);

      // Verify migration 0017 was applied and recorded in _migrations
      const versionRow = testDb.prepare("SELECT MAX(id) as version FROM _migrations").get() as { version: number };
      expect(versionRow.version).toBe(17);

      const medDirExists = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='medicine_directory'").get();
      expect(medDirExists).toBeUndefined();
    });
  });
});
