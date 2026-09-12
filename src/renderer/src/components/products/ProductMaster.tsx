import React, { useState, useEffect } from 'react'
import { Product } from '../../../../shared/types'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card } from '../ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { useModuleSearchState } from '../../hooks/useModuleSearchState'

export const ProductMaster: React.FC = () => {
  const {
    query,
    setQuery,
    debouncedQuery,
    setDebouncedQuery,
    filter,
    setFilter,
    page,
    setPage,
    clearSearch
  } = useModuleSearchState('products', 'ALL')

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Pagination & Sorting State
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<'name' | 'barcode' | 'selling_price'>('name')
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC')

  // Deactivate Confirmation Modal State
  const [deactivateProduct, setDeactivateProduct] = useState<Product | null>(null)
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
  }, [page, pageSize, debouncedQuery, filter, sortBy, sortDirection])

  const fetchProducts = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await window.api.product.list({ 
        page, 
        pageSize, 
        search: debouncedQuery,
        filter: filter !== 'ALL' ? filter : undefined,
        sortBy,
        sortDirection
      })
      setProducts(result.items || [])
      setTotal(result.total || 0)
    } catch (err: any) {
      setError(err.message || 'Unable to load medicines.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setDebouncedQuery(query)
    setPage(1)
  }

  const handleClearAll = () => {
    clearSearch()
    setFilter('ALL')
    setPage(1)
  }

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      await window.api.product.setActive(id, !currentActive)
      fetchProducts()
    } catch (err: any) {
      setError(err.message || 'Failed to update product status')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="font-sans max-w-7xl mx-auto space-y-4">
      <PageHeader
        title="Medicine Master"
        subtitle="Manage all products in the pharmacy catalog"
        action={
          <Button 
            onClick={() => navigate('/products/new')}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Add Medicine
          </Button>
        }
      />

      <Card className="shadow-xs border border-slate-200/80">
        {/* Toolbar & Filter Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Input
                type="text" 
                placeholder="Search by name, generic name, or barcode..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                icon={
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  title="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:inline">Status</span>
              <select
                value={filter}
                onChange={e => {
                  setFilter(e.target.value)
                  setPage(1)
                }}
                className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
              >
                <option value="ALL">Status: All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              <Button type="submit" variant="secondary">
                Search
              </Button>
              
              {(query || filter !== 'ALL') && (
                <Button 
                  type="button" 
                  variant="ghost"
                  onClick={handleClearAll}
                >
                  Clear
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Sub-header Bar: Count & Sorting */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-slate-600 font-medium">
            {total > 0 ? (
              <>Showing <span className="font-semibold text-slate-900">{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)}</span> of <span className="font-semibold text-slate-900">{total}</span> medicines</>
            ) : (
              <span>No matching records</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Sort by</span>
            <select
              value={`${sortBy}_${sortDirection}`}
              onChange={e => {
                const [sb, sd] = e.target.value.split('_') as [any, any]
                setSortBy(sb)
                setSortDirection(sd)
                setPage(1)
              }}
              className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="name_ASC">Name (A–Z)</option>
              <option value="name_DESC">Name (Z–A)</option>
              <option value="selling_price_ASC">Price (Low–High)</option>
              <option value="selling_price_DESC">Price (High–Low)</option>
              <option value="barcode_ASC">Barcode</option>
            </select>
          </div>
        </div>

        {/* Error State Banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-100 p-4 flex items-center justify-between">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchProducts}>
              Retry
            </Button>
          </div>
        )}

        {/* Table / Empty State Container */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <svg className="animate-spin h-8 w-8 mx-auto text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="font-medium text-slate-600">Loading medicines catalog...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="p-8">
              {query || filter !== 'ALL' ? (
                <EmptyState
                  title="No medicines found"
                  description="Try changing your search query or status filter."
                  action={
                    <Button variant="outline" onClick={handleClearAll}>
                      Clear Filters
                    </Button>
                  }
                  icon={
                    <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  }
                />
              ) : (
                <EmptyState
                  title="No medicines yet"
                  description="Add your first medicine to start building your pharmacy catalog."
                  action={
                    <Button onClick={() => navigate('/products/new')}>
                      + Add Medicine
                    </Button>
                  }
                  icon={
                    <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  }
                />
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead className="w-36">Barcode</TableHead>
                  <TableHead className="w-36 text-right">Selling Price (₹)</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => (
                  <TableRow 
                    key={p.id} 
                    className={`transition-colors hover:bg-slate-50/80 ${!p.is_active ? 'opacity-65 bg-slate-50/50' : ''}`}
                  >
                    <TableCell className="font-mono text-slate-500 text-xs">#{p.id}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">
                        {p.name} {p.strength ? <span className="font-normal text-slate-600">{p.strength}</span> : ''}
                      </div>
                      {p.generic_name && (
                        <div className="text-xs text-slate-500 mt-0.5">{p.generic_name}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-slate-600 text-xs">{p.barcode || '-'}</TableCell>
                    <TableCell className="text-right font-medium text-slate-900">
                      {(p.selling_price / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.is_active ? 'success' : 'danger'}>
                        {p.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={() => navigate(`/products/edit/${p.id}`)} 
                          className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-900 font-medium text-xs transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        
                        {p.is_active ? (
                          <button 
                            onClick={() => setDeactivateProduct(p)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-900 font-medium text-xs transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Deactivate
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleToggleActive(p.id, false)}
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-900 font-medium text-xs transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reactivate
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Pagination Footer */}
          {total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Rows per page</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  className="h-7 px-2 rounded border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>

                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1
                    if (totalPages > 5 && page > 3) {
                      pageNum = Math.min(totalPages - 4 + i, page - 2 + i)
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`h-7 w-7 rounded text-xs font-medium transition-colors ${
                          page === pageNum
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-600 hover:bg-slate-200/60'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>

                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Deactivate Confirmation Modal */}
      {deactivateProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-full text-red-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Deactivate Medicine?</h3>
                <p className="font-semibold text-slate-700 mt-1">
                  {deactivateProduct.name} {deactivateProduct.strength || ''}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  This will deactivate the medicine from the active catalog. Existing transaction history will not be deleted.
                </p>
              </div>
              <button 
                onClick={() => setDeactivateProduct(null)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeactivateProduct(null)}>
                Cancel
              </Button>
              <Button 
                variant="danger" 
                onClick={async () => {
                  const targetId = deactivateProduct.id
                  setDeactivateProduct(null)
                  await handleToggleActive(targetId, true)
                }}
              >
                Deactivate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

