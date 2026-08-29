import { DatabaseManager } from '../database/connection'
import { SettingRepository, Setting } from '../database/repositories/settingRepository'
import { executeTransaction } from '../database/transactions'

export class SettingService {
  static initializeDefaults(): void {
    executeTransaction(DatabaseManager.getInstance(), () => {
      const existingSettings = SettingRepository.getAll()
      const keys = existingSettings.map(s => s.key)

      const defaults: Record<string, string> = {
        pharmacy_name: 'NovoPharma',
        address: '',
        phone: '',
        email: '',
        gst_number: '',
        invoice_prefix: 'INV-',
        backup_auto_enabled: 'false',
        backup_location: '',
        backup_last_local_success: ''
      }

      for (const [key, value] of Object.entries(defaults)) {
        if (!keys.includes(key)) {
          SettingRepository.set(key, value)
        }
      }

      // Safe migration for next_invoice_number
      if (!keys.includes('next_invoice_number')) {
        const db = DatabaseManager.getInstance()
        // Try to find the max invoice number
        // Extract numeric part from existing invoices, e.g., 'INV-000014' -> 14
        const maxRow = db.prepare(`
          SELECT invoice_number FROM sales ORDER BY id DESC LIMIT 1
        `).get() as { invoice_number: string } | undefined

        let nextNum = 1
        if (maxRow && maxRow.invoice_number) {
          const numericPart = maxRow.invoice_number.replace(/[^0-9]/g, '')
          if (numericPart) {
            nextNum = parseInt(numericPart, 10) + 1
          }
        }
        SettingRepository.set('next_invoice_number', nextNum.toString())
      }
    })
  }

  static getSetting(key: string): string | null {
    return SettingRepository.get(key)
  }

  static setSetting(key: string, value: string): void {
    SettingRepository.set(key, value)
  }

  static getAllSettings(): Record<string, string> {
    const settings = SettingRepository.getAll()
    return settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value
      return acc
    }, {} as Record<string, string>)
  }

  static updateSettings(settings: Record<string, string>): void {
    executeTransaction(DatabaseManager.getInstance(), () => {
      for (const [key, value] of Object.entries(settings)) {
        // Validation rules
        if (key === 'invoice_prefix' && !value.trim()) {
          throw new Error('Invoice prefix cannot be empty')
        }
        if (key === 'next_invoice_number') {
          const num = parseInt(value, 10)
          if (isNaN(num) || num < 1) {
            throw new Error('Next invoice number must be a valid positive integer')
          }
        }
        SettingRepository.set(key, value)
      }
    })
  }
}
