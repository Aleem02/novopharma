import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { SalesReturnService } from '../main/services/salesReturnService'
import { SaleService } from '../main/services/saleService'
import { ProductService } from '../main/services/productService'
import { SupplierService } from '../main/services/supplierService'
import { PurchaseService } from '../main/services/purchaseService'

describe('SalesReturnService Integration Tests', () => {
  beforeEach(() => {
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  const setupData = () => {
    const supplier = SupplierService.createSupplier({
      name: 'Supplier A',
      is_active: 1
    })

    const product = ProductService.createProduct({
      name: 'Amoxicillin 500mg',
      selling_price: 1000, // 10.00 Rs
      tax_rate: 1800,      // 18%
      is_active: 1
    })

    const now = Date.now()

    PurchaseService.createDraft({
      supplier_id: supplier.id,
      purchase_date: now,
      items: [{
        product_id: product.id,
        batch_number: 'B123',
        expiry_date: now + 365 * 24 * 60 * 60 * 1000,
        quantity: 20,
        purchase_price: 600,
        mrp: 1000
      }]
    })

    const purchases = PurchaseService.listPurchases()
    PurchaseService.completePurchase(purchases[0].id)

    const sale = SaleService.createSale({
      payment_method: 'CASH',
      items: [{
        product_id: product.id,
        quantity: 5,
        selling_price: 1000,
        mrp: 1000,
        tax_rate: 1800
      }]
    })

    return { product, sale }
  }

  it('should process a successful partial return, calculate refund, and restore stock', () => {
    const { sale } = setupData()
    const saleItem = sale.items![0]

    const ret = SalesReturnService.createReturn({
      sale_id: sale.id,
      reason: 'Wrong dosage',
      items: [{
        sale_item_id: saleItem.id,
        quantity: 2
      }]
    })

    expect(ret.return_number).toMatch(/^RET-\d{6}$/)
    expect(ret.refund_amount).toBe(2000) // 2 * 1000 paise
    expect(ret.items?.length).toBe(1)
    expect(ret.items![0].original_selling_price).toBe(1000)
    expect(ret.items![0].quantity).toBe(2)

    // Check inventory restored
    const db = DatabaseManager.getInstance()
    const batch = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('B123') as any
    expect(batch.quantity).toBe(17) // 20 - 5 + 2 = 17

    // Check status updated to PARTIALLY_REFUNDED
    const updatedSale = dbUpdateSaleStatusCheck(sale.id)
    expect(updatedSale.status).toBe('PARTIALLY_REFUNDED')
  })

  it('should process a successful full return, update original sale status, and restore stock', () => {
    const { sale } = setupData()
    const saleItem = sale.items![0]

    const ret = SalesReturnService.createReturn({
      sale_id: sale.id,
      reason: 'Defective batch',
      items: [{
        sale_item_id: saleItem.id,
        quantity: 5
      }]
    })

    expect(ret.refund_amount).toBe(5000)

    // Check original sale status updated to REFUNDED
    const updatedSale = dbUpdateSaleStatusCheck(sale.id)
    expect(updatedSale.status).toBe('REFUNDED')

    // Check inventory restored to full
    const db = DatabaseManager.getInstance()
    const batch = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('B123') as any
    expect(batch.quantity).toBe(20) // 20 - 5 + 5 = 20
  })

  it('should allow multiple returns from the same invoice without over-returning', () => {
    const { sale } = setupData()
    const saleItem = sale.items![0]

    // First return: 2
    SalesReturnService.createReturn({
      sale_id: sale.id,
      reason: 'Return 2',
      items: [{ sale_item_id: saleItem.id, quantity: 2 }]
    })

    // Second return: 2 (Total 4)
    SalesReturnService.createReturn({
      sale_id: sale.id,
      reason: 'Return another 2',
      items: [{ sale_item_id: saleItem.id, quantity: 2 }]
    })

    const updatedSale = dbUpdateSaleStatusCheck(sale.id)
    expect(updatedSale.status).toBe('PARTIALLY_REFUNDED')

    // Third return: 2 (Should fail as remaining is 1)
    expect(() => {
      SalesReturnService.createReturn({
        sale_id: sale.id,
        reason: 'Return too many',
        items: [{ sale_item_id: saleItem.id, quantity: 2 }]
      })
    }).toThrow(/Cannot return more than originally sold/)

    // Final return: 1 (Total 5)
    SalesReturnService.createReturn({
      sale_id: sale.id,
      reason: 'Return final 1',
      items: [{ sale_item_id: saleItem.id, quantity: 1 }]
    })

    const finalSale = dbUpdateSaleStatusCheck(sale.id)
    expect(finalSale.status).toBe('REFUNDED')
  })

  it('should reject invalid quantities', () => {
    const { sale } = setupData()
    const saleItem = sale.items![0]

    expect(() => {
      SalesReturnService.createReturn({
        sale_id: sale.id,
        reason: 'Bad quantity',
        items: [{ sale_item_id: saleItem.id, quantity: -1 }]
      })
    }).toThrow(/Return quantity must be a positive integer/)
  })

  it('should roll back completely on failure and preserve inventory quantity', () => {
    const { sale } = setupData()
    const saleItem = sale.items![0]

    const db = DatabaseManager.getInstance()
    const initialBatch = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('B123') as any
    expect(initialBatch.quantity).toBe(15) // 20 - 5

    // We pass reason as null (violates NOT NULL constraint on sales_returns) to force db error
    expect(() => {
      SalesReturnService.createReturn({
        sale_id: sale.id,
        reason: null as any,
        items: [{ sale_item_id: saleItem.id, quantity: 3 }]
      })
    }).toThrow()

    // Assert database contains no new sales returns
    const returnsCount = db.prepare('SELECT COUNT(*) as count FROM sales_returns').get() as { count: number }
    expect(returnsCount.count).toBe(0)

    // Assert inventory quantity was NOT incremented (rolled back to 15)
    const afterBatch = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('B123') as any
    expect(afterBatch.quantity).toBe(15)
  })
})

function dbUpdateSaleStatusCheck(saleId: number) {
  const db = DatabaseManager.getInstance()
  return db.prepare('SELECT status FROM sales WHERE id = ?').get(saleId) as any
}
