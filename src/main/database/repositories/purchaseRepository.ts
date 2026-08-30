import { DatabaseManager } from '../connection'
import { Purchase, PurchaseItem, PurchaseStatus, PaginationOptions, PaginatedResult } from '../../../shared/types'

export class PurchaseRepository {
  // Purchases

  static findById(id: number): Purchase | undefined {
    const db = DatabaseManager.getInstance()
    const stmt = db.prepare(`SELECT * FROM purchases WHERE id = ?`)
    const row = stmt.get(id) as Purchase | undefined
    if (row) {
      row.items = this.getItemsForPurchase(row.id)
    }
    return row
  }

  static getPaginatedPurchases(options: PaginationOptions): PaginatedResult<Purchase> {
    const db = DatabaseManager.getInstance()
    let baseQuery = `FROM purchases p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE 1=1`
    const params: any[] = []

    if (options.search) {
      baseQuery += ` AND (p.invoice_number LIKE ?)`
      params.push(`%${options.search}%`)
    }

    if (options.filter) {
      if (['DRAFT', 'COMPLETED', 'CANCELLED'].includes(options.filter)) {
        baseQuery += ` AND p.status = ?`
        params.push(options.filter)
      }
    }

    const countQuery = `SELECT COUNT(p.id) as total ${baseQuery}`
    const totalRow = db.prepare(countQuery).get(...params) as { total: number }
    const total = totalRow.total

    let orderBy = 'ORDER BY p.purchase_date DESC, p.id DESC'
    if (options.sortBy) {
      const dir = options.sortDirection === 'DESC' ? 'DESC' : 'ASC'
      orderBy = `ORDER BY p.${options.sortBy} ${dir}`
    }

    const page = options.page || 1
    const pageSize = options.pageSize || 25
    const offset = (page - 1) * pageSize

    const dataQuery = `
      SELECT p.*, s.name as supplier_name
      ${baseQuery}
      ${orderBy}
      LIMIT ? OFFSET ?
    `
    const items = db.prepare(dataQuery).all(...params, pageSize, offset) as any[]

    const formattedItems = items.map(item => {
      const { supplier_name, ...purchase } = item
      if (purchase.supplier_id) {
        purchase.supplier = { id: purchase.supplier_id, name: supplier_name } as any
      }
      return purchase as Purchase
    })

    return {
      items: formattedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }

  static list(): Purchase[] {
    const db = DatabaseManager.getInstance()
    const stmt = db.prepare(`SELECT * FROM purchases ORDER BY purchase_date DESC, id DESC`)
    const rows = stmt.all() as Purchase[]
    for (const row of rows) {
      row.items = this.getItemsForPurchase(row.id)
    }
    return rows
  }

  static getItemsForPurchase(purchaseId: number): PurchaseItem[] {
    const db = DatabaseManager.getInstance()
    const stmt = db.prepare(`SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id ASC`)
    return stmt.all(purchaseId) as PurchaseItem[]
  }

  static updateStatus(id: number, status: PurchaseStatus): Purchase {
    const db = DatabaseManager.getInstance()
    const stmt = db.prepare(`UPDATE purchases SET status = ?, updated_at = ? WHERE id = ?`)
    stmt.run(status, Date.now(), id)
    return this.findById(id) as Purchase
  }
}
