import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { InventoryBatch, Product } from '../../../../shared/types'
import { PageHeader } from '../ui/PageHeader'
import { Card, CardHeader, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

export const EditBatch: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [batch, setBatch] = useState<InventoryBatch | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    expiry_date: '',
    mrp: '',
    selling_price: ''
  })

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const b = await window.api.inventory.getBatchById(Number(id))
      if (!b) throw new Error('Batch not found')
      setBatch(b)
      
      const p = await window.api.product.list()
      const foundProduct = p.items.find(prod => prod.id === b.product_id)
      if (foundProduct) {
        setProduct(foundProduct)
      }

      setFormData({
        expiry_date: new Date(b.expiry_date).toISOString().split('T')[0],
        mrp: (b.mrp / 100).toFixed(2),
        selling_price: ((b.selling_price || b.mrp) / 100).toFixed(2)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batch')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !batch) return

    setSaving(true)
    setError('')

    try {
      const expiry_date = new Date(formData.expiry_date).getTime()
      if (isNaN(expiry_date)) throw new Error('Invalid expiry date')

      const mrp = Math.round(parseFloat(formData.mrp) * 100)
      const selling_price = Math.round(parseFloat(formData.selling_price) * 100)

      if (isNaN(mrp) || mrp < 0) throw new Error('Invalid MRP')
      if (isNaN(selling_price) || selling_price < 0) throw new Error('Invalid Selling Price')

      await window.api.inventory.updateBatch(Number(id), {
        expiry_date,
        mrp,
        selling_price
      })

      navigate(`/inventory/batch/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update batch')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="font-sans max-w-2xl mx-auto py-12 text-center text-slate-500">
        <svg className="animate-spin h-8 w-8 mx-auto text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Loading batch details...</p>
      </div>
    )
  }

  if (error && !batch) {
    return (
      <div className="font-sans max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Inventory
        </Button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error || 'Batch not found'}
        </div>
      </div>
    )
  }

  const baseUnit = product?.unit || 'Unit'
  const isPack = (product?.units_per_pack || 1) > 1

  return (
    <div className="font-sans max-w-2xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(`/inventory/batch/${id}`)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Batch Details
      </Button>

      <PageHeader 
        title={`Edit Batch ${batch?.batch_number}`} 
        subtitle={product ? `${product.name} ${product.strength}` : 'Unknown Product'}
      />

      <form onSubmit={handleSubmit}>
        <Card className="mb-6 border-blue-200 bg-blue-50/50 shadow-none">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Important Note on Pricing</p>
              <p className="text-sm text-blue-800 mt-1">
                Changing this batch price will affect <strong>future sales</strong> from this batch. 
                Completed transactions and historical invoices will <strong>not</strong> be changed.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader title="Batch Metadata" />
          <CardContent className="space-y-6">
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
              <p className="text-sm text-slate-500 font-medium mb-1">Batch Quantity</p>
              <p className="text-lg font-semibold text-slate-900">{batch?.quantity} {baseUnit}s</p>
              <p className="text-xs text-slate-500 mt-2">
                Batch quantity cannot be edited directly. Use Stock Adjustment or Purchase Return so inventory history remains accurate.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
              <Input
                type="date"
                required
                value={formData.expiry_date}
                onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} placeholder="Enter value..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">MRP (per {baseUnit})</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500">₹</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="pl-8"
                    value={formData.mrp}
                    onChange={e => setFormData({ ...formData, mrp: e.target.value })} placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (per {baseUnit})</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500">₹</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="pl-8"
                    value={formData.selling_price}
                    onChange={e => setFormData({ ...formData, selling_price: e.target.value })} placeholder="0"
                  />
                </div>
              </div>
            </div>

            {isPack && (
              <div className="bg-slate-50 rounded p-3 text-sm text-slate-600">
                <p>Equivalent Pack Prices ({product?.pack_type} of {product?.units_per_pack} {baseUnit}s):</p>
                <ul className="list-disc ml-5 mt-1">
                  <li>MRP: ₹{((parseFloat(formData.mrp || '0') * (product?.units_per_pack || 1))).toFixed(2)}</li>
                  <li>Selling: ₹{((parseFloat(formData.selling_price || '0') * (product?.units_per_pack || 1))).toFixed(2)}</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(`/inventory/batch/${id}`)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
