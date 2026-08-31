import { DatabaseManager } from '../database/connection'
import { Logger } from '../infrastructure/logger'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { MigrationRunner } from '../database/migrations'
import { SettingService } from './settingService'

export class BackupService {
  /**
   * Safely creates a consistent backup of the database even in WAL mode.
   */
  static async createBackup(destinationPath: string): Promise<boolean> {
    try {
      const db = DatabaseManager.getInstance()
      db.pragma('wal_checkpoint(TRUNCATE)')
      Logger.info('Backup', `Starting backup to ${destinationPath}`)
      await db.backup(destinationPath)
      Logger.info('Backup', `Backup created successfully at ${destinationPath}`)
      return true
    } catch (error: any) {
      Logger.error('Backup', `Failed to create backup: ${error.message}`)
      throw new Error(`Failed to create backup: ${error.message}`)
    }
  }

  /**
   * Restores a backup after extensive validation.
   * 1. Validates the backup file.
   * 2. Creates a safety backup of the current database.
   * 3. Disconnects and overwrites.
   * 4. Reinitializes and triggers a UI reload.
   */
  static async restoreBackup(backupPath: string): Promise<boolean> {
    Logger.info('Backup', `Starting restore from ${backupPath}`)
    
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file does not exist.')
    }

    // 1. Validate Backup
    let testDb: Database.Database | null = null
    try {
      testDb = new Database(backupPath, { readonly: true })
      
      // Enforce foreign keys for validation
      testDb.pragma('foreign_keys = ON')

      // Integrity Check - `simple: true` returns a string 'ok'
      const integrity = testDb.pragma('integrity_check', { simple: true }) as string
      if (integrity !== 'ok') {
        throw new Error('Database integrity check failed on the backup file.')
      }

      // Foreign Key Check - returns array of violations (should be empty)
      const fkViolations = testDb.pragma('foreign_key_check') as any[]
      if (fkViolations && fkViolations.length > 0) {
        throw new Error('Backup contains foreign key violations and is unsafe to restore.')
      }

      // Check for expected schema table
      const hasMigrations = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'").get()
      if (!hasMigrations) {
        throw new Error('Invalid backup: Missing _migrations table.')
      }
      
    } catch (error: any) {
      Logger.error('Backup', `Backup validation failed: ${error.message}`)
      if (testDb) {
        try { testDb.close() } catch (e) { /* ignore */ }
      }
      // Return a safe, non-sensitive error message
      throw new Error(`Restore failed: the selected backup failed database validation. Your current data was not changed. (${error.message})`)
    }

    if (testDb) {
      testDb.close()
    }

    // 2. Create Safety Backup of Current State
    try {
      const db = DatabaseManager.getInstance()
      
      // Prevent restore during active transaction
      if (db.inTransaction) {
        throw new Error('Cannot restore while a transaction is active. Please try again.')
      }

      db.pragma('wal_checkpoint(TRUNCATE)')

      const userData = app.getPath('userData')
      const safetyBackupPath = join(userData, `safety_backup_${Date.now()}.sqlite`)
      Logger.info('Backup', `Creating safety backup at ${safetyBackupPath}`)
      await db.backup(safetyBackupPath)
    } catch (error: any) {
      Logger.error('Backup', `Failed to create safety backup: ${error.message}`)
      throw new Error(`Failed to create safety backup. Restore aborted to prevent data loss. Error: ${error.message}`)
    }

    // 3. Overwrite & Reinitialize
    try {
      DatabaseManager.close()
      
      const userData = app.getPath('userData')
      const targetDbPath = (DatabaseManager as any).dbPath || join(userData, 'novopharma_v1.sqlite')
      const walPath = targetDbPath + '-wal'
      const shmPath = targetDbPath + '-shm'
      
      // Overwrite primary DB file
      fs.copyFileSync(backupPath, targetDbPath)
      
      // Explicitly delete WAL and SHM files to prevent corruption mixing old WAL with new DB
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
      
      Logger.info('Backup', `Restore applied to ${targetDbPath}. Reinitializing...`)
      
      // Reinitialize
      const newDb = DatabaseManager.initialize()
      MigrationRunner.run(newDb)
      
      // Notify UI to Reload
      const windows = BrowserWindow.getAllWindows() || []
      windows.forEach(win => {
        if (win && typeof win.reload === 'function') {
          win.reload()
        }
      })
      
      return true
    } catch (error: any) {
      Logger.error('Backup', `CRITICAL: Failed during restore overwrite/reinitialize: ${error.message}`)
      throw new Error(`CRITICAL: Database restore failed: ${error.message}`)
    }
  }
}

export class BackupManager {
  private static timer: NodeJS.Timeout | null = null
  private static isBackingUp = false
  private static readonly MAX_RETENTION = 30

  static initialize() {
    // 2-hour interval (2 * 60 * 60 * 1000)
    if (this.timer) {
      clearInterval(this.timer)
    }
    this.timer = setInterval(() => this.runScheduledBackup(), 2 * 60 * 60 * 1000)
    
    // Enforce retention on initialize if location exists
    const location = SettingService.getSetting('backup_location')
    if (location && fs.existsSync(location)) {
      this.enforceRetention(location)
    }
    
    Logger.info('BackupManager', 'Initialized automatic backup scheduler')
  }

  static async runScheduledBackup() {
    if (SettingService.getSetting('backup_auto_enabled') !== 'true') return
    Logger.info('BackupManager', 'Triggering scheduled automatic backup')
    await this.executeFullBackupFlow()
  }

  static async runManualBackup() {
    Logger.info('BackupManager', 'Triggering manual backup')
    await this.executeFullBackupFlow()
  }

  static async executeFullBackupFlow() {
    if (this.isBackingUp) {
      Logger.info('BackupManager', 'Backup already in progress, skipping')
      return
    }

    const location = SettingService.getSetting('backup_location')
    if (!location) {
      Logger.warn('BackupManager', 'Backup location not configured')
      return
    }

    this.isBackingUp = true
    let fullPath = ''

    try {
      if (!fs.existsSync(location)) {
        throw new Error('Configured backup directory does not exist')
      }

      // Generate timestamp formatted as YYYY-MM-DD_HH-mm-ss
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const mins = String(now.getMinutes()).padStart(2, '0')
      const secs = String(now.getSeconds()).padStart(2, '0')
      const timestamp = `${year}-${month}-${day}_${hours}-${mins}-${secs}`
      
      const fileName = `NovoPharma_${timestamp}.db`
      fullPath = join(location, fileName)

      // 1. Create Backup
      await BackupService.createBackup(fullPath)

      // 2. Validate Backup
      await this.validateBackup(fullPath)

      // 3. Update local success setting
      SettingService.setSetting('backup_last_local_success', now.toISOString())
      Logger.info('BackupManager', 'Local backup successfully completed and validated')

      // 4. Enforce Retention
      this.enforceRetention(location)

    } catch (err: any) {
      Logger.error('BackupManager', `Backup flow failed: ${err.message}`)
      
      // Cleanup the failed backup file to prevent storing corrupt backups
      if (fullPath && fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath)
          Logger.info('BackupManager', `Cleaned up invalid backup file: ${fullPath}`)
        } catch (cleanupErr) {
          Logger.error('BackupManager', 'Failed to cleanup invalid backup file')
        }
      }
      throw err // Rethrow for manual backup to catch
    } finally {
      this.isBackingUp = false
    }
  }

  private static async validateBackup(backupPath: string) {
    Logger.info('BackupManager', `Validating backup at ${backupPath}`)
    let testDb: Database.Database | null = null
    try {
      testDb = new Database(backupPath, { readonly: true })
      
      const integrity = testDb.pragma('integrity_check', { simple: true }) as string
      if (integrity !== 'ok') {
        throw new Error('Database integrity check failed')
      }

      const fkViolations = testDb.pragma('foreign_key_check') as any[]
      if (fkViolations && fkViolations.length > 0) {
        throw new Error('Database contains foreign key violations')
      }
    } catch (err: any) {
      throw new Error(`Validation failed: ${err.message}`)
    } finally {
      if (testDb) {
        try { testDb.close() } catch (e) { /* ignore */ }
      }
    }
  }

  private static enforceRetention(backupDir: string) {
    try {
      const files = fs.readdirSync(backupDir)
      
      const backupFiles = files
        .filter(f => f.startsWith('NovoPharma_') && f.endsWith('.db'))
        .map(f => {
          const fullPath = join(backupDir, f)
          const stats = fs.statSync(fullPath)
          return { file: fullPath, time: stats.mtime.getTime() }
        })
        .sort((a, b) => b.time - a.time) // Newest first

      if (backupFiles.length > this.MAX_RETENTION) {
        const filesToDelete = backupFiles.slice(this.MAX_RETENTION)
        for (const f of filesToDelete) {
          try {
            fs.unlinkSync(f.file)
            Logger.info('BackupManager', `Deleted old backup: ${f.file}`)
          } catch (delErr) {
            Logger.error('BackupManager', `Failed to delete old backup ${f.file}`)
          }
        }
      }
    } catch (err: any) {
      Logger.error('BackupManager', `Failed to enforce retention: ${err.message}`)
    }
  }

  static async runAppCloseBackup() {
    if (SettingService.getSetting('backup_auto_enabled') !== 'true') return
    
    Logger.info('BackupManager', 'Attempting app-close backup')
    try {
      await Promise.race([
        this.executeFullBackupFlow(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('App-close backup timeout exceeded')), 10000))
      ])
    } catch (err: any) {
      Logger.error('BackupManager', `App-close backup aborted or failed: ${err.message}`)
    }
  }
}
