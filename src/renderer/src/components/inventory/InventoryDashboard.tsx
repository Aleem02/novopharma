import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { InventoryBatch, Product } from '../../../../shared/types'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card, CardHeader, CardContent } from '../ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { Search, Plus, Eye, Edit2, ArrowRightLeft } from 'lucide-react'

export const InventoryDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [inventory, setInventory] = useState<InventoryBatch[]>([])
  const [summary, setSummary] = useState<any>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Pagination & Filter State
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState('ALL') // ALL, LOW_STOCK, EXPIRED, EXPIRING_SOON
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1) // Reset to page 1 on new search
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [filter])

  useEffect(() => {
    fetchData()
  }, [page, pageSize, debouncedSearch, filter])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [invRes, summaryRes] = await Promise.all([
        window.api.inventory.list({ 
          page, 
          pageSize, 
          search: debouncedSearch, 
          filter 
        }),
        window.api.inventory.getSummary()
      ])
      
      setInventory(invRes.items)
      setTotal(invRes.total)
      setSummary(summaryRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (batch: InventoryBatch) => {
    if (batch.quantity <= 0) {
      return <Badge variant="secondary">Empty / Inactive</Badge>
    }

    const expiryTime = new Date(batch.expiry_date).getTime()
    const now = Date.now()
    const ninetyDays = 90 * 24 * 60 * 60 * 1000

    if (expiryTime < now) {
      return <Badge variant="danger">Expired</Badge>
    } else if (expiryTime < now + ninetyDays) {
      return <Badge variant="warning" className="bg-orange-100 text-orange-800">Expiring Soon</Badge>
    }

    if (batch.quantity < 10) {
      return <Badge variant="warning">Low Stock</Badge>
    }

    return <Badge variant="success">Good</Badge>
  }

  return (
    <div className="font-sans max-w-7xl mx-auto">
      <PageHeader
        title="Inventory Dashboard"
        subtitle="Real-time stock and batch management"
        action={
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
              onClick={() => setFilter('ALL')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Stock
            </button>
            <button 
              onClick={() => setFilter('LOW_STOCK')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'LOW_STOCK' ? 'bg-yellow-100 text-yellow-800 shadow-sm' : 'text-slate-600 hover:text-yellow-600'}`}
            >
              Low Stock
            </button>
            <button 
              onClick={() => setFilter('EXPIRING_SOON')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'EXPIRING_SOON' ? 'bg-orange-100 text-orange-800 shadow-sm' : 'text-slate-600 hover:text-orange-600'}`}
            >
              Expiring Soon
            </button>
            <button 
              onClick={() => setFilter('EXPIRED')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === 'EXPIRED' ? 'bg-red-100 text-red-800 shadow-sm' : 'text-slate-600 hover:text-red-600'}`}
            >
              Expired
            </button>
          </div>
        }
      />

      <div className="flex justify-between items-center mb-6">
        <div className="relative w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <Input
            className="pl-10"
            placeholder="Search by medicine name or batch number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button onClick={() => navigate('/purchases/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Add Stock / New Batch
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-800 font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
          <svg className="animate-spin h-8 w-8 mx-auto text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="font-medium">Loading inventory data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Products</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{summary?.totalProducts || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active Batches</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{summary?.activeBatches || 0}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-400">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-orange-600 uppercase tracking-wider">Expiring (90 Days)</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {summary?.expiringSoon || 0}
                </p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-red-600 uppercase tracking-wider">Expired Batches</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {summary?.expired || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Batch View */}
          <Card>
            <CardHeader 
              title={
                filter === 'ALL' ? 'All Batches' : 
                filter === 'LOW_STOCK' ? 'Low Stock Batches' : 
                filter === 'EXPIRING_SOON' ? 'Expiring Soon' : 'Expired Batches'
              } 
              className="bg-slate-50/50" 
            />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch No.</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Available Qty</TableHead>
                    <TableHead className="text-right">MRP (₹)</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                        No inventory matches the current filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    inventory.map(batch => {
                      const product = batch.product
                      return (
                        <TableRow key={batch.id}>
                          <TableCell>
                            <div className="font-medium text-slate-900">
                              {product ? `${product.name} ${product.strength || ''}` : `Product #${batch.product_id}`}
                            </div>
                            <div className="text-xs text-slate-500">
                              {product ? product.manufacturer : ''}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-slate-500 uppercase">
                            {batch.batch_number}
                          </TableCell>
                          <TableCell>
                            {new Date(batch.expiry_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-bold ${batch.quantity < 10 ? 'text-yellow-600' : 'text-slate-900'}`}>
                              {batch.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-700">
                            {(batch.mrp / 100).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(batch)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => navigate(`/inventory/batch/${batch.id}`)} title="View Batch">
                                <Eye className="h-4 w-4 text-slate-600" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => navigate(`/inventory/batch/${batch.id}/edit`)} title="Edit Metadata">
                                <Edit2 className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => navigate(`/inventory/adjustments/new?batchId=${batch.id}`)} title="Adjust Stock">
                                <ArrowRightLeft className="h-4 w-4 text-orange-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
              
              {/* Pagination Footer */}
              {total > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
                  <div className="text-sm text-slate-500">
                    Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} batches
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
      )}
    </div>
  )
}
