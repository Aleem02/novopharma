import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { DatePicker } from '../ui/DatePicker'
import { A4DocumentLayout } from './A4DocumentLayout'
import { renderToPrintHtml } from '../../utils/printUtils'
import { useToast } from '../ui/Toast'
import { ReportPreviewModal, ReportTypeKey } from './ReportPreviewModal'
import { 
  BarChart3, 
  Calendar, 
  RefreshCw, 
  Download, 
  Printer, 
  Eye, 
  TrendingUp, 
  FileText, 
  DollarSign, 
  Receipt, 
  ShoppingCart, 
  RotateCcw, 
  Tag, 
  Package, 
  AlertTriangle, 
  Clock, 
  Boxes, 
  HelpCircle,
  BookOpen
} from 'lucide-react'

type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'MONTH' | 'CUSTOM'

export const ReportDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // Date Range State
  const [preset, setPreset] = useState<DatePreset>('LAST_30_DAYS')
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Applied Date State (drives report queries)
  const [appliedStart, setAppliedStart] = useState<string>(startDate)
  const [appliedEnd, setAppliedEnd] = useState<string>(endDate)

  // Overview Metrics State
  const [financialSummary, setFinancialSummary] = useState<any | null>(null)
  const [salesCount, setSalesCount] = useState<number>(0)
  const [purchaseCount, setPurchaseCount] = useState<number>(0)
  const [returnsCount, setReturnsCount] = useState<number>(0)
  const [inventoryCount, setInventoryCount] = useState<number>(0)
  const [medicineCount, setMedicineCount] = useState<number>(0)

  // Loading & Error State
  const [loading, setLoading] = useState<boolean>(true)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [activeReportKey, setActiveReportKey] = useState<ReportTypeKey>('SALES')
  const [activeReportTitle, setActiveReportTitle] = useState<string>('Sales Register')
  const [activeReportPrintAction, setActiveReportPrintAction] = useState<(() => void) | undefined>(undefined)

  const formatPaise = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Handle Date Preset Changes
  const applyPreset = useCallback((p: DatePreset) => {
    setPreset(p)
    const currentDate = new Date()
    const endStr = currentDate.toISOString().split('T')[0]
    let startStr = endStr

    if (p === 'TODAY') {
      startStr = endStr
    } else if (p === 'YESTERDAY') {
      const y = new Date(currentDate)
      y.setDate(y.getDate() - 1)
      startStr = y.toISOString().split('T')[0]
      setEndDate(startStr)
      setStartDate(startStr)
      setAppliedStart(startStr)
      setAppliedEnd(startStr)
      return
    } else if (p === 'LAST_7_DAYS') {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 7)
      startStr = d.toISOString().split('T')[0]
    } else if (p === 'LAST_30_DAYS') {
      const d = new Date(currentDate)
      d.setDate(d.getDate() - 30)
      startStr = d.toISOString().split('T')[0]
    } else if (p === 'MONTH') {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      startStr = d.toISOString().split('T')[0]
    }

    setStartDate(startStr)
    setEndDate(endStr)
    setAppliedStart(startStr)
    setAppliedEnd(endStr)
  }, [])

  const handleCustomApply = () => {
    setPreset('CUSTOM')
    setAppliedStart(startDate)
    setAppliedEnd(endDate)
  }

  // Fetch Overview Data from Authoritative Backend Services
  const fetchOverviewData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const startMs = new Date(appliedStart).setHours(0, 0, 0, 0)
      const endMs = new Date(appliedEnd).setHours(23, 59, 59, 999)

      const [finRes, salesRes, purRes, retRes, invRes, medRes] = await Promise.all([
        window.api.report.financials(startMs, endMs),
        window.api.report.sales(startMs, endMs, 1, 1),
        window.api.report.purchases(startMs, endMs, 1, 1),
        window.api.report.salesReturns(startMs, endMs, 1, 1),
        window.api.report.inventoryReport(startMs, endMs, 1, 1),
        window.api.report.medicinesReport(startMs, endMs, 1, 1)
      ])

      setFinancialSummary(finRes)
      setSalesCount(salesRes.total || 0)
      setPurchaseCount(purRes.total || 0)
      setReturnsCount(retRes.total || 0)
      setInventoryCount(invRes.total || 0)
      setMedicineCount(medRes.total || 0)
      setLastUpdated(new Date())
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report overview data')
    } finally {
      setLoading(false)
    }
  }, [appliedStart, appliedEnd])

  useEffect(() => {
    fetchOverviewData()
  }, [fetchOverviewData])

  // Average Bill Calculation (Zero Safe)
  const averageBillPaise = useMemo(() => {
    if (!financialSummary || financialSummary.todayInvoicesCount === 0) return 0
    return Math.round(financialSummary.netSales / financialSummary.todayInvoicesCount)
  }, [financialSummary])

  // Export CSV Handler
  const handleExportCsv = async (type: 'SALES' | 'FINANCIAL' | 'INVENTORY' | 'PURCHASES' | 'MEDICINES') => {
    try {
      setActionLoading(true)
      const startMs = new Date(appliedStart).setHours(0, 0, 0, 0)
      const endMs = new Date(appliedEnd).setHours(23, 59, 59, 999)
      await window.api.document.exportReportCsv(type, startMs, endMs)
      showToast(`${type.charAt(0) + type.slice(1).toLowerCase()} report exported to CSV successfully!`, 'success')
    } catch (err: any) {
      showToast(err.message || 'CSV Export failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Print / PDF Handler (preserves existing A4DocumentLayout printing)
  const handlePrintOrPdf = async (
    type: 'SALES' | 'FINANCIAL' | 'INVENTORY' | 'PURCHASES' | 'MEDICINES',
    action: 'PRINT' | 'PDF'
  ) => {
    try {
      setActionLoading(true)
      const settings = await window.api.settings.getAll()
      const startMs = new Date(appliedStart).setHours(0, 0, 0, 0)
      const endMs = new Date(appliedEnd).setHours(23, 59, 59, 999)
      const dateRangeStr = `${new Date(appliedStart).toLocaleDateString('en-IN')} to ${new Date(appliedEnd).toLocaleDateString('en-IN')}`

      let html = ''
      let defaultOrientation: 'portrait' | 'landscape' = 'portrait'

      if (type === 'SALES') {
        const res = await window.api.report.sales(startMs, endMs, 1, 10000)
        const columns = ['Invoice #', 'Date', 'Status', 'Payment', 'Subtotal', 'Tax', 'Total']
        const items = res.items || []
        const rows = items.map((s: any) => [
          s.invoice_number,
          new Date(s.sale_date).toLocaleString('en-IN'),
          s.status.replace('_', ' '),
          s.payment_method,
          formatPaise(s.subtotal),
          formatPaise(s.tax_amount),
          formatPaise(s.total_amount)
        ])
        const comp = (
          <A4DocumentLayout
            settings={settings}
            title="Sales Register"
            subtitle={`Period: ${dateRangeStr}`}
            columns={columns}
            rows={rows}
            orientation="portrait"
          />
        )
        html = renderToPrintHtml(comp, 'Sales Register')
      } else if (type === 'FINANCIAL') {
        const summary = await window.api.report.financials(startMs, endMs)
        const columns = ['Metric', 'Amount (₹)']
        const rows = [
          ['Gross Sales', formatPaise(summary.todaySales)],
          ['Returns / Refunds', formatPaise(summary.returnsRefunds)],
          ['Net Sales', formatPaise(summary.netSales)],
          ['Total Tax Collected', formatPaise(summary.totalTax)],
          ['Cash Collection', formatPaise(summary.cashSales)],
          ['UPI Collection', formatPaise(summary.upiSales)],
          ['Card Collection', formatPaise(summary.cardSales)]
        ]
        const comp = (
          <A4DocumentLayout
            settings={settings}
            title="Financial Summary"
            subtitle={`Period: ${dateRangeStr}`}
            columns={columns}
            rows={rows}
            orientation="portrait"
          />
        )
        html = renderToPrintHtml(comp, 'Financial Summary')
      } else if (type === 'INVENTORY') {
        defaultOrientation = 'landscape'
        const res = await window.api.report.inventoryReport(startMs, endMs, 1, 10000)
        const columns = ['Product Name', 'Batch Number', 'Expiry Date', 'Quantity', 'MRP', 'Purchase Price', 'Received Date']
        const items = res.items || []
        const rows = items.map((ib: any) => [
          ib.product_name || '',
          ib.batch_number,
          new Date(ib.expiry_date).toLocaleDateString('en-IN'),
          ib.quantity.toString(),
          formatPaise(ib.mrp),
          formatPaise(ib.purchase_price),
          new Date(ib.created_at).toLocaleDateString('en-IN')
        ])
        const comp = (
          <A4DocumentLayout
            settings={settings}
            title="Inventory Records"
            subtitle={`Period: ${dateRangeStr}`}
            columns={columns}
            rows={rows}
            orientation={defaultOrientation}
          />
        )
        html = renderToPrintHtml(comp, 'Inventory Records')
      } else if (type === 'PURCHASES') {
        const res = await window.api.report.purchases(startMs, endMs, 1, 10000)
        const columns = ['Invoice #', 'Supplier', 'Purchase Date', 'Status', 'Total Amount']
        const items = res.items || []
        const rows = items.map((p: any) => [
          p.invoice_number || `GRN-${p.id}`,
          p.supplier_name || `Supplier #${p.supplier_id}`,
          new Date(p.purchase_date).toLocaleDateString('en-IN'),
          p.status,
          formatPaise(p.total_amount)
        ])
        const comp = (
          <A4DocumentLayout
            settings={settings}
            title="Purchases Report"
            subtitle={`Period: ${dateRangeStr}`}
            columns={columns}
            rows={rows}
            orientation="portrait"
          />
        )
        html = renderToPrintHtml(comp, 'Purchases Report')
      } else if (type === 'MEDICINES') {
        defaultOrientation = 'landscape'
        const res = await window.api.report.medicinesReport(startMs, endMs, 1, 10000)
        const columns = ['Name', 'Generic Name', 'Category', 'Dosage Form', 'Strength', 'Unit', 'Selling Price', 'Created Date']
        const items = res.items || []
        const rows = items.map((m: any) => [
          m.name,
          m.generic_name || '',
          m.category || '',
          m.dosage_form || '',
          m.strength || '',
          m.unit || '',
          formatPaise(m.selling_price),
          new Date(m.created_at).toLocaleDateString('en-IN')
        ])
        const comp = (
          <A4DocumentLayout
            settings={settings}
            title="Medicine Directory Report"
            subtitle={`Period: ${dateRangeStr}`}
            columns={columns}
            rows={rows}
            orientation={defaultOrientation}
          />
        )
        html = renderToPrintHtml(comp, 'Medicine Directory Report')
      }

      if (action === 'PRINT') {
        const printer = settings.a4_printer_name
        if (!printer) throw new Error('No A4 printer selected in Settings.')
        await window.api.print.printDocument(html, {
          deviceName: printer,
          landscape: defaultOrientation === 'landscape',
          pageSize: 'A4'
        })
        showToast(`Print job successfully sent to printer: "${printer}"`, 'success')
      } else if (action === 'PDF') {
        showToast('Select "Microsoft Print to PDF" or your PDF printer in the print dialog.', 'info')
        const printer = settings.a4_printer_name
        if (!printer) throw new Error('No A4 printer selected in Settings.')
        await window.api.print.printDocument(html, {
          deviceName: printer,
          landscape: defaultOrientation === 'landscape',
          pageSize: 'A4'
        })
      }
    } catch (err: any) {
      showToast(err.message || 'Print/Export failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Open Interactive Report Preview Modal
  const openPreview = (
    key: ReportTypeKey,
    title: string,
    printAction?: () => void
  ) => {
    setActiveReportKey(key)
    setActiveReportTitle(title)
    setActiveReportPrintAction(() => printAction)
    setModalOpen(true)
  }

  const startDateLabel = new Date(appliedStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const endDateLabel = new Date(appliedEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans text-slate-800">
      
      {/* 1. HEADER & HERO BANNER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">Reports & Analytics</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Pharmacy reporting, analysis and exports</p>
          </div>
        </div>

        {/* Top Info Callout Banner */}
        <div className="flex items-center space-x-3 bg-blue-50/60 border border-blue-100 p-3 rounded-xl max-w-md">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <p className="text-xs text-blue-900 leading-snug">
            Generate accurate reports from your pharmacy data. View, analyse, print or export reports for any date range.
          </p>
        </div>
      </div>

      {/* ERROR NOTIFICATION */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center justify-between shadow-xs">
          <span className="text-xs font-semibold">{error}</span>
          <button onClick={() => setError('')} className="text-red-700 hover:text-red-900">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. REUSABLE DATE RANGE CONTROLS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'MONTH', 'CUSTOM'] as const).map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  preset === p
                    ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {p === 'TODAY'
                  ? 'Today'
                  : p === 'YESTERDAY'
                  ? 'Yesterday'
                  : p === 'LAST_7_DAYS'
                  ? 'Last 7 Days'
                  : p === 'LAST_30_DAYS'
                  ? 'Last 30 Days'
                  : p === 'MONTH'
                  ? 'This Month'
                  : 'Custom'}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers & Apply Button */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500">From</span>
              <div className="w-36">
                <DatePicker
                  value={startDate}
                  onChange={(val) => setStartDate(val)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500">To</span>
              <div className="w-36">
                <DatePicker
                  value={endDate}
                  onChange={(val) => setEndDate(val)}
                />
              </div>
            </div>

            <Button
              onClick={handleCustomApply}
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-8 px-4"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>

      {/* 3. REPORT OVERVIEW PANEL */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Report Overview</span>
              <span className="text-xs font-normal text-slate-500">Key figures for {startDateLabel} – {endDateLabel}</span>
            </h2>
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span>Last updated: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            <button
              onClick={fetchOverviewData}
              disabled={loading}
              className="flex items-center space-x-1 font-semibold text-slate-600 hover:text-teal-600 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Net Sales */}
          <div className="p-4 rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/60 to-white flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-teal-500 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
              ₹
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Net Sales</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{financialSummary ? formatPaise(financialSummary.netSales) : '₹0.00'}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Gross minus refunds</p>
            </div>
          </div>

          {/* Transactions */}
          <div className="p-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-white flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Transactions</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{salesCount}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Completed invoices</p>
            </div>
          </div>

          {/* Purchases */}
          <div className="p-4 rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50/60 to-white flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Purchases</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{purchaseCount}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Purchase GRN invoices</p>
            </div>
          </div>

          {/* Returns / Refunds */}
          <div className="p-4 rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-white flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Returns / Refunds</p>
              <p className="text-xl font-bold text-rose-600 mt-0.5">{financialSummary ? formatPaise(financialSummary.returnsRefunds) : '₹0.00'}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{returnsCount} return entries</p>
            </div>
          </div>

          {/* Average Bill */}
          <div className="p-4 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/60 to-white flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Average Bill</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{formatPaise(averageBillPaise)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Net sales per invoice</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECTION 1: SALES & FINANCIAL REPORTS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-l-4 border-teal-500 pl-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Sales & Financial Reports</h2>
            <p className="text-xs text-slate-500">Sales, returns, payments and financial analysis</p>
          </div>
          <Badge variant="default" className="bg-teal-50 text-teal-800 border-teal-200 text-xs font-semibold">
            4 Reports
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Financial Summary Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-3 border border-teal-100">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Financial Summary</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Sales, tax, returns and payment collections for the selected period.
              </p>
            </div>

            <div className="mt-5 space-y-2 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => openPreview('FINANCIAL', 'Financial Summary', () => handlePrintOrPdf('FINANCIAL', 'PRINT'))}
                  disabled={actionLoading}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-1 px-2"
                >
                  View
                </Button>
                <Button
                  onClick={() => handlePrintOrPdf('FINANCIAL', 'PDF')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  PDF
                </Button>
                <Button
                  onClick={() => handleExportCsv('FINANCIAL')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Sales Register Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 border border-blue-100">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Sales Register</h3>
                <span className="text-[10px] font-semibold text-slate-400">{salesCount} invoices</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Detailed list of all invoices generated in the selected period.
              </p>
            </div>

            <div className="mt-5 space-y-2 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => openPreview('SALES', 'Sales Register', () => handlePrintOrPdf('SALES', 'PRINT'))}
                  disabled={actionLoading}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-1 px-2"
                >
                  View
                </Button>
                <Button
                  onClick={() => handlePrintOrPdf('SALES', 'PDF')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  PDF
                </Button>
                <Button
                  onClick={() => handleExportCsv('SALES')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Sales Returns Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-100">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Sales Returns</h3>
                <span className="text-[10px] font-semibold text-slate-400">{returnsCount} returns</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                List of all sales returns and refunded amounts for the period.
              </p>
            </div>

            <div className="mt-5 space-y-2 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => openPreview('SALES_RETURNS', 'Sales Returns Report')}
                  disabled={actionLoading}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-1 px-2"
                >
                  View
                </Button>
                <Button
                  onClick={() => openPreview('SALES_RETURNS', 'Sales Returns Report')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  PDF
                </Button>
                <Button
                  onClick={() => openPreview('SALES_RETURNS', 'Sales Returns Report')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Payment Collection Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-teal-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 border border-indigo-100">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Payment Collection</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Cash, UPI and card collection breakdown for the selected period.
              </p>
            </div>

            <div className="mt-5 space-y-2 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => openPreview('PAYMENT', 'Payment Collection Breakdown')}
                  disabled={actionLoading}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-1 px-2"
                >
                  View
                </Button>
                <Button
                  onClick={() => handlePrintOrPdf('FINANCIAL', 'PDF')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  PDF
                </Button>
                <Button
                  onClick={() => handleExportCsv('FINANCIAL')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. SECTION 2: INVENTORY REPORTS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-l-4 border-blue-500 pl-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Inventory Reports</h2>
            <p className="text-xs text-slate-500">Stock, batches, movements and expiry analysis</p>
          </div>
          <Badge variant="default" className="bg-blue-50 text-blue-800 border-blue-200 text-xs font-semibold">
            4 Reports
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Inventory Records Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 border border-blue-100">
                <Boxes className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Inventory Records</h3>
                <span className="text-[10px] font-semibold text-slate-400">{inventoryCount} batches</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                All inventory batches received in the selected period.
              </p>
            </div>

            <div className="mt-5 space-y-2 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => openPreview('INVENTORY', 'Inventory Records', () => handlePrintOrPdf('INVENTORY', 'PRINT'))}
                  disabled={actionLoading}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-1 px-2"
                >
                  View
                </Button>
                <Button
                  onClick={() => handlePrintOrPdf('INVENTORY', 'PDF')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  PDF
                </Button>
                <Button
                  onClick={() => handleExportCsv('INVENTORY')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Current Stock Card (Navigation to Stock & Batches) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-3 border border-teal-100">
                <Package className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Current Stock</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Current stock levels and batch quantities across all medicines.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100">
              <Button
                onClick={() => navigate('/inventory')}
                size="sm"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-1.5"
              >
                View Current Stock →
              </Button>
            </div>
          </div>

          {/* Low Stock Report Card (Navigation to Low Stock Filter) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-amber-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3 border border-amber-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Low Stock Report</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Medicines with aggregate usable quantity ≤ 10 units.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100">
              <Button
                onClick={() => navigate('/inventory?filter=LOW_STOCK')}
                size="sm"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-1.5"
              >
                View Low Stock →
              </Button>
            </div>
          </div>

          {/* Expiry Report Card (Navigation to Expiry Filter) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-orange-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-3 border border-orange-100">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Expiry Report</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Batches expiring within 90 days and expired batches.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100">
              <Button
                onClick={() => navigate('/inventory?filter=EXPIRING_SOON')}
                size="sm"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs py-1.5"
              >
                View Expiry Report →
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. SECTION 3: PURCHASING REPORTS & HELP */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-l-4 border-purple-500 pl-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Purchasing Reports</h2>
            <p className="text-xs text-slate-500">Purchase invoices, suppliers and returns</p>
          </div>
          <Badge variant="default" className="bg-purple-50 text-purple-800 border-purple-200 text-xs font-semibold">
            3 Reports
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Purchase Register Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-purple-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3 border border-purple-100">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Purchase Register</h3>
                <span className="text-[10px] font-semibold text-slate-400">{purchaseCount} purchases</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                List of all purchase invoices in the selected period.
              </p>
            </div>

            <div className="mt-5 space-y-2 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => openPreview('PURCHASES', 'Purchase Register', () => handlePrintOrPdf('PURCHASES', 'PRINT'))}
                  disabled={actionLoading}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-1 px-2"
                >
                  View
                </Button>
                <Button
                  onClick={() => handlePrintOrPdf('PURCHASES', 'PDF')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  PDF
                </Button>
                <Button
                  onClick={() => handleExportCsv('PURCHASES')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Purchase Returns Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-purple-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-100">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Purchase Returns</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                List of all purchase returns and supplier refund transactions.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100">
              <Button
                onClick={() => navigate('/purchases/returns')}
                size="sm"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-1.5"
              >
                View Purchase Returns →
              </Button>
            </div>
          </div>

          {/* Medicine Directory Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-purple-300 transition-colors">
            <div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 border border-indigo-100">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Medicine Directory</h3>
                <span className="text-[10px] font-semibold text-slate-400">{medicineCount} medicines</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                List of all products and medicines registered in the system.
              </p>
            </div>

            <div className="mt-5 space-y-2 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  onClick={() => openPreview('MEDICINES', 'Medicine Directory Report', () => handlePrintOrPdf('MEDICINES', 'PRINT'))}
                  disabled={actionLoading}
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs py-1 px-2"
                >
                  View
                </Button>
                <Button
                  onClick={() => handlePrintOrPdf('MEDICINES', 'PDF')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  PDF
                </Button>
                <Button
                  onClick={() => handleExportCsv('MEDICINES')}
                  disabled={actionLoading}
                  size="sm"
                  variant="outline"
                  className="text-xs font-medium py-1 px-2 border-slate-200"
                >
                  CSV
                </Button>
              </div>
            </div>
          </div>

          {/* Need Help? Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-lg bg-teal-950 text-teal-400 flex items-center justify-center mb-3 border border-teal-800/60">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white">Need Help?</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                For support with reports or data exports, please contact your administrator.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-700/60">
              <Button
                onClick={() => showToast('Documentation is accessible under Tools -> User Manual.', 'info')}
                size="sm"
                variant="outline"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs font-semibold gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>View Documentation</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 7. INTERACTIVE REPORT PREVIEW MODAL */}
      <ReportPreviewModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        reportType={activeReportKey}
        reportTitle={activeReportTitle}
        startDate={appliedStart}
        endDate={appliedEnd}
        onExportPdf={() => {
          setModalOpen(false)
          if (activeReportKey === 'SALES') handlePrintOrPdf('SALES', 'PDF')
          else if (activeReportKey === 'FINANCIAL' || activeReportKey === 'PAYMENT') handlePrintOrPdf('FINANCIAL', 'PDF')
          else if (activeReportKey === 'INVENTORY') handlePrintOrPdf('INVENTORY', 'PDF')
          else if (activeReportKey === 'PURCHASES') handlePrintOrPdf('PURCHASES', 'PDF')
          else if (activeReportKey === 'MEDICINES') handlePrintOrPdf('MEDICINES', 'PDF')
          else if (activeReportKey === 'SALES_RETURNS') openPreview('SALES_RETURNS', 'Sales Returns Report')
        }}
        onExportCsv={() => {
          setModalOpen(false)
          if (activeReportKey === 'SALES') handleExportCsv('SALES')
          else if (activeReportKey === 'FINANCIAL' || activeReportKey === 'PAYMENT') handleExportCsv('FINANCIAL')
          else if (activeReportKey === 'INVENTORY') handleExportCsv('INVENTORY')
          else if (activeReportKey === 'PURCHASES') handleExportCsv('PURCHASES')
          else if (activeReportKey === 'MEDICINES') handleExportCsv('MEDICINES')
          else if (activeReportKey === 'SALES_RETURNS') openPreview('SALES_RETURNS', 'Sales Returns Report')
        }}
        onPrintA4={activeReportPrintAction}
      />
    </div>
  )
}
