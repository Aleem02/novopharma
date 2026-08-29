import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Purchase } from '../../../../shared/types'

export const PurchaseReturnForm: React.FC = () => {
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const [returnItems, setReturnItems] = useState<Record<number, number>>({}) // purchase_item_id -> qty
  const [alreadyReturnedQties, setAlreadyReturnedQties] = useState<Record<number, number>>({})
  const [currentStockQties, setCurrentStockQties] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetchPurchases()
  }, [])

  const fetchPurchases = async () => {
    try {
      setLoading(true)
      const data = await window.api.purchase.list()
      // Only keep completed purchases
      setPurchases(data.items.filter(p => p.status === 'COMPLETED'))
    } catch (err: any) {
      setError(err.message || 'Failed to load purchases')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPurchase = async (purchase: Purchase) => {
    try {
      setError(null)
      setLoading(true)
      const fullPurchase = await window.api.purchase.get(purchase.id)
      setSelectedPurchase(fullPurchase)

      const initialQties: Record<number, number> = {}
      const alreadyRet: Record<number, number> = {}
      const curStock: Record<number, number> = {}

      const returns = await window.api.purchaseReturn.list()

      for (const item of fullPurchase.items || []) {
        initialQties[item.id] = 0
        
        // Sum up already returned
        const totalAlreadyReturned = returns
          .filter(r => r.purchase_id === fullPurchase.id)
          .flatMap(r => r.items || [])
          .filter(ri => ri.purchase_item_id === item.id)
          .reduce((sum, ri) => sum + ri.quantity, 0)
        alreadyRet[item.id] = totalAlreadyReturned

        // Fetch current physical stock in batch
        const batch = await window.api.inventory.getBatch(item.product_id, item.batch_number)
        curStock[item.id] = batch ? batch.quantity : 0
      }

      setReturnItems(initialQties)
      setAlreadyReturnedQties(alreadyRet)
      setCurrentStockQties(curStock)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch purchase invoice details')
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

  const calculateReturnTotal = () => {
    if (!selectedPurchase || !selectedPurchase.items) return 0
    let total = 0
    for (const item of selectedPurchase.items) {
      const qty = returnItems[item.id] || 0
      if (qty > 0) {
        total += qty * item.purchase_price
      }
    }
    return total
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPurchase || !reason) {
      setError('Please fill in all details')
      return
    }

    const itemsToReturn = Object.entries(returnItems)
      .map(([id, qty]) => ({
        purchase_item_id: parseInt(id),
        quantity: qty
      }))
      .filter(item => item.quantity > 0)

    if (itemsToReturn.length === 0) {
      setError('Please select at least one item to return')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await window.api.purchaseReturn.create({
        purchase_id: selectedPurchase.id,
        reason,
        items: itemsToReturn
      })
      navigate('/purchases/returns')
    } catch (err: any) {
      setError(err.message || 'Failed to process purchase return')
    } finally {
      setSubmitting(false)
    }
  }

  const formatPaise = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const filteredPurchases = purchases.filter(p => 
    (p.invoice_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(p.id).includes(searchQuery)
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/purchases/returns')}
          className="p-2 -ml-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          title="Back to Purchase Returns"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Process Purchase Return</h1>
          <p className="text-sm text-slate-500">Return goods to a supplier and record return value.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {!selectedPurchase ? (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-700">1. Select Purchase to Return</h3>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search purchase ID or supplier invoice number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
            />
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400">Loading purchases...</div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg max-h-96 overflow-y-auto">
              {filteredPurchases.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelectPurchase(p)}
                  className="p-4 flex justify-between items-center hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div>
                    <p className="font-bold text-slate-800">{p.invoice_number || `GRN-${p.id}`}</p>
                    <p className="text-xs text-slate-400">{new Date(p.purchase_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatPaise(p.total_amount)}</p>
                    <span className="text-xs font-semibold text-slate-500 uppercase">{p.status}</span>
                  </div>
                </div>
              ))}
              {filteredPurchases.length === 0 && (
                <div className="p-4 text-center text-slate-400">No matching completed purchases found</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-bold text-slate-800">Return Items from Purchase {selectedPurchase.invoice_number || `GRN-${selectedPurchase.id}`}</h3>
                <p className="text-xs text-slate-400">Date: {new Date(selectedPurchase.purchase_date).toLocaleDateString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 underline"
              >
                Change Invoice
              </button>
            </div>

            <div className="space-y-4">
              {selectedPurchase.items?.map((item) => {
                const already = alreadyReturnedQties[item.id] || 0
                const currentStock = currentStockQties[item.id] || 0
                
                // Max return qty is limited by both original purchase amount minus returns, and current physical stock
                const maxReturn = Math.min(item.quantity - already, currentStock)
                
                return (
                  <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-slate-100 rounded-lg gap-4 bg-slate-50/30">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800">Product ID: {item.product_id}</p>
                      <p className="text-xs text-slate-400">
                        Batch: {item.batch_number} | Cost: {formatPaise(item.purchase_price)}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        Purchased: <span className="font-bold">{item.quantity}</span> | Already Returned: <span className="font-bold text-red-500">{already}</span> | In Stock: <span className="font-bold text-teal-600">{currentStock}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {maxReturn === 0 ? (
                        <span className="text-xs font-bold text-red-500 uppercase">Not Eligible / Out of Stock</span>
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
                <option value="Expired Product">Expired Product</option>
                <option value="Damaged Shipment">Damaged Shipment</option>
                <option value="Excess Inventory / Overstock">Excess Inventory / Overstock</option>
                <option value="Product Recall">Product Recall</option>
              </select>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Return Value</p>
              <p className="text-2xl font-bold text-teal-600 mt-1">{formatPaise(calculateReturnTotal())}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/purchases/returns')}
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
                      purchase_item_id: parseInt(id),
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
                Confirm Return
              </button>
            </div>
          </div>
        </form>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Confirm Purchase Return</h2>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to process this return? This will deduct the returned quantities from your physical inventory.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg text-sm shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50">
                {submitting ? 'Processing...' : 'Yes, Deduct Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
