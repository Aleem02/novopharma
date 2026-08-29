import { SupplierRepository } from '../database/repositories/supplierRepository'
import { Supplier, CreateSupplierPayload, UpdateSupplierPayload, ApiError, PaginationOptions, PaginatedResult } from '../../shared/types'
import { executeTransaction } from '../database/transactions'
import { DatabaseManager } from '../database/connection'

export class SupplierService {
  static getPaginatedSuppliers(options: PaginationOptions): PaginatedResult<Supplier> {
    return SupplierRepository.getPaginatedSuppliers(options)
  }

  static createSupplier(payload: CreateSupplierPayload): Supplier {
    this.validateSupplier(payload)
    return executeTransaction(DatabaseManager.getInstance(), () => SupplierRepository.create(payload))
  }

  static getSupplier(id: number): Supplier {
    const supplier = SupplierRepository.findById(id)
    if (!supplier) throw new ApiError(404, 'Supplier not found')
    return supplier
  }

  static updateSupplier(id: number, payload: UpdateSupplierPayload): Supplier {
    if (Object.keys(payload).length > 0) {
      this.validateSupplier(payload as CreateSupplierPayload, true)
    }
    return executeTransaction(DatabaseManager.getInstance(), () => SupplierRepository.update(id, payload))
  }

  static searchSuppliers(query: string): Supplier[] {
    const trimmed = query.trim()
    if (!trimmed) return this.listSuppliers()
    return SupplierRepository.search(trimmed)
  }

  static listSuppliers(): Supplier[] {
    return SupplierRepository.list()
  }

  static setSupplierActive(id: number, active: boolean): Supplier {
    return executeTransaction(DatabaseManager.getInstance(), () => SupplierRepository.setActive(id, active))
  }

  private static validateSupplier(payload: CreateSupplierPayload, isUpdate = false) {
    if (!isUpdate || payload.name !== undefined) {
      if (!payload.name || payload.name.trim() === '') {
        throw new ApiError(400, 'Supplier name is required')
      }
    }
    if (payload.email) {
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
      if (!emailRegex.test(payload.email)) {
        throw new ApiError(400, 'Invalid email format')
      }
    }
    if (payload.phone) {
      const phoneRegex = /^[0-9\\-\\+]{7,15}$/
      if (!phoneRegex.test(payload.phone)) {
        throw new ApiError(400, 'Invalid phone format')
      }
    }
    if (payload.gstin) {
      if (payload.gstin.length !== 15) {
        throw new ApiError(400, 'GSTIN must be exactly 15 characters')
      }
    }
  }
}
