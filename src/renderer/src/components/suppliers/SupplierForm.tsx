import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card, CardContent, CardHeader } from '../ui/Card'

export const SupplierForm: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    gstin: ''
  })
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isEdit) {
      loadSupplier()
    }
  }, [id])

  const loadSupplier = async () => {
    setLoading(true)
    try {
      const supplier = await window.api.supplier.get(Number(id))
      if (supplier) {
        setFormData({
          name: supplier.name,
          contact_person: supplier.contact_person || '',
          phone: supplier.phone || '',
          email: supplier.email || '',
          address: supplier.address || '',
          gstin: supplier.gstin || ''
        })
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load supplier')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = { ...formData }

      if (isEdit) {
        await window.api.supplier.update(Number(id), payload)
      } else {
        await window.api.supplier.create(payload)
      }
      
      navigate('/suppliers')
    } catch (err: any) {
      setError(err.message || 'Failed to save supplier')
      setLoading(false)
    }
  }

  if (loading && isEdit && !formData.name) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-slate-400">
          <svg className="animate-spin h-8 w-8 mx-auto text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="font-medium text-slate-500">Loading supplier data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="font-sans max-w-4xl mx-auto pb-12">
      <PageHeader
        title={isEdit ? 'Edit Supplier' : 'Add Supplier'}
        subtitle={isEdit ? 'Update existing supplier details' : 'Register a new supplier or distributor'}
        showBack={true}
        action={
          <Button 
            onClick={() => navigate('/suppliers')} 
            variant="outline"
          >
            Cancel
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader title="Company Details" className="bg-slate-50/50" />
          <CardContent>
            <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input label="Supplier / Company Name *" name="name" value={formData.name} onChange={handleChange} required placeholder="Enter supplier /  company  name *..." />
              </div>
              <Input label="GSTIN" name="gstin" value={formData.gstin} onChange={handleChange} className="font-mono uppercase" placeholder="e.g. 22AAAAA0000A1Z5" maxLength={15} />
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea 
                  name="address" 
                  value={formData.address} 
                  onChange={handleChange} 
                  rows={3} 
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-colors resize-none"
                ></textarea>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Contact Information" className="bg-slate-50/50" />
          <CardContent>
            <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input label="Contact Person Name" name="contact_person" value={formData.contact_person} onChange={handleChange} placeholder="Enter contact  person  name..." />
              </div>
              <Input label="Phone Number" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+91" />
              <Input label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="contact@supplier.com" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            onClick={() => navigate('/suppliers')}
            variant="outline"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            isLoading={loading} 
          >
            {isEdit ? 'Update Supplier' : 'Save Supplier'}
          </Button>
        </div>
      </form>
    </div>
  )
}
