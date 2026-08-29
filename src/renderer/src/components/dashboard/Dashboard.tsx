import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DashboardSummary, FinancialSummary } from '../../../../shared/types'

export const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [period, setPeriod] = useState<'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'MONTH'>('TODAY')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const ds = await window.api.dashboard.getSummary()
      const fs = await window.api.financial.getSummary(period)
      setSummary(ds)
      setFinancial(fs)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [period])

  const formatPaise = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (loading && !summary) {
    return (
      <div className="flex flex-col justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-2"></div>
        <p className="text-slate-500 font-medium">Loading Dashboard...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
        <h3 className="font-bold">Error</h3>
        <p>{error}</p>
        <button onClick={fetchData} className="mt-2 text-sm text-teal-600 underline font-medium hover:text-teal-700">Try Again</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-none">Dashboard</h1>
            <p className="text-[11px] text-slate-500 mt-1">Real-time pharmacy sales, inventory, and operations overview.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'MONTH'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                period === p
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Gross Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 mr-4 shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 tracking-wide">Gross Sales ({period.replace('_', ' ')})</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{financial ? formatPaise(financial.todaySales) : '₹0.00'}</p>
          </div>
        </div>

        {/* Net Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mr-4 shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 tracking-wide">Net Sales</p>
            <p className="text-lg font-bold text-teal-600 mt-0.5">{financial ? formatPaise(financial.netSales) : '₹0.00'}</p>
          </div>
        </div>

        {/* Refunds / Returns */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="w-12 h-12 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 mr-4 shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-6a4 4 0 00-4-4H4m0 0l4-4m-4 4l4 4" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 tracking-wide">Refunds/Returns</p>
            <p className="text-lg font-bold text-rose-600 mt-0.5">{financial ? formatPaise(financial.returnsRefunds) : '₹0.00'}</p>
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 mr-4 shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 tracking-wide">Invoices</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{financial?.todayInvoicesCount || 0}</p>
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="w-12 h-12 rounded-lg bg-red-50 flex flex-col items-center justify-center text-red-500 mr-4 shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 tracking-wide">Low Stock</p>
            <p className="text-lg font-bold text-red-600 mt-0.5">{summary?.lowStockCount || 0}</p>
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center">
          <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 mr-4 shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 tracking-wide">Expiring Soon</p>
            <p className="text-lg font-bold text-orange-600 mt-0.5">{summary?.expiringSoonCount || 0}</p>
          </div>
        </div>
      </div>

      {/* Payment Breakdowns & Financial details */}
      {financial && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-3">
            <h3 className="font-bold text-sm text-slate-800 mb-4 border-b border-slate-100 pb-2">Financial Summary Breakdown ({period.replace('_', ' ')})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] font-bold text-slate-500 tracking-wide">Total Tax</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{formatPaise(financial.totalTax)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 tracking-wide">Total Discounts</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{formatPaise(financial.totalDiscounts)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 tracking-wide">Net Transactions</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{financial.todayInvoicesCount}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 tracking-wide">Returns Count</p>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{summary?.todayReturnsCount || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-sm text-slate-800 mb-4 border-b border-slate-100 pb-2">Payment Methods</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Cash</span>
                <span className="text-slate-900 font-bold">{formatPaise(financial.cashSales)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Card</span>
                <span className="text-slate-900 font-bold">{formatPaise(financial.cardSales)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">UPI</span>
                <span className="text-slate-900 font-bold">{formatPaise(financial.upiSales)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lists & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Sales */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-800">Recent Sales</h3>
            <Link to="/sales/history" className="text-xs font-bold text-teal-600 hover:text-teal-700">View All</Link>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[300px]">
            {summary?.recentSales && summary.recentSales.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold sticky top-0">
                  <tr>
                    <th className="px-4 py-2 border-b border-slate-100">Invoice No.</th>
                    <th className="px-4 py-2 border-b border-slate-100">Time</th>
                    <th className="px-4 py-2 border-b border-slate-100 text-right">Amount</th>
                    <th className="px-4 py-2 border-b border-slate-100 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {summary.recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 font-semibold text-teal-700">{sale.invoice_number}</td>
                      <td className="px-4 py-2 text-slate-500">{new Date(sale.sale_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">{formatPaise(sale.total_amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-bold rounded ${
                          sale.status === 'REFUNDED' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-teal-50 text-teal-600 border border-teal-200'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No recent sales transactions</p>
            )}
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-sm text-slate-800">Recent Purchases</h3>
            <Link to="/purchases" className="text-xs font-bold text-teal-600 hover:text-teal-700">View All</Link>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[300px]">
            {summary?.recentPurchases && summary.recentPurchases.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold sticky top-0">
                  <tr>
                    <th className="px-4 py-2 border-b border-slate-100">Receipt No.</th>
                    <th className="px-4 py-2 border-b border-slate-100">Date</th>
                    <th className="px-4 py-2 border-b border-slate-100 text-right">Amount</th>
                    <th className="px-4 py-2 border-b border-slate-100 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {summary.recentPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 font-semibold text-teal-700">{p.invoice_number || `GRN-${p.id}`}</td>
                      <td className="px-4 py-2 text-slate-500">{new Date(p.purchase_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">{formatPaise(p.total_amount)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No recent goods receipts</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
