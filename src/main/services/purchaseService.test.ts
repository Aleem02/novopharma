import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseManager } from '../database/connection'
import { PurchaseService } from './purchaseService'
import { SupplierService } from './supplierService'
import { ProductService } from './productService'
import { InventoryService } from './inventoryService'

describe('PurchaseService', () => {
  let supplierId: number
  let productId: number

  beforeEach(() => {
    // Reset DB and apply migrations
    const db = DatabaseManager.initialize(':memory:')
    const runner = require('../../database/migrationRunner').MigrationRunner
    runner.run(db)

    // Setup prerequisites
    supplierId = SupplierService.createSupplier({
      name: 'Test Supplier',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      gstin: ''
    }).id

    productId = ProductService.createProduct({
      name: 'Paracetamol',
      selling_price: 1000, // 10.00
      tax_rate: 0
    }).id
  })

  it('creates and lists a draft purchase', () => {
    const draftId = PurchaseService.createDraft({
      supplier_id: supplierId,
      invoice_number: 'INV-001',
      purchase_date: Date.now(),
      items: [{
        product_id: productId,
        batch_number: 'B001',
        expiry_date: Date.now() + 31536000000, // +1 year
        quantity: 100,
        purchase_price: 500, // 5.00
        mrp: 1500, // 15.00
        selling_price: 1000
      }]
    })

    expect(draftId.id).toBeGreaterThan(0)

    const purchase = PurchaseService.getPurchase(draftId.id)
    expect(purchase).toBeDefined()
    expect(purchase?.status).toBe('DRAFT')
    expect(purchase?.total_amount).toBe(50000) // 100 * 500
    expect(purchase?.items?.length).toBe(1)
  })

  it('completes a purchase and accumulates inventory atomically', () => {
    const draft = PurchaseService.createDraft({
      supplier_id: supplierId,
      invoice_number: 'INV-002',
      purchase_date: Date.now(),
      items: [{
        product_id: productId,
        batch_number: 'B002',
        expiry_date: Date.now() + 31536000000,
        quantity: 50,
        purchase_price: 500,
        mrp: 1500,
        selling_price: 1000
      }]
    })

    // Before completion, inventory should be empty
    const invBefore = InventoryService.getByProductId(productId)
    expect(invBefore).toHaveLength(0)

    // Complete it
    PurchaseService.completePurchase(draft.id)

    // Status should be updated
    const completed = PurchaseService.getPurchase(draft.id)
    expect(completed?.status).toBe('COMPLETED')

    // Inventory should be accumulated
    const invAfter = InventoryService.getByProductId(productId)
    expect(invAfter).toHaveLength(1)
    expect(invAfter[0].batch_number).toBe('B002')
    expect(invAfter[0].quantity).toBe(50)
  })

  it('rolls back completely if completion fails', () => {
    const draft = PurchaseService.createDraft({
      supplier_id: supplierId,
      invoice_number: 'INV-FAIL',
      purchase_date: Date.now(),
      items: [{
        product_id: productId,
        batch_number: 'B003',
        expiry_date: Date.now() + 31536000000,
        quantity: -10, // Invalid quantity to force failure in logic (though schema might not check this yet, let's force an error by sending invalid product)
        purchase_price: 500,
        mrp: 1500,
        selling_price: 1000
      }]
    })

    // To force a failure during the transaction, we'll intentionally delete the product before completing
    const db = DatabaseManager.getInstance()
    db.prepare('DELETE FROM products WHERE id = ?').run(productId)

    expect(() => {
      PurchaseService.completePurchase(draft.id)
    }).toThrow() // Should fail because foreign key product_id constraint will fail on inventory insertion

    // Ensure status was NOT changed
    const failedPurchase = PurchaseService.getPurchase(draft.id)
    expect(failedPurchase?.status).toBe('DRAFT')
    
    // Check inventory didn't get created
    const invAfter = InventoryService.searchByBatch('B003')
    expect(invAfter).toHaveLength(0)
  })
})
