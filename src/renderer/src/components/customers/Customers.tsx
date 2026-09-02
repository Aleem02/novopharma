import React, { useState, useEffect } from 'react'
import { Customer } from '../../../../shared/types'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { CustomerForm } from './CustomerForm'
import { useNavigate } from 'react-router-dom'
import { useModuleSearchState } from '../../hooks/useModuleSearchState'

export const Customers: React.FC = () => {
  const {
    query,
    setQuery,
    debouncedQuery: debouncedSearch,
    page,
    setPage
  } = useModuleSearchState('customers')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  
  const navigate = useNavigate()
  const pageSize = 50

  const loadCustomers = async () => {
    setIsLoading(true)
    try {
      const result = await window.api.customer.list({ page, pageSize, search: debouncedSearch })
      setCustomers(result.items)
      setTotal(result.total)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [debouncedSearch, page])

  useEffect(() => {
    if (!query) loadCustomers()
  }, [page])

  return (
    <div className="font-sans max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <PageHeader title="Customers & Patients" subtitle={`Total: ${total} customers`} />
        <Button onClick={() => setShowForm(true)}>+ New Customer</Button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-800">New Customer</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <CustomerForm 
                onCancel={() => setShowForm(false)}
                onSuccess={() => {
                  setShowForm(false)
                  loadCustomers()
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-200">
          <Input
            placeholder="Search by name or phone..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="max-w-md"
            icon={
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-500">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <svg className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p>No customers found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 font-bold">Name</th>
                  <th className="p-4 font-bold">Phone</th>
                  <th className="p-4 font-bold">Email</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{c.name}</div>
                      {c.gender && <div className="text-xs text-slate-500">{c.gender}</div>}
                    </td>
                    <td className="p-4 text-slate-600 font-medium">{c.phone}</td>
                    <td className="p-4 text-slate-600">{c.email || '-'}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        c.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${c.id}`)}>
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination placeholder if total > pageSize */}
        {total > pageSize && (
          <div className="p-4 border-t border-slate-200 flex justify-between items-center text-sm text-slate-500">
            <div>Showing {Math.min((page - 1) * pageSize + 1, total)} to {Math.min(page * pageSize, total)} of {total}</div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
