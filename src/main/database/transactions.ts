import { Database } from "better-sqlite3";
import { Logger } from "../infrastructure/logger";

/**
 * Executes a callback within an atomic SQLite transaction.
 * Will automatically rollback if an error is thrown, and commit if successful.
 */
export function executeTransaction<T>(db: Database, callback: () => T): T {
  const transaction = db.transaction(() => {
    return callback();
  });

  try {
    return transaction();
  } catch (error: any) {
    Logger.error("Database", "Transaction rolled back due to error", {
      error: error.message,
    });
    throw new Error(`Transaction failed: ${error.message}`);
  }
}
