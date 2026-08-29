import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { Supplier } from '../../../../shared/types'

const COMMON_DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Injection', 'Cream', 
  'Ointment', 'Gel', 'Drops', 'Spray', 'Powder', 'Sachet', 'Inhaler', 
  'Suppository', 'Device', 'Other'
]

const COMMON_PACK_TYPES = [
  'Strip', 'Bottle', 'Box', 'Tube', 'Vial', 'Ampoule', 'Sachet', 'Pack', 'Piece', 'Other'
]

const COMMON_UNITS = [
  'Tablet', 'Capsule', 'Piece', 'ml', 'Bottle', 'Vial', 'Ampoule', 'Syringe', 'Tube', 'Sachet', 'Other'
]

export const ProductForm: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [hasHistory, setHasHistory] = useState(false)
  const [showMore, setShowMore] = useState(isEdit)

  const [formData, setFormData] = useState({
    // Product Identity
    name: '',
    generic_name: '',
    manufacturer: '',
    category: '',
    therapeutic_category: '',

    // Medicine Details
    dosage_form: '',
    strength: '',
    unit: '',
    pack_type: '',
    units_per_pack: '',
    pack_description: '',

    // Regulatory & Tax
    hsn_code: '',
    drug_schedule: '',
    prescription_required: false,
    tax_rate: '0',

    // Identification
    barcode: '',
    sku: '',
    selling_price: '',

    // Inventory Defaults
    reorder_level: '0',
    min_stock: '0',
    max_stock: '0',
    rack: '',
    shelf: '',
    preferred_supplier_id: '',

    // Status
    is_active: true
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSuppliers()
    if (isEdit) {
      loadProduct()
    }
  }, [id])

  const fetchSuppliers = async () => {
    try {
      const supps = await window.api.supplier.list()
      setSuppliers(supps.items.filter(s => s.is_active))
    } catch (err) {
      console.error('Failed to load suppliers', err)
    }
  }

  const loadProduct = async () => {
    setLoading(true)
    try {
      const product = await window.api.product.get(Number(id))
      if (product) {
        setFormData({
          name: product.name || '',
          generic_name: product.generic_name || '',
          manufacturer: product.manufacturer || '',
          category: product.category || '',
          therapeutic_category: product.therapeutic_category || '',

          dosage_form: product.dosage_form || '',
          strength: product.strength || '',
          unit: product.unit || '',
          pack_type: product.pack_type || '',
          units_per_pack: product.units_per_pack ? product.units_per_pack.toString() : '',
          pack_description: product.pack_description || '',

          hsn_code: product.hsn_code || '',
          drug_schedule: product.drug_schedule || '',
          prescription_required: product.prescription_required === 1,
          tax_rate: (product.tax_rate / 100).toString(),

          barcode: product.barcode || '',
          sku: product.sku || '',
          selling_price: (product.selling_price / 100).toString(),

          reorder_level: product.reorder_level ? product.reorder_level.toString() : '0',
          min_stock: product.min_stock ? product.min_stock.toString() : '0',
          max_stock: product.max_stock ? product.max_stock.toString() : '0',
          rack: product.rack || '',
          shelf: product.shelf || '',
          preferred_supplier_id: product.preferred_supplier_id ? product.preferred_supplier_id.toString() : '',

          is_active: product.is_active === 1
        })
        
        // Check if product has history (simplified check for demo, real impl would ask backend)
        const batches = await window.api.inventory.list()
        if (batches.items.some(b => b.product_id === product.id)) {
          setHasHistory(true)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const handleDosageFormChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    let suggestedUnit = formData.unit
    let suggestedPack = formData.pack_type

    if (val === 'Tablet') {
      suggestedUnit = 'Tablet'
      suggestedPack = 'Strip'
    } else if (val === 'Syrup' || val === 'Suspension') {
      suggestedUnit = 'ml'
      suggestedPack = 'Bottle'
    } else if (val === 'Injection') {
      suggestedUnit = 'Vial'
      suggestedPack = 'Box'
    } else if (val === 'Capsule') {
      suggestedUnit = 'Capsule'
      suggestedPack = 'Strip'
    }

    setFormData(prev => ({
      ...prev,
      dosage_form: val,
      unit: prev.unit || suggestedUnit,
      pack_type: prev.pack_type || suggestedPack
    }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSave = async (actionType: 'NORMAL' | 'ADD_BATCH' | 'ADD_ANOTHER') => {
    setError('')
    setLoading(true)

    try {
      const priceFloat = parseFloat(formData.selling_price || '0')
      const taxFloat = parseFloat(formData.tax_rate || '0')
      const upp = parseInt(formData.units_per_pack)
      const reorder = parseInt(formData.reorder_level)
      const minStock = parseInt(formData.min_stock)
      const maxStock = parseInt(formData.max_stock)

      if (isNaN(priceFloat) || priceFloat < 0) throw new Error('Default Selling Price must be a valid positive number.')
      if (isNaN(taxFloat) || taxFloat < 0) throw new Error('Tax rate must be a valid positive number.')
      if (formData.units_per_pack && (isNaN(upp) || upp <= 0)) throw new Error('Units per pack must be a positive integer.')

      const payload = {
        name: formData.name,
        generic_name: formData.generic_name,
        manufacturer: formData.manufacturer,
        category: formData.category,
        therapeutic_category: formData.therapeutic_category,
        
        dosage_form: formData.dosage_form,
        strength: formData.strength,
        unit: formData.unit,
        pack_type: formData.pack_type,
        units_per_pack: formData.units_per_pack ? upp : null,
        pack_description: formData.pack_description,
        
        hsn_code: formData.hsn_code,
        drug_schedule: formData.drug_schedule,
        prescription_required: formData.prescription_required ? 1 : 0,
        tax_rate: Math.round(taxFloat * 100),
        
        barcode: formData.barcode,
        sku: formData.sku,
        selling_price: Math.round(priceFloat * 100),
        
        reorder_level: isNaN(reorder) ? 0 : reorder,
        min_stock: isNaN(minStock) ? 0 : minStock,
        max_stock: isNaN(maxStock) ? 0 : maxStock,
        rack: formData.rack,
        shelf: formData.shelf,
        preferred_supplier_id: formData.preferred_supplier_id ? parseInt(formData.preferred_supplier_id) : null,
        
        is_active: formData.is_active ? 1 : 0
      }

      let savedProduct;
      if (isEdit) {
        savedProduct = await window.api.product.update(Number(id), payload)
      } else {
        savedProduct = await window.api.product.create(payload)
      }
      
      if (actionType === 'ADD_BATCH') {
        navigate(`/purchases/new?productId=${savedProduct.id}`)
      } else if (actionType === 'ADD_ANOTHER') {
        // Reset form for next entry
        setFormData({ ...formData, name: '', barcode: '', sku: '' })
        window.scrollTo(0,0)
      } else {
        navigate('/products')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save medicine')
    } finally {
      setLoading(false)
    }
  }

  // Prevent "Enter" from submitting the form unintentionally
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault()
    }
  }

  if (loading && isEdit && !formData.name) {
    return <div className="flex items-center justify-center min-h-[400px]">Loading...</div>
  }

  const displayConversion = (formData.pack_type && formData.units_per_pack && formData.unit)
    ? `1 ${formData.pack_type} = ${formData.units_per_pack} ${formData.unit}s`
    : null;

  return (
    <div className="font-sans max-w-4xl mx-auto pb-12">
      <PageHeader
        title={isEdit ? 'Edit Medicine Master' : 'New Medicine Master'}
        subtitle={isEdit ? 'Update product record' : 'Register a new medicine into the catalog'}
        showBack={true}
      />

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-3 rounded text-sm font-medium">
          {error}
        </div>
      )}
      
      {hasHistory && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded text-sm">
          <strong>Warning:</strong> This product has existing stock/history. Modifying its unit or pack configuration is disabled to prevent historical data corruption.
        </div>
      )}

      <form onKeyDown={handleKeyDown} className="space-y-6">
        
        {/* Step 1: Essential Information */}
        <Card>
          <CardHeader title="1. Product Identity" className="bg-slate-50/50 py-3" />
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input label="Medicine Name *" name="name" value={formData.name} onChange={handleChange} autoFocus required placeholder="Enter medicine  name *..." />
              </div>
              <Input label="Generic Name / Salt" name="generic_name" value={formData.generic_name} onChange={handleChange} placeholder="Enter generic  name /  salt..." />
              <Input label="Manufacturer / Brand" name="manufacturer" value={formData.manufacturer} onChange={handleChange} placeholder="Enter manufacturer /  brand..." />
              
              <Select label="Dosage Form *" name="dosage_form" value={formData.dosage_form} onChange={handleDosageFormChange} required>
                <option value="">Select Form...</option>
                {COMMON_DOSAGE_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
              
              <Input label="Strength (e.g. 500mg)" name="strength" value={formData.strength} onChange={handleChange} placeholder="Enter strength (e.g. 500mg)..." />
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Packaging & Units */}
        <Card>
          <CardHeader title="2. Packaging & Units" className="bg-slate-50/50 py-3" />
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select label="Base / Sale Unit *" name="unit" value={formData.unit} onChange={handleChange} disabled={hasHistory} required>
                <option value="">Select Base Unit...</option>
                {COMMON_UNITS.map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
              <Select label="Pack Type" name="pack_type" value={formData.pack_type} onChange={handleChange} disabled={hasHistory}>
                <option value="">None (Bulk)</option>
                {COMMON_PACK_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
              <Input label="Units Per Pack" name="units_per_pack" type="number" min="1" value={formData.units_per_pack} onChange={handleChange} disabled={hasHistory} placeholder="Enter units  per  pack..." />
            </div>
            {displayConversion && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800 flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                <strong>Conversion Preview:</strong>&nbsp;{displayConversion}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Fast Identifiers */}
        <Card>
          <CardHeader title="3. Pricing & Identification" className="bg-slate-50/50 py-3" />
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="GST Rate (%) *" name="tax_rate" type="number" step="0.01" min="0" value={formData.tax_rate} onChange={handleChange} required placeholder="Enter g s t  rate (%) *..." />
              <Input label="Barcode (Scan here)" name="barcode" value={formData.barcode} onChange={handleChange} className="font-mono" placeholder="Enter barcode ( scan here)..." />
              <Input label="Default Product Price (₹)" name="selling_price" type="number" step="0.01" min="0" value={formData.selling_price} onChange={handleChange} placeholder="Enter default  product  price (₹)..." />
            </div>
            <p className="mt-2 text-xs text-slate-500">Note: Actual batch prices will be recorded when stock is received. The Default Product Price is only a fallback.</p>
          </CardContent>
        </Card>

        {/* Progressive Disclosure */}
        {!showMore ? (
          <div className="flex justify-center border-t border-dashed border-slate-300 pt-4">
            <button type="button" onClick={() => setShowMore(true)} className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center">
              Show Advanced Fields (Inventory, Regulatory, Status)
              <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader title="4. Regulatory & Tax Details" className="bg-slate-50/50 py-3" />
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input label="HSN Code" name="hsn_code" value={formData.hsn_code} onChange={handleChange} placeholder="Enter h s n  code..." />
                  <Select label="Drug Schedule" name="drug_schedule" value={formData.drug_schedule} onChange={handleChange}>
                    <option value="">None / OTC</option>
                    <option value="Schedule H">Schedule H</option>
                    <option value="Schedule H1">Schedule H1</option>
                    <option value="Schedule X">Schedule X</option>
                  </Select>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input type="checkbox" name="prescription_required" checked={formData.prescription_required} onChange={handleChange} className="w-4 h-4 text-teal-600" placeholder="Enter prescription required..." />
                      <span className="text-sm font-medium text-slate-700">Prescription Required</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="5. Inventory Defaults" className="bg-slate-50/50 py-3" />
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input label="Reorder Level" name="reorder_level" type="number" min="0" value={formData.reorder_level} onChange={handleChange} placeholder="Enter reorder  level..." />
                  <Input label="Minimum Stock" name="min_stock" type="number" min="0" value={formData.min_stock} onChange={handleChange} placeholder="Enter minimum  stock..." />
                  <Select label="Preferred Supplier" name="preferred_supplier_id" value={formData.preferred_supplier_id} onChange={handleChange}>
                    <option value="">-- None --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                  <Input label="Rack" name="rack" value={formData.rack} onChange={handleChange} placeholder="Enter rack..." />
                  <Input label="Shelf / Bin" name="shelf" value={formData.shelf} onChange={handleChange} placeholder="Enter shelf /  bin..." />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <div className="flex justify-between items-center border-t border-slate-200 pt-6">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" name="is_active" checked={formData.is_active} onChange={handleChange} className="w-4 h-4 text-teal-600" placeholder="Enter is active..." />
            <span className="text-sm font-medium text-slate-700">Active Medicine</span>
          </label>

          <div className="flex gap-3">
            <Button type="button" onClick={() => navigate('/products')} variant="outline" disabled={loading}>
              Cancel
            </Button>
            {!isEdit && (
              <Button type="button" onClick={() => handleSave('ADD_ANOTHER')} variant="secondary" disabled={loading}>
                Save & Add Another
              </Button>
            )}
            <Button type="button" onClick={() => handleSave('NORMAL')} variant="secondary" disabled={loading}>
              {isEdit ? 'Update Only' : 'Save Only'}
            </Button>
            <Button type="button" onClick={() => handleSave('ADD_BATCH')} className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm" disabled={loading} isLoading={loading}>
              Save & Add Batch ⚡
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
