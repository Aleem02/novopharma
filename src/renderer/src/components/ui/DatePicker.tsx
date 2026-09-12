import React, { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react'
import { formatDayMonthYear, parseDayMonthYearToIso } from '../../../../shared/utils/dateUtils'

export interface DatePickerProps {
  value: string
  onChange: (isoDate: string) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  isClearable?: boolean
  showTodayShortcut?: boolean
  id?: string
  name?: string
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'DD-MM-YYYY',
  disabled = false,
  required = false,
  className = '',
  isClearable = true,
  showTodayShortcut = true,
  id,
  name
}) => {
  const [displayText, setDisplayText] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calendar navigation state
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()) // 0-indexed

  // Sync internal display text when external value prop changes
  useEffect(() => {
    if (!value) {
      setDisplayText('')
      return
    }
    const formatted = formatDayMonthYear(value)
    setDisplayText(formatted)

    const iso = parseDayMonthYearToIso(value)
    if (iso) {
      const [y, m] = iso.split('-').map(Number)
      setViewYear(y)
      setViewMonth(m - 1)
    }
  }, [value])

  // Close calendar popup on click outside
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
    // If raw 8 digits (e.g. 12092026), format immediately as 12-09-2026
    if (/^\d{8}$/.test(val)) {
      const formatted = `${val.slice(0, 2)}-${val.slice(2, 4)}-${val.slice(4, 8)}`
      setDisplayText(formatted)
      const iso = parseDayMonthYearToIso(formatted)
      if (iso) {
        onChange(iso)
      }
      return
    }
    setDisplayText(val)
  }

  const handleBlur = () => {
    if (!displayText.trim()) {
      if (value) onChange('')
      return
    }

    const iso = parseDayMonthYearToIso(displayText)
    if (iso) {
      const formatted = formatDayMonthYear(iso)
      setDisplayText(formatted)
      if (iso !== value) {
        onChange(iso)
      }
    } else {
      // Revert to original if invalid
      setDisplayText(value ? formatDayMonthYear(value) : '')
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

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    const iso = `${viewYear}-${m}-${d}`
    setDisplayText(formatDayMonthYear(iso))
    onChange(iso)
    setIsOpen(false)
  }

  const handleTodayClick = () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const iso = `${y}-${m}-${d}`
    setViewYear(y)
    setViewMonth(today.getMonth())
    setDisplayText(formatDayMonthYear(iso))
    onChange(iso)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDisplayText('')
    onChange('')
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(v => v - 1)
    } else {
      setViewMonth(v => v - 1)
    }
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(v => v + 1)
    } else {
      setViewMonth(v => v + 1)
    }
  }

  // Days in month calculation
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sun
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

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
          className={`w-full px-3 py-2 pr-16 bg-white border border-slate-300 rounded-lg text-sm font-sans focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
        />

        <div className="absolute right-2 flex items-center gap-1">
          {isClearable && displayText && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded focus:outline-none"
              title="Clear date"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className="text-slate-400 hover:text-teal-600 p-1 rounded focus:outline-none disabled:opacity-50"
            title="Open calendar"
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar Popover */}
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 w-64 select-none animate-in fade-in zoom-in-95 duration-100">
          {/* Header Controls */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-slate-800">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <span key={d} className="text-[10px] font-bold text-slate-400">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const m = String(viewMonth + 1).padStart(2, '0')
              const d = String(dayNum).padStart(2, '0')
              const dayIso = `${viewYear}-${m}-${d}`
              const isSelected = value === dayIso
              const isToday =
                new Date().getFullYear() === viewYear &&
                new Date().getMonth() === viewMonth &&
                new Date().getDate() === dayNum

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-7 w-7 text-xs rounded-lg font-medium transition-colors flex items-center justify-center ${
                    isSelected
                      ? 'bg-teal-600 text-white font-bold'
                      : isToday
                      ? 'bg-teal-50 text-teal-700 font-bold border border-teal-300'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {dayNum}
                </button>
              )
            })}
          </div>

          {/* Shortcut Footer */}
          {showTodayShortcut && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
              <button
                type="button"
                onClick={handleTodayClick}
                className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800"
              >
                <Clock className="h-3 w-3" /> Today
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
