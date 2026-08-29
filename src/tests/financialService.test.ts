import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { FinancialService } from '../main/services/financialService'
import { SaleService } from '../main/services/saleService'
import { ProductService } from '../main/services/productService'
import { SupplierService } from '../main/services/supplierService'
import { PurchaseService } from '../main/services/purchaseService'
import { SalesReturnService } from '../main/services/salesReturnService'

describe('FinancialService Integration Tests', () => {
  beforeEach(() => {
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  const setupData = () => {
    const supplier = SupplierService.createSupplier({ name: 'Supplier F', is_active: 1 })
    const product = ProductService.createProduct({
      name: 'Vitamin C 500mg',
      selling_price: 2000,
      tax_rate: 1800,
      is_active: 1
    })

    const now = Date.now()

    PurchaseService.createDraft({
      supplier_id: supplier.id,
      purchase_date: now,
      items: [{
        product_id: product.id,
        batch_number: 'VIT001',
        expiry_date: now + 365 * 24 * 60 * 60 * 1000,
        quantity: 100,
        purchase_price: 50,
        mrp: 2000,
        selling_price: 2000
      }]
    })

    const purchases = PurchaseService.listPurchases()
    PurchaseService.completePurchase(purchases[0].id)

    // Sale 1: CASH, 10 units * 2000 = 20000
    const sale1 = SaleService.createSale({
      payment_method: 'CASH',
      items: [{ product_id: product.id, quantity: 10, selling_price: 2000, mrp: 2000, tax_rate: 1800 }]
    })

    // Sale 2: CARD, 5 units * 2000 = 10000
    const sale2 = SaleService.createSale({
      payment_method: 'CARD',
      items: [{ product_id: product.id, quantity: 5, selling_price: 2000, mrp: 2000, tax_rate: 1800 }]
    })

    return { product, sale1, sale2 }
  }

  it('should calculate correct totals, returns, payment breakdown, and net sales', () => {
    setupData()

    // Sale 1: 10 * 2000 = 20000. Tax = Math.round(20000 * 1800 / 11800) = 3051
    // Sale 2: 5 * 2000 = 10000. Tax = Math.round(10000 * 1800 / 11800) = 1525
    // Total Sales = 30000. Total Tax = 4576

    const summary = FinancialService.getSummary('TODAY')

    expect(summary.todayInvoicesCount).toBe(2)
    expect(summary.todaySales).toBe(30000)
    expect(summary.totalTax).toBe(4576)
    expect(summary.cashSales).toBe(20000)
    expect(summary.cardSales).toBe(10000)
    expect(summary.upiSales).toBe(0)
    expect(summary.returnsRefunds).toBe(0)
    expect(summary.netSales).toBe(30000)
  })

  it('should subtract partial returns from net tax, net sales, and respective payment methods', () => {
    const { sale1 } = setupData()

    // Return 2 items from sale1 (CASH)
    SalesReturnService.createReturn({
      sale_id: sale1.id,
      reason: 'Partial Return',
      items: [{ sale_item_id: sale1.items![0].id, quantity: 2 }]
    })

    const summary = FinancialService.getSummary('TODAY')

    // Gross Sales remains 30000
    expect(summary.todaySales).toBe(30000)

    // Returned tax: Math.round(3051 * 2 / 10) = 610
    const expectedTax = 4576 - 610
    expect(summary.totalTax).toBe(expectedTax)
    
    // Refunds = 4000
    expect(summary.returnsRefunds).toBe(4000)

    // cashSales net of refunds
    const expectedCashNet = 20000 - 4000
    expect(summary.cashSales).toBe(expectedCashNet)
    
    // cardSales should be unaffected
    expect(summary.cardSales).toBe(10000)
  })
})
