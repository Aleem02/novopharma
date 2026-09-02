import React, { useState, useEffect } from 'react'
import { Purchase } from '../../../../shared/types'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { useModuleSearchState } from '../../hooks/useModuleSearchState'

export const PurchaseMaster: React.FC = () => {
  const {
    query,
    setQuery,
    debouncedQuery,
    setDebouncedQuery,
    page,
    setPage
  } = useModuleSearchState('purchases')

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Pagination State
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [page, pageSize, debouncedQuery])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [purchasesRes, suppliersRes] = await Promise.all([
        window.api.purchase.list({
          page,
          pageSize,
          search: debouncedQuery
        }),
        window.api.supplier.list()
      ])
      
      setPurchases(purchasesRes.items)
      setTotal(purchasesRes.total)

      const suppMap: Record<number, string> = {}
      suppliersRes.items.forEach(s => suppMap[s.id] = s.name)
      setSuppliers(suppMap)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch purchases')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="warning">Draft</Badge>
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>
      case 'CANCELLED':
        return <Badge variant="danger">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="font-sans max-w-7xl mx-auto">
      <PageHeader
        title="Purchases / Goods Receipt"
        subtitle="Manage inbound stock from suppliers"
        action={
          <Button 
            onClick={() => navigate('/purchases/new')}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            New Purchase
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <form onSubmit={(e) => { e.preventDefault(); setDebouncedQuery(query); setPage(1); }} className="flex gap-3 max-w-2xl">
            <div className="flex-1">
              <input
                type="text" 
                placeholder="Search by Invoice Number..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <Button type="submit" variant="secondary">
              Search
            </Button>
            <Button 
              type="button" 
              variant="ghost"
              onClick={() => { setQuery(''); setDebouncedQuery(''); setPage(1); }}
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
              <p className="font-medium">Loading purchases...</p>
            </div>
          ) : purchases.length === 0 ? (
            <EmptyState
              title="No purchases found"
              description="Create a new purchase to receive stock."
              icon={
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead className="text-right">Total (₹)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-slate-500">#{p.id}</TableCell>
                    <TableCell className="text-slate-700">
                      {new Date(p.purchase_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {suppliers[p.supplier_id] || `Unknown (${p.supplier_id})`}
                    </TableCell>
                    <TableCell className="font-mono text-slate-500">
                      {p.invoice_number || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-900">
                      {(p.total_amount / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(p.status)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <button 
                        onClick={() => navigate(`/purchases/edit/${p.id}`)} 
                        className="text-teal-600 hover:text-teal-900 transition-colors"
                      >
                        {p.status === 'DRAFT' ? 'Edit Draft' : 'View Details'}
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
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} purchases
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
