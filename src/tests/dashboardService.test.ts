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

  it('should calculate correct sales trend with return deductions and cancelled sale exclusions', () => {
    const supplier = SupplierService.createSupplier({ name: 'Supplier Trend', is_active: 1 })
    const product = ProductService.createProduct({
      name: 'Trend Medicine',
      selling_price: 500,
      tax_rate: 0,
      is_active: 1
    })

    const now = Date.now()
    PurchaseService.createDraft({
      supplier_id: supplier.id,
      purchase_date: now - 86400000,
      items: [{
        product_id: product.id,
        batch_number: 'BATCH-TREND',
        expiry_date: now + 365 * 86400000,
        quantity: 100,
        purchase_price: 200,
        mrp: 500
      }]
    })
    const purchases = PurchaseService.listPurchases()
    PurchaseService.completePurchase(purchases[0].id)

    // Sale 1: completed
    const sale1 = SaleService.createSale({
      payment_method: 'CASH',
      items: [{
        product_id: product.id,
        quantity: 10,
        selling_price: 500,
        mrp: 500,
        tax_rate: 0
      }]
    })

    // Return 1: partial refund on Sale 1
    SalesReturnService.createReturn({
      sale_id: sale1.id,
      reason: 'Damaged item',
      items: [{ sale_item_id: sale1.items![0].id, quantity: 2 }]
    })

    const trend = DashboardService.getSalesTrend(now - 86400000, now + 86400000)
    expect(trend.length).toBeGreaterThan(0)
    
    // Gross: 10 * 500 = 5000, Refund: 2 * 500 = 1000, Net: 4000
    const totalTrendAmount = trend.reduce((sum, item) => sum + item.amount, 0)
    expect(totalTrendAmount).toBe(4000)
  })

  it('should calculate top selling products with return deductions and deterministic order', () => {
    const supplier = SupplierService.createSupplier({ name: 'Supplier Top', is_active: 1 })
    const productA = ProductService.createProduct({ name: 'Med Alpha', selling_price: 1000, tax_rate: 0, is_active: 1 })
    const productB = ProductService.createProduct({ name: 'Med Beta', selling_price: 200, tax_rate: 0, is_active: 1 })

    const now = Date.now()
    PurchaseService.createDraft({
      supplier_id: supplier.id,
      purchase_date: now - 86400000,
      items: [
        { product_id: productA.id, batch_number: 'BATCH-A', expiry_date: now + 365 * 86400000, quantity: 100, purchase_price: 500, mrp: 1000 },
        { product_id: productB.id, batch_number: 'BATCH-B', expiry_date: now + 365 * 86400000, quantity: 100, purchase_price: 100, mrp: 200 }
      ]
    })
    const purchases = PurchaseService.listPurchases()
    PurchaseService.completePurchase(purchases[0].id)

    // Sale Alpha
    SaleService.createSale({
      payment_method: 'UPI',
      items: [{ product_id: productA.id, quantity: 5, selling_price: 1000, mrp: 1000, tax_rate: 0 }]
    })

    // Sale Beta
    SaleService.createSale({
      payment_method: 'CASH',
      items: [{ product_id: productB.id, quantity: 10, selling_price: 200, mrp: 200, tax_rate: 0 }]
    })

    const topSelling = DashboardService.getTopSellingProducts(now - 86400000, now + 86400000, 5)
    expect(topSelling.length).toBe(2)
    
    // Product A: 5000 salesAmount, Product B: 2000 salesAmount. Alpha should rank first!
    expect(topSelling[0].productId).toBe(productA.id)
    expect(topSelling[0].salesAmount).toBe(5000)
    expect(topSelling[0].quantitySold).toBe(5)

    expect(topSelling[1].productId).toBe(productB.id)
    expect(topSelling[1].salesAmount).toBe(2000)
    expect(topSelling[1].quantitySold).toBe(10)
  })

  it('TEST 1: Medicine with expired batch (50) and valid batch (4) -> lowStockCount=1, expiredCount=1', () => {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    const med = ProductService.createProduct({ name: 'Med Test 1', selling_price: 100, tax_rate: 0, is_active: 1 })
    
    // Expired batch = 50
    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, 'EXP-50', ?, 50, 100, 50, 100, ?, ?)
    `).run(med.id, now - 86400000, now, now)

    // Valid batch = 4
    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, 'VAL-4', ?, 4, 100, 50, 100, ?, ?)
    `).run(med.id, now + 365 * 86400000, now, now)

    const summary = DashboardService.getSummary()
    expect(summary.lowStockCount).toBe(1) // Usable stock is 4 <= 10
    expect(summary.expiredCount).toBe(1) // Expired batch count is 1
  })

  it('TEST 2: Medicine with expired batch (50) and valid batch (20) -> lowStockCount=0, expiredCount=1', () => {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    const med = ProductService.createProduct({ name: 'Med Test 2', selling_price: 100, tax_rate: 0, is_active: 1 })
    
    // Expired batch = 50
    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, 'EXP-50', ?, 50, 100, 50, 100, ?, ?)
    `).run(med.id, now - 86400000, now, now)

    // Valid batch = 20
    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, 'VAL-20', ?, 20, 100, 50, 100, ?, ?)
    `).run(med.id, now + 365 * 86400000, now, now)

    const summary = DashboardService.getSummary()
    expect(summary.lowStockCount).toBe(0) // Usable stock is 20 > 10
    expect(summary.expiredCount).toBe(1) // Expired batch count is 1
  })

  it('TEST 3: Batch expires within 90 days and quantity > 0 -> expiringSoonCount=1, expiredCount=0', () => {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    const med = ProductService.createProduct({ name: 'Med Test 3', selling_price: 100, tax_rate: 0, is_active: 1 })
    
    // Expiring soon batch (30 days from now)
    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, 'SOON-30', ?, 15, 100, 50, 100, ?, ?)
    `).run(med.id, now + 30 * 86400000, now, now)

    const summary = DashboardService.getSummary()
    expect(summary.expiringSoonCount).toBe(1)
    expect(summary.expiredCount).toBe(0)
  })

  it('TEST 4: Expired batch has quantity = 0 -> expiredCount=0', () => {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    const med = ProductService.createProduct({ name: 'Med Test 4', selling_price: 100, tax_rate: 0, is_active: 1 })
    
    // Expired batch with 0 quantity
    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, 'EXP-0', ?, 0, 100, 50, 100, ?, ?)
    `).run(med.id, now - 86400000, now, now)

    const summary = DashboardService.getSummary()
    expect(summary.expiredCount).toBe(0)
  })

  it('TEST 5: Already expired batch -> not in expiringSoon, in expiredCount if quantity > 0', () => {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    const med = ProductService.createProduct({ name: 'Med Test 5', selling_price: 100, tax_rate: 0, is_active: 1 })
    
    // Already expired batch with quantity 10
    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, selling_price, created_at, updated_at)
      VALUES (?, 'EXP-10', ?, 10, 100, 50, 100, ?, ?)
    `).run(med.id, now - 10 * 86400000, now, now)

    const summary = DashboardService.getSummary()
    expect(summary.expiringSoonCount).toBe(0)
    expect(summary.expiredCount).toBe(1)
  })
})
