import { DatabaseManager } from '../database/connection'
import { StockAdjustmentRepository } from '../database/repositories/stockAdjustmentRepository'
import { CreateStockAdjustmentPayload, StockAdjustment, ApiError, InventoryBatch } from '../../shared/types'
import { FirebaseAuthService } from './firebaseAuth'
import { executeTransaction } from '../database/transactions'

export class StockAdjustmentService {
  static createAdjustment(payload: CreateStockAdjustmentPayload): StockAdjustment {
    return executeTransaction(DatabaseManager.getInstance(), () => {
      const db = DatabaseManager.getInstance()
      const now = Date.now()

      const batch = db.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(payload.inventory_batch_id) as InventoryBatch | undefined
      if (!batch) {
        throw new ApiError(404, `Inventory batch with ID ${payload.inventory_batch_id} not found`)
      }

      if (payload.quantity <= 0) {
        throw new ApiError(400, 'Adjustment quantity must be greater than 0')
      }

      const userEmail = FirebaseAuthService.getCurrentUserEmail()

      if (payload.type === 'DECREASE') {
        if (batch.quantity < payload.quantity) {
          throw new ApiError(
            400,
            `Cannot decrease quantity below 0. Current stock: ${batch.quantity}, Adjustment: ${payload.quantity}`
          )
        }

        // Mutate inventory
        db.prepare('UPDATE inventory_batches SET quantity = quantity - ?, updated_at = ? WHERE id = ?')
          .run(payload.quantity, now, batch.id)
      } else if (payload.type === 'INCREASE') {
        // Mutate inventory
        db.prepare('UPDATE inventory_batches SET quantity = quantity + ?, updated_at = ? WHERE id = ?')
          .run(payload.quantity, now, batch.id)
      } else {
        throw new ApiError(400, `Invalid adjustment type: ${payload.type}`)
      }

      // Write adjustment audit log
      const stmt = db.prepare(`
        INSERT INTO stock_adjustments (
          product_id, inventory_batch_id, batch_number, quantity, type, reason, notes, adjusted_by, adjusted_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      
      const result = stmt.run(
        batch.product_id,
        batch.id,
        batch.batch_number,
        payload.quantity,
        payload.type,
        payload.reason,
        payload.notes || null,
        userEmail,
        now,
        now
      )

      return StockAdjustmentRepository.findById(result.lastInsertRowid as number) as StockAdjustment
    })
  }

  static listAdjustments(): StockAdjustment[] {
    return StockAdjustmentRepository.list()
  }
}
