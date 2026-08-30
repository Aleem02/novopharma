import { DatabaseManager } from '../connection'
import { Sale, Product, Customer, Prescription, PaginationOptions, PaginatedResult } from '../../../shared/types'
import { CustomerRepository } from './customerRepository'
import { PrescriptionRepository } from './prescriptionRepository'

export class SaleRepository {
  static findById(id: number): Sale | undefined {
    const db = DatabaseManager.getInstance()
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as Sale | undefined
    if (!sale) return undefined

    const items = db.prepare(`
      SELECT si.*, 
             p.name as product_name, p.generic_name as product_generic_name, 
             p.barcode as product_barcode, p.strength as product_strength
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(id) as any[]

    const itemIds = items.map(i => i.id)
    let itemBatches: any[] = []
    if (itemIds.length > 0) {
      itemBatches = db.prepare(`
        SELECT * FROM sale_item_batches WHERE sale_item_id IN (${itemIds.join(',')})
      `).all() as any[]
    }

    sale.items = items.map(item => {
      const { product_name, product_generic_name, product_barcode, product_strength, ...rest } = item
      return {
        ...rest,
        batches: itemBatches.filter(b => b.sale_item_id === item.id),
        product: {
          id: item.product_id,
          name: product_name,
          generic_name: product_generic_name,
          barcode: product_barcode,
          strength: product_strength
        } as Product
      }
    })

    if (sale.customer_id) {
      sale.customer = CustomerRepository.findById(sale.customer_id)
    }

    if (sale.prescription_id) {
      sale.prescription = PrescriptionRepository.findById(sale.prescription_id)
    }

    return sale
  }

  static findByInvoiceNumber(invoiceNumber: string): Sale | undefined {
    const db = DatabaseManager.getInstance()
    const sale = db.prepare('SELECT id FROM sales WHERE invoice_number = ?').get(invoiceNumber) as { id: number } | undefined
    if (!sale) return undefined
    return this.findById(sale.id)
  }

  static getPaginatedSales(options: PaginationOptions): PaginatedResult<Sale> {
    const db = DatabaseManager.getInstance()
    let baseQuery = `FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE 1=1`
    const params: any[] = []

    if (options.search) {
      baseQuery += ` AND (s.invoice_number LIKE ?)`
      params.push(`%${options.search}%`)
    }

    if (options.filter) {
      if (options.filter === 'COMPLETED') {
        baseQuery += ` AND s.status = 'COMPLETED'`
      } else if (options.filter === 'RETURNED') {
        baseQuery += ` AND s.status = 'RETURNED'`
      } else if (options.filter === 'CANCELLED') {
        baseQuery += ` AND s.status = 'CANCELLED'`
      } else if (options.filter === 'HELD') {
        baseQuery += ` AND s.status = 'HELD'`
      }
    }

    const countQuery = `SELECT COUNT(s.id) as total ${baseQuery}`
    const totalRow = db.prepare(countQuery).get(...params) as { total: number }
    const total = totalRow.total

    let orderBy = 'ORDER BY s.sale_date DESC'
    if (options.sortBy) {
      const dir = options.sortDirection === 'DESC' ? 'DESC' : 'ASC'
      orderBy = `ORDER BY s.${options.sortBy} ${dir}`
    }

    const page = options.page || 1
    const pageSize = options.pageSize || 25
    const offset = (page - 1) * pageSize

    const dataQuery = `
      SELECT s.*,
      c.name as customer_name, c.phone as customer_phone
      ${baseQuery}
      ${orderBy}
      LIMIT ? OFFSET ?
    `
    const items = db.prepare(dataQuery).all(...params, pageSize, offset) as any[]

    const formattedItems = items.map(item => {
      const { customer_name, customer_phone, ...sale } = item
      if (sale.customer_id) {
        sale.customer = { id: sale.customer_id, name: customer_name, phone: customer_phone } as Customer
      }
      return sale as Sale
    })

    return {
      items: formattedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }

  static list(): Sale[] {
    const db = DatabaseManager.getInstance()
    return db.prepare('SELECT * FROM sales ORDER BY sale_date DESC').all() as Sale[]
  }
}
