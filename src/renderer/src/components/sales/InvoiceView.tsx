import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Sale } from '../../../../shared/types'
import { Button } from '../ui/Button'
import { ThermalReceipt } from './receipts/ThermalReceipt'
import { A4Invoice } from './receipts/A4Invoice'
import { renderToPrintHtml } from '../../utils/printUtils'

export const InvoiceView: React.FC = () => {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  
  const [sale, setSale] = useState<Sale | null>(null)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [printError, setPrintError] = useState('')
  const autoPrinted = useRef(false)
  
  const isNewSale = location.state?.isNewSale === true
  const isDuplicate = !isNewSale

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sales, stgs] = await Promise.all([
          window.api.sale.list(),
          window.api.settings.getAll()
        ])
        
        const found = sales.items.find((s: Sale) => s.invoice_number === invoiceNumber)
        if (found) {
          const detailedSale = await window.api.sale.get(found.id)
          setSale(detailedSale)
          setSettings(stgs)
        } else {
          throw new Error('Invoice not found')
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [invoiceNumber])

  const handlePrintThermal = async () => {
    if (!sale) return
    setExporting(true)
    try {
      const printer = settings.thermal_printer_name
      if (!printer) {
        alert('No thermal printer selected in Settings.')
        return
      }
      
      const html = renderToPrintHtml(
        <ThermalReceipt sale={sale} settings={settings} isDuplicate={isDuplicate} />
      )
      
      await window.api.print.printDocument(html, { 
        deviceName: printer,
        margins: { marginType: 'none' }
      })
      setPrintError('')
    } catch (e: any) {
      setPrintError(`Thermal Print failed: ${e.message}`)
    } finally {
      setExporting(false)
    }
  }

  const handleExportA4 = async (action: 'PRINT' | 'PDF') => {
    if (!sale) return
    setExporting(true)
    try {
      if (action === 'PRINT') {
        const printer = settings.a4_printer_name
        if (!printer) {
          alert('No A4 printer selected in Settings.')
          return
        }
        const isLandscape = settings.a4_orientation === 'landscape'
        const html = renderToPrintHtml(<A4Invoice sale={sale} settings={settings} />, 'A4 Invoice')
        
        await window.api.print.printDocument(html, { 
          deviceName: printer,
          landscape: isLandscape,
          pageSize: 'A4'
        })
      } else {
        // Fallback to existing DocumentService for PDF export
        await window.api.document.exportInvoice(sale.id, 'PDF')
      }
    } catch (e: any) {
      alert(`A4 Export failed: ${e.message}`)
    } finally {
      setExporting(false)
    }
  }

  // Auto Print Logic
  useEffect(() => {
    if (sale && settings.auto_print_receipt === 'true' && isNewSale && !autoPrinted.current) {
      autoPrinted.current = true
      handlePrintThermal()
    }
  }, [sale, settings, isNewSale])

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        handlePrintThermal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sale, settings, isDuplicate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-slate-400">
          <svg className="animate-spin h-8 w-8 mx-auto text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="font-medium">Loading invoice...</p>
        </div>
      </div>
    )
  }

  if (error || !sale) {
    return (
      <div className="max-w-3xl mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <svg className="h-12 w-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-bold text-red-800 mb-2">Invoice Not Found</h3>
          <p className="text-red-600 mb-6">{error || 'The requested invoice could not be found.'}</p>
          <Button onClick={() => navigate('/sales/pos')}>Return to POS</Button>
        </div>
      </div>
    )
  }

  const receiptWidth = settings.receipt_width || '80'

  return (
    <div className="font-sans max-w-5xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">
              {isNewSale ? 'Sale Completed' : 'Invoice Details'}
            </h1>
            <p className="text-slate-500 font-medium">Invoice: <span className="text-teal-600 font-bold">{sale.invoice_number}</span></p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap justify-end">
          <Button variant="outline" onClick={() => navigate('/sales/pos')}>
            New Sale
          </Button>
          <Button variant="outline" disabled={exporting} onClick={() => handleExportA4('PDF')}>
            Export A4 PDF
          </Button>
          <Button variant="outline" disabled={exporting} onClick={() => handleExportA4('PRINT')}>
            Print A4 Document
          </Button>
          <Button disabled={exporting} onClick={handlePrintThermal} className="bg-teal-600 hover:bg-teal-700 font-bold">
            {isNewSale ? 'Print Thermal Receipt (Ctrl+P)' : 'Print Duplicate (Ctrl+P)'}
          </Button>
        </div>
      </div>

      {printError && (
        <div className="mb-8 bg-red-50 border border-red-200 p-4 rounded-lg flex justify-between items-center">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800 font-medium">{printError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrintThermal} className="bg-white border-red-200 text-red-700 hover:bg-red-50">
            Retry Print
          </Button>
        </div>
      )}

      <div className="flex justify-center mt-8">
        <div className="bg-white p-6 rounded-xl shadow-xl border border-slate-200 inline-block">
          <h3 className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            Thermal Receipt Preview ({receiptWidth}mm)
          </h3>
          <div className="border border-slate-300 shadow-sm mx-auto overflow-hidden bg-white" style={{ width: receiptWidth === '58' ? '220px' : '302px' }}>
            {/* 
              We use standard CSS width (roughly 1mm ≈ 3.78px, 58mm ≈ 220px, 80mm ≈ 302px) 
              to provide an accurate preview of the thermal receipt.
            */}
            <ThermalReceipt sale={sale} settings={settings} isDuplicate={isDuplicate} />
          </div>
        </div>
      </div>
    </div>
  )
}
