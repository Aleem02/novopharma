import React, { useState, useEffect } from 'react'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { PrintingSettings } from './PrintingSettings'
import { DatabaseSettings } from './DatabaseSettings'

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'printing' | 'database'>('general')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const data = await window.api.settings.getAll()
      setSettings(data)
    } catch (e: any) {
      setError(e.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await window.api.settings.update(settings)
      setSuccess('Settings saved successfully')
    } catch (e: any) {
      setError(e.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }


  if (loading) return <div className="p-8">Loading settings...</div>

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-6 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pharmacy Settings</h1>
          <p className="text-slate-500 mt-1">Configure your application preferences.</p>
        </div>
        <Button onClick={() => handleSave()} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
      
      {error && <div className="p-4 mb-4 bg-red-100 text-red-700 rounded-lg font-medium">{error}</div>}
      {success && <div className="p-4 mb-4 bg-green-100 text-green-700 rounded-lg font-medium">{success}</div>}
      
      <div className="flex gap-8">
        {/* Settings Navigation Sidebar */}
        <div className="w-64 shrink-0">
          <nav className="flex flex-col space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors ${activeTab === 'general' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              General Configuration
            </button>
            <button
              onClick={() => setActiveTab('printing')}
              className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors ${activeTab === 'printing' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Printing
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`px-4 py-2.5 text-left text-sm font-semibold rounded-lg transition-colors ${activeTab === 'database' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Database Management
            </button>
          </nav>
        </div>

        {/* Settings Content Area */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Pharmacy Details</h2>
                <div className="space-y-4">
                  <Input
                    label="Pharmacy Name"
                    value={settings.pharmacy_name || ''}
                    onChange={e => handleChange('pharmacy_name', e.target.value)} placeholder="Enter pharmacy  name..."
                  />
                  <Input
                    label="Address"
                    value={settings.address || ''}
                    onChange={e => handleChange('address', e.target.value)} placeholder="Enter address..."
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Phone"
                      value={settings.phone || ''}
                      onChange={e => handleChange('phone', e.target.value)} placeholder="Enter phone..."
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={settings.email || ''}
                      onChange={e => handleChange('email', e.target.value)} placeholder="Enter email..."
                    />
                  </div>
                  <Input
                    label="GST Number"
                    value={settings.gst_number || ''}
                    onChange={e => handleChange('gst_number', e.target.value)} placeholder="Enter g s t  number..."
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Invoice Configuration</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Invoice Prefix"
                    value={settings.invoice_prefix || ''}
                    onChange={e => handleChange('invoice_prefix', e.target.value)} placeholder="Enter invoice  prefix..."
                  />
                  <Input
                    label="Next Invoice Number"
                    type="number"
                    min="1"
                    value={settings.next_invoice_number || '1'}
                    onChange={e => handleChange('next_invoice_number', e.target.value)} placeholder="Enter next  invoice  number..."
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Warning: Changing the next invoice number may cause sequence gaps or conflicts if not handled carefully.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'printing' && (
            <PrintingSettings settings={settings} handleChange={handleChange} />
          )}

          {activeTab === 'database' && (
            <DatabaseSettings 
              settings={settings} 
              handleChange={handleChange}
              setError={setError}
              setSuccess={setSuccess}
            />
          )}
        </div>
      </div>
    </div>
  )
}
