import React, { useState, useEffect, useMemo } from 'react'
import { Purchase } from '../../../../shared/types'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../ui/PageHeader'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { useModuleSearchState } from '../../hooks/useModuleSearchState'

type DateRangeOption = 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'all'

export const PurchaseMaster: React.FC = () => {
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
  } = useModuleSearchState('purchases', 'ALL')

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Pagination & Sorting State
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<'purchase_date' | 'total_amount' | 'invoice_number'>('purchase_date')
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC')

  // Date Range State
  const [dateRange, setDateRange] = useState<DateRangeOption>('all')
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [page, pageSize, debouncedQuery, filter, sortBy, sortDirection])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [purchasesRes, suppliersRes] = await Promise.all([
        window.api.purchase.list({
          page,
          pageSize,
          search: debouncedQuery,
          filter: filter !== 'ALL' ? filter : undefined,
          sortBy,
          sortDirection
        }),
        window.api.supplier.list()
      ])
      
      setPurchases(purchasesRes.items || [])
      setTotal(purchasesRes.total || 0)

      const suppMap: Record<number, string> = {}
      if (suppliersRes?.items) {
        suppliersRes.items.forEach(s => suppMap[s.id] = s.name)
      }
      setSuppliers(suppMap)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch purchases')
    } finally {
      setLoading(false)
    }
  }

  // Date Range Boundaries calculation
  const getTimeBoundaries = (range: DateRangeOption) => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const dayMs = 24 * 60 * 60 * 1000

    switch (range) {
      case 'today':
        return { start: todayStart, end: todayStart + dayMs }
      case 'yesterday':
        return { start: todayStart - dayMs, end: todayStart }
      case '7days':
        return { start: todayStart - 7 * dayMs, end: now.getTime() + dayMs }
      case '30days':
        return { start: todayStart - 30 * dayMs, end: now.getTime() + dayMs }
      case 'thisMonth': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
        return { start: monthStart, end: now.getTime() + dayMs }
      }
      case 'all':
      default:
        return { start: 0, end: Infinity }
    }
  }

  // Filtered purchases in current view date context
  const filteredPurchases = useMemo(() => {
    const { start, end } = getTimeBoundaries(dateRange)
    if (start === 0 && end === Infinity) return purchases

    return purchases.filter(p => {
      const pDate = new Date(p.purchase_date).getTime()
      return pDate >= start && pDate < end
    })
  }, [purchases, dateRange])

  // Aggregate KPI Calculations
  const kpis = useMemo(() => {
    const targetSet = filteredPurchases
    const totalVal = targetSet.reduce((sum, p) => sum + (p.total_amount || 0), 0)
    const count = targetSet.length
    const avg = count > 0 ? totalVal / count : 0

    const uniqueSuppliers = new Set(targetSet.map(p => p.supplier_id)).size

    return {
      totalValue: (totalVal / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      count,
      avg: (avg / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      uniqueSuppliers
    }
  }, [filteredPurchases])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setDebouncedQuery(query)
    setPage(1)
  }

  const handleClearAll = () => {
    clearSearch()
    setFilter('ALL')
    setDateRange('all')
    setPage(1)
  }

  const handleExportCsv = async () => {
    try {
      const { start, end } = getTimeBoundaries(dateRange)
      const startDate = start === 0 ? 0 : start
      const endDate = end === Infinity ? Date.now() : end
      await window.api.document.exportReportCsv('PURCHASES', startDate, endDate)
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV report')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="warning">DRAFT</Badge>
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED</Badge>
      case 'CANCELLED':
        return <Badge variant="danger">CANCELLED</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="font-sans max-w-7xl mx-auto space-y-4">
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

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 shadow-2xs border border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100/80 rounded-xl text-emerald-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Purchase Value</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">₹{kpis.totalValue}</div>
              <div className="text-xs text-slate-500 mt-0.5">Filtered dataset</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-2xs border border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100/80 rounded-xl text-blue-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Purchase Transactions</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{kpis.count}</div>
              <div className="text-xs text-slate-500 mt-0.5">Inbound records</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-2xs border border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100/80 rounded-xl text-purple-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Purchase</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">₹{kpis.avg}</div>
              <div className="text-xs text-slate-500 mt-0.5">Per purchase transaction</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-2xs border border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100/80 rounded-xl text-indigo-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Suppliers</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{kpis.uniqueSuppliers}</div>
              <div className="text-xs text-slate-500 mt-0.5">Represented in context</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="shadow-xs border border-slate-200/80">
        {/* Toolbar: Search, Status Filter & Export */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-3 items-center">
              <div className="relative flex-1 max-w-xl">
                <input
                  type="text" 
                  placeholder="Search by invoice number..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-8 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                />
                <svg className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
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

              <select
                value={filter}
                onChange={e => {
                  setFilter(e.target.value)
                  setPage(1)
                }}
                className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
              >
                <option value="ALL">Status: All</option>
                <option value="COMPLETED">Completed</option>
                <option value="DRAFT">Draft</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <Button type="submit" variant="secondary">
                Search
              </Button>
              
              {(query || filter !== 'ALL' || dateRange !== 'all') && (
                <Button 
                  type="button" 
                  variant="ghost"
                  onClick={handleClearAll}
                >
                  Clear
                </Button>
              )}
            </form>

            <Button
              variant="outline"
              onClick={handleExportCsv}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Export CSV
            </Button>
          </div>

          {/* Quick Date Range Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
            {[
              { id: 'all', label: 'All time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7days', label: 'Last 7 days' },
              { id: '30days', label: 'Last 30 days' },
              { id: 'thisMonth', label: 'This month' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setDateRange(tab.id as DateRangeOption)
                  setPage(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  dateRange === tab.id
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-header Bar: Count & Sorting */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="text-slate-600 font-medium">
            {total > 0 ? (
              <>Showing <span className="font-semibold text-slate-900">{((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)}</span> of <span className="font-semibold text-slate-900">{total}</span> purchases</>
            ) : (
              <span>No matching purchases</span>
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
              <option value="purchase_date_DESC">Date (Newest first)</option>
              <option value="purchase_date_ASC">Date (Oldest first)</option>
              <option value="total_amount_DESC">Total (High–Low)</option>
              <option value="total_amount_ASC">Total (Low–High)</option>
              <option value="invoice_number_ASC">Invoice No.</option>
            </select>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-100 p-4 flex items-center justify-between">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchData}>
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
              <p className="font-medium text-slate-600">Loading purchases...</p>
            </div>
          ) : filteredPurchases.length === 0 ? (
            <div className="p-8">
              {query || filter !== 'ALL' || dateRange !== 'all' ? (
                <EmptyState
                  title="No purchases found"
                  description="Try changing your search query, status filter, or date range."
                  action={
                    <Button variant="outline" onClick={handleClearAll}>
                      Clear Filters
                    </Button>
                  }
                  icon={
                    <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                />
              ) : (
                <EmptyState
                  title="No purchases yet"
                  description="Record your first goods receipt to start tracking inventory purchases."
                  action={
                    <Button onClick={() => navigate('/purchases/new')}>
                      + New Purchase
                    </Button>
                  }
                  icon={
                    <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                />
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Purchase ID</TableHead>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="w-36">Invoice No.</TableHead>
                  <TableHead className="w-36 text-right">Total (₹)</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map(p => (
                  <TableRow key={p.id} className="transition-colors hover:bg-slate-50/80">
                    <TableCell className="font-mono text-slate-500 text-xs">#{p.id}</TableCell>
                    <TableCell className="text-slate-700 text-xs">
                      {new Date(p.purchase_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      {suppliers[p.supplier_id] || `Unknown (${p.supplier_id})`}
                    </TableCell>
                    <TableCell className="font-mono text-slate-500 text-xs">
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
                        className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-900 text-xs font-medium transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
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
    </div>
  )
}

