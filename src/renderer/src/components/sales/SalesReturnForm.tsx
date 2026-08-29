import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sale } from '../../../../shared/types'

export const SalesReturnForm: React.FC = () => {
  const navigate = useNavigate()
  const [sales, setSales] = useState<Sale[]>([])
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [returnItems, setReturnItems] = useState<Record<number, number>>({}) // sale_item_id -> qty
  const [alreadyReturnedQties, setAlreadyReturnedQties] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const processingLock = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetchSales()
  }, [])

  const fetchSales = async () => {
    try {
      setLoading(true)
      const data = await window.api.sale.list()
      // Only keep completed and eligible ones
      setSales(data.items.filter(s => s.status !== 'CANCELLED'))
    } catch (err: any) {
      setError(err.message || 'Failed to load sales')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSale = async (sale: Sale) => {
    try {
      setError(null)
      setLoading(true)
      const fullSale = await window.api.sale.get(sale.id)
      setSelectedSale(fullSale)
      
      // Initialize return quantities to 0
      const initialQties: Record<number, number> = {}
      const alreadyRet: Record<number, number> = {}
      
      for (const item of fullSale.items || []) {
        initialQties[item.id] = 0
        // We will fetch returns list to find out how many were already returned
        // Or we can query the backend/main process
        // To be safe, let's call salesReturn.list to sum up already returned
        const returns = await window.api.salesReturn.list()
        const totalAlreadyReturned = returns
          .filter(r => r.sale_id === fullSale.id)
          .flatMap(r => r.items || [])
          .filter(ri => ri.sale_item_id === item.id)
          .reduce((sum, ri) => sum + ri.quantity, 0)
        alreadyRet[item.id] = totalAlreadyReturned
      }
      
      setReturnItems(initialQties)
      setAlreadyReturnedQties(alreadyRet)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch invoice details')
    } finally {
      setLoading(false)
    }
  }

  const handleQtyChange = (itemId: number, maxQty: number, val: number) => {
    const qty = Math.max(0, Math.min(maxQty, val))
    setReturnItems(prev => ({
      ...prev,
      [itemId]: qty
    }))
  }

  const calculateRefund = () => {
    if (!selectedSale || !selectedSale.items) return 0
    let total = 0
    for (const item of selectedSale.items) {
      const qty = returnItems[item.id] || 0
      if (qty > 0) {
        const returnedDiscount = Math.round((item.discount_amount * qty) / item.entered_quantity)
        total += (qty * item.selling_price) - returnedDiscount
      }
    }
    return total
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSale || processingLock.current) return

    const itemsToReturn = Object.entries(returnItems)
      .map(([id, qty]) => ({
        sale_item_id: parseInt(id),
        quantity: qty
      }))
      .filter(item => item.quantity > 0)

    if (itemsToReturn.length === 0) {
      setError('Please select at least one item to return')
      return
    }

    processingLock.current = true
    setSubmitting(true)
    setError(null)
    try {
      await window.api.salesReturn.create({
        sale_id: selectedSale.id,
        reason,
        items: itemsToReturn
      })
      navigate('/sales/returns')
    } catch (err: any) {
      setError(err.message || 'Failed to process return')
      processingLock.current = false
    } finally {
      setSubmitting(false)
    }
  }

  const formatPaise = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const filteredSales = sales.filter(s => 
    s.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/sales/returns')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Back to Sales Returns"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Process Sales Return</h1>
          <p className="text-sm text-slate-500">Initiate customer return and process refund.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {!selectedSale ? (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-700">1. Select Invoice to Return</h3>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search invoice number (e.g. INV-000001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
            />
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400">Loading invoices...</div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg max-h-96 overflow-y-auto">
              {filteredSales.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleSelectSale(s)}
                  className="p-4 flex justify-between items-center hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div>
                    <p className="font-bold text-slate-800">{s.invoice_number}</p>
                    <p className="text-xs text-slate-400">{new Date(s.sale_date).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatPaise(s.total_amount)}</p>
                    <span className="text-xs font-semibold text-slate-500 uppercase">{s.payment_method}</span>
                  </div>
                </div>
              ))}
              {filteredSales.length === 0 && (
                <div className="p-4 text-center text-slate-400">No matching completed invoices found</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800">Return Items from {selectedSale.invoice_number}</h3>
                <p className="text-xs text-slate-400">Date: {new Date(selectedSale.sale_date).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 underline"
              >
                Change Invoice
              </button>
            </div>

            <div className="space-y-4">
              {selectedSale.items?.map((item) => {
                const already = alreadyReturnedQties[item.id] || 0
                // For simplicity on the frontend, maxReturn is based on entered_quantity
                // In a perfect system we'd track returns per unit precisely, but here we enforce integer return of entered_quantity
                const maxReturn = item.entered_quantity - already
                
                return (
                  <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-slate-100 rounded-lg gap-4 bg-slate-50/30">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800">{item.product?.name}</p>
                      <p className="text-xs text-slate-400">
                        Batch: {item.batches && item.batches.length > 1 ? 'MULTI' : (item.batches?.[0]?.batch_number || item.batch_number || 'N/A')} | Price: {formatPaise(item.selling_price)}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        Sold: <span className="font-bold">{item.entered_quantity} {item.sale_unit}</span> | Already Returned: <span className="font-bold text-red-500">{already} {item.sale_unit}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {maxReturn === 0 ? (
                        <span className="text-xs font-bold text-red-500 uppercase">Fully Returned</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-500">Returning Qty:</label>
                          <input
                            type="number"
                            min="0"
                            max={maxReturn}
                            value={returnItems[item.id] || 0}
                            onChange={(e) => handleQtyChange(item.id, maxReturn, parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1.5 border border-slate-200 rounded text-center text-sm focus:outline-none focus:border-teal-500" placeholder="0"
                          />
                          <span className="text-xs text-slate-400 font-medium">max: {maxReturn}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="space-y-2 pt-4">
              <label className="block text-sm font-semibold text-slate-700">Reason for Return</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
              >
                <option value="">Select a reason...</option>
                <option value="Customer Dissatisfied">Customer Dissatisfied</option>
                <option value="Damaged / Defective">Damaged / Defective</option>
                <option value="Wrong Dosage / Item">Wrong Dosage / Item</option>
                <option value="Expired Medicine">Expired Medicine</option>
              </select>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Refund</p>
              <p className="text-2xl font-bold text-teal-600 mt-1">{formatPaise(calculateRefund())}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/sales/returns')}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  const itemsToReturn = Object.entries(returnItems)
                    .map(([id, qty]) => ({
                      sale_item_id: parseInt(id),
                      quantity: qty
                    }))
                    .filter(item => item.quantity > 0)
                  
                  if (itemsToReturn.length === 0) {
                    setError('Please select at least one item to return')
                    return
                  }
                  if (!reason) {
                    setError('Please select a reason for return')
                    return
                  }
                  setShowConfirm(true)
                }}
                className="px-6 py-2 bg-teal-600 text-white font-semibold rounded-lg text-sm shadow-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                Confirm Return & Refund
              </button>
            </div>
          </div>
        </form>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Confirm Return</h2>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to process this return? This action will restore inventory and issue a refund.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg text-sm shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50">
                {submitting ? 'Processing...' : 'Yes, Process Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
