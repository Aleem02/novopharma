import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { SettingService } from '../main/services/settingService'
import { ProductService } from '../main/services/productService'
import { PurchaseService } from '../main/services/purchaseService'
import { SaleService } from '../main/services/saleService'
import { SalesReturnService } from '../main/services/salesReturnService'
import { ReportService } from '../main/services/reportService'

describe('Financial Reconciliation', () => {
  let productId: number
  
  beforeAll(() => {
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
    SettingService.initializeDefaults()

    // 1. Setup supplier and product
    db.prepare('INSERT INTO suppliers (name, is_active, created_at, updated_at) VALUES (?, 1, ?, ?)').run('Supplier A', Date.now(), Date.now())
    const product = ProductService.createProduct({
      name: 'Recon Med',
      selling_price: 1000,
      tax_rate: 1200, // 12%
      is_active: 1
    })
    productId = product.id

    // 2. Purchase stock (100 qty)
    const draft = PurchaseService.createDraft({
      supplier_id: 1,
      purchase_date: Date.now(),
      items: [
        {
          product_id: productId,
          batch_number: 'BATCH-R',
          expiry_date: Date.now() + 100000000,
          quantity: 100,
          purchase_price: 500,
          mrp: 1000
        }
      ]
    })
    PurchaseService.completePurchase(draft.id)
  })

  afterAll(() => {
    DatabaseManager.close()
  })

  it('should reconcile sales, returns, taxes, and net amounts correctly', () => {
    const start = 0
    const end = Date.now() + 100000

    // 1. Make 2 sales
    // Sale 1: CASH, 10 units (10000 total) -> Tax is included in 10000
    // Tax formula: (lineTotal * tax_rate) / (10000 + tax_rate)
    // lineTotal = 10000, tax_rate = 1200 => (10000 * 1200) / 11200 = 1071 tax
    const sale1 = SaleService.createSale({
      payment_method: 'CASH',
      items: [
        { product_id: productId, quantity: 10, selling_price: 1000, mrp: 1000, tax_rate: 1200 }
      ]
    })
    expect(sale1.total_amount).toBe(10000)
    expect(sale1.tax_amount).toBe(1071)
    
    // Sale 2: CARD, 20 units (20000 total) => Tax = 2143
    const sale2 = SaleService.createSale({
      payment_method: 'CARD',
      items: [
        { product_id: productId, quantity: 20, selling_price: 1000, mrp: 1000, tax_rate: 1200 }
      ]
    })
    expect(sale2.total_amount).toBe(20000)
    expect(sale2.tax_amount).toBe(2143)

    // 2. Financial Summary Before Return
    let summary = ReportService.getFinancials(start, end)
    expect(summary.todaySales).toBe(30000) // Gross Sales
    expect(summary.totalTax).toBe(3214)    // 1071 + 2143
    expect(summary.cashSales).toBe(10000)
    expect(summary.cardSales).toBe(20000)
    expect(summary.returnsRefunds).toBe(0)
    expect(summary.netSales).toBe(30000)

    // 3. Make a partial return on Sale 1 (CASH)
    // Returning 5 units = 5000 total refund.
    // Refund tax = (5000 * 1200) / 11200 = 536
    const salesReturn = SalesReturnService.createReturn({
      sale_id: sale1.id,
      reason: 'Damaged',
      items: [
        { sale_item_id: sale1.items![0].id, quantity: 5 }
      ]
    })
    expect(salesReturn.refund_amount).toBe(5000)
    
    // 4. Financial Summary After Return
    summary = ReportService.getFinancials(start, end)
    
    expect(summary.todaySales).toBe(30000) // Gross Sales should stay the same
    expect(summary.returnsRefunds).toBe(5000)
    expect(summary.netSales).toBe(25000) // 30000 - 5000
    
    // Tax Reconciliation
    // Returned tax should be deducted
    expect(summary.totalTax).toBe(3214 - 536)

    // Payment Method Reconciliation
    // Original CASH sale was 10000. Refund was 5000. Net CASH = 5000.
    expect(summary.cashSales).toBe(5000)
    
    // CARD was unaffected
    expect(summary.cardSales).toBe(20000)
  })
  
  it('should list paginated reports correctly', () => {
    const start = 0
    const end = Date.now() + 100000

    const salesReport = ReportService.getSales(start, end, 1, 10)
    expect(salesReport.items.length).toBe(2)
    expect(salesReport.total).toBe(2)

    const returnsReport = ReportService.getSalesReturns(start, end, 1, 10)
    expect(returnsReport.items.length).toBe(1)
    expect(returnsReport.total).toBe(1)

    const inventoryReport = ReportService.getInventory(1, 10, false)
    expect(inventoryReport.items.length).toBeGreaterThan(0)
    expect(inventoryReport.items[0].product_name).toBe('Recon Med')
    // Originally 100, sold 10 + 20 = 30 => 70. Return 5 => 75.
    expect(inventoryReport.items[0].quantity).toBe(75)
  })
})
