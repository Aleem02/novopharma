import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { ProductService } from '../main/services/productService'

describe('ProductService', () => {
  beforeEach(() => {
    DatabaseManager.initialize(':memory:')
    MigrationRunner.run(DatabaseManager.getInstance())
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  describe('Creation & Retrieval', () => {
    it('creates and retrieves a product with required fields', () => {
      const product = ProductService.createProduct({
        name: 'Paracetamol',
        selling_price: 1500,
        tax_rate: 1200
      })

      expect(product.id).toBeTypeOf('number')
      expect(product.name).toBe('Paracetamol')
      expect(product.selling_price).toBe(1500)
      expect(product.tax_rate).toBe(1200)
      expect(product.is_active).toBe(1)

      const retrieved = ProductService.getProduct(product.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe('Paracetamol')
    })

    it('creates a product with all optional fields', () => {
      const product = ProductService.createProduct({
        name: 'Ibuprofen',
        generic_name: 'Ibuprofen',
        manufacturer: 'PharmaCorp',
        category: 'Painkiller',
        dosage_form: 'Tablet',
        strength: '400mg',
        unit: 'Strip',
        barcode: '123456789012',
        selling_price: 3000,
        tax_rate: 1200
      })

      expect(product.manufacturer).toBe('PharmaCorp')
      expect(product.barcode).toBe('123456789012')
    })
  })

  describe('Validation & Constraints', () => {
    it('rejects empty name', () => {
      expect(() => ProductService.createProduct({ name: '', selling_price: 100, tax_rate: 0 }))
        .toThrow('Product name is required')
    })

    it('rejects negative selling price', () => {
      expect(() => ProductService.createProduct({ name: 'Med', selling_price: -50, tax_rate: 0 }))
        .toThrow('Selling price must be a non-negative integer')
    })

    it('rejects negative tax rate', () => {
      expect(() => ProductService.createProduct({ name: 'Med', selling_price: 100, tax_rate: -1 }))
        .toThrow('Tax rate must be a non-negative integer')
    })

    it('rejects duplicate barcodes', () => {
      ProductService.createProduct({ name: 'Med1', barcode: '111', selling_price: 100, tax_rate: 0 })
      
      expect(() => ProductService.createProduct({ name: 'Med2', barcode: '111', selling_price: 100, tax_rate: 0 }))
        .toThrow(/UNIQUE constraint failed/)
    })
  })

  describe('Updates & Activation', () => {
    it('updates product fields', () => {
      const product = ProductService.createProduct({ name: 'Med', selling_price: 100, tax_rate: 0 })
      
      const updated = ProductService.updateProduct(product.id, { selling_price: 200, name: 'Med Updated' })
      expect(updated.selling_price).toBe(200)
      expect(updated.name).toBe('Med Updated')
    })

    it('deactivates and reactivates product', () => {
      const product = ProductService.createProduct({ name: 'Med', selling_price: 100, tax_rate: 0 })
      
      const deactivated = ProductService.setProductActive(product.id, false)
      expect(deactivated.is_active).toBe(0)

      const retrieved = ProductService.getProduct(product.id)
      expect(retrieved?.is_active).toBe(0)

      const reactivated = ProductService.setProductActive(product.id, true)
      expect(reactivated.is_active).toBe(1)
    })
  })

  describe('List & Search', () => {
    beforeEach(() => {
      ProductService.createProduct({ name: 'Paracetamol', generic_name: 'Acetaminophen', barcode: '1001', selling_price: 100, tax_rate: 0 })
      ProductService.createProduct({ name: 'Aspirin', generic_name: 'Acetylsalicylic acid', barcode: '1002', selling_price: 200, tax_rate: 0 })
      ProductService.createProduct({ name: 'Ibuprofen', generic_name: 'Ibuprofen', barcode: '1003', selling_price: 300, tax_rate: 0 })
    })

    it('lists all products ordered by name', () => {
      const list = ProductService.listProducts()
      expect(list.length).toBe(3)
      expect(list[0].name).toBe('Aspirin') // Ordered by name
      expect(list[1].name).toBe('Ibuprofen')
      expect(list[2].name).toBe('Paracetamol')
    })

    it('searches by name', () => {
      const list = ProductService.searchProducts('para')
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Paracetamol')
    })

    it('searches by generic name', () => {
      const list = ProductService.searchProducts('aceta')
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Paracetamol')
    })

    it('searches by barcode', () => {
      const list = ProductService.searchProducts('1002')
      expect(list.length).toBe(1)
      expect(list[0].name).toBe('Aspirin')
    })
  })

  describe('Database Failure Handling', () => {
    it('rolls back on update failure due to constraint', () => {
      ProductService.createProduct({ name: 'P1', barcode: 'B1', selling_price: 10, tax_rate: 0 })
      const p2 = ProductService.createProduct({ name: 'P2', barcode: 'B2', selling_price: 10, tax_rate: 0 })
      
      // Attempting to update p2 with p1's barcode
      expect(() => ProductService.updateProduct(p2.id, { barcode: 'B1' }))
        .toThrow(/UNIQUE constraint failed/)

      // Ensure p2 is untouched
      const retrieved = ProductService.getProduct(p2.id)
      expect(retrieved?.barcode).toBe('B2')
    })
  })
})
