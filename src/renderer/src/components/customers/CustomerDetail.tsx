import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Customer, Sale, Prescription, PrescriptionItem } from '../../../../shared/types'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { PrescriptionForm } from './PrescriptionForm'

export const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false)
  const [exporting, setExporting] = useState<number | null>(null)
  
  const loadData = async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const customerId = parseInt(id)
      const c = await window.api.customer.get(customerId)
      setCustomer(c)
      
      const s = await window.api.customer.history(customerId, 1, 10)
      setSales(s.items)

      const p = await window.api.prescription.list(customerId, 1, 10)
      setPrescriptions(p.items)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleExportPrescription = async (prescriptionId: number, format: 'PDF' | 'PRINT') => {
    setExporting(prescriptionId)
    try {
      await window.api.document.exportPrescription(prescriptionId, format)
    } catch (e: any) {
      alert(`Export failed: ${e.message}`)
    } finally {
      setExporting(null)
    }
  }

  if (isLoading) return <div className="p-8 text-slate-500">Loading customer details...</div>
  if (!customer) return <div className="p-8 text-red-500">Customer not found</div>

  return (
    <div className="font-sans max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-6 flex items-center">
        <PageHeader title={customer.name} subtitle={customer.phone} showBack={true} />
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-12">
        {/* Customer Profile Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Profile Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-slate-500 mb-1">Email</div>
              <div className="font-medium text-slate-800">{customer.email || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Date of Birth</div>
              <div className="font-medium text-slate-800">{customer.date_of_birth || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Gender</div>
              <div className="font-medium text-slate-800">{customer.gender || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Status</div>
              <div className="font-medium text-slate-800">{customer.is_active ? 'Active' : 'Inactive'}</div>
            </div>
          </div>
          {customer.address && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Address</div>
              <div className="text-slate-800">{customer.address}</div>
            </div>
          )}
          {customer.notes && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 mb-1">Notes</div>
              <div className="text-slate-800 bg-amber-50 p-3 rounded-lg text-sm">{customer.notes}</div>
            </div>
          )}
        </div>

        {/* Prescriptions Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Prescriptions</h3>
            <Button size="sm" onClick={() => setShowPrescriptionForm(true)}>+ Add Prescription</Button>
          </div>
          
          {prescriptions.length === 0 ? (
            <div className="text-center py-6 text-slate-400">No prescriptions recorded yet.</div>
          ) : (
            <div className="space-y-4">
              {prescriptions.map(p => (
                <div key={p.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-bold text-slate-800">{p.doctor_name}</div>
                      <div className="text-xs text-slate-500">{new Date(p.prescription_date).toLocaleDateString()} {p.reference_number && `• Ref: ${p.reference_number}`}</div>
                    </div>
                    <div className="space-x-2 flex">
                      <Button variant="outline" size="sm" disabled={exporting === p.id} onClick={() => handleExportPrescription(p.id, 'PDF')}>
                        PDF
                      </Button>
                      <Button variant="outline" size="sm" disabled={exporting === p.id} onClick={() => handleExportPrescription(p.id, 'PRINT')}>
                        Print
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {p.items?.map((item: PrescriptionItem) => (
                      <div key={item.id} className="p-3 flex justify-between items-center text-sm">
                        <div>
                          <span className="font-bold text-slate-700">{item.medicine_name_snapshot}</span>
                          <span className="text-slate-500 ml-2">{item.dosage_instructions}</span>
                        </div>
                        <div className="text-slate-500 font-medium">Qty: {item.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Purchase History */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Recent Purchases</h3>
          {sales.length === 0 ? (
            <div className="text-center py-6 text-slate-400">No purchase history found.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-3 font-bold rounded-tl-lg">Date</th>
                  <th className="p-3 font-bold">Invoice</th>
                  <th className="p-3 font-bold">Total</th>
                  <th className="p-3 font-bold text-right rounded-tr-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-sm text-slate-700">{new Date(s.sale_date).toLocaleDateString()}</td>
                    <td className="p-3 text-sm font-medium text-slate-800">{s.invoice_number}</td>
                    <td className="p-3 text-sm font-bold text-slate-800">₹{(s.total_amount / 100).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/sales/${s.id}`)}>View Invoice</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showPrescriptionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            <PrescriptionForm
              customerId={customer.id}
              onCancel={() => setShowPrescriptionForm(false)}
              onSuccess={() => {
                setShowPrescriptionForm(false)
                loadData()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
