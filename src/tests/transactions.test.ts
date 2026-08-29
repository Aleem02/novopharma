// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { executeTransaction } from '../main/database/transactions'
import { Database } from 'better-sqlite3'

describe('Transaction Reliability & Financial Atomicity', () => {
  let db: Database

  beforeEach(() => {
    // @ts-ignore
    DatabaseManager.instance = null
    db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  it('guarantees atomicity on failure (simulated workflow)', () => {
    // 1. Setup Base Data
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('counter', '100', 0)").run()

    // 2. Simulate successful update
    executeTransaction(db, () => {
      db.prepare("UPDATE settings SET value = '95' WHERE key = 'counter'").run()
      
      db.prepare(`
        INSERT INTO audit_logs (entity_type, entity_id, action, timestamp)
        VALUES ('setting', 1, 'update', 0)
      `).run()
    })

    const counter1 = db.prepare("SELECT value FROM settings WHERE key = 'counter'").get() as any
    expect(counter1.value).toBe('95')

    // 3. Simulate FAILED update
    expect(() => {
      executeTransaction(db, () => {
        db.prepare("UPDATE settings SET value = '90' WHERE key = 'counter'").run()
  
        db.prepare(`
          INSERT INTO audit_logs (entity_type, entity_id, action, timestamp)
          VALUES ('setting', 1, 'update', 1)
        `).run()
  
        throw new Error('Simulated crash during update')
      })
    }).toThrow('Simulated crash during update')

    // 4. Verify exact pre-transaction state
    const counter2 = db.prepare("SELECT value FROM settings WHERE key = 'counter'").get() as any
    expect(counter2.value).toBe('95') // Counter did NOT reduce further

    const auditCount = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE timestamp = 1").get() as any
    expect(auditCount.c).toBe(0) // Parent record absent
  })

  it('handles rapid concurrent requests without database locking errors', async () => {
    // Create base setting to update rapidly
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('ConcurrencyBase', 'val', 0)").run()

    const promises = Array.from({ length: 50 }).map((_, i) => {
      return new Promise<void>((resolve) => {
        executeTransaction(db, () => {
          db.prepare("UPDATE settings SET value = ? WHERE key = 'ConcurrencyBase'").run(`Update-${i}`)
        })
        resolve()
      })
    })

    await Promise.all(promises)
    const result = db.prepare("SELECT value FROM settings WHERE key = 'ConcurrencyBase'").get() as any
    expect(result.value).toMatch(/Update-\d+/)
  })
})
