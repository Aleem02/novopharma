import { Database } from "better-sqlite3";
import { Logger } from "../infrastructure/logger";
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

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

// Ensure the schema version increments sequentially
const MIGRATIONS: Migration[] = [
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
];

export class MigrationRunner {
  static run(db: Database): void {
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

    // Run each migration inside its own transaction (if possible)
    for (const migration of pendingMigrations) {
      Logger.info(
        "Database",
        `Applying migration ${migration.id}: ${migration.name}`,
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

      try {
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
      } catch (error: any) {
        if (error.message.includes("duplicate column name")) {
          Logger.warn(
            "Database",
            `Migration ${migration.id} duplicate column ignored. Force marking as applied.`,
          );
          db.prepare(
            "INSERT OR IGNORE INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)",
          ).run(migration.id, migration.name, Date.now());
        } else {
          Logger.error(
            "Database",
            `Migration ${migration.id} failed, rolled back. Database remains in previous state.`,
            { error: error.message },
          );
          throw new Error(`Migration failure: ${error.message}`);
        }
      }
    }

    Logger.info("Database", "All migrations applied successfully.");
  }
}
