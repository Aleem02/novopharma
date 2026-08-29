import { InventoryRepository } from '../database/repositories/inventoryRepository'
import { InventoryBatch, PaginationOptions, PaginatedResult } from '../../shared/types'

export class InventoryService {
  static getInventoryBatch(productId: number, batchNumber: string): InventoryBatch | undefined {
    return InventoryRepository.getBatch(productId, batchNumber)
  }

  static getPaginatedBatches(options: PaginationOptions): PaginatedResult<InventoryBatch> {
    return InventoryRepository.getPaginatedBatches(options)
  }

  static getSummary(): { totalProducts: number, activeBatches: number, expiringSoon: number, expired: number } {
    return InventoryRepository.getSummary()
  }

  static listInventory(): InventoryBatch[] {
    return InventoryRepository.listAll()
  }

  static getByProductId(productId: number): InventoryBatch[] {
    return InventoryRepository.listAll().filter(b => b.product_id === productId)
  }

  static getActiveBatches(productId: number): InventoryBatch[] {
    const now = Date.now()
    return InventoryRepository.listAll().filter(b => b.product_id === productId && b.quantity > 0 && b.expiry_date >= now)
      .sort((a, b) => a.expiry_date - b.expiry_date)
  }

  static searchByBatch(batchNumber: string): InventoryBatch[] {
    return InventoryRepository.listAll().filter(b => b.batch_number === batchNumber)
  }

  static getBatchById(id: number): InventoryBatch | undefined {
    return InventoryRepository.findById(id)
  }

  static updateBatch(id: number, payload: Partial<InventoryBatch>): void {
    InventoryRepository.updateBatch(id, payload)
  }
}
