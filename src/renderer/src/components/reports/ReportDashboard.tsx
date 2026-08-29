import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { A4DocumentLayout } from './A4DocumentLayout'
import { renderToPrintHtml } from '../../utils/printUtils'

export const ReportDashboard: React.FC = () => {
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

  const handleExport = async (type: 'SALES' | 'FINANCIAL') => {
    try {
      setLoading(true)
      setError('')
      const startMs = new Date(startDate).setHours(0,0,0,0)
      const endMs = new Date(endDate).setHours(23,59,59,999)
      
      await window.api.document.exportReportCsv(type, startMs, endMs)
    } catch (err: any) {
      setError(err.message || 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const handlePrintOrPdf = async (type: 'SALES' | 'FINANCIAL', action: 'PRINT' | 'PDF') => {
    try {
      setLoading(true)
      setError('')
      
      const settings = await window.api.settings.getAll()
      const startMs = new Date(startDate).setHours(0,0,0,0)
      const endMs = new Date(endDate).setHours(23,59,59,999)
      const dateRangeStr = `${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`

      let html = ''

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
      }

      if (action === 'PRINT') {
        const printer = settings.a4_printer_name
        if (!printer) throw new Error('No A4 printer selected in Settings.')
        await window.api.print.printDocument(html, {
          deviceName: printer,
          landscape: false,
          pageSize: 'A4'
        })
      } else if (action === 'PDF') {
        // PDF Export is best supported using the system print dialog in main process if we want a save dialog
        // For now, since PrintService is headless, we can use a "Save as PDF" printer or we can trigger documentService.
        // Wait, documentService doesn't have a generic HTML to PDF yet, it only has exportInvoice/Prescription.
        // Let's just instruct users to select "Microsoft Print to PDF" or use the Print method.
        // Actually, let's just trigger print, and user can select Print to PDF.
        alert('To export as PDF, select your System PDF Printer (e.g., Microsoft Print to PDF) during printing, or ensure it is set as your default A4 printer.')
        const printer = settings.a4_printer_name
        if (!printer) throw new Error('No A4 printer selected in Settings.')
        await window.api.print.printDocument(html, {
          deviceName: printer,
          pageSize: 'A4'
        })
      }
    } catch (err: any) {
      setError(err.message || 'Print/Export failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Reports & Exports</h1>
      
      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}

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
      </div>
    </div>
  )
}
