import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { InventoryBatch, Product } from '../../../../shared/types'

export const StockAdjustmentForm: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialBatchId = searchParams.get('batchId') || ''
  
  const [searchQuery, setSearchQuery] = useState('')
  const [displayedBatches, setDisplayedBatches] = useState<InventoryBatch[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const dropdownContainerRef = useRef<HTMLDivElement>(null)

  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
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

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Initial load: either fetch specific batch by ID or fetch default initial batches
  useEffect(() => {
    if (initialBatchId) {
      loadInitialBatch(Number(initialBatchId))
    } else {
      fetchDefaultBatches()
    }
  }, [initialBatchId])

  const loadInitialBatch = async (batchId: number) => {
    try {
      setLoading(true)
      const b = await window.api.inventory.getBatchById(batchId)
      if (b) {
        await handleSelectBatch(b)
      } else {
        setError(`Batch #${batchId} not found`)
        fetchDefaultBatches()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load specified batch')
      fetchDefaultBatches()
    } finally {
      setLoading(false)
    }
  }

  const fetchDefaultBatches = async () => {
    try {
      setLoading(true)
      const res = await window.api.inventory.list({ pageSize: 50 })
      setDisplayedBatches(res.items)
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory batches')
    } finally {
      setLoading(false)
    }
  }

  // Debounced live search
  useEffect(() => {
    let active = true
    const search = async () => {
      setIsSearching(true)
      try {
        const res = await window.api.inventory.list({
          search: searchQuery.trim(),
          pageSize: 40
        })
        if (active) {
          setDisplayedBatches(res.items)
          setSelectedIndex(-1)
        }
      } catch (err) {
        console.error('Failed to search inventory batches:', err)
      } finally {
        if (active) setIsSearching(false)
      }
    }

    const timer = setTimeout(() => {
      search()
    }, 200)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [searchQuery])

  const handleSelectBatch = async (batch: InventoryBatch) => {
    setSelectedBatch(batch)
    setSelectedBatchId(batch.id)
    setError(null)
    setIsDropdownOpen(false)
    setSearchQuery('')

    if (batch.product && batch.product.unit) {
      setSelectedProduct(batch.product)
    } else {
      try {
        const prod = await window.api.product.get(batch.product_id)
        if (prod) {
          setSelectedProduct(prod)
        }
      } catch (err) {
        console.error('Failed to load product details for batch:', err)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen || displayedBatches.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < displayedBatches.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : displayedBatches.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < displayedBatches.length) {
        handleSelectBatch(displayedBatches[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false)
    }
  }

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
        {/* Batch Selection with Search Autocomplete */}
        <div className="space-y-2 relative" ref={dropdownContainerRef}>
          <label className="block text-sm font-semibold text-slate-700">1. Select Inventory Batch *</label>
          
          {selectedBatch ? (
            <div className="flex items-center justify-between w-full px-3.5 py-2.5 bg-teal-50 border border-teal-400 rounded-lg shadow-sm text-sm text-slate-800">
              <div className="truncate pr-2">
                <span className="font-bold text-slate-900">
                  {selectedProduct?.name || selectedBatch.product?.name || `Product #${selectedBatch.product_id}`}
                </span>
                {(selectedProduct?.strength || selectedBatch.product?.strength) && (
                  <span className="text-xs text-slate-600 ml-1.5 font-medium">
                    ({selectedProduct?.strength || selectedBatch.product?.strength})
                  </span>
                )}
                <span className="text-xs bg-teal-100 text-teal-800 font-mono px-2 py-0.5 rounded ml-2 font-medium">
                  Batch: {selectedBatch.batch_number}
                </span>
                <span className="text-xs text-teal-700 ml-2 font-medium">
                  (Exp: {new Date(selectedBatch.expiry_date).toLocaleDateString()} • Stock: {selectedBatch.quantity} {baseUnit}s)
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatch(null)
                  setSelectedProduct(null)
                  setSelectedBatchId('')
                  setSearchQuery('')
                  setIsDropdownOpen(true)
                }}
                className="text-slate-400 hover:text-red-500 focus:outline-none px-1.5 py-0.5 rounded text-sm font-bold transition-colors"
                title="Change selected batch"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Search batch by medicine, batch number, barcode..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (!isDropdownOpen) setIsDropdownOpen(true)
                }}
                onFocus={() => setIsDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                className="block w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm placeholder-slate-400"
              />
              {isSearching && (
                <div className="absolute right-3.5 top-3">
                  <svg className="animate-spin h-4 w-4 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              )}
            </div>
          )}

          {isDropdownOpen && !selectedBatch && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto z-50">
              {displayedBatches.length > 0 ? (
                displayedBatches.map((b, index) => {
                  const p = b.product
                  const displayName = p?.name || `Product ID: ${b.product_id}`
                  const displayStrength = p?.strength ? p.strength : null
                  const displayUnit = p?.unit || 'Unit'
                  const displayPack = p?.pack_type
                  const isSelected = index === selectedIndex

                  return (
                    <div
                      key={b.id}
                      className={`px-3.5 py-2.5 cursor-pointer border-b border-slate-100 last:border-0 text-sm transition-colors ${
                        isSelected
                          ? 'bg-teal-50 font-semibold text-teal-900 active-batch-option'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                      onClick={() => handleSelectBatch(b)}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-slate-900 truncate">
                          {displayName}
                          {displayStrength && (
                            <span className="font-normal text-slate-600 text-xs ml-1">({displayStrength})</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {p?.barcode && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                              BC: {p.barcode}
                            </span>
                          )}
                          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
                            Batch: {b.batch_number}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500 mt-1">
                        <span>Exp: {new Date(b.expiry_date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span className="font-medium text-teal-700">Current Qty: {b.quantity} {displayUnit}s</span>
                        {displayPack && (
                          <>
                            <span>•</span>
                            <span>{displayPack}</span>
                          </>
                        )}
                        {p?.manufacturer && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400">{p.manufacturer}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="p-4 text-center text-sm text-slate-500">
                  {isSearching ? 'Searching inventory batches...' : 'No matching inventory batches found.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Batch Details */}
        {selectedBatch && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center text-sm font-medium">
            <div>
              <p className="text-xs text-slate-400">Selected Batch Stock</p>
              <p className="text-slate-800 font-bold mt-1">
                {selectedProduct?.name || selectedBatch.product?.name} — Batch {selectedBatch.batch_number}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Expires: {new Date(selectedBatch.expiry_date).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Current Qty</p>
              <p className="text-teal-600 font-bold text-lg mt-1">{selectedBatch.quantity} {baseUnit}s</p>
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
