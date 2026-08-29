import { DatabaseManager } from '../database/connection'
import { PurchaseReturnRepository } from '../database/repositories/purchaseReturnRepository'
import { PurchaseRepository } from '../database/repositories/purchaseRepository'
import { CreatePurchaseReturnPayload, PurchaseReturn, ApiError, InventoryBatch } from '../../shared/types'
import { executeTransaction } from '../database/transactions'

export class PurchaseReturnService {
  static createReturn(payload: CreatePurchaseReturnPayload): PurchaseReturn {
    return executeTransaction(DatabaseManager.getInstance(), () => {
      const db = DatabaseManager.getInstance()
      const now = Date.now()

      const purchase = PurchaseRepository.findById(payload.purchase_id)
      if (!purchase) {
        throw new ApiError(404, `Purchase with ID ${payload.purchase_id} not found`)
      }

      if (purchase.status !== 'COMPLETED') {
        throw new ApiError(400, `Cannot return items from a non-COMPLETED purchase`)
      }

      if (!payload.items || payload.items.length === 0) {
        throw new ApiError(400, 'Return must contain at least one item')
      }

      // Generate secure return number
      const lastIdRow = db.prepare('SELECT id FROM purchase_returns ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined
      const nextId = (lastIdRow?.id || 0) + 1
      const returnNumber = `PR-${String(nextId).padStart(6, '0')}`

      let totalReturnAmount = 0
      const returnItemsToInsert: Array<{
        purchase_item_id: number
        product_id: number
        batch_number: string
        entered_quantity: number
        return_unit: string
        quantity: number // base units
        purchase_price: number
        mrp: number
        line_total: number
      }> = []

      // Prepare statements
      const getBatchStmt = db.prepare(`
        SELECT * FROM inventory_batches 
        WHERE product_id = ? AND batch_number = ?
      `)

      const updateBatchStmt = db.prepare(`
        UPDATE inventory_batches 
        SET quantity = quantity - ?, updated_at = ?
        WHERE id = ?
      `)

      for (const item of payload.items) {
        const purchaseItem = purchase.items?.find(pi => pi.id === item.purchase_item_id)
        if (!purchaseItem) {
          throw new ApiError(400, `Purchase item ID ${item.purchase_item_id} not found on invoice`)
        }

        // We fetch product from DB directly
        const dbProduct = db.prepare('SELECT units_per_pack, pack_type, unit FROM products WHERE id = ?').get(purchaseItem.product_id) as any
        const unitsPerPack = dbProduct?.units_per_pack || 1
        
        const enteredReturnQty = item.quantity
        const returnUnit = item.is_pack ? (dbProduct?.pack_type || 'Pack') : (dbProduct?.unit || 'Unit')
        const baseReturnQty = item.is_pack ? item.quantity * unitsPerPack : item.quantity

        if (!Number.isInteger(baseReturnQty) || baseReturnQty <= 0) {
          throw new ApiError(400, `Return quantity must resolve to a positive integer`)
        }

        // Validate return quantity does not exceed original purchased quantity less prior returns
        // Note: PurchaseReturnRepository.getAlreadyReturnedQuantity must now return base units!
        const alreadyReturnedBase = PurchaseReturnRepository.getAlreadyReturnedQuantity(item.purchase_item_id)
        if (alreadyReturnedBase + baseReturnQty > purchaseItem.base_quantity) {
          throw new ApiError(
            400,
            `Cannot return more than originally purchased. Purchased (base): ${purchaseItem.base_quantity}, Already Returned (base): ${alreadyReturnedBase}, Attempted: ${baseReturnQty}`
          )
        }

        // Validate physical stock availability in inventory batch
        const batch = getBatchStmt.get(purchaseItem.product_id, purchaseItem.batch_number) as InventoryBatch | undefined
        if (!batch) {
          throw new ApiError(400, `Inventory batch not found for product ID ${purchaseItem.product_id} and batch ${purchaseItem.batch_number}`)
        }

        if (batch.quantity < baseReturnQty) {
          throw new ApiError(
            400,
            `Insufficient stock in inventory batch ${purchaseItem.batch_number}. Current stock: ${batch.quantity}, Attempted return: ${baseReturnQty}`
          )
        }

        // purchase_price on purchase_items is historically per-pack if it was entered that way.
        // But line_total should be calculated carefully. 
        // We know baseReturnQty and purchaseItem.base_quantity.
        // We can apportion the original line total or calculate from purchase_price.
        // To be perfectly safe, apportion it based on base quantity:
        const originalLineTotal = purchaseItem.quantity * purchaseItem.purchase_price
        const lineTotal = Math.round((originalLineTotal * baseReturnQty) / purchaseItem.base_quantity)

        returnItemsToInsert.push({
          purchase_item_id: purchaseItem.id,
          product_id: purchaseItem.product_id,
          batch_number: purchaseItem.batch_number,
          entered_quantity: enteredReturnQty,
          return_unit: returnUnit,
          quantity: baseReturnQty,
          purchase_price: purchaseItem.purchase_price,
          mrp: purchaseItem.mrp,
          line_total: lineTotal
        })

        totalReturnAmount += lineTotal

        // Deduct from inventory batch
        updateBatchStmt.run(baseReturnQty, now, batch.id)
      }

      // Insert Purchase Return record
      const returnStmt = db.prepare(`
        INSERT INTO purchase_returns (
          purchase_id, return_number, return_date, total_amount, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      const returnResult = returnStmt.run(
        payload.purchase_id,
        returnNumber,
        now,
        totalReturnAmount,
        payload.reason,
        now
      )
      const purchaseReturnId = returnResult.lastInsertRowid as number

      // Insert Purchase Return Items
      const returnItemStmt = db.prepare(`
        INSERT INTO purchase_return_items (
          purchase_return_id, purchase_item_id, product_id, batch_number, entered_quantity, return_unit, quantity,
          purchase_price, mrp, line_total, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const ri of returnItemsToInsert) {
        returnItemStmt.run(
          purchaseReturnId,
          ri.purchase_item_id,
          ri.product_id,
          ri.batch_number,
          ri.entered_quantity,
          ri.return_unit,
          ri.quantity,
          ri.purchase_price,
          ri.mrp,
          ri.line_total,
          now
        )
      }

      return PurchaseReturnRepository.findById(purchaseReturnId) as PurchaseReturn
    })
  }

  static getReturn(id: number): PurchaseReturn {
    const pr = PurchaseReturnRepository.findById(id)
    if (!pr) throw new ApiError(404, 'Purchase return not found')
    return pr
  }

  static listReturns(): PurchaseReturn[] {
    return PurchaseReturnRepository.list()
  }
}
