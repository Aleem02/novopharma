import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Supplier, Product } from '../../../../shared/types'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table'

export const PurchaseForm: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const initialProductId = searchParams.get('productId') || ''
  const isEdit = !!id

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  
  const [purchaseData, setPurchaseData] = useState({
    supplier_id: '',
    invoice_number: '',
    purchase_date: new Date().toISOString().split('T')[0]
  })

  // Line items state
  const [items, setItems] = useState<any[]>([])
  
  // Current editing line item
  const [currentItem, setCurrentItem] = useState({
    product_id: initialProductId,
    batch_number: '',
    expiry_date: '',
    quantity: '',
    purchase_price: '',
    mrp: '',
    selling_price: ''
  })

  const [status, setStatus] = useState<string>('DRAFT')
  const [loading, setLoading] = useState(false)
  const processingLock = React.useRef(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDependencies()
    if (isEdit) {
      loadPurchase()
    }
  }, [id])

  const fetchDependencies = async () => {
    try {
      const [supps, prods] = await Promise.all([
        window.api.supplier.list(),
        window.api.product.list()
      ])
      setSuppliers(supps.items.filter(s => s.is_active))
      setProducts(prods.items.filter(p => p.is_active))
    } catch (err) {
      console.error('Failed to load dependencies', err)
    }
  }

  const loadPurchase = async () => {
    setLoading(true)
    try {
      const purchase = await window.api.purchase.get(Number(id))
      if (purchase) {
        setPurchaseData({
          supplier_id: purchase.supplier_id.toString(),
          invoice_number: purchase.invoice_number || '',
          purchase_date: new Date(purchase.purchase_date).toISOString().split('T')[0]
        })
        setStatus(purchase.status)
        
        if (purchase.items) {
          const loadedItems = purchase.items.map(item => ({
            ...item,
            product_id: item.product_id.toString(),
            quantity: item.quantity.toString(),
            purchase_price: (item.purchase_price / 100).toString(),
            mrp: (item.mrp / 100).toString(),
            expiry_date: new Date(item.expiry_date).toISOString().slice(0, 7) // YYYY-MM
          }))
          setItems(loadedItems)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load purchase')
    } finally {
      setLoading(false)
    }
  }

  const handlePurchaseDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setPurchaseData(prev => ({ ...prev, [name]: value }))
  }

  const handleCurrentItemChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setCurrentItem(prev => ({ ...prev, [name]: value }))
  }

  const handleAddItem = () => {
    if (!currentItem.product_id || !currentItem.batch_number || !currentItem.expiry_date || 
        !currentItem.quantity || !currentItem.purchase_price || !currentItem.mrp || !currentItem.selling_price) {
      setError('Please fill in all line item fields')
      return
    }

    const qty = parseInt(currentItem.quantity)
    const pp = parseFloat(currentItem.purchase_price)
    const mrp = parseFloat(currentItem.mrp)
    const sp = parseFloat(currentItem.selling_price)

    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number')
      return
    }
    if (isNaN(pp) || pp < 0 || isNaN(mrp) || mrp < 0 || isNaN(sp) || sp < 0) {
      setError('Prices must be valid positive numbers')
      return
    }

    // Convert YYYY-MM to timestamp (last day of month is standard, but we'll just use the 1st of the month for simplicity or precise YYYY-MM-01)
    const expiryDate = new Date(`${currentItem.expiry_date}-01T00:00:00Z`).getTime()

    const selectedProduct = products.find(p => p.id.toString() === currentItem.product_id)
    
    setItems(prev => [...prev, {
      ...currentItem,
      parsed_quantity: qty,
      parsed_purchase_price: Math.round(pp * 100),
      parsed_mrp: Math.round(mrp * 100),
      parsed_selling_price: Math.round(sp * 100),
      parsed_expiry_date: expiryDate,
      entered_unit: selectedProduct?.pack_type || selectedProduct?.unit || 'Unit',
      entered_units_per_pack: selectedProduct?.units_per_pack || 1
    }])

    // Reset line item form
    setCurrentItem({
      product_id: '',
      batch_number: '',
      expiry_date: '',
      quantity: '',
      purchase_price: '',
      mrp: '',
      selling_price: ''
    })
    setError('')
  }

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const preparePayload = () => {
    if (!purchaseData.supplier_id) throw new Error('Please select a supplier')
    if (items.length === 0) throw new Error('Please add at least one item')

    return {
      supplier_id: parseInt(purchaseData.supplier_id),
      invoice_number: purchaseData.invoice_number,
      purchase_date: new Date(purchaseData.purchase_date).getTime(),
      items: items.map(item => ({
        product_id: parseInt(item.product_id),
        batch_number: item.batch_number,
        expiry_date: item.parsed_expiry_date,
        quantity: item.parsed_quantity,
        purchase_price: item.parsed_purchase_price,
        mrp: item.parsed_mrp,
        selling_price: item.parsed_selling_price,
        entered_unit: item.entered_unit,
        entered_units_per_pack: item.entered_units_per_pack
      }))
    }
  }

  const handleSaveDraft = async () => {
    if (processingLock.current) return
    setError('')
    processingLock.current = true
    setLoading(true)
    try {
      const payload = preparePayload()
      if (isEdit) {
        await window.api.purchase.updateDraft(Number(id), payload)
      } else {
        const result = await window.api.purchase.createDraft(payload)
        navigate(`/purchases/edit/${result.id}`, { replace: true })
      }
      navigate('/purchases')
    } catch (err: any) {
      setError(err.message || 'Failed to save draft')
      processingLock.current = false
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    if (processingLock.current) return
    if (!window.confirm('Are you sure you want to COMPLETE this purchase? This will update inventory and cannot be undone.')) {
      return
    }

    setError('')
    processingLock.current = true
    setLoading(true)
    try {
      // First save any pending changes
      const payload = preparePayload()
      let purchaseId = Number(id)
      
      if (isEdit) {
        await window.api.purchase.updateDraft(purchaseId, payload)
      } else {
        const result = await window.api.purchase.createDraft(payload)
        purchaseId = result.id
      }

      // Then complete
      await window.api.purchase.complete(purchaseId)
      navigate('/purchases')
    } catch (err: any) {
      setError(err.message || 'Failed to complete purchase')
      processingLock.current = false
      setLoading(false)
    }
  }

  const isReadOnly = status !== 'DRAFT'

  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.parsed_purchase_price * item.parsed_quantity)
  }, 0)

  return (
    <div className="font-sans max-w-6xl mx-auto pb-12">
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            {isEdit ? 'Edit Purchase' : 'New Purchase'}
            {isEdit && (
              <Badge variant={status === 'COMPLETED' ? 'success' : status === 'CANCELLED' ? 'danger' : 'warning'}>
                {status}
              </Badge>
            )}
          </div>
        }
        subtitle="Goods receipt and inward stock entry"
        showBack={true}
        action={
          <Button 
            onClick={() => navigate('/purchases')} 
            variant="outline"
          >
            {isReadOnly ? 'Back' : 'Cancel'}
          </Button>
        }
      />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <svg className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-800 font-medium">{error}</p>
        </div>
      )}

      {isReadOnly && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
          <svg className="h-5 w-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-800 font-medium">This purchase is completed and cannot be modified. Inventory has been updated.</p>
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader title="Invoice Details" className="bg-slate-50/50" />
          <CardContent>
            <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Supplier *</label>
                <select
                  name="supplier_id"
                  value={purchaseData.supplier_id}
                  onChange={handlePurchaseDataChange}
                  disabled={isReadOnly}
                  className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm disabled:opacity-50 disabled:bg-slate-50"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <Input 
                label="Invoice Number" 
                name="invoice_number" 
                value={purchaseData.invoice_number} 
                onChange={handlePurchaseDataChange}
                disabled={isReadOnly}
                className="font-mono" placeholder="Enter invoice  number..."
              />
              <Input 
                label="Purchase Date *" 
                type="date" 
                name="purchase_date" 
                value={purchaseData.purchase_date} 
                onChange={handlePurchaseDataChange}
                disabled={isReadOnly} placeholder="Enter purchase  date *..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items Entry (Only if Draft) */}
        {!isReadOnly && (
          <Card>
            <CardHeader title="Add Line Item" className="bg-slate-50/50" />
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Product</label>
                  <select
                    name="product_id"
                    value={currentItem.product_id}
                    onChange={handleCurrentItemChange}
                    className="block w-full px-2 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                  >
                    <option value="">Select Product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.strength} ({p.pack_type || p.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Batch</label>
                  <input type="text" name="batch_number" value={currentItem.batch_number} onChange={handleCurrentItemChange} className="block w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="BAT-123" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Expiry</label>
                  <input type="month" name="expiry_date" value={currentItem.expiry_date} onChange={handleCurrentItemChange} className="block w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Enter expiry date..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
                  <input type="number" min="1" name="quantity" value={currentItem.quantity} onChange={handleCurrentItemChange} className="block w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Enter quantity..." />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">P.Price (₹)</label>
                    <input type="number" step="0.01" min="0" name="purchase_price" value={currentItem.purchase_price} onChange={handleCurrentItemChange} className="block w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Enter purchase price..." />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">MRP (₹)</label>
                    <input type="number" step="0.01" min="0" name="mrp" value={currentItem.mrp} onChange={handleCurrentItemChange} className="block w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Enter mrp..." />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Sell (₹)</label>
                    <input type="number" step="0.01" min="0" name="selling_price" value={currentItem.selling_price} onChange={handleCurrentItemChange} className="block w-full px-2 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" placeholder="Enter selling price..." />
                  </div>
                </div>
              </div>

              {currentItem.product_id && (
                <div className="mt-3 text-xs text-slate-500 bg-slate-100 p-2 rounded">
                  {(() => {
                    const p = products.find(prod => prod.id.toString() === currentItem.product_id)
                    if (!p) return null
                    const pack = p.pack_type || 'Unit'
                    const unit = p.unit || 'Item'
                    const qty = p.units_per_pack || 1
                    
                    const m = parseFloat(currentItem.mrp)
                    const mrpPerUnit = (!isNaN(m) && qty > 0) ? (m / qty).toFixed(2) : '0.00'
                    
                    return (
                      <span>
                        <strong>Conversion:</strong> 1 {pack} = {qty} {unit}s. <span className="ml-2"><strong>Base MRP:</strong> ₹{mrpPerUnit} / {unit}</span>
                      </span>
                    )
                  })()}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button 
                  type="button" 
                  onClick={handleAddItem}
                  variant="secondary"
                  icon={
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  Add Item
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Added Items Table */}
        <Card>
          <CardHeader 
            title="Purchase Items" 
            className="bg-slate-50/50" 
            action={<span className="text-sm font-medium text-slate-500">{items.length} items</span>} 
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {!isReadOnly && <TableHead className="text-center"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isReadOnly ? 6 : 7} className="py-8 text-center text-slate-500">
                      No items added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => {
                    const product = products.find(p => p.id.toString() === item.product_id)
                    const lineTotal = item.parsed_purchase_price * item.parsed_quantity
                    
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-slate-900">
                          {product ? `${product.name} ${product.strength}` : `Product #${item.product_id}`}
                        </TableCell>
                        <TableCell className="font-mono text-slate-500 uppercase">{item.batch_number}</TableCell>
                        <TableCell>{item.expiry_date}</TableCell>
                        <TableCell className="text-right font-medium text-slate-700">{item.parsed_quantity}</TableCell>
                        <TableCell className="text-right text-slate-700">₹{(item.parsed_purchase_price / 100).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">₹{(lineTotal / 100).toFixed(2)}</TableCell>
                        {!isReadOnly && (
                          <TableCell className="text-center">
                            <button 
                              type="button" 
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                              title="Remove item"
                            >
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-right text-sm font-bold text-slate-700">Grand Total:</td>
                  <td className="px-4 py-4 text-right text-lg font-bold text-teal-600">
                    ₹{(totalAmount / 100).toFixed(2)}
                  </td>
                  {!isReadOnly && <td></td>}
                </tr>
              </tfoot>
            </Table>
          </div>
        </Card>

        {/* Actions */}
        {!isReadOnly && (
          <div className="flex justify-end gap-4 pt-4">
            <Button
              type="button"
              onClick={handleSaveDraft}
              disabled={loading || items.length === 0}
              variant="outline"
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              onClick={handleComplete}
              disabled={loading || items.length === 0}
              isLoading={loading}
              icon={
                !loading && (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                )
              }
            >
              Complete Purchase
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
