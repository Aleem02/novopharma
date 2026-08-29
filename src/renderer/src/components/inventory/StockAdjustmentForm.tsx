import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { InventoryBatch, Product } from '../../../../shared/types'

export const StockAdjustmentForm: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialBatchId = searchParams.get('batchId') || ''
  
  const [batches, setBatches] = useState<InventoryBatch[]>([])
  const [products, setProducts] = useState<Record<number, Product>>({})
  const [selectedBatchId, setSelectedBatchId] = useState<number | string>(initialBatchId)
  const [enteredQuantity, setEnteredQuantity] = useState<number>(0)
  const [adjustmentUnit, setAdjustmentUnit] = useState<'BASE' | 'PACK'>('BASE')
  const [type, setType] = useState<'INCREASE' | 'DECREASE'>('DECREASE')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    fetchBatches()
  }, [])

  const fetchBatches = async () => {
    try {
      setLoading(true)
      const [invData, prodData] = await Promise.all([
        window.api.inventory.list(),
        window.api.product.list()
      ])
      setBatches(invData.items)
      const prodMap: Record<number, Product> = {}
      prodData.items.forEach(p => prodMap[p.id] = p)
      setProducts(prodMap)
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory batches')
    } finally {
      setLoading(false)
    }
  }

  const selectedBatch = batches.find(b => b.id === Number(selectedBatchId))
  const selectedProduct = selectedBatch ? products[selectedBatch.product_id] : null
  
  const baseUnit = selectedProduct?.unit || 'Unit'
  const packType = selectedProduct?.pack_type || 'Pack'
  const unitsPerPack = selectedProduct?.units_per_pack || 1
  const isPack = unitsPerPack > 1
  
  const finalQuantity = adjustmentUnit === 'PACK' && isPack ? enteredQuantity * unitsPerPack : enteredQuantity

  useEffect(() => {
    // Reset unit to BASE if new product doesn't support packs
    if (!isPack) {
      setAdjustmentUnit('BASE')
    }
  }, [isPack])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBatchId || finalQuantity <= 0 || !type || !reason) {
      setError('Please fill in all required fields')
      return
    }

    if (type === 'DECREASE' && selectedBatch && selectedBatch.quantity < finalQuantity) {
      setError(`Cannot adjust stock below 0. Current stock is ${selectedBatch.quantity}, adjustment is ${finalQuantity}`)
      return
    }

    if (type === 'DECREASE') {
      setShowConfirm(true)
      return
    }

    // Direct submit for INCREASE
    executeSubmit()
  }

  const executeSubmit = async () => {
    setShowConfirm(false)

    try {
      setSubmitting(true)
      setError(null)
      await window.api.stockAdjustment.create({
        inventory_batch_id: Number(selectedBatchId),
        quantity: finalQuantity,
        type,
        reason,
        notes
      })
      navigate('/inventory/adjustments')
    } catch (err: any) {
      setError(err.message || 'Failed to submit stock adjustment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
          title="Back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Record Stock Adjustment</h1>
          <p className="text-sm text-slate-500">Record inventory corrections with required reasons.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-sm">
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm space-y-6">
        {/* Batch Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">1. Select Inventory Batch *</label>
          <select
            value={selectedBatchId}
            onChange={(e) => {
              setSelectedBatchId(e.target.value)
              setError(null)
            }}
            required
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
          >
            <option value="">Select a batch...</option>
            {batches.map(b => {
              const p = products[b.product_id]
              return (
                <option key={b.id} value={b.id}>
                  {p ? `${p.name} ${p.strength}` : `Product ID: ${b.product_id}`} | Batch: {b.batch_number} (Exp: {new Date(b.expiry_date).toLocaleDateString()}) - Current Qty: {b.quantity}
                </option>
              )
            })}
          </select>
        </div>

        {/* Selected Batch Details */}
        {selectedBatch && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center text-sm font-medium">
            <div>
              <p className="text-xs text-slate-400">Selected Batch Stock</p>
              <p className="text-slate-800 font-bold mt-1">Batch {selectedBatch.batch_number}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Current Qty</p>
              <p className="text-teal-600 font-bold text-lg mt-1">{selectedBatch.quantity}</p>
            </div>
          </div>
        )}

        {/* Adjustment Type Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">2. Adjustment Direction *</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType('INCREASE')}
              className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                type === 'INCREASE'
                  ? 'border-green-600 bg-green-50/50 text-green-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Increase (+ Add Stock)
            </button>
            <button
              type="button"
              onClick={() => setType('DECREASE')}
              className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                type === 'DECREASE'
                  ? 'border-rose-600 bg-rose-50/50 text-rose-700 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
              </svg>
              Decrease (- Deduct Stock)
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">3. Adjustment Quantity *</label>
          <div className="flex gap-4 items-start">
            <input
              type="number"
              min="1"
              value={enteredQuantity}
              onChange={(e) => setEnteredQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              required
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
              placeholder="Enter quantity to adjust..."
            />
            {isPack && (
              <select
                value={adjustmentUnit}
                onChange={(e) => setAdjustmentUnit(e.target.value as 'BASE' | 'PACK')}
                className="w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 bg-slate-50"
              >
                <option value="BASE">{baseUnit}</option>
                <option value="PACK">{packType}</option>
              </select>
            )}
            {!isPack && selectedProduct && (
              <div className="w-48 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 flex items-center">
                {baseUnit}
              </div>
            )}
          </div>
          {adjustmentUnit === 'PACK' && isPack && enteredQuantity > 0 && (
            <p className="text-sm font-medium text-teal-700 mt-2 bg-teal-50 p-2 rounded border border-teal-100">
              {type === 'INCREASE' ? '+' : '-'}{enteredQuantity} {packType}s = {type === 'INCREASE' ? '+' : '-'}{finalQuantity} {baseUnit}s
            </p>
          )}
        </div>

        {/* Reason */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">4. Reason *</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
          >
            <option value="">Select a reason...</option>
            <option value="Damaged Stock">Damaged Stock</option>
            <option value="Expired Stock">Expired Stock</option>
            <option value="Physical Count Correction">Physical Count Correction</option>
            <option value="Theft / Missing Stock">Theft / Missing Stock</option>
            <option value="Manual Receiving Override">Manual Receiving Override</option>
          </select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-700">5. Audit Notes (Optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500"
            rows={3}
            placeholder="Add any extra trace/notes about this correction..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/inventory/adjustments')}
            className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedBatchId || finalQuantity <= 0}
            className="px-6 py-2 bg-teal-600 text-white font-semibold rounded-lg text-sm shadow-sm hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Apply Correction'}
          </button>
        </div>
      </form>

      {showConfirm && selectedBatch && (
        <div className="fixed inset-0 bg-slate-900/50 flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Confirm Deduction</h2>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to DECREASE stock for batch {selectedBatch.batch_number} by {finalQuantity} {baseUnit}s?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={executeSubmit} disabled={submitting} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg text-sm shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50">
                {submitting ? 'Processing...' : 'Yes, Deduct Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
