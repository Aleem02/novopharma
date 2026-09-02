import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { InventoryBatch, Product } from '../../../../shared/types'
import { PageHeader } from '../ui/PageHeader'
import { Card, CardHeader, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ArrowLeft, Edit2, ArrowRightLeft } from 'lucide-react'

export const BatchDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [batch, setBatch] = useState<InventoryBatch | null>(null)
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batch')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="font-sans max-w-4xl mx-auto py-12 text-center text-slate-500">
        <svg className="animate-spin h-8 w-8 mx-auto text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Loading batch details...</p>
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className="font-sans max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Inventory
        </Button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error || 'Batch not found'}
        </div>
      </div>
    )
  }

  const getStatusBadge = (batch: InventoryBatch) => {
    if (batch.quantity <= 0) return <Badge variant="secondary">Empty / Inactive</Badge>
    const expiryTime = new Date(batch.expiry_date).getTime()
    const now = Date.now()
    const ninetyDays = 90 * 24 * 60 * 60 * 1000

    if (expiryTime < now) return <Badge variant="danger">Expired</Badge>
    if (expiryTime < now + ninetyDays) return <Badge variant="warning" className="bg-orange-100 text-orange-800">Expiring Soon</Badge>
    if (batch.quantity < 10) return <Badge variant="warning">Low Stock</Badge>
    return <Badge variant="success">Good</Badge>
  }

  const formatCurrency = (val: number) => `₹${(val / 100).toFixed(2)}`
  const baseUnit = product?.unit || 'Unit'
  const packType = product?.pack_type || 'Pack'
  const unitsPerPack = product?.units_per_pack || 1
  const isPack = unitsPerPack > 1

  const packs = Math.floor(batch.quantity / unitsPerPack)
  const remainder = batch.quantity % unitsPerPack

  return (
    <div className="font-sans max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Inventory
      </Button>
      
      <PageHeader 
        title={`Batch ${batch.batch_number}`} 
        subtitle={product ? `${product.name} ${product.strength}` : 'Unknown Product'}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/inventory/batch/${batch.id}/edit`)}>
              <Edit2 className="h-4 w-4 mr-2" /> Edit Batch
            </Button>
            <Button variant="outline" onClick={() => navigate(`/inventory/adjustments/new?batchId=${batch.id}`)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" /> Adjust Stock
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Product Information" />
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 font-medium">Medicine Name</p>
              <p className="text-slate-900 font-semibold">{product?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Generic / Composition</p>
              <p className="text-slate-900">{product?.generic_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Manufacturer</p>
              <p className="text-slate-900">{product?.manufacturer || 'N/A'}</p>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-2">Unit Configuration</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Base Unit</p>
                  <p className="text-sm font-medium">{baseUnit}</p>
                </div>
                {isPack && (
                  <div>
                    <p className="text-xs text-slate-400">Pack Type</p>
                    <p className="text-sm font-medium">{packType} ({unitsPerPack} {baseUnit}s)</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Batch Information" action={getStatusBadge(batch)} />
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 font-medium">Batch Number</p>
              <p className="text-slate-900 font-mono text-lg">{batch.batch_number}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Expiry Date</p>
              <p className="text-slate-900">{new Date(batch.expiry_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}</p>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500 font-medium mb-1">Current Inventory</p>
              <div className="flex items-end gap-3">
                <p className="text-3xl font-bold text-slate-900">{batch.quantity} <span className="text-lg font-medium text-slate-500">{baseUnit}s</span></p>
              </div>
              {isPack && (
                <p className="text-sm text-slate-600 mt-1">
                  Equivalent to: <span className="font-medium">{packs} full {packType}s</span>
                  {remainder > 0 && ` + ${remainder} ${baseUnit}s`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader title="Pricing" />
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-500 font-medium">Purchase Price</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(batch.purchase_price)} <span className="text-sm font-normal text-slate-500">/ {baseUnit}</span></p>
                {isPack && <p className="text-sm text-slate-600 mt-1">{formatCurrency(batch.purchase_price * unitsPerPack)} / {packType}</p>}
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-500 font-medium">MRP</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(batch.mrp)} <span className="text-sm font-normal text-slate-500">/ {baseUnit}</span></p>
                {isPack && <p className="text-sm text-slate-600 mt-1">{formatCurrency(batch.mrp * unitsPerPack)} / {packType}</p>}
              </div>
              <div className="bg-teal-50 p-4 rounded-lg border border-teal-100">
                <p className="text-sm text-teal-700 font-medium">Selling Price</p>
                <p className="text-2xl font-bold text-teal-900">{formatCurrency(batch.selling_price || batch.mrp)} <span className="text-sm font-normal text-teal-700">/ {baseUnit}</span></p>
                {isPack && <p className="text-sm text-teal-700 mt-1">{formatCurrency((batch.selling_price || batch.mrp) * unitsPerPack)} / {packType}</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
