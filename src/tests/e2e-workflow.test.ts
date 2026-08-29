import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { ProductService } from '../main/services/productService'
import { CustomerService } from '../main/services/customerService'
import { SupplierService } from '../main/services/supplierService'
import { PurchaseService } from '../main/services/purchaseService'
import { SaleService } from '../main/services/saleService'
import { ReportService } from '../main/services/reportService'
import { DashboardService } from '../main/services/dashboardService'
import { InventoryService } from '../main/services/inventoryService'
import { ApiClient } from '../main/services/apiClient'
import * as fs from 'fs'
import * as path from 'path'

// Mock Electron app
vi.mock('electron', () => {
  return {
    app: {
      getPath: vi.fn((name) => {
        if (name === 'userData') return path.join(process.cwd(), '.test_userdata')
        return process.cwd()
      }),
      getVersion: () => '1.0.0'
    },
    ipcMain: { handle: vi.fn(), on: vi.fn() }
  }
})

describe('ERP End-to-End Workflow & Offline Testing', () => {
  let createdProductId: string;
  let createdCustomerId: string;
  let createdSupplierId: string;
  let purchaseId: number;
  let saleId: number;
  
  beforeAll(async () => {
    // Ensure clean state
    const dbPath = path.join(process.cwd(), '.test_userdata', 'novopharma_v1.sqlite')
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
    
    // Disable network completely for offline testing
    vi.spyOn(ApiClient, 'request').mockRejectedValue(new Error('NETWORK_UNAVAILABLE'))
    
    const dbDir = path.dirname(dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    const db = DatabaseManager.initialize(dbPath)
    MigrationRunner.run(db)
  })

  afterAll(() => {
    DatabaseManager.close()
  })

  describe('D. Master Data', () => {
    it('should create and retrieve a Product offline', async () => {
      const product = await ProductService.createProduct({
        name: 'Test Paracetamol',
        generic_name: 'Paracetamol 500mg',
        category: 'Tablets',
        unit: 'Strip',
        selling_price: 15,
        tax_rate: 0
      })
      expect(product).toBeDefined()
      expect(product.id).toBeDefined()
      createdProductId = product.id

      const fetched = await ProductService.getProduct(createdProductId)
      expect(fetched?.name).toBe('Test Paracetamol')
      const stock = InventoryService.getByProductId(createdProductId).reduce((sum, b) => sum + b.quantity, 0)
      expect(stock).toBe(0) // Initial stock is 0
    })

    it('should create and retrieve a Customer offline', async () => {
      const customer = await CustomerService.createCustomer({
        name: 'John Doe',
        phone: '1234567890',
        email: 'john@example.com',
        address: '123 Test St'
      })
      expect(customer).toBeDefined()
      createdCustomerId = customer.id
      
      const fetched = await CustomerService.getCustomer(createdCustomerId)
      expect(fetched?.name).toBe('John Doe')
    })

    it('should create and retrieve a Supplier offline', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'PharmaCorp',
        contact_person: 'Jane Smith',
        phone: '0987654321',
        email: 'contact@pharmacorp.com',
        address: '456 Pharma Ave'
      })
      expect(supplier).toBeDefined()
      createdSupplierId = supplier.id
      
      const fetched = await SupplierService.getSupplier(createdSupplierId)
      expect(fetched?.name).toBe('PharmaCorp')
    })
  })

  describe('E. Purchase Workflow', () => {
    it('should complete a purchase and update stock offline', async () => {
      const draft = PurchaseService.createDraft({
        supplier_id: createdSupplierId,
        purchase_date: Date.now(),
        invoice_number: 'INV-123456',
        items: [
          {
            product_id: createdProductId,
            batch_number: 'BATCH-001',
            expiry_date: Date.now() + 86400000 * 365, // 1 year
            quantity: 100,
            purchase_price: 10,
            mrp: 15,
            selling_price: 15
          }
        ]
      })
      
      const purchase = PurchaseService.completePurchase(draft.id)
      
      expect(purchase).toBeDefined()
      expect(purchase.id).toBeDefined()
      purchaseId = purchase.id

      // Verify stock was updated
      const stock = InventoryService.getByProductId(createdProductId).reduce((sum, b) => sum + b.quantity, 0)
      expect(stock).toBe(100)
    })
  })

  describe('F. Sales/POS Workflow', () => {
    it('should complete a sale and reduce stock offline', async () => {
      const sale = SaleService.createSale({
        customer_id: createdCustomerId,
        payments: [{ payment_method: 'CASH', amount: 30 }],
        received_amount: 30,
        change_amount: 0,
        items: [
          {
            product_id: createdProductId,
            quantity: 2,
            selling_price: 15,
            mrp: 15,
            tax_rate: 0
          }
        ]
      })
      
      expect(sale).toBeDefined()
      expect(sale.id).toBeDefined()
      saleId = sale.id

      // Verify stock was reduced (100 - 2 = 98)
      const stock = InventoryService.getByProductId(createdProductId).reduce((sum, b) => sum + b.quantity, 0)
      expect(stock).toBe(98)
    })
  })

  describe('G. Reports & Dashboard', () => {
    it('should generate accurate reports offline', () => {
      const salesReport = ReportService.getSales(Date.now() - 86400000, Date.now() + 86400000)
      expect(salesReport.items.length).toBe(1)
      expect(salesReport.items[0].total_amount).toBe(30)
      
      const batches = InventoryService.listInventory()
      const totalValuation = batches.reduce((sum, b) => sum + (b.quantity * b.purchase_price), 0)
      expect(totalValuation).toBe(980)
    })
    
    it('should load dashboard data offline', () => {
      const stats = DashboardService.getSummary()
      expect(stats.todaySales).toBe(30)
      expect(stats.totalProducts).toBe(1)
      expect(stats.lowStockCount).toBe(0) // Stock is 98, min is 50
    })
  })
  
  describe('K. Network Dependency Audit', () => {
    it('should not have made any network calls during the entire ERP workflow', () => {
      // ApiClient.request is mocked to throw NETWORK_UNAVAILABLE. 
      // Since no tests failed, it proves the core ERP logic handles everything offline perfectly.
      expect(ApiClient.request).not.toHaveBeenCalled()
    })
  })
})
