import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PurchaseReturn } from '../../../../shared/types'

export const PurchaseReturns: React.FC = () => {
  const [returns, setReturns] = useState<PurchaseReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReturns = async () => {
    try {
      setLoading(true)
      const data = await window.api.purchaseReturn.list()
      setReturns(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase returns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReturns()
  }, [])

  const formatPaise = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-2"></div>
        <p className="text-slate-500 font-medium">Loading purchase returns...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Returns</h1>
          <p className="text-sm text-slate-500">Track returns to suppliers / distributors.</p>
        </div>
        <Link
          to="/purchases/returns/new"
          className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-teal-700 transition-colors"
        >
          New Purchase Return
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {returns.length === 0 ? (
        <div className="bg-white border border-slate-100 p-12 text-center rounded-xl shadow-sm">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="font-bold text-slate-700">No Purchase Returns Found</h3>
          <p className="text-sm text-slate-400 mt-1">Start by creating a new purchase return to a supplier.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                <th className="px-6 py-4">Return ID</th>
                <th className="px-6 py-4">Purchase Ref</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4 text-right">Return Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {returns.map((ret) => (
                <tr key={ret.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-bold text-slate-900">{ret.return_number}</td>
                  <td className="px-6 py-4 text-slate-600">ID: {ret.purchase_id}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(ret.return_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-slate-600">{ret.reason}</td>
                  <td className="px-6 py-4 text-right font-bold text-teal-600">{formatPaise(ret.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
