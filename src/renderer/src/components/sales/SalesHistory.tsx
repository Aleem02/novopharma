import React, { useState, useEffect, useRef } from 'react'
import { Sale, SalesKpis, Customer } from '../../../../shared/types'
import { PageHeader } from '../ui/PageHeader'
import { Card, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Input } from '../ui/Input'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/Table'
import { useNavigate } from 'react-router-dom'
import { useModuleSearchState } from '../../hooks/useModuleSearchState'
import { DatePicker } from '../ui/DatePicker'

type QuickDateOption = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'CUSTOM' | 'ALL'

export const SalesHistory: React.FC = () => {
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    debouncedQuery,
    page,
    setPage
  } = useModuleSearchState('sales_history')

  const navigate = useNavigate()

  // Main Data States
  const [sales, setSales] = useState<Sale[]>([])
  const [kpis, setKpis] = useState<SalesKpis | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [kpisLoading, setKpisLoading] = useState(true)
  const [error, setError] = useState('')

  // Pagination & Sorting States
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<'sale_date' | 'invoice_number' | 'total_amount' | 'customer_name'>('sale_date')
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC')

  // Filter States
  const [quickDate, setQuickDate] = useState<QuickDateOption>('TODAY')
  const [customFromDate, setCustomFromDate] = useState('')
  const [customToDate, setCustomToDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL')
  const [customerFilter, setCustomerFilter] = useState<string>('ALL')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  // UI States
  const [showFiltersPopover, setShowFiltersPopover] = useState(false)
  const [activeActionMenuId, setActiveActionMenuId] = useState<number | null>(null)
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null)
  const [saleDetail, setSaleDetail] = useState<Sale | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const filterPopoverRef = useRef<HTMLDivElement>(null)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  // Load Customers on Mount
  useEffect(() => {
    window.api.customer.list({ pageSize: 500 }).then(res => {
      setCustomers(res.items || [])
    }).catch(err => console.error('Failed to load customers', err))
  }, [])

  // Calculate Date Range Timestamps
  const getDateRange = (): { dateFrom?: number; dateTo?: number } => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const todayEnd = todayStart + 24 * 60 * 60 * 1000

    switch (quickDate) {
      case 'TODAY':
        return { dateFrom: todayStart, dateTo: todayEnd }
      case 'YESTERDAY':
        return { dateFrom: todayStart - 24 * 60 * 60 * 1000, dateTo: todayStart }
      case 'LAST_7_DAYS':
        return { dateFrom: todayStart - 6 * 24 * 60 * 60 * 1000, dateTo: todayEnd }
      case 'LAST_30_DAYS':
        return { dateFrom: todayStart - 29 * 24 * 60 * 60 * 1000, dateTo: todayEnd }
      case 'THIS_MONTH': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
        return { dateFrom: monthStart, dateTo: nextMonthStart }
      }
      case 'CUSTOM': {
        let dateFrom: number | undefined = undefined
        let dateTo: number | undefined = undefined
        if (customFromDate) {
          const d = new Date(customFromDate)
          if (!isNaN(d.getTime())) dateFrom = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
        }
        if (customToDate) {
          const d = new Date(customToDate)
          if (!isNaN(d.getTime())) dateTo = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() + 24 * 60 * 60 * 1000
        }
        return { dateFrom, dateTo }
      }
      case 'ALL':
      default:
        return {}
    }
  }

  // Build Filter Payload
  const getFilterPayload = () => {
    const { dateFrom, dateTo } = getDateRange()
    const payload: any = {}

    if (debouncedQuery.trim()) payload.search = debouncedQuery.trim()
    if (dateFrom) payload.dateFrom = dateFrom
    if (dateTo) payload.dateTo = dateTo
    if (statusFilter !== 'ALL') payload.status = statusFilter
    if (paymentMethodFilter !== 'ALL') payload.paymentMethod = paymentMethodFilter

    if (customerFilter === 'WALK_IN') {
      payload.customerId = 'WALK_IN'
    } else if (customerFilter !== 'ALL') {
      payload.customerId = Number(customerFilter)
    }

    const minPaise = parseFloat(minAmount)
    if (!isNaN(minPaise) && minPaise >= 0) payload.minAmount = Math.round(minPaise * 100)

    const maxPaise = parseFloat(maxAmount)
    if (!isNaN(maxPaise) && maxPaise >= 0) payload.maxAmount = Math.round(maxPaise * 100)

    return payload
  }

  // Fetch Paginated Sales & KPIs
  useEffect(() => {
    loadSalesData()
  }, [
    page,
    pageSize,
    debouncedQuery,
    quickDate,
    customFromDate,
    customToDate,
    statusFilter,
    paymentMethodFilter,
    customerFilter,
    minAmount,
    maxAmount,
    sortBy,
    sortDirection
  ])

  const loadSalesData = async () => {
    setLoading(true)
    setKpisLoading(true)
    setError('')
    try {
      const filters = getFilterPayload()

      // Fetch Sales Table Data and KPIs concurrently
      const [salesRes, kpisRes] = await Promise.all([
        window.api.sale.list({
          ...filters,
          page,
          pageSize,
          sortBy,
          sortDirection
        }),
        window.api.sale.kpis(filters)
      ])

      setSales(salesRes.items || [])
      setTotal(salesRes.total || 0)
      setKpis(kpisRes || null)
    } catch (err: any) {
      setError(err.message || 'Failed to load sales history')
    } finally {
      setLoading(false)
      setKpisLoading(false)
    }
  }

  // Load Sale Details for Drawer
  useEffect(() => {
    if (selectedSaleId) {
      setLoadingDetail(true)
      window.api.sale.get(selectedSaleId).then(detailed => {
        setSaleDetail(detailed)
      }).catch(err => {
        console.error('Failed to load sale detail', err)
      }).finally(() => {
        setLoadingDetail(false)
      })
    } else {
      setSaleDetail(null)
    }
  }, [selectedSaleId])

  // Click outside listener for popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setShowFiltersPopover(false)
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActiveActionMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Count active filters (excluding default quickDate if 'TODAY')
  const countActiveFilters = (): number => {
    let count = 0
    if (quickDate !== 'TODAY' && quickDate !== 'ALL') count++
    if (statusFilter !== 'ALL') count++
    if (paymentMethodFilter !== 'ALL') count++
    if (customerFilter !== 'ALL') count++
    if (minAmount.trim() !== '') count++
    if (maxAmount.trim() !== '') count++
    return count
  }

  const activeFiltersCount = countActiveFilters()

  // Reset Filters
  const handleClearAllFilters = () => {
    setQuickDate('TODAY')
    setCustomFromDate('')
    setCustomToDate('')
    setStatusFilter('ALL')
    setPaymentMethodFilter('ALL')
    setCustomerFilter('ALL')
    setMinAmount('')
    setMaxAmount('')
    setSearchQuery('')
    setPage(1)
  }

  // Handle CSV Export
  const handleExportCSV = async () => {
    try {
      const filters = getFilterPayload()
      const exportItems = await window.api.sale.export(filters)

      if (!exportItems || exportItems.length === 0) {
        alert('No transactions available to export for current filters.')
        return
      }

      const headers = ['Invoice Number', 'Date & Time', 'Customer', 'Items Count', 'Payment Method', 'Status', 'Subtotal (INR)', 'Discount (INR)', 'Tax (INR)', 'Total Amount (INR)']
      const rows = exportItems.map(s => [
        s.invoice_number,
        new Date(s.sale_date).toLocaleString(),
        s.customer?.name || 'Walk-in',
        s.items_count || 1,
        s.payment_method,
        s.status,
        (s.subtotal / 100).toFixed(2),
        (s.discount_amount / 100).toFixed(2),
        (s.tax_amount / 100).toFixed(2),
        (s.total_amount / 100).toFixed(2)
      ])

      const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Sales_History_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`Export failed: ${err.message}`)
    }
  }

  // Handle Sort Toggle
  const handleSort = (field: 'sale_date' | 'invoice_number' | 'total_amount' | 'customer_name') => {
    if (sortBy === field) {
      setSortDirection(prev => (prev === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setSortBy(field)
      setSortDirection('DESC')
    }
    setPage(1)
  }

  return (
    <div className="font-sans max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Sales History"
        subtitle="View, search and manage all sales transactions"
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
          <div className="flex-1">
            <p className="text-sm text-red-800 font-medium">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSalesData}>Retry</Button>
        </div>
      )}

      {/* KPI Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Today's / Context Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {quickDate === 'TODAY' ? "Today's Sales" : 'Sales'}
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900">
              {kpisLoading ? '...' : `₹${((kpis?.salesAmount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            </div>
            {quickDate === 'TODAY' && kpis?.salesChangePercent !== undefined ? (
              <div className={`text-xs mt-1 font-medium ${kpis.salesChangePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {kpis.salesChangePercent >= 0 ? `↑ +${kpis.salesChangePercent}%` : `↓ ${kpis.salesChangePercent}%`} vs yesterday
              </div>
            ) : (
              <div className="text-xs text-slate-400 mt-1">Current filter context</div>
            )}
          </div>
        </div>

        {/* Transactions Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transactions</span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900">
              {kpisLoading ? '...' : kpis?.totalTransactionsCount || 0}
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate">
              {kpisLoading ? '' : `${kpis?.completedTransactionsCount || 0} completed • ${kpis?.refundedTransactionsCount || 0} refunded`}
            </div>
          </div>
        </div>

        {/* Average Bill */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Bill</span>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900">
              {kpisLoading ? '...' : `₹${((kpis?.averageBillAmount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            </div>
            <div className="text-xs text-slate-400 mt-1">Per completed sale</div>
          </div>
        </div>

        {/* Refunds */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Refunds</span>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900">
              {kpisLoading ? '...' : `₹${((kpis?.totalRefundsAmount || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-medium">
              {kpisLoading ? '' : `${kpis?.totalRefundsCount || 0} transactions`}
            </div>
          </div>
        </div>

        {/* Items Sold */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Items Sold</span>
            <div className="p-2 bg-teal-50 rounded-lg text-teal-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900">
              {kpisLoading ? '...' : kpis?.totalItemsSold || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">Total quantity</div>
          </div>
        </div>
      </div>

      {/* Main Search & Filter Control Bar */}
      <Card className="mb-6 overflow-visible">
        <div className="p-4 bg-white rounded-t-xl border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Universal Search Input */}
          <div className="flex-1 max-w-xl">
            <Input
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Search invoice, customer, phone, product name or barcode..."
              className="bg-white text-sm"
              icon={
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
          </div>

          {/* Action Buttons: Filters Popover Toggle + Export */}
          <div className="flex items-center gap-3 justify-end relative" ref={filterPopoverRef}>
            <Button
              variant={activeFiltersCount > 0 ? 'secondary' : 'outline'}
              onClick={() => setShowFiltersPopover(!showFiltersPopover)}
              className="flex items-center gap-2 text-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-teal-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="flex items-center gap-2 text-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export</span>
            </Button>

            {/* Advanced Filters Popover Panel */}
            {showFiltersPopover && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 p-5 z-50 text-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-sm">Advanced Filters</h3>
                  <button
                    onClick={() => setShowFiltersPopover(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="REFUNDED">Refunded / Returned</option>
                    <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method</label>
                  <select
                    value={paymentMethodFilter}
                    onChange={e => { setPaymentMethodFilter(e.target.value); setPage(1) }}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="ALL">All Payment Methods</option>
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>

                {/* Customer Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Customer</label>
                  <select
                    value={customerFilter}
                    onChange={e => { setCustomerFilter(e.target.value); setPage(1) }}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="ALL">All Customers</option>
                    <option value="WALK_IN">Walk-in Customer</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                    ))}
                  </select>
                </div>

                {/* Amount Range Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Total Amount (₹ Range)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min ₹"
                      value={minAmount}
                      onChange={e => { setMinAmount(e.target.value); setPage(1) }}
                      className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <input
                      type="number"
                      placeholder="Max ₹"
                      value={maxAmount}
                      onChange={e => { setMaxAmount(e.target.value); setPage(1) }}
                      className="w-full text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={handleClearAllFilters}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                  >
                    Reset All
                  </button>
                  <Button
                    size="sm"
                    onClick={() => setShowFiltersPopover(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Date Filter Pills */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'CUSTOM', 'ALL'] as QuickDateOption[]).map(option => {
              const labelMap: Record<QuickDateOption, string> = {
                TODAY: 'Today',
                YESTERDAY: 'Yesterday',
                LAST_7_DAYS: 'Last 7 days',
                LAST_30_DAYS: 'Last 30 days',
                THIS_MONTH: 'This month',
                CUSTOM: 'Custom range',
                ALL: 'All Time'
              }
              const isSelected = quickDate === option
              return (
                <button
                  key={option}
                  onClick={() => {
                    setQuickDate(option)
                    setPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {labelMap[option]}
                </button>
              )
            })}
          </div>

          {/* Custom Date Pickers */}
          {quickDate === 'CUSTOM' && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-lg shadow-sm">
              <span className="text-xs font-medium text-slate-500">From:</span>
              <div className="w-36">
                <DatePicker
                  value={customFromDate}
                  onChange={val => { setCustomFromDate(val); setPage(1) }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500">To:</span>
              <div className="w-36">
                <DatePicker
                  value={customToDate}
                  onChange={val => { setCustomToDate(val); setPage(1) }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Active Filters Chips Bar */}
        {(activeFiltersCount > 0 || searchQuery.trim() !== '') && (
          <div className="px-4 py-2.5 bg-teal-50/50 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600 mr-1">Active filters:</span>

            {quickDate !== 'TODAY' && quickDate !== 'ALL' && (
              <span className="bg-white border border-teal-200 text-teal-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-sm">
                Date: {quickDate.replace(/_/g, ' ')}
                <button onClick={() => setQuickDate('TODAY')} className="text-teal-600 hover:text-teal-900 font-bold ml-1">✕</button>
              </span>
            )}

            {statusFilter !== 'ALL' && (
              <span className="bg-white border border-teal-200 text-teal-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-sm">
                Status: {statusFilter.replace(/_/g, ' ')}
                <button onClick={() => setStatusFilter('ALL')} className="text-teal-600 hover:text-teal-900 font-bold ml-1">✕</button>
              </span>
            )}

            {paymentMethodFilter !== 'ALL' && (
              <span className="bg-white border border-teal-200 text-teal-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-sm">
                Payment: {paymentMethodFilter}
                <button onClick={() => setPaymentMethodFilter('ALL')} className="text-teal-600 hover:text-teal-900 font-bold ml-1">✕</button>
              </span>
            )}

            {customerFilter !== 'ALL' && (
              <span className="bg-white border border-teal-200 text-teal-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-sm">
                Customer: {customerFilter === 'WALK_IN' ? 'Walk-in' : customers.find(c => c.id === Number(customerFilter))?.name || customerFilter}
                <button onClick={() => setCustomerFilter('ALL')} className="text-teal-600 hover:text-teal-900 font-bold ml-1">✕</button>
              </span>
            )}

            {(minAmount.trim() !== '' || maxAmount.trim() !== '') && (
              <span className="bg-white border border-teal-200 text-teal-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-sm">
                Amount: ₹{minAmount || '0'} - ₹{maxAmount || '∞'}
                <button onClick={() => { setMinAmount(''); setMaxAmount('') }} className="text-teal-600 hover:text-teal-900 font-bold ml-1">✕</button>
              </span>
            )}

            {searchQuery.trim() !== '' && (
              <span className="bg-white border border-teal-200 text-teal-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shadow-sm">
                Search: "{searchQuery.trim()}"
                <button onClick={() => setSearchQuery('')} className="text-teal-600 hover:text-teal-900 font-bold ml-1">✕</button>
              </span>
            )}

            <button
              onClick={handleClearAllFilters}
              className="text-xs text-teal-700 hover:text-teal-900 underline font-semibold ml-2"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Transactions Table */}
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50">
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('invoice_number')}>
                  <div className="flex items-center gap-1">
                    <span>Invoice</span>
                    {sortBy === 'invoice_number' && <span className="text-teal-600">{sortDirection === 'ASC' ? '↑' : '↓'}</span>}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('sale_date')}>
                  <div className="flex items-center gap-1">
                    <span>Date & Time</span>
                    {sortBy === 'sale_date' && <span className="text-teal-600">{sortDirection === 'ASC' ? '↑' : '↓'}</span>}
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('customer_name')}>
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    {sortBy === 'customer_name' && <span className="text-teal-600">{sortDirection === 'ASC' ? '↑' : '↓'}</span>}
                  </div>
                </TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('total_amount')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Total Amount</span>
                    {sortBy === 'total_amount' && <span className="text-teal-600">{sortDirection === 'ASC' ? '↑' : '↓'}</span>}
                  </div>
                </TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell><div className="h-4 bg-slate-200 rounded w-24"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 rounded w-32"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 rounded w-28"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 rounded w-8 mx-auto"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 rounded w-12"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 rounded w-20"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 rounded w-8 mx-auto"></div></TableCell>
                  </TableRow>
                ))
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-slate-500">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <svg className="h-12 w-12 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="font-semibold text-slate-700 text-base">No sales transactions found</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Try changing your search term or active filters.</p>
                      {activeFiltersCount > 0 && (
                        <Button variant="outline" size="sm" onClick={handleClearAllFilters}>
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sales.map(sale => (
                  <TableRow
                    key={sale.id}
                    className={`hover:bg-teal-50/40 cursor-pointer transition-colors ${selectedSaleId === sale.id ? 'bg-teal-50/60 font-medium' : ''}`}
                    onClick={() => setSelectedSaleId(sale.id)}
                  >
                    <TableCell className="font-bold text-teal-600 font-mono underline hover:text-teal-800">
                      {sale.invoice_number}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">
                      {new Date(sale.sale_date).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })}
                    </TableCell>
                    <TableCell className="text-slate-800">
                      {sale.customer?.name || 'Walk-in'}
                    </TableCell>
                    <TableCell className="text-center font-medium text-slate-700">
                      {sale.items_count || 1}
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-bold tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {sale.payment_method}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        sale.status === 'COMPLETED' ? 'success' :
                        sale.status === 'PARTIALLY_REFUNDED' ? 'warning' :
                        sale.status === 'REFUNDED' ? 'danger' : 'default'
                      }>
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-current"></span>
                        {sale.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-900">
                      ₹{(sale.total_amount / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center relative" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveActionMenuId(activeActionMenuId === sale.id ? null : sale.id)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 font-bold focus:outline-none"
                      >
                        ⋮
                      </button>

                      {/* Action Menu Dropdown */}
                      {activeActionMenuId === sale.id && (
                        <div ref={actionMenuRef} className="absolute right-2 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-40 text-left text-xs">
                          <button
                            onClick={() => {
                              setSelectedSaleId(sale.id)
                              setActiveActionMenuId(null)
                            }}
                            className="w-full px-3 py-2 text-slate-700 hover:bg-teal-50 hover:text-teal-800 flex items-center gap-2 font-medium"
                          >
                            View Sale Details
                          </button>
                          <button
                            onClick={() => {
                              navigate(`/sales/invoice/${sale.invoice_number}`)
                              setActiveActionMenuId(null)
                            }}
                            className="w-full px-3 py-2 text-slate-700 hover:bg-teal-50 hover:text-teal-800 flex items-center gap-2 font-medium"
                          >
                            Open Full Invoice
                          </button>
                          <button
                            onClick={() => {
                              navigate('/sales/returns', { state: { invoiceNumber: sale.invoice_number } })
                              setActiveActionMenuId(null)
                            }}
                            className="w-full px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium border-t border-slate-100"
                          >
                            Refund / Return
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Database Pagination Footer */}
          {total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/60 gap-4">
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    className="bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs font-semibold"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <span>
                  Showing <strong>{((page - 1) * pageSize) + 1}</strong>–<strong>{Math.min(page * pageSize, total)}</strong> of <strong>{total}</strong> sales
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  ‹ Previous
                </Button>
                {Array.from({ length: Math.min(5, Math.ceil(total / pageSize)) }).map((_, i) => {
                  const pNum = i + 1
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                        page === pNum
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pNum}
                    </button>
                  )
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next ›
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right-Side Sale Details Drawer */}
      {selectedSaleId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSelectedSaleId(null)}
          ></div>

          {/* Drawer Container */}
          <div className="relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col z-10 border-l border-slate-200 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-slate-900 font-mono">{saleDetail?.invoice_number || 'Loading...'}</span>
                  {saleDetail && (
                    <Badge variant={
                      saleDetail.status === 'COMPLETED' ? 'success' :
                      saleDetail.status === 'PARTIALLY_REFUNDED' ? 'warning' :
                      saleDetail.status === 'REFUNDED' ? 'danger' : 'default'
                    }>
                      {saleDetail.status}
                    </Badge>
                  )}
                </div>
                {saleDetail && (
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(saleDetail.sale_date).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedSaleId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {loadingDetail ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center">
                  <svg className="animate-spin h-8 w-8 text-teal-600 mb-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-xs font-medium">Loading transaction details...</p>
                </div>
              ) : saleDetail ? (
                <>
                  {/* Customer Information */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Customer</span>
                    <div className="font-semibold text-slate-900 text-sm">
                      {saleDetail.customer?.name || 'Walk-in Customer'}
                    </div>
                    {saleDetail.customer?.phone && (
                      <div className="text-xs text-slate-500 mt-0.5">Phone: {saleDetail.customer.phone}</div>
                    )}
                  </div>

                  {/* Summary Breakdown */}
                  <div className="space-y-2 text-sm border-b border-slate-100 pb-4">
                    <div className="flex justify-between text-slate-600">
                      <span>Items Count</span>
                      <span className="font-semibold text-slate-800">{saleDetail.items?.length || 0}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>₹{(saleDetail.subtotal / 100).toFixed(2)}</span>
                    </div>
                    {saleDetail.discount_amount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Discount</span>
                        <span>-₹{(saleDetail.discount_amount / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Tax</span>
                      <span>₹{(saleDetail.tax_amount / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold text-base pt-2 border-t border-slate-200">
                      <span>Total Amount</span>
                      <span className="text-teal-700">₹{(saleDetail.total_amount / 100).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Payment</span>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded text-xs">
                        {saleDetail.payment_method}
                      </span>
                      <span className="font-bold text-slate-900">₹{(saleDetail.total_amount / 100).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">
                      Items ({saleDetail.items?.length || 0})
                    </span>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {saleDetail.items?.map((item, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900">{item.product?.name || `Product #${item.product_id}`}</div>
                            {item.product?.strength && <div className="text-slate-500 text-[11px]">{item.product.strength}</div>}
                            <div className="text-slate-400 text-[10px] mt-0.5">
                              {item.entered_quantity} {item.sale_unit || 'Unit'} × ₹{(item.selling_price / 100).toFixed(2)}
                              {item.batch_number && <span className="ml-2 font-mono uppercase bg-white px-1 border border-slate-200 rounded">BAT: {item.batch_number}</span>}
                            </div>
                          </div>
                          <div className="font-bold text-slate-900 text-right">
                            ₹{(item.line_total / 100).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Action Buttons */}
            {saleDetail && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
                <Button
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => navigate(`/sales/invoice/${saleDetail.invoice_number}`)}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Open & Print Invoice</span>
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/sales/returns', { state: { invoiceNumber: saleDetail.invoice_number } })}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    Refund / Return
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSaleId(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
