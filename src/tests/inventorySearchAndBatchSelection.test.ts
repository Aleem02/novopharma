import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { InventoryRepository } from '../main/database/repositories/inventoryRepository'
import { ProductRepository } from '../main/database/repositories/productRepository'

describe('InventoryRepository Batch Search & Product Join Tests', () => {
  beforeEach(async () => {
    const db = DatabaseManager.initialize(':memory:')
    await MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  it('joins full product details (strength, unit, pack_type, units_per_pack) in getPaginatedBatches', () => {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    // Create product with strength and pack details
    const product = ProductRepository.create({
      name: 'Augmentin 625 Duo',
      generic_name: 'Amoxicillin + Clavulanic Acid',
      manufacturer: 'GSK',
      barcode: '10002',
      strength: '625mg',
      unit: 'Tablet',
      pack_type: 'Strip',
      units_per_pack: 10,
      selling_price: 200,
      tax_rate: 1200,
      is_active: 1
    })

    // Insert batch
    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(product.id, 'AUG-B01', now + 1000000, 100, 250, 150, 200, now, now)

    const result = InventoryRepository.getPaginatedBatches({ page: 1, pageSize: 25 })
    expect(result.items.length).toBe(1)
    const batch = result.items[0]
    expect(batch.batch_number).toBe('AUG-B01')
    expect(batch.product).toBeDefined()
    expect(batch.product?.name).toBe('Augmentin 625 Duo')
    expect(batch.product?.strength).toBe('625mg')
    expect(batch.product?.unit).toBe('Tablet')
    expect(batch.product?.pack_type).toBe('Strip')
    expect(batch.product?.units_per_pack).toBe(10)
    expect(batch.product?.barcode).toBe('10002')
  })

  it('searches batches across product name, generic name, and batch number', () => {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    const p1 = ProductRepository.create({
      name: 'Allegra 120',
      generic_name: 'Fexofenadine',
      manufacturer: 'Sanofi',
      strength: '120mg',
      selling_price: 150,
      tax_rate: 1200,
      is_active: 1
    })

    const p2 = ProductRepository.create({
      name: 'Calpol 250',
      generic_name: 'Paracetamol',
      manufacturer: 'GSK',
      strength: '250mg',
      selling_price: 50,
      tax_rate: 1200,
      is_active: 1
    })

    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      p1.id, 'ALL-9988', now + 2000000, 50, 160, 100, 150, now, now,
      p2.id, 'CAL-1122', now + 3000000, 40, 60, 30, 50, now, now
    )

    // Search by product name
    const resByName = InventoryRepository.getPaginatedBatches({ search: 'allegra' })
    expect(resByName.items.length).toBe(1)
    expect(resByName.items[0].batch_number).toBe('ALL-9988')

    // Search by generic name
    const resByGeneric = InventoryRepository.getPaginatedBatches({ search: 'Paracetamol' })
    expect(resByGeneric.items.length).toBe(1)
    expect(resByGeneric.items[0].batch_number).toBe('CAL-1122')

    // Search by batch number
    const resByBatch = InventoryRepository.getPaginatedBatches({ search: '9988' })
    expect(resByBatch.items.length).toBe(1)
    expect(resByBatch.items[0].batch_number).toBe('ALL-9988')
  })

  it('findById returns the batch with product information attached', () => {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    const product = ProductRepository.create({
      name: 'Dolo 650',
      generic_name: 'Paracetamol',
      manufacturer: 'Micro Labs',
      strength: '650mg',
      unit: 'Tablet',
      selling_price: 30,
      tax_rate: 1200,
      is_active: 1
    })

    const insertResult = db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(product.id, 'DOLO-777', now + 1000000, 200, 35, 20, 30, now, now)

    const batchId = insertResult.lastInsertRowid as number
    const batch = InventoryRepository.findById(batchId)
    expect(batch).toBeDefined()
    expect(batch?.id).toBe(batchId)
    expect(batch?.product).toBeDefined()
    expect(batch?.product?.name).toBe('Dolo 650')
    expect(batch?.product?.strength).toBe('650mg')
    expect(batch?.product?.manufacturer).toBe('Micro Labs')
  })
})
