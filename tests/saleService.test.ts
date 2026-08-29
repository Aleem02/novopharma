import { DatabaseManager } from '../src/main/database/connection'
import { MigrationRunner } from '../src/main/database/migrations'
import { SaleService } from '../src/main/services/saleService'
import { ProductService } from '../src/main/services/productService'
import { SupplierService } from '../src/main/services/supplierService'
import { PurchaseService } from '../src/main/services/purchaseService'
describe('SaleService Integration Tests', () => {
  beforeEach(() => {
    // Setup isolated in-memory DB for each test
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  const setupData = () => {
    const supplier = SupplierService.createSupplier({
      name: 'Test Supplier',
      is_active: 1
    })

    const product = ProductService.createProduct({
      name: 'Paracetamol 500mg',
      selling_price: 5000, // ₹50.00
      tax_rate: 1200,      // 12%
      is_active: 1
    })

    const now = Date.now()

    // Create a purchase to stock inventory
    PurchaseService.createDraft({
      supplier_id: supplier.id,
      purchase_date: now,
      items: [
        {
          product_id: product.id,
          batch_number: 'BATCH1',
          expiry_date: now + 30 * 24 * 60 * 60 * 1000, // 30 days future
          quantity: 10,
          purchase_price: 3000,
          mrp: 5000
        },
        {
          product_id: product.id,
          batch_number: 'BATCH2',
          expiry_date: now + 60 * 24 * 60 * 60 * 1000, // 60 days future
          quantity: 5,
          purchase_price: 3000,
          mrp: 5000
        }
      ]
    })

    // Complete purchase to move to inventory_batches
    const purchases = PurchaseService.listPurchases()
    PurchaseService.completePurchase(purchases[0].id)

    return { product }
  }

  test('should successfully create a sale and deduct inventory', () => {
    const { product } = setupData()

    const sale = SaleService.createSale({
      payment_method: 'CASH',
      items: [
        {
          product_id: product.id,
          quantity: 2,
          selling_price: 5000,
          mrp: 5000,
          tax_rate: 1200
        }
      ]
    })

    expect(sale.invoice_number).toMatch(/^INV-\d{6}$/)
    expect(sale.total_amount).toBe(10000) // 2 * 5000
    expect(sale.items?.length).toBe(1)
    expect(sale.items?.[0].quantity).toBe(2)
    expect(sale.items?.[0].batch_number).toBe('BATCH1') // Picked earliest expiry

    // Verify inventory deduction
    const db = DatabaseManager.getInstance()
    const batch1 = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('BATCH1') as any
    expect(batch1.quantity).toBe(8) // 10 - 2
  })

  test('should split across multiple batches if first batch is insufficient (FEFO)', () => {
    const { product } = setupData()

    const sale = SaleService.createSale({
      payment_method: 'CARD',
      items: [{
        product_id: product.id,
        quantity: 12, // Needs 10 from BATCH1, 2 from BATCH2
        selling_price: 5000,
        mrp: 5000,
        tax_rate: 1200
      }]
    })

    expect(sale.items?.length).toBe(2)
    
    const item1 = sale.items?.find(i => i.batch_number === 'BATCH1')
    const item2 = sale.items?.find(i => i.batch_number === 'BATCH2')

    expect(item1?.quantity).toBe(10)
    expect(item2?.quantity).toBe(2)

    // Verify inventory
    const db = DatabaseManager.getInstance()
    const b1 = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('BATCH1') as any
    const b2 = db.prepare('SELECT quantity FROM inventory_batches WHERE batch_number = ?').get('BATCH2') as any

    expect(b1.quantity).toBe(0)
    expect(b2.quantity).toBe(3) // 5 - 2
  })

  test('should reject sale if quantity > available stock', () => {
    const { product } = setupData()

    expect(() => {
      SaleService.createSale({
        payment_method: 'CASH',
        items: [{
          product_id: product.id,
          quantity: 20, // Only 15 available
          selling_price: 5000,
          mrp: 5000,
          tax_rate: 1200
        }]
      })
    }).toThrow(/Insufficient stock/)
  })

  test('should not sell expired batches', () => {
    const { product } = setupData()
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    // Expire BATCH1
    db.prepare('UPDATE inventory_batches SET expiry_date = ? WHERE batch_number = ?').run(now - 1000, 'BATCH1')

    const sale = SaleService.createSale({
      payment_method: 'CASH',
      items: [{
        product_id: product.id,
        quantity: 3,
        selling_price: 5000,
        mrp: 5000,
        tax_rate: 1200
      }]
    })

    // Should pick BATCH2 since BATCH1 is expired
    expect(sale.items?.length).toBe(1)
    expect(sale.items?.[0].batch_number).toBe('BATCH2')
    expect(sale.items?.[0].quantity).toBe(3)
  })

  test('should reject sale of inactive product', () => {
    const { product } = setupData()
    ProductService.setProductActive(product.id, false)

    expect(() => {
      SaleService.createSale({
        payment_method: 'CASH',
        items: [{
          product_id: product.id,
          quantity: 1,
          selling_price: 5000,
          mrp: 5000,
          tax_rate: 1200
        }]
      })
    }).toThrow(/inactive and cannot be sold/)
  })
})
