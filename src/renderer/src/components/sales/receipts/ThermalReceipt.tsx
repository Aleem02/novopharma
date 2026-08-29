import React from 'react'
import { Sale } from '../../../../../shared/types'

interface ThermalReceiptProps {
  sale: Sale
  settings: Record<string, string>
  widthOverride?: '58' | '80'
  isDuplicate?: boolean
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ sale, settings, widthOverride, isDuplicate }) => {
  const width = widthOverride || settings.receipt_width || '80'
  const is58 = width === '58'

  // CSS explicitly designed for thermal printers
  const styles = `
    @page { margin: 0; }
    .thermal-body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${is58 ? '10px' : '12px'};
      line-height: 1.2;
      color: #000;
      margin: 0 auto;
      padding: 0;
      width: ${is58 ? '58mm' : '80mm'};
      word-break: break-word;
      overflow-wrap: break-word;
      background: white;
    }
    .receipt-container {
      padding: ${is58 ? '2mm' : '4mm'};
      box-sizing: border-box;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    
    .divider {
      border-bottom: 1px dashed #000;
      margin: 4px 0;
    }
    .solid-divider {
      border-bottom: 1px solid #000;
      margin: 4px 0;
    }
    
    .header h2 {
      margin: 0 0 2px 0;
      font-size: ${is58 ? '14px' : '18px'};
    }
    .header p { margin: 1px 0; }
    
    .meta-info { margin: 6px 0; }
    .meta-info table { width: 100%; border-collapse: collapse; }
    .meta-info td { padding: 1px 0; vertical-align: top; }
    
    .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .items-table th, .items-table td {
      text-align: left;
      padding: 2px 1px;
      vertical-align: top;
    }
    .items-table th { border-bottom: 1px dashed #000; }
    
    .totals { margin-top: 6px; }
    .totals table { width: 100%; border-collapse: collapse; }
    .totals td { padding: 1px 0; }
    .grand-total { font-size: ${is58 ? '12px' : '14px'}; font-weight: bold; }
    
    .footer { margin-top: 10px; margin-bottom: 10px; font-size: ${is58 ? '9px' : '11px'}; }
  `

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <div className="thermal-body">
        <div className="receipt-container">
          <div className="header text-center">
          <h2 className="bold">{settings.pharmacy_name || 'NovoPharma'}</h2>
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && <p>Ph: {settings.phone}</p>}
          {settings.gst_number && <p>GSTIN: {settings.gst_number}</p>}
          <p className="bold" style={{ marginTop: '4px' }}>TAX INVOICE / CASH MEMO</p>
          {isDuplicate && <p className="bold" style={{ marginTop: '2px' }}>** DUPLICATE **</p>}
        </div>
        
        <div className="divider"></div>
        
        <div className="meta-info">
          <table>
            <tbody>
              <tr>
                <td>Inv:</td>
                <td className="bold">{sale.invoice_number}</td>
              </tr>
              <tr>
                <td>Date:</td>
                <td>{new Date(sale.sale_date).toLocaleString()}</td>
              </tr>
              {sale.customer && (
                <tr>
                  <td>Cust:</td>
                  <td>{sale.customer.name} {sale.customer.phone ? `(${sale.customer.phone})` : ''}</td>
                </tr>
              )}
              {sale.prescription?.doctor_name && (
                <tr>
                  <td>Dr:</td>
                  <td>{sale.prescription.doctor_name}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="divider"></div>
        
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Item</th>
              <th style={{ width: '20%' }}>Qty</th>
              <th className="text-right" style={{ width: '20%' }}>Rate</th>
              <th className="text-right" style={{ width: '20%' }}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item, idx) => (
              <React.Fragment key={idx}>
                <tr>
                  <td colSpan={4} className="bold" style={{ paddingTop: '2px' }}>
                    {item.product?.name || 'Unknown'} {item.is_price_overridden ? '*' : ''}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontSize: is58 ? '8px' : '10px' }}>
                    B:{item.batches && item.batches.length > 1 ? 'MULTI' : (item.batches?.[0]?.batch_number || item.batch_number || 'N/A')}
                  </td>
                  <td>{item.entered_quantity} {item.sale_unit}</td>
                  <td className="text-right">{(item.selling_price / 100).toFixed(2)}</td>
                  <td className="text-right">{(item.line_total / 100).toFixed(2)}</td>
                </tr>
                {item.discount_amount > 0 && (
                  <tr>
                    <td colSpan={4} className="text-right" style={{ fontSize: is58 ? '8px' : '10px' }}>
                      Incl. Disc: -{(item.discount_amount / 100).toFixed(2)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        
        <div className="solid-divider"></div>
        
        <div className="totals">
          <table>
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="text-right">{(sale.subtotal / 100).toFixed(2)}</td>
              </tr>
              {sale.discount_amount > 0 && (
                <tr>
                  <td>Total Disc</td>
                  <td className="text-right">-{(sale.discount_amount / 100).toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td>Tax</td>
                <td className="text-right">{(sale.tax_amount / 100).toFixed(2)}</td>
              </tr>
              <tr><td colSpan={2}><div className="divider"></div></td></tr>
              <tr className="grand-total">
                <td>GRAND TOTAL</td>
                <td className="text-right">{(sale.total_amount / 100).toFixed(2)}</td>
              </tr>
              <tr><td colSpan={2}><div className="solid-divider"></div></td></tr>
              {sale.payments && sale.payments.length > 0 ? (
                sale.payments.map((p, idx) => (
                  <tr key={idx}>
                    <td className="bold">PAY: {p.payment_method}</td>
                    <td className="text-right bold">{(p.amount / 100).toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="bold">PAYMENT: {sale.payment_method}</td>
                  <td className="text-right bold">{(sale.total_amount / 100).toFixed(2)}</td>
                </tr>
              )}
              {sale.received_amount !== undefined && sale.received_amount > 0 && (
                 <tr>
                    <td style={{ fontSize: is58 ? '9px' : '11px', paddingTop: '4px' }}>Rcvd: {(sale.received_amount / 100).toFixed(2)}</td>
                    <td className="text-right" style={{ fontSize: is58 ? '9px' : '11px', paddingTop: '4px' }}>Chg: {((sale.change_amount || 0) / 100).toFixed(2)}</td>
                 </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="divider"></div>
        
        <div className="footer text-center">
          <p>Thank you for your visit!</p>
          <p>Goods once sold cannot be taken back or exchanged.</p>
        </div>
      </div>
      </div>
    </>
  )
}
