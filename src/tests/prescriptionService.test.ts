import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { CustomerService } from '../main/services/customerService'
import { PrescriptionService } from '../main/services/prescriptionService'
import { ProductService } from '../main/services/productService'

describe('PrescriptionService Integration Tests', () => {
  beforeEach(() => {
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  it('should create a prescription and snapshot medicines', () => {
    const customer = CustomerService.createCustomer({
      name: 'John Doe',
      phone: '1234567890'
    })

    const product = ProductService.createProduct({
      name: 'Aspirin',
      strength: '81mg',
      selling_price: 100,
      tax_rate: 0,
      is_active: 1
    })

    const prescription = PrescriptionService.createPrescription({
      customer_id: customer.id,
      prescription_date: Date.now(),
      doctor_name: 'Dr. Smith',
      items: [
        {
          product_id: product.id,
          medicine_name_snapshot: 'Should be replaced by product',
          dosage_instructions: 'Take 1 pill daily',
          quantity: 30
        },
        {
          // Custom product without product_id
          medicine_name_snapshot: 'Custom Vitamin',
          dosage_instructions: 'Take 2 daily',
          quantity: 60
        }
      ]
    })

    expect(prescription.id).toBeGreaterThan(0)
    expect(prescription.customer_id).toBe(customer.id)
    expect(prescription.items?.length).toBe(2)
    
    // Check snapshot overrides
    const item1 = prescription.items!.find(i => i.product_id === product.id)
    expect(item1?.medicine_name_snapshot).toBe('Aspirin')
    expect(item1?.strength_snapshot).toBe('81mg')
    expect(item1?.dosage_instructions).toBe('Take 1 pill daily')

    // Check custom item
    const item2 = prescription.items!.find(i => i.product_id === null)
    expect(item2?.medicine_name_snapshot).toBe('Custom Vitamin')
  })
})
