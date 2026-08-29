import React from 'react'

export const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-300 rounded-sm overflow-hidden ${className}`}>
    {children}
  </div>
)

export const CardHeader: React.FC<{ title: string, subtitle?: string, action?: React.ReactNode, className?: string }> = ({ title, subtitle, action, className = '' }) => (
  <div className={`px-4 py-2.5 border-b border-slate-200 flex justify-between items-center bg-white ${className}`}>
    <div>
      <h3 className="text-[15px] font-semibold text-slate-800 tracking-tight">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
)

export const CardContent: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 bg-white ${className}`}>
    {children}
  </div>
)
