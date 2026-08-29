import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { PurchaseReturnService } from '../main/services/purchaseReturnService'
import { ProductService } from '../main/services/productService'
import { SupplierService } from '../main/services/supplierService'
import { PurchaseService } from '../main/services/purchaseService'

describe('PurchaseReturnService Integration Tests', () => {
  beforeEach(() => {
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  const setupData = () => {
    const supplier = SupplierService.createSupplier({
      name: 'Supplier B',
      is_active: 1
    })

    const product = ProductService.createProduct({
      name: 'Ibuprofen 400mg',
      selling_price: 800,
      tax_rate: 1200,
      is_active: 1
    })

    const now = Date.now()

    PurchaseService.createDraft({
      supplier_id: supplier.id,
      purchase_date: now,
      items: [{
        product_id: product.id,
        batch_number: 'IBU999',
        expiry_date: now + 365 * 24 * 60 * 60 * 1000,
        quantity: 15,
        purchase_price: 500,
        mrp: 800
      }]
    })

    const purchases = PurchaseService.listPurchases()
    const purchase = PurchaseService.completePurchase(purchases[0].id)

    return { product, purchase }
  }

  it('should successfully return stock and deduct from inventory', () => {
    const { purchase } = setupData()
    const purchaseItem = purchase.items![0]

    const ret = PurchaseReturnService.createReturn({
      purchase_id: purchase.id,
      reason: 'Expired items',
      items: [{
        purchase_item_id: purchaseItem.id,
        quantity: 5
      }]
    })

    expect(ret.return_number).toMatch(/^PR-\d{6}$/)
    expect(ret.total_amount).toBe(2500) // 5 * 500 paise
    expect(ret.items?.length).toBe(1)
    expect(ret.items![0].purchase_price).toBe(500)

    // Verify inventory deduction
    const db = DatabaseManager.getInstance()
    const batch = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('IBU999') as any
    expect(batch.quantity).toBe(10) // 15 - 5
  })

  it('should reject returning more than purchased quantity', () => {
    const { purchase } = setupData()
    const purchaseItem = purchase.items![0]

    expect(() => {
      PurchaseReturnService.createReturn({
        purchase_id: purchase.id,
        reason: 'Too many',
        items: [{
          purchase_item_id: purchaseItem.id,
          quantity: 20
        }]
      })
    }).toThrow(/Cannot return more than originally purchased/)
  })

  it('should prevent return if current batch quantity is less than returning quantity', () => {
    const { purchase } = setupData()
    const purchaseItem = purchase.items![0]

    // Mutate the batch quantity directly (simulating that some stock was sold)
    const db = DatabaseManager.getInstance()
    db.prepare('UPDATE inventory_batches SET quantity = 3 WHERE batch_number = ?').run('IBU999')

    expect(() => {
      PurchaseReturnService.createReturn({
        purchase_id: purchase.id,
        reason: 'Return 5 items',
        items: [{
          purchase_item_id: purchaseItem.id,
          quantity: 5 // Stock is only 3, should fail
        }]
      })
    }).toThrow(/Insufficient stock in inventory batch/)
  })

  it('should roll back completely on failure and preserve inventory quantity', () => {
    const { purchase } = setupData()
    const purchaseItem = purchase.items![0]

    const db = DatabaseManager.getInstance()
    const initialBatch = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('IBU999') as any
    expect(initialBatch.quantity).toBe(15)

    // Pass reason as null to cause NOT NULL constraint error on purchase_returns
    expect(() => {
      PurchaseReturnService.createReturn({
        purchase_id: purchase.id,
        reason: null as any,
        items: [{ purchase_item_id: purchaseItem.id, quantity: 5 }]
      })
    }).toThrow()

    // Assert no purchase return record was created
    const returnsCount = db.prepare('SELECT COUNT(*) as count FROM purchase_returns').get() as { count: number }
    expect(returnsCount.count).toBe(0)

    // Assert stock was NOT deducted (rolled back to 15)
    const afterBatch = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('IBU999') as any
    expect(afterBatch.quantity).toBe(15)
  })
})
