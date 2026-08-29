import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../main/database/connection'
import { MigrationRunner } from '../main/database/migrations'
import { CustomerService } from '../main/services/customerService'

describe('CustomerService Integration Tests', () => {
  beforeEach(() => {
    const db = DatabaseManager.initialize(':memory:')
    MigrationRunner.run(db)
  })

  afterEach(() => {
    DatabaseManager.close()
  })

  it('should create a customer successfully', () => {
    const customer = CustomerService.createCustomer({
      name: 'John Doe',
      phone: '1234567890',
      email: 'john@example.com'
    })

    expect(customer.id).toBeGreaterThan(0)
    expect(customer.name).toBe('John Doe')
    expect(customer.phone).toBe('1234567890')
    expect(customer.email).toBe('john@example.com')
    expect(customer.is_active).toBe(1)
  })

  it('should reject customer creation with empty name', () => {
    expect(() => {
      CustomerService.createCustomer({
        name: '',
        phone: '1234567890'
      })
    }).toThrow(/Customer name is required/)
  })

  it('should update a customer successfully', () => {
    const customer = CustomerService.createCustomer({
      name: 'Jane Doe',
      phone: '9876543210'
    })

    const updated = CustomerService.updateCustomer(customer.id, {
      name: 'Jane Smith',
      is_active: 0
    })

    expect(updated.name).toBe('Jane Smith')
    expect(updated.phone).toBe('9876543210')
    expect(updated.is_active).toBe(0)
  })

  it('should list and search customers with pagination', () => {
    for (let i = 1; i <= 15; i++) {
      CustomerService.createCustomer({
        name: `Customer ${i}`,
        phone: `55500000${i.toString().padStart(2, '0')}`
      })
    }

    const page1 = CustomerService.listCustomers(1, 10)
    expect(page1.total).toBe(15)
    expect(page1.data.length).toBe(10)
    expect(page1.totalPages).toBe(2)

    const search = CustomerService.listCustomers(1, 10, 'Customer 1')
    // Matches 1, 10, 11, 12, 13, 14, 15
    expect(search.total).toBe(7)
  })
})
