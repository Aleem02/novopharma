import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { DashboardService } from '../main/services/dashboardService'
import { SaleService } from '../main/services/saleService'
import { ProductService } from '../main/services/productService'
import { SupplierService } from '../main/services/supplierService'
import { PurchaseService } from '../main/services/purchaseService'
import { SalesReturnService } from '../main/services/salesReturnService'
import { StockAdjustmentService } from '../main/services/stockAdjustmentService'

describe('DashboardService Integration Tests', () => {
  beforeEach(() => {
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  it('should return correct dashboard summaries, alerts, and recent activities', () => {
    const supplier = SupplierService.createSupplier({ name: 'Supplier D', is_active: 1 })
    
    // Product 1: Low stock (10 quantity)
    const product1 = ProductService.createProduct({
      name: 'Product Low Stock',
      selling_price: 100,
      tax_rate: 0,
      is_active: 1
    })

    // Product 2: High stock (50 quantity)
    const product2 = ProductService.createProduct({
      name: 'Product High Stock',
      selling_price: 200,
      tax_rate: 0,
      is_active: 1
    })

    const now = Date.now()

    // Purchase 1: Stock inventory
    PurchaseService.createDraft({
      supplier_id: supplier.id,
      purchase_date: now,
      items: [
        {
          product_id: product1.id,
          batch_number: 'BATCH-LOW',
          expiry_date: now + 365 * 24 * 60 * 60 * 1000,
          quantity: 10,
          purchase_price: 50,
          mrp: 100
        },
        {
          product_id: product2.id,
          batch_number: 'BATCH-EXP',
          expiry_date: now + 10 * 24 * 60 * 60 * 1000, // Expires in 10 days
          quantity: 50,
          purchase_price: 100,
          mrp: 200
        }
      ]
    })

    const purchases = PurchaseService.listPurchases()
    PurchaseService.completePurchase(purchases[0].id)

    // Create a sale
    const sale = SaleService.createSale({
      payment_method: 'CASH',
      items: [{
        product_id: product2.id,
        quantity: 2,
        selling_price: 200,
        mrp: 200,
        tax_rate: 0
      }]
    })

    // Process a return
    SalesReturnService.createReturn({
      sale_id: sale.id,
      reason: 'Wrong product',
      items: [{ sale_item_id: sale.items![0].id, quantity: 1 }]
    })

    // Process a stock adjustment
    const db = DatabaseManager.getInstance()
    const batchLow = db.prepare('SELECT id FROM inventory_batches WHERE batch_number = ?').get('BATCH-LOW') as { id: number }
    StockAdjustmentService.createAdjustment({
      inventory_batch_id: batchLow.id,
      quantity: 5,
      type: 'INCREASE',
      reason: 'Found more stock'
    })

    // Fetch dashboard summary
    const summary = DashboardService.getSummary()

    expect(summary.todaySales).toBe(400) // 2 * 200 = 400 paise
    expect(summary.todayInvoicesCount).toBe(1)
    expect(summary.totalProducts).toBe(2)
    
    // BATCH-LOW has 10 quantity + 5 adjusted = 15. So lowStockCount should be 0 because both are > 10.
    // Let's verify:
    expect(summary.lowStockCount).toBe(0)

    // BATCH-EXP has expiry in 10 days, quantity 48 (50 - 2 sold + 1 returned = 49). So expiringSoonCount should be 1.
    expect(summary.expiringSoonCount).toBe(1)
    expect(summary.todayReturnsCount).toBe(1)

    // Check recent activities length
    expect(summary.recentSales.length).toBe(1)
    expect(summary.recentPurchases.length).toBe(1)
    expect(summary.recentReturns.length).toBe(1)
    expect(summary.recentAdjustments.length).toBe(1)
  })
})
