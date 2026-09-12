import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Download, Printer, X, ChevronLeft, ChevronRight, RefreshCw, FileText } from 'lucide-react'

export type ReportTypeKey = 
  | 'FINANCIAL'
  | 'SALES'
  | 'SALES_RETURNS'
  | 'PAYMENT'
  | 'INVENTORY'
  | 'PURCHASES'
  | 'MEDICINES'

interface ReportPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  reportType: ReportTypeKey
  reportTitle: string
  startDate: string
  endDate: string
  onExportPdf: () => void
  onExportCsv: () => void
  onPrintA4?: () => void
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  reportType,
  reportTitle,
  startDate,
  endDate,
  onExportPdf,
  onExportCsv,
  onPrintA4
}) => {
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState<any | null>(null)
  const [page, setPage] = useState<number>(1)
  const [pageSize] = useState<number>(25)
  const [total, setTotal] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  const formatPaise = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const fetchReportData = useCallback(async () => {
    if (!isOpen) return
    setLoading(true)
    setError('')

    try {
      const startMs = new Date(startDate).setHours(0, 0, 0, 0)
      const endMs = new Date(endDate).setHours(23, 59, 59, 999)

      if (reportType === 'FINANCIAL' || reportType === 'PAYMENT') {
        const finRes = await window.api.report.financials(startMs, endMs)
        setSummary(finRes)
        setData([])
        setTotal(1)
        setTotalPages(1)
      } else if (reportType === 'SALES') {
        const salesRes = await window.api.report.sales(startMs, endMs, page, pageSize)
        setData(salesRes.items || [])
        setTotal(salesRes.total || 0)
        setTotalPages(salesRes.totalPages || 1)
      } else if (reportType === 'SALES_RETURNS') {
        const returnsRes = await window.api.report.salesReturns(startMs, endMs, page, pageSize)
        setData(returnsRes.items || [])
        setTotal(returnsRes.total || 0)
        setTotalPages(returnsRes.totalPages || 1)
      } else if (reportType === 'INVENTORY') {
        const invRes = await window.api.report.inventoryReport(startMs, endMs, page, pageSize)
        setData(invRes.items || [])
        setTotal(invRes.total || 0)
        setTotalPages(invRes.totalPages || 1)
      } else if (reportType === 'PURCHASES') {
        const purRes = await window.api.report.purchases(startMs, endMs, page, pageSize)
        setData(purRes.items || [])
        setTotal(purRes.total || 0)
        setTotalPages(purRes.totalPages || 1)
      } else if (reportType === 'MEDICINES') {
        const medRes = await window.api.report.medicinesReport(startMs, endMs, page, pageSize)
        setData(medRes.items || [])
        setTotal(medRes.total || 0)
        setTotalPages(medRes.totalPages || 1)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }, [isOpen, reportType, startDate, endDate, page, pageSize])

  useEffect(() => {
    if (isOpen) {
      setPage(1)
    }
  }, [isOpen, reportType, startDate, endDate])

  useEffect(() => {
    fetchReportData()
  }, [fetchReportData])

  if (!isOpen) return null

  const dateRangeLabel = `${new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">{reportTitle}</h2>
                <Badge variant="default" className="bg-teal-50 text-teal-800 border-teal-200 text-xs">
                  {dateRangeLabel}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Authoritative preview sourced from NovoPharma database</p>
            </div>
          </div>

          {/* Top Actions & Close */}
          <div className="flex items-center space-x-2">
            {onPrintA4 && (
              <Button onClick={onPrintA4} variant="outline" size="sm" className="text-xs gap-1.5">
                <Printer className="w-3.5 h-3.5" />
                <span>Print A4</span>
              </Button>
            )}
            <Button onClick={onExportPdf} variant="outline" size="sm" className="text-xs gap-1.5">
              <Download className="w-3.5 h-3.5 text-rose-600" />
              <span>PDF</span>
            </Button>
            <Button onClick={onExportCsv} variant="outline" size="sm" className="text-xs gap-1.5">
              <Download className="w-3.5 h-3.5 text-teal-600" />
              <span>CSV</span>
            </Button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center justify-between">
              <span className="text-xs font-semibold">{error}</span>
              <Button onClick={fetchReportData} size="sm" variant="outline" className="text-xs gap-1 text-red-700 border-red-300">
                <RefreshCw className="w-3 h-3" />
                Retry
              </Button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3 py-8">
              <div className="h-8 bg-slate-100 animate-pulse rounded-lg w-full"></div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-lg w-full"></div>
              ))}
            </div>
          ) : reportType === 'FINANCIAL' && summary ? (
            /* Financial Summary Breakdown Cards & Table */
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-teal-50/60 border border-teal-100 rounded-xl">
                  <p className="text-xs font-bold uppercase text-teal-700">Gross Sales</p>
                  <p className="text-2xl font-bold text-teal-900 mt-1">{formatPaise(summary.todaySales)}</p>
                  <p className="text-[11px] text-teal-600 mt-0.5">{summary.todayInvoicesCount} sale invoices</p>
                </div>
                <div className="p-4 bg-rose-50/60 border border-rose-100 rounded-xl">
                  <p className="text-xs font-bold uppercase text-rose-700">Returns / Refunds</p>
                  <p className="text-2xl font-bold text-rose-900 mt-1">{formatPaise(summary.returnsRefunds)}</p>
                  <p className="text-[11px] text-rose-600 mt-0.5">Total refunded amount</p>
                </div>
                <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
                  <p className="text-xs font-bold uppercase text-blue-700">Net Sales</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{formatPaise(summary.netSales)}</p>
                  <p className="text-[11px] text-blue-600 mt-0.5">Gross minus refunds</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Financial Metric</th>
                      <th className="py-3 px-4 text-right">Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-800">Gross Sales Total</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatPaise(summary.todaySales)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-800">Total Discounts Applied</td>
                      <td className="py-3 px-4 text-right font-medium text-amber-700">{formatPaise(summary.totalDiscounts)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-800">Total Tax Collected</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">{formatPaise(summary.totalTax)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-rose-700">Sales Returns / Refunds</td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600">{formatPaise(summary.returnsRefunds)}</td>
                    </tr>
                    <tr className="bg-teal-50/40">
                      <td className="py-3 px-4 font-bold text-teal-900">Net Sales</td>
                      <td className="py-3 px-4 text-right font-bold text-teal-700 text-sm">{formatPaise(summary.netSales)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : reportType === 'PAYMENT' && summary ? (
            /* Payment Breakdown Cards & Table */
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-teal-50/60 border border-teal-100 rounded-xl">
                  <p className="text-xs font-bold uppercase text-teal-700">Cash Net</p>
                  <p className="text-2xl font-bold text-teal-900 mt-1">{formatPaise(summary.cashSales)}</p>
                </div>
                <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
                  <p className="text-xs font-bold uppercase text-blue-700">UPI / QR Net</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{formatPaise(summary.upiSales)}</p>
                </div>
                <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-xl">
                  <p className="text-xs font-bold uppercase text-purple-700">Card Net</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">{formatPaise(summary.cardSales)}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Payment Channel</th>
                      <th className="py-3 px-4 text-right">Net Collections (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Cash Collection
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatPaise(summary.cashSales)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> UPI / QR Collection
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatPaise(summary.upiSales)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Card Collection
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{formatPaise(summary.cardSales)}</td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="py-3 px-4 text-slate-900">Total Net Collections</td>
                      <td className="py-3 px-4 text-right text-teal-700 text-sm">{formatPaise(summary.cashSales + summary.upiSales + summary.cardSales)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : data.length > 0 ? (
            /* Paginated Tabular Reports */
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    {reportType === 'SALES' && (
                      <tr>
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Payment</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Tax (₹)</th>
                        <th className="py-3 px-4 text-right">Total Amount (₹)</th>
                      </tr>
                    )}

                    {reportType === 'SALES_RETURNS' && (
                      <tr>
                        <th className="py-3 px-4">Return #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Reason</th>
                        <th className="py-3 px-4 text-right">Refund Amount (₹)</th>
                      </tr>
                    )}

                    {reportType === 'INVENTORY' && (
                      <tr>
                        <th className="py-3 px-4">Medicine Name</th>
                        <th className="py-3 px-4">Batch Number</th>
                        <th className="py-3 px-4">Expiry Date</th>
                        <th className="py-3 px-4 text-right">Quantity</th>
                        <th className="py-3 px-4 text-right">MRP (₹)</th>
                        <th className="py-3 px-4 text-right">Cost Price (₹)</th>
                      </tr>
                    )}

                    {reportType === 'PURCHASES' && (
                      <tr>
                        <th className="py-3 px-4">Receipt #</th>
                        <th className="py-3 px-4">Supplier</th>
                        <th className="py-3 px-4">Purchase Date</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Total Amount (₹)</th>
                      </tr>
                    )}

                    {reportType === 'MEDICINES' && (
                      <tr>
                        <th className="py-3 px-4">Medicine Name</th>
                        <th className="py-3 px-4">Generic Name</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Dosage / Strength</th>
                        <th className="py-3 px-4 text-right">Selling Price (₹)</th>
                      </tr>
                    )}
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-xs">
                    {reportType === 'SALES' && data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-teal-700">{item.invoice_number}</td>
                        <td className="py-3 px-4 text-slate-600">{new Date(item.sale_date).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-4 font-medium text-slate-700">{item.payment_method}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded ${
                            item.status === 'REFUNDED' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600">{formatPaise(item.tax_amount)}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">{formatPaise(item.total_amount)}</td>
                      </tr>
                    ))}

                    {reportType === 'SALES_RETURNS' && data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-rose-700">{item.return_number}</td>
                        <td className="py-3 px-4 text-slate-600">{new Date(item.return_date).toLocaleString('en-IN')}</td>
                        <td className="py-3 px-4 text-slate-700">{item.reason || 'Customer Return'}</td>
                        <td className="py-3 px-4 text-right font-bold text-rose-600">{formatPaise(item.refund_amount)}</td>
                      </tr>
                    ))}

                    {reportType === 'INVENTORY' && data.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{item.product_name || `Product #${item.product_id}`}</td>
                        <td className="py-3 px-4 font-mono text-slate-700">{item.batch_number}</td>
                        <td className="py-3 px-4 text-slate-600">{new Date(item.expiry_date).toLocaleDateString('en-IN')}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-800">{item.quantity}</td>
                        <td className="py-3 px-4 text-right text-slate-700">{formatPaise(item.mrp)}</td>
                        <td className="py-3 px-4 text-right text-slate-600">{formatPaise(item.purchase_price)}</td>
                      </tr>
                    ))}

                    {reportType === 'PURCHASES' && data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-teal-700">{item.invoice_number || `GRN-${item.id}`}</td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{item.supplier_name || `Supplier #${item.supplier_id}`}</td>
                        <td className="py-3 px-4 text-slate-600">{new Date(item.purchase_date).toLocaleDateString('en-IN')}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">{formatPaise(item.total_amount)}</td>
                      </tr>
                    ))}

                    {reportType === 'MEDICINES' && data.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-3 px-4 text-slate-500 italic">{item.generic_name || '—'}</td>
                        <td className="py-3 px-4 text-slate-700">{item.category || 'General'}</td>
                        <td className="py-3 px-4 text-slate-600">{item.dosage_form || ''} {item.strength || ''}</td>
                        <td className="py-3 px-4 text-right font-bold text-teal-700">{formatPaise(item.selling_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No records found for the selected period.</p>
              <p className="text-xs text-slate-400 mt-1">Try selecting a wider date range above.</p>
            </div>
          )}
        </div>

        {/* Modal Footer / Pagination */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0 text-xs text-slate-600">
          <span>
            {total > 0 ? `Showing page ${page} of ${totalPages} (${total} total records)` : '0 records'}
          </span>

          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                variant="outline"
                size="sm"
                className="text-xs px-2.5 py-1"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>
              <span className="font-semibold text-slate-800">
                {page} / {totalPages}
              </span>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                variant="outline"
                size="sm"
                className="text-xs px-2.5 py-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
