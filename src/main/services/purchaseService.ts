import { DatabaseManager } from '../database/connection'
import { PurchaseRepository } from '../database/repositories/purchaseRepository'
import { SupplierRepository } from '../database/repositories/supplierRepository'
import { ProductRepository } from '../database/repositories/productRepository'
import { Purchase, CreatePurchasePayload, UpdatePurchasePayload, ApiError, PaginationOptions, PaginatedResult } from '../../shared/types'
import { executeTransaction } from '../database/transactions'

export class PurchaseService {
  static createDraft(payload: CreatePurchasePayload): Purchase {
    return executeTransaction(DatabaseManager.getInstance(), () => {
      this.validateSupplier(payload.supplier_id)
      this.validateItems(payload.items)

      const db = DatabaseManager.getInstance()
      const total_amount = payload.items.reduce((sum, item) => sum + (item.purchase_price * item.quantity), 0)

      const stmt = db.prepare(`
        INSERT INTO purchases (
          supplier_id, invoice_number, purchase_date, total_amount, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'DRAFT', ?, ?)
      `)
      
      const now = Date.now()
      const result = stmt.run(
        payload.supplier_id,
        payload.invoice_number || null,
        payload.purchase_date,
        total_amount,
        now,
        now
      )

      const purchaseId = result.lastInsertRowid as number
      
      const itemStmt = db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, batch_number, expiry_date, quantity, purchase_price, mrp, selling_price, entered_unit, entered_units_per_pack, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const item of payload.items) {
        itemStmt.run(
          purchaseId,
          item.product_id,
          item.batch_number,
          item.expiry_date,
          item.quantity,
          item.purchase_price,
          item.mrp,
          item.selling_price,
          item.entered_unit || null,
          item.entered_units_per_pack || null,
          now
        )
      }

      return PurchaseRepository.findById(purchaseId) as Purchase
    })
  }

  static getPurchase(id: number): Purchase {
    const purchase = PurchaseRepository.findById(id)
    if (!purchase) throw new ApiError(404, 'Purchase not found')
    return purchase
  }

  static getPaginatedPurchases(options: PaginationOptions): PaginatedResult<Purchase> {
    return PurchaseRepository.getPaginatedPurchases(options)
  }

  static listPurchases(): Purchase[] {
    return PurchaseRepository.list()
  }

  static updateDraft(id: number, payload: UpdatePurchasePayload): Purchase {
    return executeTransaction(DatabaseManager.getInstance(), () => {
      const existing = this.getPurchase(id)
      if (existing.status !== 'DRAFT') {
        throw new ApiError(400, 'Only DRAFT purchases can be edited')
      }

      const db = DatabaseManager.getInstance()
      const now = Date.now()

      let supplier_id = existing.supplier_id
      if (payload.supplier_id !== undefined) {
        this.validateSupplier(payload.supplier_id)
        supplier_id = payload.supplier_id
      }

      const invoice_number = payload.invoice_number !== undefined ? payload.invoice_number : existing.invoice_number
      const purchase_date = payload.purchase_date !== undefined ? payload.purchase_date : existing.purchase_date

      let itemsToSave = existing.items || []
      if (payload.items) {
        this.validateItems(payload.items)
        itemsToSave = payload.items as any
        
        // Delete old items
        db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id)
        
        // Insert new items
        const itemStmt = db.prepare(`
          INSERT INTO purchase_items (
            purchase_id, product_id, batch_number, expiry_date, quantity, base_quantity, purchase_price, mrp, selling_price, entered_unit, entered_units_per_pack, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        for (const item of payload.items) {
          const baseQuantity = item.quantity * (item.entered_units_per_pack || 1);
          itemStmt.run(id, item.product_id, item.batch_number, item.expiry_date, item.quantity, baseQuantity, item.purchase_price, item.mrp, item.selling_price, item.entered_unit || null, item.entered_units_per_pack || null, now)
        }
      }

      const total_amount = itemsToSave.reduce((sum, item) => sum + (item.purchase_price * item.quantity), 0)

      db.prepare(`
        UPDATE purchases 
        SET supplier_id = ?, invoice_number = ?, purchase_date = ?, total_amount = ?, updated_at = ?
        WHERE id = ?
      `).run(supplier_id, invoice_number || null, purchase_date, total_amount, now, id)

      return PurchaseRepository.findById(id) as Purchase
    })
  }

  static completePurchase(id: number): Purchase {
    // ATOMIC COMPLETION TRANSACTION
    return executeTransaction(DatabaseManager.getInstance(), () => {
      const purchase = this.getPurchase(id)
      if (purchase.status !== 'DRAFT') {
        throw new ApiError(400, 'Purchase is not in DRAFT state')
      }
      if (!purchase.items || purchase.items.length === 0) {
        throw new ApiError(400, 'Cannot complete a purchase with no items')
      }

      this.validateSupplier(purchase.supplier_id)
      this.validateItems(purchase.items as any)

      const db = DatabaseManager.getInstance()
      const now = Date.now()

      // 1. Update purchase status
      db.prepare(`UPDATE purchases SET status = 'COMPLETED', updated_at = ? WHERE id = ?`).run(now, id)

      // 2. Accumulate Inventory Batches
      const batchSelectStmt = db.prepare(`SELECT * FROM inventory_batches WHERE product_id = ? AND batch_number = ?`)
      const batchInsertStmt = db.prepare(`
        INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, entered_quantity, entered_unit, units_per_pack, mrp, purchase_price, selling_price, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const batchUpdateStmt = db.prepare(`
        UPDATE inventory_batches SET quantity = quantity + ?, updated_at = ?
        WHERE product_id = ? AND batch_number = ?
      `)

      for (const item of purchase.items) {
        const product = ProductRepository.findById(item.product_id)
        if (!product) throw new ApiError(400, `Product ${item.product_id} not found during purchase completion`)
        
        const unitsPerPack = product.units_per_pack || 1
        const normalizedQty = item.quantity * unitsPerPack
        const normalizedMrp = Math.round(item.mrp / unitsPerPack)
        const normalizedPP = Math.round(item.purchase_price / unitsPerPack)
        const normalizedSP = Math.round(item.selling_price / unitsPerPack)

        const existingBatch = batchSelectStmt.get(item.product_id, item.batch_number)
        if (existingBatch) {
          // Increase quantity
          batchUpdateStmt.run(normalizedQty, now, item.product_id, item.batch_number)
        } else {
          // Insert new batch
          batchInsertStmt.run(
            item.product_id,
            item.batch_number,
            item.expiry_date,
            normalizedQty,
            item.quantity,
            item.entered_unit || product.pack_type || 'Unit',
            unitsPerPack,
            normalizedMrp,
            normalizedPP,
            normalizedSP,
            now,
            now
          )
        }
      }

      return PurchaseRepository.findById(id) as Purchase
    })
  }

  private static validateSupplier(supplierId: number) {
    const supplier = SupplierRepository.findById(supplierId)
    if (!supplier) throw new ApiError(400, 'Supplier not found')
    if (supplier.is_active === 0) throw new ApiError(400, 'Cannot use an inactive supplier')
  }

  private static validateItems(items: Array<{product_id: number, batch_number: string, expiry_date: number, quantity: number, purchase_price: number, mrp: number}>) {
    if (!items || items.length === 0) {
      throw new ApiError(400, 'Purchase must contain at least one item')
    }
    for (const item of items) {
      if (!item.batch_number || item.batch_number.trim() === '') {
        throw new ApiError(400, 'Batch number is required')
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new ApiError(400, 'Quantity must be a positive integer')
      if (!Number.isInteger(item.purchase_price) || item.purchase_price < 0) throw new ApiError(400, 'Purchase price must be a non-negative integer')
      if (!Number.isInteger(item.mrp) || item.mrp < 0) throw new ApiError(400, 'MRP must be a non-negative integer')
      
      const product = ProductRepository.findById(item.product_id)
      if (!product) throw new ApiError(400, `Product with ID ${item.product_id} not found`)
      if (product.is_active === 0) throw new ApiError(400, `Product ${product.name} is inactive`)
    }
  }
}
