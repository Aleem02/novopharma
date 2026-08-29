// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import * as fs from 'fs'
import { join } from 'path'
import * as os from 'os'

describe('Database Failure & Reliability', () => {
  const tempDir = fs.mkdtempSync(join(os.tmpdir(), 'novopharma-test-'))
  const testDbPath = join(tempDir, 'test_failure.sqlite')

  afterEach(() => {
    DatabaseManager.close()
    // @ts-ignore
    DatabaseManager.instance = null
  })

  it('safely reopens an existing database and preserves data', () => {
    // 1. Initialize & Write
    const db1 = DatabaseManager.initialize(testDbPath)
    MigrationRunner.run(db1)
    db1.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('ReopenTest', 'value', 0)").run()
    DatabaseManager.close()
    // @ts-ignore
    DatabaseManager.instance = null

    // 2. Reopen & Verify
    const db2 = DatabaseManager.initialize(testDbPath)
    const result = db2.prepare("SELECT key FROM settings WHERE key = 'ReopenTest'").get() as any
    expect(result.key).toBe('ReopenTest')
  })

  it('throws explicitly on a completely unreadable/corrupted database file without silently deleting it', () => {
    DatabaseManager.close()
    // @ts-ignore
    DatabaseManager.instance = null
    
    // Create a corrupted fake DB file
    const corruptedDbPath = join(tempDir, 'corrupt.sqlite')
    fs.writeFileSync(corruptedDbPath, 'THIS IS NOT A SQLITE DATABASE. IT IS CORRUPT DATA.')

    // Attempt to open should throw a native SQLite error, not silently recreate it.
    expect(() => {
      DatabaseManager.initialize(corruptedDbPath)
    }).toThrow(/file is not a database/)

    // Ensure the file is still there and NOT deleted
    expect(fs.existsSync(corruptedDbPath)).toBe(true)
    expect(fs.readFileSync(corruptedDbPath, 'utf8')).toBe('THIS IS NOT A SQLITE DATABASE. IT IS CORRUPT DATA.')
  })
})
