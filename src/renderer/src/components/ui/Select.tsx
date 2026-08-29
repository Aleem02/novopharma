/* eslint-disable react/prop-types */
import React from 'react'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, error?: string }>(
  ({ className = '', label, error, children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`block w-full rounded-md shadow-sm bg-white text-[13px] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500
            px-3 py-2
            ${error 
              ? 'border border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500' 
              : 'border border-slate-300 text-slate-900 focus:border-teal-500 focus:ring-teal-500'}
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'
