import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { SettingService } from '../main/services/settingService'
import { SaleService } from '../main/services/saleService'
import { ProductService } from '../main/services/productService'
import { PurchaseService } from '../main/services/purchaseService'

describe('SettingService & Invoice Numbering', () => {
  beforeAll(() => {
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
    SettingService.initializeDefaults()
  })

  afterAll(() => {
    DatabaseManager.close()
  })

  it('should initialize default settings', () => {
    const settings = SettingService.getAllSettings()
    expect(settings.pharmacy_name).toBe('NovoPharma')
    expect(settings.invoice_prefix).toBe('INV-')
    expect(settings.next_invoice_number).toBe('1')
  })

  it('should update settings successfully', () => {
    SettingService.updateSettings({
      pharmacy_name: 'Super Pharma',
      invoice_prefix: 'SP-',
      next_invoice_number: '100'
    })
    
    const settings = SettingService.getAllSettings()
    expect(settings.pharmacy_name).toBe('Super Pharma')
    expect(settings.invoice_prefix).toBe('SP-')
    expect(settings.next_invoice_number).toBe('100')
  })

  it('should use the new invoice settings in SaleService and increment', () => {
    // Setup a product and stock to make a sale
    const product = ProductService.createProduct({
      name: 'Test Med',
      selling_price: 1000,
      tax_rate: 0,
      is_active: 1
    })
    
    // We need a supplier first because of foreign keys and manual validation
    const db = DatabaseManager.getInstance()
    db.prepare('INSERT INTO suppliers (name, is_active, created_at, updated_at) VALUES (?, 1, ?, ?)').run('Supplier A', Date.now(), Date.now())

    const draft = PurchaseService.createDraft({
      supplier_id: 1,
      purchase_date: Date.now(),
      items: [
        {
          product_id: product.id,
          batch_number: 'B001',
          expiry_date: Date.now() + 1000000,
          quantity: 10,
          purchase_price: 500,
          mrp: 1000
        }
      ]
    })
    PurchaseService.completePurchase(draft.id)

    // Now make a sale
    const sale = SaleService.createSale({
      payment_method: 'CASH',
      items: [
        {
          product_id: product.id,
          quantity: 1,
          selling_price: 1000,
          mrp: 1000,
          tax_rate: 0
        }
      ]
    })

    expect(sale.invoice_number).toBe('SP-000100') // padded 6 digits from '100'
    expect(SettingService.getSetting('next_invoice_number')).toBe('101')
  })

  it('should rollback invoice number if sale fails (transactional safety)', () => {
    const nextNumBefore = SettingService.getSetting('next_invoice_number')
    
    try {
      SaleService.createSale({
        payment_method: 'CASH',
        items: [
          {
            product_id: 9999, // Invalid product
            quantity: 1,
            selling_price: 1000,
            mrp: 1000,
            tax_rate: 0
          }
        ]
      })
    } catch (e) {
      // Expected to fail
    }

    const nextNumAfter = SettingService.getSetting('next_invoice_number')
    expect(nextNumAfter).toBe(nextNumBefore)
  })
})
