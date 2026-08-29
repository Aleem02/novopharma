import React from 'react'

export const EmptyState: React.FC<{ title: string, description: string, icon?: React.ReactNode, action?: React.ReactNode }> = ({ title, description, icon, action }) => (
  <div className="text-center py-16 px-4">
    {icon ? (
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-slate-100 mb-6 text-slate-400">
        {icon}
      </div>
    ) : (
      <svg className="mx-auto h-16 w-16 text-slate-300 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    )}
    <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
    <p className="text-slate-500 max-w-sm mx-auto mb-6">{description}</p>
    {action}
  </div>
)
