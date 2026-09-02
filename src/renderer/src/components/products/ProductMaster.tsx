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
    page,
    setPage
  } = useModuleSearchState('products')

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Pagination State
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchProducts()
  }, [page, pageSize, debouncedQuery])

  const fetchProducts = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await window.api.product.list({ 
        page, 
        pageSize, 
        search: debouncedQuery 
      })
      setProducts(result.items)
      setTotal(result.total)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products')
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
      await window.api.product.setActive(id, currentActive === 0)
      fetchProducts()
    } catch (err: any) {
      setError(err.message || 'Failed to update product status')
    }
  }

  return (
    <div className="font-sans max-w-7xl mx-auto">
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

      <Card className="mb-6">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl">
            <div className="flex-1">
              <Input
                type="text" 
                placeholder="Search by name, generic name, or barcode..."
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
              onClick={() => { setQuery(''); fetchProducts(); }}
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
              <p className="font-medium">Loading products...</p>
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              title="No products found"
              description="Try adjusting your search or add a new medicine to the catalog."
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead className="text-right">Price (₹)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => (
                  <TableRow key={p.id} className={!p.is_active ? 'opacity-60 bg-slate-50' : ''}>
                    <TableCell className="font-mono text-slate-500">#{p.id}</TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{p.name} {p.strength}</div>
                      <div className="text-xs text-slate-500">{p.generic_name}</div>
                    </TableCell>
                    <TableCell>{p.barcode || '-'}</TableCell>
                    <TableCell className="text-right font-medium text-slate-900">
                      {(p.selling_price / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.is_active ? 'success' : 'danger'}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button 
                        onClick={() => navigate(`/products/edit/${p.id}`)} 
                        className="text-teal-600 hover:text-teal-900 font-medium mr-4 transition-colors"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleToggleActive(p.id, p.is_active)}
                        className={`${p.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} font-medium transition-colors`}
                      >
                        {p.is_active ? 'Deactivate' : 'Reactivate'}
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
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} products
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
