import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { StockAdjustmentService } from '../main/services/stockAdjustmentService'
import { ProductService } from '../main/services/productService'
import { SupplierService } from '../main/services/supplierService'
import { PurchaseService } from '../main/services/purchaseService'
import { FirebaseAuthService } from '../main/services/firebaseAuth'

describe('StockAdjustmentService Integration Tests', () => {
  beforeEach(() => {
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
    
    // Mock user email
    vi.spyOn(FirebaseAuthService, 'getCurrentUserEmail').mockReturnValue('operator@novopharma.com')
  })

  afterEach(() => {
    DatabaseManager.close()
    vi.restoreAllMocks()
  })

  const setupData = () => {
    const supplier = SupplierService.createSupplier({
      name: 'Supplier C',
      is_active: 1
    })

    const product = ProductService.createProduct({
      name: 'Aspirin 100mg',
      selling_price: 300,
      tax_rate: 1200,
      is_active: 1
    })

    const now = Date.now()

    PurchaseService.createDraft({
      supplier_id: supplier.id,
      purchase_date: now,
      items: [{
        product_id: product.id,
        batch_number: 'ASP001',
        expiry_date: now + 365 * 24 * 60 * 60 * 1000,
        quantity: 50,
        purchase_price: 200,
        mrp: 300
      }]
    })

    const purchases = PurchaseService.listPurchases()
    PurchaseService.completePurchase(purchases[0].id)

    // Get the created batch ID
    const db = DatabaseManager.getInstance()
    const batch = db.prepare('SELECT * FROM inventory_batches WHERE batch_number = ?').get('ASP001') as any

    return { product, batch }
  }

  it('should successfully increase stock and create a logged audit record', () => {
    const { batch } = setupData()

    const adj = StockAdjustmentService.createAdjustment({
      inventory_batch_id: batch.id,
      quantity: 10,
      type: 'INCREASE',
      reason: 'Physical recount correction',
      notes: 'Found extra pack under counter'
    })

    expect(adj.id).toBeDefined()
    expect(adj.quantity).toBe(10)
    expect(adj.type).toBe('INCREASE')
    expect(adj.adjusted_by).toBe('operator@novopharma.com')

    // Verify inventory increased
    const db = DatabaseManager.getInstance()
    const updatedBatch = db.prepare('SELECT quantity FROM inventory_batches WHERE id = ?').get(batch.id) as any
    expect(updatedBatch.quantity).toBe(60) // 50 + 10 = 60
  })

  it('should successfully decrease stock and create a logged audit record', () => {
    const { batch } = setupData()

    const adj = StockAdjustmentService.createAdjustment({
      inventory_batch_id: batch.id,
      quantity: 15,
      type: 'DECREASE',
      reason: 'Damaged stock'
    })

    expect(adj.quantity).toBe(15)
    expect(adj.type).toBe('DECREASE')

    // Verify inventory decreased
    const db = DatabaseManager.getInstance()
    const updatedBatch = db.prepare('SELECT quantity FROM inventory_batches WHERE id = ?').get(batch.id) as any
    expect(updatedBatch.quantity).toBe(35) // 50 - 15 = 35
  })

  it('should reject decreasing stock below 0', () => {
    const { batch } = setupData()

    expect(() => {
      StockAdjustmentService.createAdjustment({
        inventory_batch_id: batch.id,
        quantity: 60, // Stock is only 50
        type: 'DECREASE',
        reason: 'Discard all'
      })
    }).toThrow(/Cannot decrease quantity below 0/)
  })

  it('should reject invalid batch ID', () => {
    expect(() => {
      StockAdjustmentService.createAdjustment({
        inventory_batch_id: 9999,
        quantity: 5,
        type: 'INCREASE',
        reason: 'Recount'
      })
    }).toThrow(/Inventory batch with ID 9999 not found/)
  })

  it('should roll back completely on failure and preserve inventory quantity', () => {
    const { batch } = setupData()

    const db = DatabaseManager.getInstance()
    const initialBatch = db.prepare('SELECT quantity FROM inventory_batches WHERE id = ?').get(batch.id) as any
    expect(initialBatch.quantity).toBe(50)

    // Force failure by passing reason as null (NOT NULL constraint failure)
    expect(() => {
      StockAdjustmentService.createAdjustment({
        inventory_batch_id: batch.id,
        quantity: 10,
        type: 'DECREASE',
        reason: null as any
      })
    }).toThrow()

    // Assert no adjustment record remains
    const countRow = db.prepare('SELECT COUNT(*) as count FROM stock_adjustments').get() as { count: number }
    expect(countRow.count).toBe(0)

    // Assert stock was NOT decreased (rolled back to 50)
    const afterBatch = db.prepare('SELECT quantity FROM inventory_batches WHERE id = ?').get(batch.id) as any
    expect(afterBatch.quantity).toBe(50)
  })
})
