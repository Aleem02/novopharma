import React, { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { formatMonthYear, normalizeMonthYearString } from '../../../../shared/utils/dateUtils'

export interface MonthYearPickerProps {
  value: string
  onChange: (monthYear: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  isClearable?: boolean
  id?: string
  name?: string
}

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'MM/YYYY',
  disabled = false,
  required = false,
  className = '',
  isClearable = true,
  id,
  name
}) => {
  const [displayText, setDisplayText] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Current year displayed in the month grid
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())

  const monthNames = [
    { label: 'Jan', value: '01' },
    { label: 'Feb', value: '02' },
    { label: 'Mar', value: '03' },
    { label: 'Apr', value: '04' },
    { label: 'May', value: '05' },
    { label: 'Jun', value: '06' },
    { label: 'Jul', value: '07' },
    { label: 'Aug', value: '08' },
    { label: 'Sep', value: '09' },
    { label: 'Oct', value: '10' },
    { label: 'Nov', value: '11' },
    { label: 'Dec', value: '12' }
  ]

  // Sync internal display when external value prop changes
  useEffect(() => {
    if (!value) {
      setDisplayText('')
      return
    }
    const formatted = formatMonthYear(value)
    setDisplayText(formatted)

    const normalized = normalizeMonthYearString(value)
    if (normalized) {
      const parts = normalized.split('/')
      const y = parseInt(parts[1], 10)
      if (!isNaN(y)) setViewYear(y)
    }
  }, [value])

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        handleBlur()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [displayText])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value

    // Auto-format 6 digits (e.g. 112027 -> 11/2027)
    if (/^\d{6}$/.test(val)) {
      const formatted = `${val.slice(0, 2)}/${val.slice(2, 6)}`
      const normalized = normalizeMonthYearString(formatted)
      if (normalized) {
        setDisplayText(normalized)
        onChange(normalized)
        return
      }
    }

    setDisplayText(val)
  }

  const handleBlur = () => {
    if (!displayText.trim()) {
      if (value) onChange('')
      return
    }

    const normalized = normalizeMonthYearString(displayText)
    if (normalized) {
      setDisplayText(normalized)
      if (normalized !== value && formatMonthYear(value) !== normalized) {
        onChange(normalized)
      }
    } else {
      // Revert if invalid
      setDisplayText(value ? formatMonthYear(value) : '')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleBlur()
      setIsOpen(false)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleSelectMonth = (monthVal: string) => {
    const formatted = `${monthVal}/${viewYear}`
    setDisplayText(formatted)
    onChange(formatted)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDisplayText('')
    onChange('')
  }

  const handlePrevYear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setViewYear(y => y - 1)
  }

  const handleNextYear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setViewYear(y => y + 1)
  }

  // Selected month check
  const currentNormalized = normalizeMonthYearString(value)
  const selectedParts = currentNormalized ? currentNormalized.split('/') : []
  const selectedMonth = selectedParts[0]
  const selectedYear = selectedParts[1] ? parseInt(selectedParts[1], 10) : null

  return (
    <div className={`relative inline-block w-full ${isOpen ? 'z-40' : ''} ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor={id}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          id={id}
          name={name}
          type="text"
          value={displayText}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full px-3 py-2 pr-14 bg-white border border-slate-300 rounded-lg text-sm font-sans focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {isClearable && displayText && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded focus:outline-none"
              title="Clear expiry"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className="text-slate-400 hover:text-teal-600 p-1 rounded focus:outline-none disabled:opacity-50"
            title="Select expiry month/year"
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Month/Year Popover Grid */}
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 w-56 select-none animate-in fade-in zoom-in-95 duration-100">
          {/* Year Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={handlePrevYear}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-slate-800">{viewYear}</span>
            <button
              type="button"
              onClick={handleNextYear}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 3x4 Month Grid */}
          <div className="grid grid-cols-3 gap-2">
            {monthNames.map(m => {
              const isSelected = selectedMonth === m.value && selectedYear === viewYear

              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleSelectMonth(m.value)}
                  className={`py-2 px-1 text-xs rounded-lg font-semibold transition-colors text-center ${
                    isSelected
                      ? 'bg-teal-600 text-white font-bold'
                      : 'bg-slate-50 hover:bg-teal-50 hover:text-teal-700 text-slate-700 border border-slate-100'
                  }`}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
