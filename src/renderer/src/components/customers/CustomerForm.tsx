import React, { useState } from 'react'
import { CreateCustomerPayload, UpdateCustomerPayload, Customer } from '../../../../shared/types'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface CustomerFormProps {
  initialData?: Customer
  onSuccess: () => void
  onCancel: () => void
}

export const CustomerForm: React.FC<CustomerFormProps> = ({ initialData, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<CreateCustomerPayload | UpdateCustomerPayload>({
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    address: initialData?.address || '',
    date_of_birth: initialData?.date_of_birth || '',
    gender: initialData?.gender || '',
    notes: initialData?.notes || '',
    is_active: initialData ? initialData.is_active : 1
  })
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData((prev: CreateCustomerPayload | UpdateCustomerPayload) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked ? 1 : 0 : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    
    try {
      if (initialData) {
        await window.api.customer.update(initialData.id, formData as UpdateCustomerPayload)
      } else {
        await window.api.customer.create(formData as CreateCustomerPayload)
      }
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to save customer')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Full Name"
          name="name"
          value={formData.name || ''}
          onChange={handleChange}
          required
          placeholder="e.g. John Doe"
        />
        <Input
          label="Phone Number"
          name="phone"
          value={formData.phone || ''}
          onChange={handleChange}
          required
          placeholder="e.g. 9876543210"
        />
        <Input
          label="Email (Optional)"
          name="email"
          type="email"
          value={formData.email || ''}
          onChange={handleChange}
          placeholder="e.g. john@example.com"
        />
        <Input
          label="Date of Birth (Optional)"
          name="date_of_birth"
          type="date"
          value={formData.date_of_birth || ''}
          onChange={handleChange} placeholder="Enter date of  birth ( optional)..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Gender (Optional)</label>
        <select 
          name="gender" 
          value={formData.gender || ''} 
          onChange={handleChange}
          className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors"
        >
          <option value="">Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Address (Optional)</label>
        <textarea
          name="address"
          value={formData.address || ''}
          onChange={handleChange}
          className="w-full p-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors min-h-[80px]"
          placeholder="Full address..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
        <textarea
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          className="w-full p-3 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors min-h-[80px]"
          placeholder="Any additional notes..."
        />
      </div>

      {initialData && (
        <div className="flex items-center pt-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={formData.is_active === 1}
            onChange={handleChange}
            className="h-4 w-4 text-teal-600 rounded border-slate-300" placeholder="Enter is active..."
          />
          <label htmlFor="is_active" className="ml-2 text-sm text-slate-700">
            Active Customer
          </label>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {initialData ? 'Update Customer' : 'Create Customer'}
        </Button>
      </div>
    </form>
  )
}
