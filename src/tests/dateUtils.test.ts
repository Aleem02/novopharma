import { describe, it, expect } from 'vitest'
import {
  formatDayMonthYear,
  parseDayMonthYearToIso,
  formatMonthYear,
  parseMonthYearEndMs,
  normalizeMonthYearString
} from '../shared/utils/dateUtils'

describe('NovoPharma Date Utilities', () => {
  describe('formatDayMonthYear', () => {
    it('formats ISO YYYY-MM-DD as DD-MM-YYYY', () => {
      expect(formatDayMonthYear('2026-09-12')).toBe('12-09-2026')
    })

    it('formats timestamp as DD-MM-YYYY', () => {
      const ts = new Date(2026, 8, 12).getTime() // Sep 12 2026
      expect(formatDayMonthYear(ts)).toBe('12-09-2026')
    })

    it('returns empty string for invalid date', () => {
      expect(formatDayMonthYear('')).toBe('')
      expect(formatDayMonthYear(null)).toBe('')
    })
  })

  describe('parseDayMonthYearToIso', () => {
    it('parses raw 8 digits (12092026) to 2026-09-12', () => {
      expect(parseDayMonthYearToIso('12092026')).toBe('2026-09-12')
    })

    it('parses DD-MM-YYYY or DD/MM/YYYY to 2026-09-12', () => {
      expect(parseDayMonthYearToIso('12-09-2026')).toBe('2026-09-12')
      expect(parseDayMonthYearToIso('12/09/2026')).toBe('2026-09-12')
    })

    it('preserves valid ISO YYYY-MM-DD', () => {
      expect(parseDayMonthYearToIso('2026-09-12')).toBe('2026-09-12')
    })

    it('rejects invalid dates like 32-09-2026 or month 13', () => {
      expect(parseDayMonthYearToIso('32092026')).toBe('')
      expect(parseDayMonthYearToIso('12132026')).toBe('')
    })
  })

  describe('formatMonthYear', () => {
    it('formats YYYY-MM or timestamp as MM/YYYY', () => {
      expect(formatMonthYear('2027-11')).toBe('11/2027')
      expect(formatMonthYear('2027-11-30')).toBe('11/2027')
    })
  })

  describe('parseMonthYearEndMs (Expiry canonical timestamp)', () => {
    it('normalizes 112027 or 11/2027 to the end of November 2027 (Nov 30)', () => {
      const ms = parseMonthYearEndMs('112027')
      expect(ms).not.toBeNull()
      const d = new Date(ms!)
      expect(d.getFullYear()).toBe(2027)
      expect(d.getMonth()).toBe(10) // 0-indexed: 10 is Nov
      expect(d.getDate()).toBe(30)
      expect(d.getHours()).toBe(23)
      expect(d.getMinutes()).toBe(59)
      expect(d.getSeconds()).toBe(59)
    })

    it('handles leap years correctly (02/2028 -> Feb 29 2028)', () => {
      const ms = parseMonthYearEndMs('022028')
      expect(ms).not.toBeNull()
      const d = new Date(ms!)
      expect(d.getDate()).toBe(29)
    })

    it('rejects month 00 and month 13', () => {
      expect(parseMonthYearEndMs('002027')).toBeNull()
      expect(parseMonthYearEndMs('132027')).toBeNull()
    })
  })

  describe('normalizeMonthYearString', () => {
    it('normalizes 112027 to 11/2027', () => {
      expect(normalizeMonthYearString('112027')).toBe('11/2027')
    })

    it('normalizes 2027-11 to 11/2027', () => {
      expect(normalizeMonthYearString('2027-11')).toBe('11/2027')
    })

    it('rejects invalid inputs', () => {
      expect(normalizeMonthYearString('002027')).toBe('')
      expect(normalizeMonthYearString('132027')).toBe('')
    })
  })
})
