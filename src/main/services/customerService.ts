import { DatabaseManager } from '../database/connection'
import { CustomerRepository } from '../database/repositories/customerRepository'
import { CreateCustomerPayload, UpdateCustomerPayload, Customer, ApiError, PaginatedResult, Sale } from '../../shared/types'

export class CustomerService {
  static createCustomer(payload: CreateCustomerPayload): Customer {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    if (!payload.name || payload.name.trim().length === 0) {
      throw new ApiError(400, 'Customer name is required')
    }
    if (!payload.phone || payload.phone.trim().length === 0) {
      throw new ApiError(400, 'Customer phone is required')
    }

    const stmt = db.prepare(`
      INSERT INTO customers (
        name, phone, email, address, date_of_birth, gender, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      payload.name.trim(),
      payload.phone.trim(),
      payload.email?.trim() || null,
      payload.address?.trim() || null,
      payload.date_of_birth || null,
      payload.gender || null,
      payload.notes || null,
      payload.is_active ?? 1,
      now,
      now
    )

    return CustomerRepository.findById(result.lastInsertRowid as number) as Customer
  }

  static updateCustomer(id: number, payload: UpdateCustomerPayload): Customer {
    const db = DatabaseManager.getInstance()
    const now = Date.now()

    const existing = CustomerRepository.findById(id)
    if (!existing) {
      throw new ApiError(404, 'Customer not found')
    }

    if (payload.name !== undefined && payload.name.trim().length === 0) {
      throw new ApiError(400, 'Customer name cannot be empty')
    }
    if (payload.phone !== undefined && payload.phone.trim().length === 0) {
      throw new ApiError(400, 'Customer phone cannot be empty')
    }

    const name = payload.name !== undefined ? payload.name.trim() : existing.name
    const phone = payload.phone !== undefined ? payload.phone.trim() : existing.phone
    const email = payload.email !== undefined ? (payload.email?.trim() || null) : existing.email
    const address = payload.address !== undefined ? (payload.address?.trim() || null) : existing.address
    const dob = payload.date_of_birth !== undefined ? payload.date_of_birth : existing.date_of_birth
    const gender = payload.gender !== undefined ? payload.gender : existing.gender
    const notes = payload.notes !== undefined ? payload.notes : existing.notes
    const is_active = payload.is_active !== undefined ? payload.is_active : existing.is_active

    db.prepare(`
      UPDATE customers
      SET name = ?, phone = ?, email = ?, address = ?, date_of_birth = ?, gender = ?, notes = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(name, phone, email, address, dob, gender, notes, is_active, now, id)

    return CustomerRepository.findById(id) as Customer
  }

  static getCustomer(id: number): Customer {
    const customer = CustomerRepository.findById(id)
    if (!customer) {
      throw new ApiError(404, 'Customer not found')
    }
    return customer
  }

  static getPaginatedCustomers(options: any): PaginatedResult<Customer> {
    return CustomerRepository.getPaginatedCustomers(options)
  }

  static getCustomerSales(id: number, page: number = 1, pageSize: number = 50): PaginatedResult<Sale> {
    const { data, total } = CustomerRepository.getCustomerSales(id, page, pageSize)
    return {
      items: data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }
}
