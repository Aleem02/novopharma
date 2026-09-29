import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { SaleService } from '../main/services/saleService'
import { ProductService } from '../main/services/productService'
import { CustomerService } from '../main/services/customerService'

describe('SalesHistory Repository & Service Tests', () => {
  beforeEach(async () => {
    const db = DatabaseManager.initialize(':memory:')
    await MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  const setupTestData = () => {
    // Create products
    const p1 = ProductService.createProduct({
      name: 'Paracetamol 500mg',
      generic_name: 'Acetaminophen',
      barcode: '8901234567890',
      selling_price: 5000, // 50.00
      tax_rate: 1200
    })
    const p2 = ProductService.createProduct({
      name: 'Azithromycin 250mg',
      generic_name: 'Azithromycin',
      barcode: '8901234567891',
      selling_price: 12000, // 120.00
      tax_rate: 1200
    })

    // Create stock batches
    const db = DatabaseManager.getInstance()
    const now = Date.now()
    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, purchase_price, mrp, selling_price, created_at, updated_at)
      VALUES (?, 'BAT-101', ?, 100, 3000, 6000, 5000, ?, ?)
    `).run(p1.id, now + 365 * 24 * 3600 * 1000, now, now)

    db.prepare(`
      INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, purchase_price, mrp, selling_price, created_at, updated_at)
      VALUES (?, 'BAT-102', ?, 100, 8000, 15000, 12000, ?, ?)
    `).run(p2.id, now + 365 * 24 * 3600 * 1000, now, now)

    // Create customers
    const c1 = CustomerService.createCustomer({
      name: 'Rahul Sharma',
      phone: '9876543210'
    })

    // Create Sales
    const sale1 = SaleService.createSale({
      customer_id: c1.id,
      payment_method: 'CASH',
      payments: [{ payment_method: 'CASH', amount: 5000 }],
      items: [{ product_id: p1.id, quantity: 1 }]
    })

    const sale2 = SaleService.createSale({
      payment_method: 'UPI',
      payments: [{ payment_method: 'UPI', amount: 12000 }],
      items: [{ product_id: p2.id, quantity: 1 }]
    })

    return { p1, p2, c1, sale1, sale2 }
  }

  describe('Paginated Sales & Search', () => {
    it('returns default paginated sales', () => {
      setupTestData()
      const result = SaleService.getPaginatedSales({ page: 1, pageSize: 25 })
      expect(result.items.length).toBe(2)
      expect(result.total).toBe(2)
      expect(result.page).toBe(1)
    })

    it('searches by invoice number', () => {
      const { sale1 } = setupTestData()
      const result = SaleService.getPaginatedSales({ page: 1, pageSize: 25, search: sale1.invoice_number })
      expect(result.items.length).toBe(1)
      expect(result.items[0].invoice_number).toBe(sale1.invoice_number)
    })

    it('searches by customer name', () => {
      setupTestData()
      const result = SaleService.getPaginatedSales({ page: 1, pageSize: 25, search: 'Rahul' })
      expect(result.items.length).toBe(1)
      expect(result.items[0].customer?.name).toBe('Rahul Sharma')
    })

    it('searches by customer phone', () => {
      setupTestData()
      const result = SaleService.getPaginatedSales({ page: 1, pageSize: 25, search: '9876543210' })
      expect(result.items.length).toBe(1)
      expect(result.items[0].customer?.phone).toBe('9876543210')
    })

    it('searches by product name', () => {
      setupTestData()
      const result = SaleService.getPaginatedSales({ page: 1, pageSize: 25, search: 'Azithromycin' })
      expect(result.items.length).toBe(1)
    })

    it('searches by barcode', () => {
      setupTestData()
      const result = SaleService.getPaginatedSales({ page: 1, pageSize: 25, search: '8901234567890' })
      expect(result.items.length).toBe(1)
    })
  })

  describe('Filtering & Sorting', () => {
    it('filters by status', () => {
      setupTestData()
      const result = SaleService.getPaginatedSales({ page: 1, pageSize: 25, status: 'COMPLETED' })
      expect(result.items.length).toBe(2)

      const resultRefunded = SaleService.getPaginatedSales({ page: 1, pageSize: 25, status: 'REFUNDED' })
      expect(resultRefunded.items.length).toBe(0)
    })

    it('filters by payment method', () => {
      setupTestData()
      const cashSales = SaleService.getPaginatedSales({ page: 1, pageSize: 25, paymentMethod: 'CASH' })
      expect(cashSales.items.length).toBe(1)
      expect(cashSales.items[0].payment_method).toBe('CASH')

      const upiSales = SaleService.getPaginatedSales({ page: 1, pageSize: 25, paymentMethod: 'UPI' })
      expect(upiSales.items.length).toBe(1)
      expect(upiSales.items[0].payment_method).toBe('UPI')
    })

    it('filters by customer', () => {
      const { c1 } = setupTestData()
      const customerSales = SaleService.getPaginatedSales({ page: 1, pageSize: 25, customerId: c1.id })
      expect(customerSales.items.length).toBe(1)

      const walkInSales = SaleService.getPaginatedSales({ page: 1, pageSize: 25, customerId: 'WALK_IN' })
      expect(walkInSales.items.length).toBe(1)
    })

    it('filters by date range', () => {
      const { sale1 } = setupTestData()
      const now = Date.now()
      const dateFrom = now - 60000
      const dateTo = now + 60000

      const dateSales = SaleService.getPaginatedSales({ page: 1, pageSize: 25, dateFrom, dateTo })
      expect(dateSales.items.length).toBe(2)

      const oldDateSales = SaleService.getPaginatedSales({ page: 1, pageSize: 25, dateFrom: now + 100000, dateTo: now + 200000 })
      expect(oldDateSales.items.length).toBe(0)
    })

    it('sorts by total amount ascending and descending', () => {
      setupTestData()
      const ascSales = SaleService.getPaginatedSales({ page: 1, pageSize: 25, sortBy: 'total_amount', sortDirection: 'ASC' })
      expect(ascSales.items[0].total_amount).toBeLessThan(ascSales.items[1].total_amount)

      const descSales = SaleService.getPaginatedSales({ page: 1, pageSize: 25, sortBy: 'total_amount', sortDirection: 'DESC' })
      expect(descSales.items[0].total_amount).toBeGreaterThan(descSales.items[1].total_amount)
    })
  })

  describe('KPI Calculations', () => {
    it('calculates KPIs correctly', () => {
      setupTestData()
      const kpis = SaleService.getSalesKpis({})
      expect(kpis.totalTransactionsCount).toBe(2)
      expect(kpis.completedTransactionsCount).toBe(2)
      expect(kpis.refundedTransactionsCount).toBe(0)
      expect(kpis.salesAmount).toBe(17000) // 5000 + 12000
      expect(kpis.averageBillAmount).toBe(8500) // 17000 / 2
      expect(kpis.totalItemsSold).toBe(2)
    })

    it('handles zero sales gracefully for KPIs', () => {
      const kpis = SaleService.getSalesKpis({})
      expect(kpis.totalTransactionsCount).toBe(0)
      expect(kpis.completedTransactionsCount).toBe(0)
      expect(kpis.salesAmount).toBe(0)
      expect(kpis.averageBillAmount).toBe(0)
      expect(kpis.totalItemsSold).toBe(0)
    })
  })

  describe('CSV Export Data Retrieval', () => {
    it('retrieves export sales dataset without pagination cap', () => {
      setupTestData()
      const exportItems = SaleService.getExportSales({})
      expect(exportItems.length).toBe(2)
      expect(exportItems[0].invoice_number).toBeDefined()
    })
  })
})
