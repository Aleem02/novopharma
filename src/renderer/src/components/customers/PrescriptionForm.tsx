import React, { useState, useEffect, useRef } from 'react'
import { CreatePrescriptionPayload, Product } from '../../../../shared/types'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface PrescriptionFormProps {
  customerId: number
  onSuccess: () => void
  onCancel: () => void
}

export const PrescriptionForm: React.FC<PrescriptionFormProps> = ({ customerId, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<Omit<CreatePrescriptionPayload, 'items'>>({
    customer_id: customerId,
    prescription_date: Date.now(),
    doctor_name: '',
    doctor_reg_number: '',
    reference_number: '',
    diagnosis_notes: '' // Kept optional as per instruction
  })

  const [items, setItems] = useState<Array<{
    product_id: number | null
    medicine_name_snapshot: string
    dosage_instructions: string
    quantity: number
  }>>([])

  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1)
  const productContainerRef = useRef<HTMLDivElement>(null)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (productSearch.length > 2) {
      const delay = setTimeout(async () => {
        try {
          const results = await window.api.product.search(productSearch)
          setSearchResults(results)
          setSelectedResultIndex(-1)
        } catch (e) {
          console.error(e)
          setSelectedResultIndex(-1)
        }
      }, 300)
      return () => clearTimeout(delay)
    } else {
      setSearchResults([])
      setSelectedResultIndex(-1)
    }
  }, [productSearch])

  const addProduct = (product: Product) => {
    setItems(prev => [
      ...prev,
      {
        product_id: product.id,
        medicine_name_snapshot: product.name,
        dosage_instructions: '',
        quantity: 1
      }
    ])
    setProductSearch('')
    setSearchResults([])
  }

  const addCustomProduct = () => {
    if (!productSearch.trim()) return
    setItems(prev => [
      ...prev,
      {
        product_id: null,
        medicine_name_snapshot: productSearch,
        dosage_instructions: '',
        quantity: 1
      }
    ])
    setProductSearch('')
    setSearchResults([])
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (searchResults.length > 0) {
        e.preventDefault()
        setSelectedResultIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev))
      }
    } else if (e.key === 'ArrowUp') {
      if (searchResults.length > 0) {
        e.preventDefault()
        setSelectedResultIndex(prev => (prev > 0 ? prev - 1 : 0))
      }
    } else if (e.key === 'Enter') {
      if (selectedResultIndex >= 0 && selectedResultIndex < searchResults.length) {
        e.preventDefault()
        addProduct(searchResults[selectedResultIndex])
      }
    } else if (e.key === 'Escape') {
      setSearchResults([])
      setSelectedResultIndex(-1)
    }
  }

  // Auto-scroll selected product into view
  useEffect(() => {
    if (selectedResultIndex >= 0 && productContainerRef.current) {
      const activeElement = productContainerRef.current.querySelector('.active-product')
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedResultIndex])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (items.length === 0) {
      setError('Please add at least one medicine to the prescription')
      return
    }

    setIsSubmitting(true)
    
    try {
      await window.api.prescription.create({
        ...formData,
        items
      } as CreatePrescriptionPayload)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to save prescription')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 bg-slate-50 relative">
      <div className="bg-white p-6 border-b border-slate-200 shadow-sm z-10 flex-shrink-0">
        <h2 className="text-xl font-bold text-slate-800">Add New Prescription</h2>
        <p className="text-sm text-slate-500">Record a prescription for this patient.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <form id="prescription-form" onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm font-medium border border-red-100">
              {error}
            </div>
          )}
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Doctor Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Doctor Name"
                name="doctor_name"
                value={formData.doctor_name}
                onChange={e => setFormData({ ...formData, doctor_name: e.target.value })}
                required
                placeholder="Dr. Name"
              />
              <Input
                label="Registration Number (Optional)"
                name="doctor_reg_number"
                value={formData.doctor_reg_number || ''}
                onChange={e => setFormData({ ...formData, doctor_reg_number: e.target.value })}
                placeholder="Reg #"
              />
              <Input
                label="Reference / Rx Number (Optional)"
                name="reference_number"
                value={formData.reference_number || ''}
                onChange={e => setFormData({ ...formData, reference_number: e.target.value })} placeholder="Enter reference /  rx  number ( optional)..."
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Prescribed Medicines</h3>
            
            <div className="mb-6 relative z-20">
              <label className="block text-sm font-medium text-slate-700 mb-1">Search Product Master or Add Custom</label>
              <div className="flex space-x-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="Type medicine name..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                  {searchResults.length > 0 && (
                    <div ref={productContainerRef} className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {searchResults.map((p, index) => (
                        <div 
                          key={p.id} 
                          className={`px-4 py-3 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${
                            index === selectedResultIndex ? 'bg-teal-50 font-semibold shadow-sm active-product' : 'hover:bg-teal-50'
                          }`}
                          onClick={() => addProduct(p)}
                        >
                          <div className="font-bold text-slate-800">{p.name}</div>
                          {p.strength && <div className="text-xs text-slate-500">{p.strength}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="button" variant="outline" onClick={addCustomProduct} disabled={!productSearch.trim()}>
                  Add as Custom
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex space-x-3 items-start bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <Input 
                      label="Medicine Name" 
                      value={item.medicine_name_snapshot} 
                      onChange={e => updateItem(index, 'medicine_name_snapshot', e.target.value)}
                      required placeholder="Enter medicine  name..."
                    />
                    {item.product_id && <span className="text-xs text-teal-600 mt-1 font-medium block">✓ Linked to Product Master</span>}
                  </div>
                  <div className="flex-1">
                    <Input 
                      label="Dosage Instructions" 
                      value={item.dosage_instructions} 
                      onChange={e => updateItem(index, 'dosage_instructions', e.target.value)}
                      placeholder="e.g. 1 pill morning and night"
                      required
                    />
                  </div>
                  <div className="w-24">
                    <Input 
                      label="Qty" 
                      type="number"
                      min="1"
                      value={item.quantity} 
                      onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      required placeholder="Enter qty..."
                    />
                  </div>
                  <div className="pt-6">
                    <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                  Search and add medicines above
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="bg-white p-4 border-t border-slate-200 flex justify-end space-x-3 flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" form="prescription-form" isLoading={isSubmitting}>
          Save Prescription
        </Button>
      </div>
    </div>
  )
}
