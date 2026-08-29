import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { Logger } from '../infrastructure/logger'

export class DatabaseManager {
  private static instance: Database.Database | null = null
  private static dbPath: string = ''

  static initialize(testDbPath?: string): Database.Database {
    if (this.instance) {
      Logger.warn('Database', 'DatabaseManager.initialize called but connection already exists')
      return this.instance
    }

    // Safely determine path, blocking any renderer influence
    if (testDbPath) {
      this.dbPath = testDbPath
    } else if (!this.dbPath) {
      if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        throw new Error('FATAL: Attempted to open production database during automated tests.')
      }
      const userData = app.getPath('userData')
      this.dbPath = join(userData, 'novopharma_v1.sqlite')
    }

    try {
      this.instance = new Database(this.dbPath)
      
      // We do NOT automatically delete or recreate if the file is corrupted.
      // better-sqlite3 will throw if the file is an invalid/corrupted SQLite database.
      
      // PRAGMA configuration
      this.instance.pragma('journal_mode = WAL')
      // FULL synchronous is required for maximum durability of financial records
      this.instance.pragma('synchronous = FULL')
      this.instance.pragma('foreign_keys = ON')
      // Wait up to 5000ms if DB is locked by another process/transaction
      this.instance.pragma('busy_timeout = 5000')

      Logger.info('Database', 'SQLite connection initialized successfully', { path: this.dbPath })
      return this.instance
    } catch (error: any) {
      Logger.error('Database', 'Failed to initialize SQLite connection', { error: error.message })
      throw new Error(`Database connection failed: ${error.message}`)
    }
  }

  static getInstance(): Database.Database {
    if (!this.instance) {
      throw new Error('Database connection not initialized. Call initialize() first.')
    }
    return this.instance
  }

  static close(): void {
    if (this.instance) {
      this.instance.close()
      this.instance = null
      Logger.info('Database', 'SQLite connection closed gracefully')
    }
  }
}
