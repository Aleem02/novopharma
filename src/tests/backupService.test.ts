import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BackupService } from '../main/services/backupService'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'


// Mock Electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue(__dirname),
    getAppPath: vi.fn().mockReturnValue(__dirname)
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([{ reload: vi.fn() }])
  }
}))

// Mock Logger to suppress noise
vi.mock('../main/infrastructure/logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('BackupService', () => {
  const testDir = __dirname
  const mockDbPath = path.join(testDir, 'test_active.sqlite')
  const backupDbPath = path.join(testDir, 'test_backup.sqlite')
  const corruptDbPath = path.join(testDir, 'test_corrupt.sqlite')
  const fkInvalidDbPath = path.join(testDir, 'test_fk_invalid.sqlite')

  beforeEach(() => {
    // Clean up
    [mockDbPath, backupDbPath, corruptDbPath, fkInvalidDbPath].forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p)
      if (fs.existsSync(p + '-wal')) fs.unlinkSync(p + '-wal')
      if (fs.existsSync(p + '-shm')) fs.unlinkSync(p + '-shm')
    })

    // Setup active db mock
    vi.spyOn(app, 'getPath').mockReturnValue(testDir)
    const db = DatabaseManager.initialize(mockDbPath)
    MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
    vi.restoreAllMocks()
  })

  it('A. Valid standalone backup', async () => {
    // Add some data
    const db = DatabaseManager.getInstance()
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('test', '123', 0)").run()

    // Create Backup
    const success = await BackupService.createBackup(backupDbPath)
    expect(success).toBe(true)

    // Verify it independently
    const checkDb = new Database(backupDbPath)
    const integrity = checkDb.pragma('integrity_check', { simple: true }) as string
    expect(integrity).toBe('ok')

    const fks = checkDb.pragma('foreign_key_check') as any[]
    expect(fks.length).toBe(0)
    checkDb.close()
  })

  it('B. Invalid/corrupt SQLite file rejected, active DB unchanged', async () => {
    // Create corrupt file
    fs.writeFileSync(corruptDbPath, 'This is definitely not a sqlite database file.')

    const originalSize = fs.statSync(mockDbPath).size

    // Attempt restore
    await expect(BackupService.restoreBackup(corruptDbPath)).rejects.toThrow(/Restore failed: the selected backup failed database validation/)

    // Active DB should be completely unchanged
    expect(fs.statSync(mockDbPath).size).toBe(originalSize)
  })

  it('C. Foreign-key-invalid database rejected, active DB unchanged', async () => {
    // Create a standalone DB, run migrations
    const badDb = new Database(fkInvalidDbPath)
    MigrationRunner.run(badDb)
    
    // Insert invalid foreign key by bypassing PRAGMA foreign_keys temporarily
    badDb.pragma('foreign_keys = OFF')
    badDb.prepare("INSERT INTO purchases (supplier_id, purchase_date, total_amount, created_at, updated_at) VALUES (9999, 0, 0, 0, 0)").run()
    badDb.close()

    const originalSize = fs.statSync(mockDbPath).size

    await expect(BackupService.restoreBackup(fkInvalidDbPath)).rejects.toThrow(/Restore failed: the selected backup failed database validation/)
    expect(fs.statSync(mockDbPath).size).toBe(originalSize)
  })

  it('D. Valid NovoPharma backup restore succeeds', async () => {
    // Generate valid backup
    const tempDbPath = path.join(testDir, 'temp_generate.sqlite')
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath)
    const tempDb = new Database(tempDbPath)
    MigrationRunner.run(tempDb)
    tempDb.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('test_key', 'test_value', 0)").run()
    await tempDb.backup(backupDbPath)
    tempDb.close()

    const result = await BackupService.restoreBackup(backupDbPath)
    expect(result).toBe(true)

    // Re-check active db to see if data came over
    const activeDb = DatabaseManager.getInstance()
    const val = activeDb.prepare("SELECT value FROM settings WHERE key = 'test_key'").get() as any
    expect(val.value).toBe('test_value')
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath)
  })

  it('E. Incompatible/non-NovoPharma SQLite databases are rejected', async () => {
    // Create valid SQLite but without _migrations
    const emptyDb = new Database(backupDbPath)
    emptyDb.prepare("CREATE TABLE some_table (id INTEGER PRIMARY KEY)").run()
    emptyDb.close()

    await expect(BackupService.restoreBackup(backupDbPath)).rejects.toThrow(/Restore failed: the selected backup failed database validation/)
  })

  it('G. Restore safety backup creates a backup of current active db before overwriting', async () => {
    // Insert canary into active db
    const activeDb = DatabaseManager.getInstance()
    activeDb.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('canary', 'tweet', 0)").run()

    // Create a valid backup to restore
    const tempDbPath = path.join(testDir, 'temp_valid.sqlite')
    const tempDb = new Database(tempDbPath)
    MigrationRunner.run(tempDb)
    await tempDb.backup(backupDbPath)
    tempDb.close()

    await BackupService.restoreBackup(backupDbPath)

    // Check that a safety backup was created in testDir (app.getPath('userData'))
    const files = fs.readdirSync(testDir)
    const safetyBackup = files.find(f => f.startsWith('safety_backup_'))
    expect(safetyBackup).toBeDefined()

    // Verify safety backup contains the canary
    const sDb = new Database(path.join(testDir, safetyBackup!))
    const row = sDb.prepare("SELECT value FROM settings WHERE key = 'canary'").get() as any
    expect(row.value).toBe('tweet')
    sDb.close()

    // Cleanup
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath)
    fs.unlinkSync(path.join(testDir, safetyBackup!))
  })

  it('J. Regression: integrity_check with simple: true returning "ok" must NOT be rejected', async () => {
    // Create valid Backup
    await BackupService.createBackup(backupDbPath)

    // We simply call restoreBackup. If it throws an error about integrity_check, it fails.
    const result = await BackupService.restoreBackup(backupDbPath)
    expect(result).toBe(true)
  })

})
