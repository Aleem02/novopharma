import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { StockAdjustment } from '../../../../shared/types'

export const StockAdjustments: React.FC = () => {
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAdjustments = async () => {
    try {
      setLoading(true)
      const data = await window.api.stockAdjustment.list()
      setAdjustments(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to load adjustments history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdjustments()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-2"></div>
        <p className="text-slate-500 font-medium">Loading stock adjustments...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Adjustments</h1>
          <p className="text-sm text-slate-500">Trace and log all physical inventory corrections.</p>
        </div>
        <Link
          to="/inventory/adjustments/new"
          className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-teal-700 transition-colors"
        >
          Add Stock Adjustment
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {adjustments.length === 0 ? (
        <div className="bg-white border border-slate-100 p-12 text-center rounded-xl shadow-sm">
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="font-bold text-slate-700">No Adjustments Found</h3>
          <p className="text-sm text-slate-400 mt-1">Every stock change is securely tracked here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
                <th className="px-6 py-4">Product ID</th>
                <th className="px-6 py-4">Batch Number</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Adjusted By</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {adjustments.map((adj) => (
                <tr key={adj.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-slate-900 font-bold">ID: {adj.product_id}</td>
                  <td className="px-6 py-4 text-slate-600 font-bold">{adj.batch_number}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                      adj.type === 'INCREASE' ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {adj.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">{adj.quantity}</td>
                  <td className="px-6 py-4 text-slate-600">{adj.reason}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium">{adj.adjusted_by || 'Unknown Operator'}</td>
                  <td className="px-6 py-4 text-slate-400">{new Date(adj.adjusted_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
