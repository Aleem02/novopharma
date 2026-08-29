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
        genericName: 'Paracetamol 500mg',
        categoryId: 'cat_1',
        categoryName: 'Tablets',
        unitId: 'unit_1',
        unitName: 'Strip',
        purchasePrice: 10,
        sellingPrice: 15,
        minStockLevel: 50,
        requiresPrescription: false
      })
      expect(product).toBeDefined()
      expect(product.id).toBeDefined()
      createdProductId = product.id

      const fetched = await ProductService.getProductById(createdProductId)
      expect(fetched?.name).toBe('Test Paracetamol')
      expect(fetched?.stockQuantity).toBe(0) // Initial stock is 0
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
      
      const fetched = await CustomerService.getCustomerById(createdCustomerId)
      expect(fetched?.name).toBe('John Doe')
    })

    it('should create and retrieve a Supplier offline', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'PharmaCorp',
        contactPerson: 'Jane Smith',
        phone: '0987654321',
        email: 'contact@pharmacorp.com',
        address: '456 Pharma Ave'
      })
      expect(supplier).toBeDefined()
      createdSupplierId = supplier.id
      
      const fetched = await SupplierService.getSupplierById(createdSupplierId)
      expect(fetched?.name).toBe('PharmaCorp')
    })
  })

  describe('E. Purchase Workflow', () => {
    it('should complete a purchase and update stock offline', async () => {
      const purchase = await PurchaseService.createPurchase({
        supplierId: createdSupplierId,
        supplierName: 'PharmaCorp',
        purchaseDate: Date.now(),
        status: 'COMPLETED',
        totalAmount: 1000,
        notes: 'Monthly restock',
        items: [
          {
            productId: createdProductId,
            productName: 'Test Paracetamol',
            batchNumber: 'BATCH-001',
            expiryDate: Date.now() + 86400000 * 365, // 1 year
            quantity: 100,
            unitPrice: 10,
            totalPrice: 1000
          }
        ]
      })
      
      expect(purchase).toBeDefined()
      expect(purchase.id).toBeDefined()
      purchaseId = purchase.id

      // Verify stock was updated
      const product = await ProductService.getProductById(createdProductId)
      expect(product?.stockQuantity).toBe(100)
    })
  })

  describe('F. Sales/POS Workflow', () => {
    it('should complete a sale and reduce stock offline', async () => {
      const sale = await SaleService.createSale({
        customerId: createdCustomerId,
        customerName: 'John Doe',
        saleDate: Date.now(),
        status: 'COMPLETED',
        subTotal: 30,
        discount: 0,
        tax: 0,
        totalAmount: 30,
        paymentMethod: 'CASH',
        items: [
          {
            productId: createdProductId,
            productName: 'Test Paracetamol',
            quantity: 2,
            unitPrice: 15,
            totalPrice: 30
          }
        ]
      })
      
      expect(sale).toBeDefined()
      expect(sale.id).toBeDefined()
      saleId = sale.id

      // Verify stock was reduced (100 - 2 = 98)
      const product = await ProductService.getProductById(createdProductId)
      expect(product?.stockQuantity).toBe(98)
    })
  })

  describe('G. Reports & Dashboard', () => {
    it('should generate accurate reports offline', async () => {
      const salesReport = await ReportService.getSalesReport(Date.now() - 86400000, Date.now() + 86400000)
      expect(salesReport.totalSales).toBe(30)
      
      const inventoryReport = await ReportService.getInventoryValuationReport()
      // 98 items * 10 purchase price = 980
      expect(inventoryReport.totalValuation).toBe(980)
    })
    
    it('should load dashboard data offline', async () => {
      const stats = await DashboardService.getStats()
      expect(stats.todaySales).toBe(30)
      expect(stats.totalProducts).toBe(1)
      expect(stats.lowStockItems).toBe(0) // Stock is 98, min is 50
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
