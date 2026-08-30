import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { A4DocumentLayout } from './A4DocumentLayout'
import { renderToPrintHtml } from '../../utils/printUtils'
import { useToast } from '../ui/Toast'

export const ReportDashboard: React.FC = () => {
  const { showToast } = useToast()
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setHours(0,0,0,0)
    return d.toISOString().split('T')[0]
  })
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    d.setHours(23,59,59,999)
    return d.toISOString().split('T')[0]
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExport = async (type: 'SALES' | 'FINANCIAL' | 'INVENTORY' | 'PURCHASES' | 'MEDICINES') => {
    try {
      setLoading(true)
      setError('')
      const startMs = new Date(startDate).setHours(0,0,0,0)
      const endMs = new Date(endDate).setHours(23,59,59,999)
      
      await window.api.document.exportReportCsv(type, startMs, endMs)
      showToast(`${type.charAt(0) + type.slice(1).toLowerCase()} report exported to CSV successfully!`, 'success')
    } catch (err: any) {
      const msg = err.message || 'Export failed'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handlePrintOrPdf = async (type: 'SALES' | 'FINANCIAL' | 'INVENTORY' | 'PURCHASES' | 'MEDICINES', action: 'PRINT' | 'PDF') => {
    try {
      setLoading(true)
      setError('')
      
      const settings = await window.api.settings.getAll()
      const startMs = new Date(startDate).setHours(0,0,0,0)
      const endMs = new Date(endDate).setHours(23,59,59,999)
      const dateRangeStr = `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`

      let html = ''
      let defaultOrientation: 'portrait' | 'landscape' = 'portrait'

      if (type === 'SALES') {
        const res = await window.api.report.sales(startMs, endMs, 1, 10000)
        const columns = ['Invoice #', 'Date', 'Status', 'Payment', 'Subtotal', 'Tax', 'Total']
        const items = res.items || []
        const rows = items.map((s: any) => [
          s.invoice_number,
          new Date(s.sale_date).toLocaleString(),
          s.status.replace('_', ' '),
          s.payment_method,
          `₹${(s.subtotal/100).toFixed(2)}`,
          `₹${(s.tax_amount/100).toFixed(2)}`,
          `₹${(s.total_amount/100).toFixed(2)}`
        ])
        const comp = <A4DocumentLayout 
          settings={settings}
          title="Sales Register"
          subtitle={`Period: ${dateRangeStr}`}
          columns={columns}
          rows={rows}
          orientation="portrait"
        />
        html = renderToPrintHtml(comp, 'Sales Register')
      } else if (type === 'FINANCIAL') {
        const summary = await window.api.report.financials(startMs, endMs)
        const columns = ['Metric', 'Amount']
        const rows = [
          ['Gross Sales', `₹${(summary.todaySales/100).toFixed(2)}`],
          ['Returns / Refunds', `₹${(summary.returnsRefunds/100).toFixed(2)}`],
          ['Net Sales', `₹${(summary.netSales/100).toFixed(2)}`],
          ['Total Tax Collected', `₹${(summary.totalTax/100).toFixed(2)}`]
        ]
        const comp = <A4DocumentLayout 
          settings={settings}
          title="Financial Summary"
          subtitle={`Period: ${dateRangeStr}`}
          columns={columns}
          rows={rows}
          orientation="portrait"
        />
        html = renderToPrintHtml(comp, 'Financial Summary')
      } else if (type === 'INVENTORY') {
        defaultOrientation = 'landscape'
        const res = await window.api.report.inventoryReport(startMs, endMs, 1, 10000)
        const columns = ['Product Name', 'Batch Number', 'Expiry Date', 'Quantity', 'MRP', 'Purchase Price', 'Received Date']
        const items = res.items || []
        const rows = items.map((ib: any) => [
          ib.product_name || '',
          ib.batch_number,
          new Date(ib.expiry_date).toLocaleDateString(),
          ib.quantity.toString(),
          `₹${(ib.mrp/100).toFixed(2)}`,
          `₹${(ib.purchase_price/100).toFixed(2)}`,
          new Date(ib.created_at).toLocaleDateString()
        ])
        const comp = <A4DocumentLayout 
          settings={settings}
          title="Inventory Records"
          subtitle={`Period: ${dateRangeStr}`}
          columns={columns}
          rows={rows}
          orientation={defaultOrientation}
        />
        html = renderToPrintHtml(comp, 'Inventory Records')
      } else if (type === 'PURCHASES') {
        const res = await window.api.report.purchases(startMs, endMs, 1, 10000)
        const columns = ['Invoice #', 'Supplier', 'Purchase Date', 'Status', 'Total Amount']
        const items = res.items || []
        const rows = items.map((p: any) => [
          p.invoice_number || '',
          p.supplier_name || p.supplier_id.toString(),
          new Date(p.purchase_date).toLocaleDateString(),
          p.status,
          `₹${(p.total_amount/100).toFixed(2)}`
        ])
        const comp = <A4DocumentLayout 
          settings={settings}
          title="Purchases Report"
          subtitle={`Period: ${dateRangeStr}`}
          columns={columns}
          rows={rows}
          orientation="portrait"
        />
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
          `₹${(m.selling_price/100).toFixed(2)}`,
          new Date(m.created_at).toLocaleDateString()
        ])
        const comp = <A4DocumentLayout 
          settings={settings}
          title="Medicine Registered Report"
          subtitle={`Period: ${dateRangeStr}`}
          columns={columns}
          rows={rows}
          orientation={defaultOrientation}
        />
        html = renderToPrintHtml(comp, 'Medicine Registered Report')
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
        showToast('To save as PDF, select your system PDF printer (e.g., Microsoft Print to PDF) in the following print dialog.', 'info')
        const printer = settings.a4_printer_name
        if (!printer) throw new Error('No A4 printer selected in Settings.')
        await window.api.print.printDocument(html, {
          deviceName: printer,
          landscape: defaultOrientation === 'landscape',
          pageSize: 'A4'
        })
      }
    } catch (err: any) {
      const msg = err.message || 'Print/Export failed'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Reports & Exports</h1>
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button 
            onClick={() => setError('')} 
            className="ml-4 text-red-700 hover:text-red-900 shrink-0 focus:outline-none"
            aria-label="Dismiss error"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Date Range</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Input 
              type="date" 
              label="Start Date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} placeholder="Enter start  date..." 
            />
          </div>
          <div className="flex-1">
            <Input 
              type="date" 
              label="End Date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} placeholder="Enter end  date..." 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-start">
          <h2 className="text-lg font-semibold mb-2">Financial Summary</h2>
          <p className="text-slate-500 mb-6 text-sm">Export net sales, tax, returns, and payment splits for the selected period.</p>
          <div className="flex flex-wrap gap-2 mt-auto w-full">
            <Button onClick={() => handlePrintOrPdf('FINANCIAL', 'PRINT')} disabled={loading} variant="outline" className="flex-1">
              Print A4
            </Button>
            <Button onClick={() => handlePrintOrPdf('FINANCIAL', 'PDF')} disabled={loading} variant="outline" className="flex-1">
              PDF
            </Button>
            <Button onClick={() => handleExport('FINANCIAL')} disabled={loading} className="w-full mt-2">
              Export to CSV
            </Button>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-start">
          <h2 className="text-lg font-semibold mb-2">Sales Register</h2>
          <p className="text-slate-500 mb-6 text-sm">Export a detailed list of all invoices generated within the date range.</p>
          <div className="flex flex-wrap gap-2 mt-auto w-full">
            <Button onClick={() => handlePrintOrPdf('SALES', 'PRINT')} disabled={loading} variant="outline" className="flex-1">
              Print A4
            </Button>
            <Button onClick={() => handlePrintOrPdf('SALES', 'PDF')} disabled={loading} variant="outline" className="flex-1">
              PDF
            </Button>
            <Button onClick={() => handleExport('SALES')} disabled={loading} className="w-full mt-2">
              Export to CSV
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-start">
          <h2 className="text-lg font-semibold mb-2">Inventory Records</h2>
          <p className="text-slate-500 mb-6 text-sm">Export details of all inventory batches received within the selected date range.</p>
          <div className="flex flex-wrap gap-2 mt-auto w-full">
            <Button onClick={() => handlePrintOrPdf('INVENTORY', 'PRINT')} disabled={loading} variant="outline" className="flex-1">
              Print A4
            </Button>
            <Button onClick={() => handlePrintOrPdf('INVENTORY', 'PDF')} disabled={loading} variant="outline" className="flex-1">
              PDF
            </Button>
            <Button onClick={() => handleExport('INVENTORY')} disabled={loading} className="w-full mt-2">
              Export to CSV
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-start">
          <h2 className="text-lg font-semibold mb-2">Purchases</h2>
          <p className="text-slate-500 mb-6 text-sm">Export a log of all goods receipt/purchase invoices within the selected date range.</p>
          <div className="flex flex-wrap gap-2 mt-auto w-full">
            <Button onClick={() => handlePrintOrPdf('PURCHASES', 'PRINT')} disabled={loading} variant="outline" className="flex-1">
              Print A4
            </Button>
            <Button onClick={() => handlePrintOrPdf('PURCHASES', 'PDF')} disabled={loading} variant="outline" className="flex-1">
              PDF
            </Button>
            <Button onClick={() => handleExport('PURCHASES')} disabled={loading} className="w-full mt-2">
              Export to CSV
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-start">
          <h2 className="text-lg font-semibold mb-2">Medicine Registered</h2>
          <p className="text-slate-500 mb-6 text-sm">Export a list of all products and medicines registered in the system within the selected date range.</p>
          <div className="flex flex-wrap gap-2 mt-auto w-full">
            <Button onClick={() => handlePrintOrPdf('MEDICINES', 'PRINT')} disabled={loading} variant="outline" className="flex-1">
              Print A4
            </Button>
            <Button onClick={() => handlePrintOrPdf('MEDICINES', 'PDF')} disabled={loading} variant="outline" className="flex-1">
              PDF
            </Button>
            <Button onClick={() => handleExport('MEDICINES')} disabled={loading} className="w-full mt-2">
              Export to CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
