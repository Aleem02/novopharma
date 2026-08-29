import React from 'react'
import { useNavigate } from 'react-router-dom'

export const PageHeader: React.FC<{ title: React.ReactNode | string, subtitle?: string, action?: React.ReactNode, breadcrumbs?: React.ReactNode, showBack?: boolean }> = ({ title, subtitle, action, breadcrumbs, showBack }) => {
  const navigate = useNavigate()
  
  return (
  <div className="mb-4">
    {breadcrumbs && <div className="mb-1">{breadcrumbs}</div>}
    <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
      <div className="flex items-center gap-2">
        {showBack && (
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-slate-200 rounded-sm transition-colors text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  </div>
)}
