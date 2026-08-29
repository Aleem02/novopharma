// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { Database } from 'better-sqlite3'

describe('Data Type & Representation Reliability', () => {
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

  it('stores and retrieves integer safely', () => {
    // Simulate inserting an audit log with a large integer
    const timestampValue = 1756598400000
    
    db.prepare(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, changes, timestamp)
      VALUES (1, 'setting', 1, 'update', '{"theme": "dark"}', ?)
    `).run(timestampValue)

    const result = db.prepare("SELECT timestamp FROM audit_logs WHERE id = 1").get() as any
    expect(result.timestamp).toBe(1756598400000)
    expect(Number.isInteger(result.timestamp)).toBe(true)
  })

  it('stores and retrieves strings explicitly as TEXT', () => {
    const jsonString = '{"theme":"dark"}'
    const timestampValue = 1756598400000
    
    db.prepare(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, changes, timestamp)
      VALUES (2, 'setting', 1, 'update', ?, ?)
    `).run(jsonString, timestampValue)

    const log = db.prepare("SELECT changes FROM audit_logs WHERE id = 2").get() as any
    expect(log.changes).toBe('{"theme":"dark"}')
    expect(typeof log.changes).toBe('string')
  })
})
