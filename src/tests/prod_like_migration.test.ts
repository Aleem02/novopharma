// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import Database from 'better-sqlite3'
import path from 'path'
import { MigrationRunner } from '../main/database/migrations'

describe('Production-Like Database Migration Test (demo_novopharma_v1.sqlite)', () => {
  it('migrates production demo database safely and removes medicine_directory table', async () => {
    const srcDbPath = path.join(process.cwd(), 'demo_novopharma_v1.sqlite')
    const tempDbPath = path.join(process.cwd(), 'scratch', 'prod_like_test.sqlite')

    if (!fs.existsSync(path.dirname(tempDbPath))) {
      fs.mkdirSync(path.dirname(tempDbPath), { recursive: true })
    }
    fs.copyFileSync(srcDbPath, tempDbPath)

    const beforeSize = fs.statSync(tempDbPath).size
    const dbBefore = new Database(tempDbPath)

    const getCount = (db: any, table: string) => {
      try {
        const has = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
        if (!has) return -1
        return db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c
      } catch {
        return -1
      }
    }

    const beforeProducts = getCount(dbBefore, 'products')
    const beforeCustomers = getCount(dbBefore, 'customers')
    const beforeSales = getCount(dbBefore, 'sales')
    const beforePurchases = getCount(dbBefore, 'purchases')
    const beforeBatches = getCount(dbBefore, 'inventory_batches')
    const beforePrescriptions = getCount(dbBefore, 'prescriptions')
    const beforeMedDir = getCount(dbBefore, 'medicine_directory')

    console.log('=== BEFORE MIGRATION METRICS ===')
    console.log('Database File Size:', beforeSize, 'bytes (' + (beforeSize / 1024).toFixed(2) + ' KB)')
    console.log('Products Count:', beforeProducts)
    console.log('Customers Count:', beforeCustomers)
    console.log('Sales Count:', beforeSales)
    console.log('Purchases Count:', beforePurchases)
    console.log('Inventory Batches Count:', beforeBatches)
    console.log('Prescriptions Count:', beforePrescriptions)
    console.log('Medicine Directory Row Count:', beforeMedDir)

    dbBefore.close()

    // Execute Migration 0017 on temp DB
    console.log('\nApplying v1.5.0 Migration 0017 on production-like test DB...')
    const dbMig = new Database(tempDbPath)
    dbMig.pragma('journal_mode = WAL')
    dbMig.pragma('foreign_keys = ON')

    await MigrationRunner.run(dbMig, tempDbPath)
    dbMig.close()

    const afterSize = fs.statSync(tempDbPath).size
    const dbAfter = new Database(tempDbPath)

    const afterProducts = getCount(dbAfter, 'products')
    const afterCustomers = getCount(dbAfter, 'customers')
    const afterSales = getCount(dbAfter, 'sales')
    const afterPurchases = getCount(dbAfter, 'purchases')
    const afterBatches = getCount(dbAfter, 'inventory_batches')
    const afterPrescriptions = getCount(dbAfter, 'prescriptions')
    const afterMedDir = getCount(dbAfter, 'medicine_directory')

    const integrity = dbAfter.pragma('integrity_check', { simple: true })
    const fkViolations = dbAfter.pragma('foreign_key_check') as any[]

    console.log('\n=== AFTER MIGRATION METRICS ===')
    console.log('Database File Size:', afterSize, 'bytes (' + (afterSize / 1024).toFixed(2) + ' KB)')
    console.log('Products Count:', afterProducts)
    console.log('Customers Count:', afterCustomers)
    console.log('Sales Count:', afterSales)
    console.log('Purchases Count:', afterPurchases)
    console.log('Inventory Batches Count:', afterBatches)
    console.log('Prescriptions Count:', afterPrescriptions)
    console.log('Medicine Directory Table Status:', afterMedDir === -1 ? 'ABSENT (Successfully Removed)' : 'PRESENT')
    console.log('integrity_check:', integrity)
    console.log('foreign_key_check violations count:', fkViolations.length)

    expect(integrity).toBe('ok')
    expect(fkViolations.length).toBe(0)
    expect(afterMedDir).toBe(-1) // Table absent
    expect(afterProducts).toBe(beforeProducts)
    expect(afterCustomers).toBe(beforeCustomers)
    expect(afterSales).toBe(beforeSales)
    expect(afterPurchases).toBe(beforePurchases)
    expect(afterBatches).toBe(beforeBatches)
    expect(afterPrescriptions).toBe(beforePrescriptions)

    dbAfter.close()
  })
})
