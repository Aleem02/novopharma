import React, { useState, useEffect } from 'react'
import { Supplier } from '../../../../shared/types'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card } from '../ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { useModuleSearchState } from '../../hooks/useModuleSearchState'

export const SupplierMaster: React.FC = () => {
  const {
    query,
    setQuery,
    debouncedQuery,
    setDebouncedQuery,
    page,
    setPage
  } = useModuleSearchState('suppliers')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Pagination State
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchSuppliers()
  }, [page, pageSize, debouncedQuery])

  const fetchSuppliers = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await window.api.supplier.list({ 
        page, 
        pageSize, 
        search: debouncedQuery 
      })
      setSuppliers(result.items)
      setTotal(result.total)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setDebouncedQuery(query)
    setPage(1)
  }

  const handleToggleActive = async (id: number, currentActive: number) => {
    try {
      await window.api.supplier.setActive(id, currentActive === 0)
      fetchSuppliers()
    } catch (err: any) {
      setError(err.message || 'Failed to update supplier status')
    }
  }

  return (
    <div className="font-sans max-w-7xl mx-auto">
      <PageHeader
        title="Suppliers"
        subtitle="Manage distributors and manufacturers"
        action={
          <Button 
            onClick={() => navigate('/suppliers/new')}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Supplier
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
            <div className="flex-1">
              <Input
                type="text" 
                placeholder="Search by name, contact, phone, or GSTIN..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
            <Button 
              type="button" 
              variant="ghost"
              onClick={() => { setQuery(''); fetchSuppliers(); }}
            >
              Clear
            </Button>
          </form>
        </div>

        {error && (
          <div className="bg-red-50 border-b border-red-100 p-4">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <svg className="animate-spin h-8 w-8 mx-auto text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="font-medium">Loading suppliers...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <EmptyState
              title="No suppliers found"
              description="Try adjusting your search or add a new supplier."
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map(s => (
                  <TableRow key={s.id} className={!s.is_active ? 'opacity-60 bg-slate-50' : ''}>
                    <TableCell>
                      <div className="font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.email || 'No email'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-700">{s.contact_person || '-'}</div>
                      <div className="text-xs text-slate-500">{s.phone || '-'}</div>
                    </TableCell>
                    <TableCell className="font-mono text-slate-500">
                      {s.gstin || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={s.is_active ? 'success' : 'danger'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button 
                        onClick={() => navigate(`/suppliers/edit/${s.id}`)} 
                        className="text-teal-600 hover:text-teal-900 font-medium mr-4 transition-colors"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => {
                          if (s.is_active && !window.confirm(`Are you sure you want to deactivate ${s.name}?`)) return
                          handleToggleActive(s.id, s.is_active)
                        }}
                        className={`${s.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} font-medium transition-colors`}
                      >
                        {s.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
            )}
            
            {/* Pagination Footer */}
            {total > 0 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
                <div className="text-sm text-slate-500">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} suppliers
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    disabled={page >= Math.ceil(total / pageSize)}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
    </div>
  )
}
