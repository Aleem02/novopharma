import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`block w-full rounded-md shadow-sm bg-white text-[13px] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500
              ${icon ? 'pl-9' : 'px-3'} py-2
              ${error 
                ? 'border border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500' 
                : 'border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-teal-500'}
              ${className}
            `}
            placeholder="Enter value..." {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
