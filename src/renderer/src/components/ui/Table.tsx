import React from 'react'

export const Table: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
  <div className="w-full overflow-x-auto">
    <table className={`min-w-full divide-y divide-slate-200 ${className}`}>
      {children}
    </table>
  </div>
)

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200">
    {children}
  </thead>
)

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="bg-white divide-y divide-slate-100">
    {children}
  </tbody>
)

export const TableRow: React.FC<{ children: React.ReactNode, className?: string, onClick?: (e: React.MouseEvent) => void }> = ({ children, className = '', onClick }) => (
  <tr className={`hover:bg-teal-50/50 even:bg-slate-50/50 transition-colors duration-150 ${onClick ? 'cursor-pointer' : ''} ${className}`} onClick={onClick}>
    {children}
  </tr>
)

export const TableHead: React.FC<{ children?: React.ReactNode, className?: string, colSpan?: number }> = ({ children, className = '', colSpan }) => (
  <th colSpan={colSpan} className={`px-3 py-2 text-left text-xs font-semibold text-slate-600 border-r border-slate-200 last:border-r-0 ${className}`}>
    {children}
  </th>
)

export const TableCell: React.FC<{ children?: React.ReactNode, className?: string, colSpan?: number }> = ({ children, className = '', colSpan }) => (
  <td colSpan={colSpan} className={`px-3 py-1.5 whitespace-nowrap text-[13px] text-slate-700 border-r border-slate-100 last:border-r-0 ${className}`}>
    {children}
  </td>
)
