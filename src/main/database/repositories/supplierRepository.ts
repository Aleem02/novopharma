import { DatabaseManager } from '../connection'
import { Supplier, CreateSupplierPayload, UpdateSupplierPayload, PaginationOptions, PaginatedResult } from '../../../shared/types'

export class SupplierRepository {
  static create(payload: CreateSupplierPayload): Supplier {
    const db = DatabaseManager.getInstance()
    
    const stmt = db.prepare(`
      INSERT INTO suppliers (
        name, contact_person, phone, email, address, gstin,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = Date.now()
    const result = stmt.run(
      payload.name,
      payload.contact_person || null,
      payload.phone || null,
      payload.email || null,
      payload.address || null,
      payload.gstin || null,
      payload.is_active !== undefined ? payload.is_active : 1,
      now,
      now
    )

    return this.findById(result.lastInsertRowid as number) as Supplier
  }

  static findById(id: number): Supplier | undefined {
    const db = DatabaseManager.getInstance()
    const stmt = db.prepare(`SELECT * FROM suppliers WHERE id = ?`)
    const row = stmt.get(id) as Supplier | undefined
    return row
  }

  static update(id: number, payload: UpdateSupplierPayload): Supplier {
    const db = DatabaseManager.getInstance()
    
    const current = this.findById(id)
    if (!current) {
      throw new Error(`Supplier with ID ${id} not found`)
    }

    const updates: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`)
        values.push(value)
      }
    }

    if (updates.length === 0) {
      return current
    }

    updates.push(`updated_at = ?`)
    values.push(Date.now())
    values.push(id)

    const sql = `UPDATE suppliers SET ${updates.join(', ')} WHERE id = ?`
    db.prepare(sql).run(...values)
    
    return this.findById(id) as Supplier
  }

  static getPaginatedSuppliers(options: PaginationOptions): PaginatedResult<Supplier> {
    const db = DatabaseManager.getInstance()
    let baseQuery = `FROM suppliers WHERE 1=1`
    const params: any[] = []

    if (options.search) {
      baseQuery += ` AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ? OR gstin = ?)`
      const searchParam = `%${options.search}%`
      params.push(searchParam, searchParam, searchParam, searchParam, options.search)
    }

    if (options.filter) {
      if (options.filter === 'ACTIVE') {
        baseQuery += ` AND is_active = 1`
      } else if (options.filter === 'INACTIVE') {
        baseQuery += ` AND is_active = 0`
      }
    }

    const countQuery = `SELECT COUNT(id) as total ${baseQuery}`
    const totalRow = db.prepare(countQuery).get(...params) as { total: number }
    const total = totalRow.total

    let orderBy = 'ORDER BY name ASC'
    if (options.sortBy) {
      const dir = options.sortDirection === 'DESC' ? 'DESC' : 'ASC'
      orderBy = `ORDER BY ${options.sortBy} ${dir}`
    }

    const page = options.page || 1
    const pageSize = options.pageSize || 25
    const offset = (page - 1) * pageSize

    const dataQuery = `SELECT * ${baseQuery} ${orderBy} LIMIT ? OFFSET ?`
    const items = db.prepare(dataQuery).all(...params, pageSize, offset) as Supplier[]

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }

  static list(): Supplier[] {
    const db = DatabaseManager.getInstance()
    const stmt = db.prepare(`SELECT * FROM suppliers ORDER BY name ASC`)
    return stmt.all() as Supplier[]
  }

  static search(query: string): Supplier[] {
    const db = DatabaseManager.getInstance()
    
    // Clean and split query into words
    const words = query.trim().split(/\s+/).filter(w => w.length > 0)
    if (words.length === 0) return []

    // Exact string matching variables for priority sort
    const exactStart = `${query}%`
    const exactBoundary = `% ${query}%`

    const nameConditions = words.map(() => `name LIKE ?`).join(' AND ')
    const contactConditions = words.map(() => `contact_person LIKE ?`).join(' AND ')
    const phoneConditions = words.map(() => `phone LIKE ?`).join(' AND ')
    
    const wordBindings = words.map(w => `%${w}%`)
    
    const bindings = [
      ...wordBindings, // name
      ...wordBindings, // contact_person
      ...wordBindings, // phone
      query,           // gstin
      exactStart,
      exactBoundary
    ]

    const stmt = db.prepare(`
      SELECT * FROM suppliers 
      WHERE (${nameConditions})
         OR (${contactConditions})
         OR (${phoneConditions})
         OR gstin = ?
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1
          WHEN name LIKE ? THEN 2
          ELSE 3
        END ASC,
        name ASC
    `)
    return stmt.all(...bindings) as Supplier[]
  }

  static setActive(id: number, active: boolean): Supplier {
    return this.update(id, { is_active: active ? 1 : 0 })
  }
}
