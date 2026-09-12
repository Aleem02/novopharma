/**
 * NovoPharma Date Utilities
 * Single source of truth for date formatting, parsing, keyboard normalization,
 * and canonical timestamp conversions across NovoPharma.
 */

/**
 * Format a Date, timestamp, or ISO string to DD-MM-YYYY for display.
 */
export function formatDayMonthYear(input: Date | number | string | null | undefined): string {
  if (!input) return ''
  
  let date: Date
  if (input instanceof Date) {
    date = input
  } else if (typeof input === 'number') {
    date = new Date(input)
  } else {
    const str = input.trim()
    if (!str) return ''
    // Handle YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-')
      return `${d}-${m}-${y}`
    }
    // Handle DD-MM-YYYY or DD/MM/YYYY
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
      return str.replace(/\//g, '-')
    }
    date = new Date(str)
  }

  if (isNaN(date.getTime())) return ''

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}-${month}-${year}`
}

/**
 * Parse typed input (12092026, 12-09-2026, 12/09/2026, or 2026-09-12)
 * to ISO YYYY-MM-DD format.
 */
export function parseDayMonthYearToIso(input: string): string {
  if (!input) return ''
  const clean = input.trim()

  // Match 8 digits: DDMMYYYY
  if (/^\d{8}$/.test(clean)) {
    const d = clean.slice(0, 2)
    const m = clean.slice(2, 4)
    const y = clean.slice(4, 8)
    if (isValidDateParts(parseInt(d, 10), parseInt(m, 10), parseInt(y, 10))) {
      return `${y}-${m}-${d}`
    }
    return ''
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(clean)) {
    const parts = clean.split(/[-/]/)
    const d = parts[0].padStart(2, '0')
    const m = parts[1].padStart(2, '0')
    const y = parts[2]
    if (isValidDateParts(parseInt(d, 10), parseInt(m, 10), parseInt(y, 10))) {
      return `${y}-${m}-${d}`
    }
    return ''
  }

  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-')
    if (isValidDateParts(parseInt(d, 10), parseInt(m, 10), parseInt(y, 10))) {
      return clean
    }
    return ''
  }

  return ''
}

function isValidDateParts(d: number, m: number, y: number): boolean {
  if (m < 1 || m > 12) return false
  if (d < 1 || d > 31) return false
  if (y < 1900 || y > 2100) return false
  const daysInMonth = new Date(y, m, 0).getDate()
  return d <= daysInMonth
}

/**
 * Format a Date, timestamp, or string to MM/YYYY format for expiry.
 */
export function formatMonthYear(input: Date | number | string | null | undefined): string {
  if (!input) return ''

  let date: Date
  if (input instanceof Date) {
    date = input
  } else if (typeof input === 'number') {
    date = new Date(input)
  } else {
    const str = input.trim()
    if (!str) return ''
    // Handle MM/YYYY or MM-YYYY
    if (/^\d{2}[-/]\d{4}$/.test(str)) {
      return str.replace('-', '/')
    }
    // Handle YYYY-MM
    if (/^\d{4}-\d{2}$/.test(str)) {
      const [y, m] = str.split('-')
      return `${m}/${y}`
    }
    // Handle YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const parts = str.split('-')
      return `${parts[1]}/${parts[0]}`
    }
    date = new Date(str)
  }

  if (isNaN(date.getTime())) return ''

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${month}/${year}`
}

/**
 * Parse expiry typed input (112027, 11/2027, 11-2027, or 2027-11)
 * into the last millisecond of that month (e.g. 2027-11-30T23:59:59.999).
 *
 * CRITICAL EXPIRY BUSINESS RULE:
 * Medicine expiring in MM/YYYY remains valid through the LAST calendar day of that month
 * and becomes expired at the start of the following month.
 */
export function parseMonthYearEndMs(input: string): number | null {
  if (!input) return null
  const clean = input.trim()

  let monthStr = ''
  let yearStr = ''

  // 6 digits: MMYYYY
  if (/^\d{6}$/.test(clean)) {
    monthStr = clean.slice(0, 2)
    yearStr = clean.slice(2, 6)
  }
  // MM/YYYY or MM-YYYY
  else if (/^\d{1,2}[-/]\d{4}$/.test(clean)) {
    const parts = clean.split(/[-/]/)
    monthStr = parts[0].padStart(2, '0')
    yearStr = parts[1]
  }
  // YYYY-MM
  else if (/^\d{4}-\d{2}$/.test(clean)) {
    const parts = clean.split('-')
    yearStr = parts[0]
    monthStr = parts[1]
  }

  if (!monthStr || !yearStr) return null

  const m = parseInt(monthStr, 10)
  const y = parseInt(yearStr, 10)

  if (isNaN(m) || m < 1 || m > 12) return null
  if (isNaN(y) || y < 1900 || y > 2100) return null

  // Last day of the month: new Date(year, month, 0) gives the last day of `month`
  // Set to 23:59:59.999 local time to cover the entire last day
  const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999)
  return endOfMonth.getTime()
}

/**
 * Normalizes input string MM/YYYY or 112027 into clean "MM/YYYY" format.
 * Returns empty string if invalid.
 */
export function normalizeMonthYearString(input: string): string {
  if (!input) return ''
  const clean = input.trim()

  if (/^\d{6}$/.test(clean)) {
    const m = clean.slice(0, 2)
    const y = clean.slice(2, 6)
    const monthNum = parseInt(m, 10)
    const yearNum = parseInt(y, 10)
    if (monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
      return `${m}/${y}`
    }
    return ''
  }

  if (/^\d{1,2}[-/]\d{4}$/.test(clean)) {
    const parts = clean.split(/[-/]/)
    const m = parts[0].padStart(2, '0')
    const y = parts[1]
    const monthNum = parseInt(m, 10)
    const yearNum = parseInt(y, 10)
    if (monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
      return `${m}/${y}`
    }
    return ''
  }

  if (/^\d{4}-\d{2}$/.test(clean)) {
    const [y, m] = clean.split('-')
    const monthNum = parseInt(m, 10)
    const yearNum = parseInt(y, 10)
    if (monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
      return `${m}/${y}`
    }
    return ''
  }

  return ''
}
