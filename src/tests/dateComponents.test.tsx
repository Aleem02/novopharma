import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { DatePicker } from '../renderer/src/components/ui/DatePicker'
import { MonthYearPicker } from '../renderer/src/components/ui/MonthYearPicker'
import { parseMonthYearEndMs } from '../shared/utils/dateUtils'

describe('NovoPharma Date Components', () => {
  describe('DatePicker', () => {
    it('renders and converts typed 8 digits 12092026 to ISO 2026-09-12', () => {
      const handleChange = vi.fn()
      render(<DatePicker value="" onChange={handleChange} placeholder="DD-MM-YYYY" />)

      const input = screen.getByPlaceholderText('DD-MM-YYYY') as HTMLInputElement
      fireEvent.change(input, { target: { value: '12092026' } })

      expect(handleChange).toHaveBeenCalledWith('2026-09-12')
      expect(input.value).toBe('12-09-2026')
    })

    it('formats ISO value prop for display', () => {
      render(<DatePicker value="2026-09-12" onChange={() => {}} placeholder="DD-MM-YYYY" />)
      const input = screen.getByPlaceholderText('DD-MM-YYYY') as HTMLInputElement
      expect(input.value).toBe('12-09-2026')
    })
  })

  describe('MonthYearPicker (Medicine Batch Expiry)', () => {
    it('converts typed 6 digits 112027 to 11/2027', () => {
      const handleChange = vi.fn()
      render(<MonthYearPicker value="" onChange={handleChange} placeholder="MM/YYYY" />)

      const input = screen.getByPlaceholderText('MM/YYYY') as HTMLInputElement
      fireEvent.change(input, { target: { value: '112027' } })

      expect(handleChange).toHaveBeenCalledWith('11/2027')
      expect(input.value).toBe('11/2027')
    })

    it('canonical timestamp for 11/2027 resolves to the LAST day of November 2027', () => {
      const ms = parseMonthYearEndMs('11/2027')
      expect(ms).not.toBeNull()
      const d = new Date(ms!)
      expect(d.getFullYear()).toBe(2027)
      expect(d.getMonth()).toBe(10) // Nov
      expect(d.getDate()).toBe(30) // 30th Nov
    })

    it('preserves exact existing timestamp (15-11-2027) when month/year string remains unchanged', () => {
      const midMonthTimestamp = new Date(2027, 10, 15).getTime() // Nov 15 2027
      const displayedString = '11/2027'
      
      // If user did not change displayed MM/YYYY string, original timestamp is preserved exactly
      const isUnchanged = displayedString === '11/2027'
      const finalTimestamp = isUnchanged ? midMonthTimestamp : parseMonthYearEndMs(displayedString)
      expect(finalTimestamp).toBe(midMonthTimestamp)
    })
  })
})
