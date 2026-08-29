import { ProductRepository } from '../database/repositories/productRepository'
import { Product, CreateProductPayload, UpdateProductPayload, PaginationOptions, PaginatedResult } from '../../shared/types'
import { executeTransaction } from '../database/transactions'
import { DatabaseManager } from '../database/connection'

export class ProductService {
  static getPaginatedProducts(options: PaginationOptions): PaginatedResult<Product> {
    return ProductRepository.getPaginatedProducts(options)
  }

  static createProduct(payload: CreateProductPayload): Product {
    this.validateProductPayload(payload)
    
    // Barcode uniqueness is enforced by SQLite, but we could add an explicit check here if we wanted
    return executeTransaction(DatabaseManager.getInstance(), () => {
      return ProductRepository.create(payload)
    })
  }

  static updateProduct(id: number, payload: UpdateProductPayload): Product {
    if (Object.keys(payload).length > 0) {
      this.validateProductPayload(payload, true)
    }

    return executeTransaction(DatabaseManager.getInstance(), () => {
      return ProductRepository.update(id, payload)
    })
  }

  static getProduct(id: number): Product | undefined {
    return ProductRepository.findById(id)
  }

  static listProducts(): Product[] {
    return ProductRepository.list()
  }

  static searchProducts(query: string): Product[] {
    if (!query || query.trim() === '') {
      return this.listProducts()
    }
    return ProductRepository.search(query.trim())
  }

  static setProductActive(id: number, active: boolean): Product {
    return executeTransaction(DatabaseManager.getInstance(), () => {
      return ProductRepository.setActive(id, active)
    })
  }

  private static validateProductPayload(payload: Partial<CreateProductPayload>, isUpdate = false): void {
    if (!isUpdate || payload.name !== undefined) {
      if (!payload.name || payload.name.trim() === '') {
        throw new Error('Product name is required')
      }
    }

    if (payload.selling_price !== undefined) {
      if (!Number.isInteger(payload.selling_price) || payload.selling_price < 0) {
        throw new Error('Selling price must be a non-negative integer (minor units)')
      }
    } else if (!isUpdate) {
      throw new Error('Selling price is required')
    }

    if (payload.tax_rate !== undefined) {
      if (!Number.isInteger(payload.tax_rate) || payload.tax_rate < 0) {
        throw new Error('Tax rate must be a non-negative integer')
      }
    } else if (!isUpdate) {
      throw new Error('Tax rate is required')
    }
    
    // Normalize optional strings to null if empty
    for (const key of ['generic_name', 'manufacturer', 'category', 'therapeutic_category', 'dosage_form', 'strength', 'unit', 'pack_type', 'pack_description', 'hsn_code', 'drug_schedule', 'barcode', 'sku', 'rack', 'shelf'] as const) {
      if (payload[key] !== undefined) {
        if (payload[key] === '') {
          payload[key] = null
        }
      }
    }
  }
}
