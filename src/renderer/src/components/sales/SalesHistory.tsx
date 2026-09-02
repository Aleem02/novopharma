import React, { useState, useEffect } from 'react'
import { Sale } from '../../../../shared/types'
import { PageHeader } from '../ui/PageHeader'
import { Card, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Input } from '../ui/Input'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table'
import { useNavigate } from 'react-router-dom'
import { useModuleSearchState } from '../../hooks/useModuleSearchState'

export const SalesHistory: React.FC = () => {
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    debouncedQuery,
    page,
    setPage
  } = useModuleSearchState('sales_history')

  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Pagination State
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  
  const navigate = useNavigate()

  useEffect(() => {
    loadSales()
  }, [page, pageSize, debouncedQuery])

  const loadSales = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await window.api.sale.list({
        page,
        pageSize,
        search: debouncedQuery
      })
      setSales(data.items)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales history')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="font-sans max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Sales History"
        subtitle="View previous POS transactions and invoices"
        action={
          <Button onClick={() => navigate('/sales/pos')}>
            + New Sale
          </Button>
        }
      />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-lg flex items-start">
          <svg className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-800 font-medium">{error}</p>
        </div>
      )}

      <Card>
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <Input 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Invoice Number..."
            className="max-w-md bg-white"
            icon={
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <svg className="animate-spin h-8 w-8 text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="font-medium">Loading sales history...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <p className="font-medium">No sales transactions found.</p>
                  </TableCell>
                </TableRow>
              ) : (
                sales.map(sale => (
                  <TableRow key={sale.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/sales/invoice/${sale.invoice_number}`)}>
                    <TableCell className="font-bold text-teal-600 font-mono">
                      {sale.invoice_number}
                    </TableCell>
                    <TableCell>
                      {new Date(sale.sale_date).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {sale.customer?.name || 'Walk-in'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {sale.payment_method}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        sale.status === 'COMPLETED' ? 'success' : 
                        sale.status === 'PARTIALLY_REFUNDED' ? 'warning' : 
                        sale.status === 'REFUNDED' ? 'danger' : 'default'
                      }>
                        {sale.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-900">
                      ₹{(sale.total_amount / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/sales/invoice/${sale.invoice_number}`) }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination Footer */}
          {total > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
              <div className="text-sm text-slate-500">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} transactions
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
        </CardContent>
      </Card>
    </div>
  )
}
