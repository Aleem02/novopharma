import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { DashboardSummary, FinancialSummary, SalesTrendItem, TopSellingProduct } from '../../../../shared/types'

type PeriodType = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'MONTH'

export const Dashboard: React.FC = () => {
  const [period, setPeriod] = useState<PeriodType>('TODAY')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [financial, setFinancial] = useState<FinancialSummary | null>(null)
  const [salesTrend, setSalesTrend] = useState<SalesTrendItem[]>([])
  const [topSelling, setTopSelling] = useState<TopSellingProduct[]>([])
  
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<Date>(new Date())

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Calculate start/end timestamps based on selected period
  const dateRange = useMemo(() => {
    const currentDate = new Date()
    const end = currentDate.getTime()
    const startOfToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime()

    switch (period) {
      case 'TODAY':
        return { start: startOfToday, end }
      case 'YESTERDAY': {
        const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
        return { start: startOfYesterday, end: startOfToday - 1 }
      }
      case 'LAST_7_DAYS': {
        const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000
        return { start: sevenDaysAgo, end }
      }
      case 'LAST_30_DAYS': {
        const thirtyDaysAgo = startOfToday - 30 * 24 * 60 * 60 * 1000
        return { start: thirtyDaysAgo, end }
      }
      case 'MONTH': {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime()
        return { start: startOfMonth, end }
      }
      default:
        return { start: startOfToday, end }
    }
  }, [period])

  // Period label string
  const periodLabel = useMemo(() => {
    switch (period) {
      case 'TODAY': return 'Today'
      case 'YESTERDAY': return 'Yesterday'
      case 'LAST_7_DAYS': return 'Last 7 days'
      case 'LAST_30_DAYS': return 'Last 30 days'
      case 'MONTH': return 'This month'
      default: return 'Today'
    }
  }, [period])

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = now.getHours()
    if (hour < 12) return 'Good Morning!'
    if (hour < 17) return 'Good Afternoon!'
    return 'Good Evening!'
  }, [now])

  const formatPaise = useCallback((paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }, [])

  // Fetch all dashboard data concurrently
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Map period for financial API (uses string period)
      const finPeriodParam = (period === 'LAST_30_DAYS' ? 'MONTH' : period) as 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'MONTH'

      const [summaryRes, financialRes, trendRes, topSellingRes] = await Promise.all([
        window.api.dashboard.getSummary(),
        window.api.financial.getSummary(finPeriodParam),
        window.api.dashboard.getSalesTrend(dateRange.start, dateRange.end),
        window.api.dashboard.getTopSellingProducts(dateRange.start, dateRange.end, 5)
      ])

      setSummary(summaryRes)
      setFinancial(financialRes)
      setSalesTrend(trendRes)
      setTopSelling(topSellingRes)
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [period, dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Payment Breakdown Calculations
  const paymentBreakdown = useMemo(() => {
    if (!financial) return { cash: 0, upi: 0, card: 0, total: 0, cashPct: 0, upiPct: 0, cardPct: 0 }
    
    const cash = Math.max(0, financial.cashSales)
    const card = Math.max(0, financial.cardSales)
    const upi = Math.max(0, financial.upiSales)
    const total = cash + card + upi

    if (total === 0) {
      return { cash: 0, upi: 0, card: 0, total: 0, cashPct: 0, upiPct: 0, cardPct: 0 }
    }

    const cashPct = Math.round((cash / total) * 100)
    const upiPct = Math.round((upi / total) * 100)
    const cardPct = Math.max(0, 100 - (cashPct + upiPct)) // Ensure sum is 100%

    return { cash, upi, card, total, cashPct, upiPct, cardPct }
  }, [financial])

  // Average bill amount calculation
  const averageBillPaise = useMemo(() => {
    if (!financial || financial.todayInvoicesCount === 0) return 0
    return Math.round(financial.netSales / financial.todayInvoicesCount)
  }, [financial])

  // Max value for trend chart scaling
  const maxTrendAmount = useMemo(() => {
    if (salesTrend.length === 0) return 1
    const max = Math.max(...salesTrend.map(t => t.amount))
    return max > 0 ? max : 1
  }, [salesTrend])

  if (loading && !summary) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="h-10 w-48 bg-slate-100 animate-pulse rounded-lg"></div>
          <div className="h-9 w-64 bg-slate-100 animate-pulse rounded-lg"></div>
        </div>

        {/* KPI Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="h-4 w-24 bg-slate-100 animate-pulse rounded"></div>
              <div className="h-8 w-36 bg-slate-100 animate-pulse rounded"></div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-72 animate-pulse"></div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-72 animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center space-x-3">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="font-bold text-lg">Unable to Load Dashboard Data</h3>
          </div>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button 
            onClick={fetchData} 
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm"
          >
            Retry Loading
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans text-slate-800">
      
      {/* 1. HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">Dashboard</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Real-time pharmacy performance and operational overview.</p>
          </div>
        </div>

        {/* Date Range Selector Pills & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'MONTH'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                period === p
                  ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {p === 'TODAY' ? 'Today' : p === 'YESTERDAY' ? 'Yesterday' : p === 'LAST_7_DAYS' ? 'Last 7 days' : p === 'LAST_30_DAYS' ? 'Last 30 days' : 'This month'}
            </button>
          ))}

          <button
            onClick={fetchData}
            title="Refresh Dashboard Data"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-teal-600 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. QUICK ACTIONS & CONTEXT PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Card */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Quick Actions</h2>
            <p className="text-xs text-slate-500">Fast access to core pharmacy workflows.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link
              to="/sales/pos"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm text-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>New Sale</span>
            </Link>

            <Link
              to="/purchases/new"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm text-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>New Purchase</span>
            </Link>

            <Link
              to="/products/new"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm text-center"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Medicine</span>
            </Link>

            <Link
              to="/inventory"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors text-center border border-slate-200"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Stock Adjustment</span>
            </Link>
          </div>
        </div>

        {/* Dynamic Context Panel */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-xl text-white shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">{greeting}</span>
              <h3 className="text-base font-bold mt-0.5">Pharmacy Status Summary</h3>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium">{now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</p>
              <p className="text-xs font-mono text-slate-300">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-slate-300">Active Period Context:</span>
            <span className="font-semibold text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/50">{periodLabel}</span>
          </div>
        </div>
      </div>

      {/* 3. LEVEL 1: OPERATIONAL ALERTS & FINANCIAL KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Attention Required & Operational Alerts (Column 1 - Always Visible at Top) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-sm text-slate-800">Attention Required</h3>
            <p className="text-xs text-slate-500">Live operational alerts & stock health</p>
          </div>

          <div className="space-y-3">
            {/* Expired Batches Alert (High Risk) */}
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-rose-600 font-bold">🔴</span>
                <div>
                  <p className="text-xs font-bold text-rose-900">{summary?.expiredCount || 0} Expired Batches</p>
                  <p className="text-[11px] text-rose-700">Batches past expiry date (High Risk)</p>
                </div>
              </div>
              <Link to="/inventory?filter=EXPIRED" className="text-xs font-bold text-rose-700 hover:text-rose-900 underline shrink-0">
                Review Expired →
              </Link>
            </div>

            {/* Low Stock Alert */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-amber-600 font-bold">🟠</span>
                <div>
                  <p className="text-xs font-bold text-amber-900">{summary?.lowStockCount || 0} Low Stock Medicines</p>
                  <p className="text-[11px] text-amber-700">Products with usable quantity ≤ 10</p>
                </div>
              </div>
              <Link to="/inventory?filter=LOW_STOCK" className="text-xs font-bold text-amber-700 hover:text-amber-900 underline shrink-0">
                Review Stock →
              </Link>
            </div>

            {/* Expiring Soon Alert */}
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-orange-600 font-bold">🟠</span>
                <div>
                  <p className="text-xs font-bold text-orange-900">{summary?.expiringSoonCount || 0} Batches Expiring Soon</p>
                  <p className="text-[11px] text-orange-700">Expiring within 90 days</p>
                </div>
              </div>
              <Link to="/inventory?filter=EXPIRING_SOON" className="text-xs font-bold text-orange-700 hover:text-orange-900 underline shrink-0">
                Review Expiry →
              </Link>
            </div>

            {/* Inventory Health Summary */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-800">{summary?.totalProducts || 0} Active Medicines</p>
                <p className="text-[11px] text-slate-500">Currently active in catalog</p>
              </div>
              <Link to="/products" className="text-xs font-bold text-teal-600 hover:text-teal-700 shrink-0">
                Catalog →
              </Link>
            </div>
          </div>
        </div>

        {/* Financial Performance KPI Cards (Columns 2-3 Grid) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Net Sales */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">Net Sales ({periodLabel})</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{financial ? formatPaise(financial.netSales) : '₹0.00'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Gross minus refunds</p>
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">Transactions</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{financial?.todayInvoicesCount || 0}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Completed sale invoices</p>
            </div>
          </div>

          {/* Average Bill */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">Average Bill</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{formatPaise(averageBillPaise)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Net sales per invoice</p>
            </div>
          </div>

          {/* Refunds / Returns */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-6a4 4 0 00-4-4H4m0 0l4-4m-4 4l4 4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 tracking-wide uppercase">Refunds / Returns</p>
              <p className="text-2xl font-bold text-rose-600 mt-0.5">{financial ? formatPaise(financial.returnsRefunds) : '₹0.00'}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{summary?.todayReturnsCount || 0} return transactions</p>
            </div>
          </div>
        </div>

      </div>

      {/* 4. LEVEL 2: BUSINESS ACTIVITY (Sales Trend & Payment Methods) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Sales Trend</h3>
              <p className="text-xs text-slate-500">Daily net sales overview for {periodLabel}</p>
            </div>
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              Daily Aggregated
            </span>
          </div>

          {/* SVG Trend Line / Bar Visualization */}
          {salesTrend.length > 0 && salesTrend.some(t => t.amount > 0) ? (
            <div className="space-y-4">
              <div className="h-48 w-full flex items-end justify-between gap-2 pt-6 pb-2 px-2 bg-slate-50/50 rounded-lg border border-slate-100 relative">
                {salesTrend.map((item, idx) => {
                  const heightPct = Math.max(8, Math.round((item.amount / maxTrendAmount) * 100))
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-8 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                        {item.date}: {formatPaise(item.amount)}
                      </div>
                      {/* Bar */}
                      <div 
                        style={{ height: `${heightPct}%` }} 
                        className="w-full max-w-[36px] bg-teal-500 group-hover:bg-teal-600 rounded-t transition-all shadow-sm"
                      ></div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-[11px] font-medium text-slate-400 px-1">
                <span>{salesTrend[0]?.date}</span>
                <span>{salesTrend[salesTrend.length - 1]?.date}</span>
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
              <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <p className="text-xs font-semibold text-slate-500">No sales data for this period.</p>
            </div>
          )}
        </div>

        {/* Payment Methods Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-sm text-slate-800">Payment Methods</h3>
            <p className="text-xs text-slate-500">Collection breakdown ({periodLabel})</p>
          </div>

          <div className="space-y-4 my-auto">
            {/* Cash */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span>
                  Cash
                </span>
                <span className="font-bold text-slate-900">{formatPaise(paymentBreakdown.cash)} ({paymentBreakdown.cashPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div style={{ width: `${paymentBreakdown.cashPct}%` }} className="bg-teal-500 h-full rounded-full transition-all"></div>
              </div>
            </div>

            {/* UPI */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                  UPI / QR
                </span>
                <span className="font-bold text-slate-900">{formatPaise(paymentBreakdown.upi)} ({paymentBreakdown.upiPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div style={{ width: `${paymentBreakdown.upiPct}%` }} className="bg-blue-500 h-full rounded-full transition-all"></div>
              </div>
            </div>

            {/* Card */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                  Card
                </span>
                <span className="font-bold text-slate-900">{formatPaise(paymentBreakdown.card)} ({paymentBreakdown.cardPct}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div style={{ width: `${paymentBreakdown.cardPct}%` }} className="bg-purple-500 h-full rounded-full transition-all"></div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
            <span>Total Collections:</span>
            <span className="font-bold text-slate-900">{formatPaise(paymentBreakdown.total)}</span>
          </div>
        </div>
      </div>

      {/* 5. LEVEL 3: TOP SELLING MEDICINES */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
          <div>
            <h3 className="font-bold text-sm text-slate-800">Top Selling Medicines</h3>
            <p className="text-xs text-slate-500">Most sold items for {periodLabel}</p>
          </div>
          <Link to="/reports" className="text-xs font-bold text-teal-600 hover:text-teal-700">View Reports →</Link>
        </div>

        <div className="flex-1 overflow-x-auto">
          {topSelling.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase text-slate-400 font-bold">
                  <th className="py-2 px-2">Medicine Name</th>
                  <th className="py-2 px-2 text-right">Qty Sold</th>
                  <th className="py-2 px-2 text-right">Net Sales (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {topSelling.map((prod) => (
                  <tr key={prod.productId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-2 font-semibold text-slate-900">{prod.productName}</td>
                    <td className="py-2.5 px-2 text-right font-medium text-slate-600">{prod.quantitySold}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-teal-700">{formatPaise(prod.salesAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No products sold during this period.
            </div>
          )}
        </div>
      </div>

      {/* 6. LEVEL 4: RECENT ACTIVITY (Recent Sales & Recent Purchases) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Sales Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Recent Sales</h3>
              <p className="text-[11px] text-slate-500">Latest 5 sales transactions</p>
            </div>
            <Link to="/sales/history" className="text-xs font-bold text-teal-600 hover:text-teal-700">View All →</Link>
          </div>
          <div className="overflow-x-auto">
            {summary?.recentSales && summary.recentSales.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 text-[10px] uppercase text-slate-400 font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5">Invoice No.</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {summary.recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-teal-700">{sale.invoice_number}</td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(sale.sale_date).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatPaise(sale.total_amount)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-bold rounded ${
                          sale.status === 'REFUNDED' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-teal-50 text-teal-600 border border-teal-200'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">No recent sales transactions</p>
            )}
          </div>
        </div>

        {/* Recent Purchases Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h3 className="font-bold text-sm text-slate-800">Recent Purchases</h3>
              <p className="text-[11px] text-slate-500">Latest 5 goods receipts</p>
            </div>
            <Link to="/purchases" className="text-xs font-bold text-teal-600 hover:text-teal-700">View All →</Link>
          </div>
          <div className="overflow-x-auto">
            {summary?.recentPurchases && summary.recentPurchases.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 text-[10px] uppercase text-slate-400 font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5">Receipt No.</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {summary.recentPurchases.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-teal-700">{p.invoice_number || `GRN-${p.id}`}</td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(p.purchase_date).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-900">{formatPaise(p.total_amount)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-slate-400 py-8 text-center">No recent goods receipts</p>
            )}
          </div>
        </div>

      </div>

    </div>
  )
}

