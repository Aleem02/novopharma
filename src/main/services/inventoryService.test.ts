import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseManager } from '../database/connection'
import { InventoryService } from './inventoryService'

describe('InventoryService', () => {
  beforeEach(() => {
    // Reset DB and apply migrations
    const db = DatabaseManager.initialize(':memory:')
    const runner = require('../database/migrationRunner').MigrationRunner
    runner.run(db)
  })

  it('retrieves an empty list initially', () => {
    const list = InventoryService.listInventory()
    expect(list).toHaveLength(0)
  })

  it('returns false for getByProductId if no inventory exists', () => {
    const result = InventoryService.getByProductId(999)
    expect(result).toHaveLength(0)
  })

  it('can search by batch number even if empty', () => {
    const result = InventoryService.searchByBatch('BAT')
    expect(result).toHaveLength(0)
  })
})
