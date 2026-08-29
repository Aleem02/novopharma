import { DatabaseManager } from '../connection'
import { StockAdjustment, Product } from '../../../shared/types'

export class StockAdjustmentRepository {
  static findById(id: number): StockAdjustment | undefined {
    const db = DatabaseManager.getInstance()
    const sa = db.prepare('SELECT * FROM stock_adjustments WHERE id = ?').get(id) as StockAdjustment | undefined
    if (!sa) return undefined

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(sa.product_id) as Product | undefined
    if (product) {
      sa.product = product
    }

    return sa
  }

  static list(): StockAdjustment[] {
    const db = DatabaseManager.getInstance()
    const list = db.prepare('SELECT * FROM stock_adjustments ORDER BY adjusted_at DESC').all() as StockAdjustment[]
    return list.map(item => this.findById(item.id)!)
  }
}
