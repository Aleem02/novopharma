import { DatabaseManager } from '../database/connection'
import { PrescriptionRepository } from '../database/repositories/prescriptionRepository'
import { CustomerRepository } from '../database/repositories/customerRepository'
import { ProductRepository } from '../database/repositories/productRepository'
import { executeTransaction } from '../database/transactions'
import { 
  CreatePrescriptionPayload, 
  Prescription, 
  ApiError, 
  PaginatedResult 
} from '../../shared/types'

export class PrescriptionService {
  static createPrescription(payload: CreatePrescriptionPayload): Prescription {
    return executeTransaction(DatabaseManager.getInstance(), () => {
      const db = DatabaseManager.getInstance()
      const now = Date.now()

      const customer = CustomerRepository.findById(payload.customer_id)
      if (!customer) {
        throw new ApiError(404, `Customer with ID ${payload.customer_id} not found`)
      }

      if (!payload.items || payload.items.length === 0) {
        throw new ApiError(400, 'Prescription must contain at least one medicine item')
      }

      if (!payload.doctor_name || payload.doctor_name.trim() === '') {
        throw new ApiError(400, 'Doctor name is required')
      }

      const prescriptionStmt = db.prepare(`
        INSERT INTO prescriptions (
          customer_id, prescription_date, doctor_name, doctor_reg_number, 
          reference_number, diagnosis_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result = prescriptionStmt.run(
        payload.customer_id,
        payload.prescription_date,
        payload.doctor_name.trim(),
        payload.doctor_reg_number?.trim() || null,
        payload.reference_number?.trim() || null,
        payload.diagnosis_notes?.trim() || null,
        now,
        now
      )

      const prescriptionId = result.lastInsertRowid as number

      const itemStmt = db.prepare(`
        INSERT INTO prescription_items (
          prescription_id, product_id, medicine_name_snapshot, strength_snapshot,
          dosage_instructions, frequency, duration, quantity, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const item of payload.items) {
        let nameSnapshot = item.medicine_name_snapshot
        let strengthSnapshot = item.strength_snapshot || null

        // If product_id is provided, snapshot current data
        if (item.product_id) {
          const product = ProductRepository.findById(item.product_id)
          if (!product) {
            throw new ApiError(400, `Product ID ${item.product_id} not found`)
          }
          nameSnapshot = product.name
          strengthSnapshot = product.strength || null
        }

        if (!nameSnapshot || nameSnapshot.trim() === '') {
          throw new ApiError(400, 'Medicine name snapshot is required for all items')
        }

        itemStmt.run(
          prescriptionId,
          item.product_id || null,
          nameSnapshot.trim(),
          strengthSnapshot,
          item.dosage_instructions.trim(),
          item.frequency?.trim() || null,
          item.duration?.trim() || null,
          item.quantity,
          item.notes?.trim() || null,
          now
        )
      }

      return PrescriptionRepository.findById(prescriptionId) as Prescription
    })
  }

  static getPrescription(id: number): Prescription {
    const prescription = PrescriptionRepository.findById(id)
    if (!prescription) {
      throw new ApiError(404, 'Prescription not found')
    }
    return prescription
  }

  static getCustomerPrescriptions(customerId: number, page: number = 1, pageSize: number = 50): PaginatedResult<Prescription> {
    const { data, total } = PrescriptionRepository.getCustomerPrescriptions(customerId, page, pageSize)
    return {
      items: data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  }
}
