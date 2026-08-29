import { DatabaseManager } from '../connection'

export interface Setting {
  key: string
  value: string
  updated_at: number
}

export class SettingRepository {
  static get(key: string): string | null {
    const db = DatabaseManager.getInstance()
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
    const row = stmt.get(key) as { value: string } | undefined
    return row ? row.value : null
  }

  static set(key: string, value: string): void {
    const db = DatabaseManager.getInstance()
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    stmt.run(key, value, Date.now())
  }

  static getAll(): Setting[] {
    const db = DatabaseManager.getInstance()
    const stmt = db.prepare('SELECT * FROM settings')
    return stmt.all() as Setting[]
  }
}
