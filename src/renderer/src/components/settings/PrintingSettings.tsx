import React, { useState, useEffect } from 'react'
import { Select } from '../ui/Select'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { ThermalReceipt } from '../sales/receipts/ThermalReceipt'
import { A4DocumentLayout } from '../reports/A4DocumentLayout'
import { renderToPrintHtml } from '../../utils/printUtils'

interface PrintingSettingsProps {
  settings: Record<string, string>
  handleChange: (key: string, value: string) => void
}

export const PrintingSettings: React.FC<PrintingSettingsProps> = ({ settings, handleChange }) => {
  const [printers, setPrinters] = useState<any[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)

  useEffect(() => {
    loadPrinters()
  }, [])

  const loadPrinters = async () => {
    setLoadingPrinters(true)
    try {
      const availablePrinters = await window.api.print.getPrinters()
      setPrinters(availablePrinters)
    } catch (error) {
      console.error('Failed to load printers', error)
    } finally {
      setLoadingPrinters(false)
    }
  }

  const handleTestThermalPrint = async () => {
    try {
      const printer = settings.thermal_printer_name
      if (!printer) return alert('Please select a thermal printer first and save settings.')
      
      const testSale: any = {
        invoice_number: 'TEST-0001',
        sale_date: new Date().toISOString(),
        payment_method: 'CASH',
        customer: { name: 'Test Customer', phone: '1234567890' },
        subtotal: 50000,
        tax_amount: 5000,
        discount_amount: 0,
        total_amount: 55000,
        items: [
          { medicine_name: 'Amoxicillin 500mg', batch_number: 'B101', quantity: 10, mrp: 500, selling_price: 500, tax_rate: 12, line_total: 5000 },
          { medicine_name: 'Paracetamol 500mg (Long Name Test Example to see wrapping)', batch_number: 'B102', quantity: 20, mrp: 200, selling_price: 200, tax_rate: 12, line_total: 4000 }
        ]
      }
      
      const html = renderToPrintHtml(
        <ThermalReceipt sale={testSale} settings={settings} />
      )
      
      await window.api.print.printDocument(html, { 
        deviceName: printer,
        margins: { marginType: 'none' }
      })
      alert('Test thermal print sent successfully!')
    } catch (e: any) {
      alert(`Test print failed: ${e.message}`)
    }
  }

  const handleTestA4Print = async () => {
    try {
      const printer = settings.a4_printer_name
      if (!printer) return alert('Please select an A4 printer first and save settings.')
      
      const isLandscape = settings.a4_orientation === 'landscape'
      
      const columns = ['Medicine', 'Batch', 'Qty', 'Rate', 'Tax %', 'Total']
      const rows = [
        ['Amoxicillin 500mg', 'B101', '10', '₹5.00', '12%', '₹50.00'],
        ['Paracetamol 500mg', 'B102', '20', '₹2.00', '12%', '₹40.00'],
        ['Azithromycin 250mg', 'B103', '5', '₹15.00', '12%', '₹75.00'],
      ]
      
      const html = renderToPrintHtml(
        <A4DocumentLayout
          settings={settings}
          title="A4 Test Print Document"
          subtitle={`Generated on ${new Date().toLocaleString()}`}
          columns={columns}
          rows={rows}
          orientation={isLandscape ? 'landscape' : 'portrait'}
        />, 
        'A4 Test Print'
      )
      
      await window.api.print.printDocument(html, { 
        deviceName: printer, 
        landscape: isLandscape,
        pageSize: 'A4'
      })
      alert('Test A4 print sent successfully!')
    } catch (e: any) {
      alert(`Test print failed: ${e.message}`)
    }
  }

  return (
    <div className="space-y-8">
      {/* THERMAL PRINTER SETTINGS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center justify-between">
          <span>Thermal Receipt Printing (POS)</span>
          <Button variant="outline" size="sm" onClick={loadPrinters} disabled={loadingPrinters}>
            {loadingPrinters ? 'Refreshing...' : 'Refresh Printers'}
          </Button>
        </h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Default Thermal Printer"
              value={settings.thermal_printer_name || ''}
              onChange={e => handleChange('thermal_printer_name', e.target.value)}
            >
              <option value="">Select a printer...</option>
              {printers.map(p => (
                <option key={p.name} value={p.name}>{p.name} {p.isDefault ? '(Default)' : ''}</option>
              ))}
            </Select>

            <Select
              label="Receipt Width"
              value={settings.receipt_width || '80'}
              onChange={e => handleChange('receipt_width', e.target.value)}
            >
              <option value="58">58 mm</option>
              <option value="80">80 mm</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Auto Print After Sale"
              value={settings.auto_print_receipt || 'false'}
              onChange={e => handleChange('auto_print_receipt', e.target.value)}
            >
              <option value="true">ON - Print automatically</option>
              <option value="false">OFF - Require manual print</option>
            </Select>

            <Input
              label="Default Copies"
              type="number"
              min="1"
              value={settings.thermal_copies || '1'}
              onChange={e => handleChange('thermal_copies', e.target.value)} placeholder="Enter default  copies..."
            />
          </div>

          <div className="pt-2">
            <Button type="button" variant="outline" onClick={handleTestThermalPrint}>
              Test Thermal Print
            </Button>
          </div>
        </div>
      </div>

      {/* A4 PRINTER SETTINGS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">A4 / Report Printing</h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Default A4 Printer"
              value={settings.a4_printer_name || ''}
              onChange={e => handleChange('a4_printer_name', e.target.value)}
            >
              <option value="">Select a printer...</option>
              {printers.map(p => (
                <option key={p.name} value={p.name}>{p.name} {p.isDefault ? '(Default)' : ''}</option>
              ))}
            </Select>

            <Select
              label="Default Orientation"
              value={settings.a4_orientation || 'portrait'}
              onChange={e => handleChange('a4_orientation', e.target.value)}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Default Copies"
              type="number"
              min="1"
              value={settings.a4_copies || '1'}
              onChange={e => handleChange('a4_copies', e.target.value)} placeholder="Enter default  copies..."
            />
          </div>

          <div className="pt-2">
            <Button type="button" variant="outline" onClick={handleTestA4Print}>
              Test A4 Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
