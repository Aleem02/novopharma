import React from 'react'
import { Sale } from '../../../../../shared/types'

interface A4InvoiceProps {
  sale: Sale
  settings: Record<string, string>
}

export const A4Invoice: React.FC<A4InvoiceProps> = ({ sale, settings }) => {
  const styles = `
    @page { margin: 15mm; size: A4 portrait; }
    .a4-body {
      font-family: Arial, sans-serif;
      color: #333;
      margin: 0 auto;
      padding: 0;
      background: white;
    }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    h1 { text-align: center; color: #1a56db; margin-top: 0; }
    .pharmacy-info h2 { margin: 0; font-size: 20px; }
    .pharmacy-info p { margin: 2px 0; font-size: 14px; }
    .invoice-details h3 { margin: 0; }
    .invoice-details p { margin: 2px 0; font-size: 14px; text-align: right; }
    .customer-info { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }
    th { background-color: #f9fafb; }
    .totals { margin-top: 20px; float: right; width: 300px; }
    .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
    .totals .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
    .clear { clear: both; }
  `

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <div className="a4-body">
        <h1>TAX INVOICE</h1>
        <div className="header">
          <div className="pharmacy-info">
            <h2>{settings.pharmacy_name || 'NovoPharma'}</h2>
            {settings.address && <p>{settings.address}</p>}
            {settings.phone && <p>Phone: {settings.phone}</p>}
            {settings.gst_number && <p>GSTIN: {settings.gst_number}</p>}
          </div>
          <div className="invoice-details" style={{ textAlign: 'right' }}>
            <h3>Invoice #: {sale.invoice_number}</h3>
            <p>Date: {new Date(sale.sale_date).toLocaleString()}</p>
            <p>Status: {sale.status}</p>
          </div>
        </div>

        {sale.customer && (
          <div className="customer-info">
            <strong>Billed To:</strong> {sale.customer.name} (Ph: {sale.customer.phone})
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Discount</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items?.map((item, idx) => (
              <tr key={idx}>
                <td>
                  {item.product?.name || 'Unknown'}
                  {item.is_price_overridden ? ' (Price Overridden)' : ''}
                </td>
                <td>{item.batches && item.batches.length > 1 ? 'MULTI' : (item.batches?.[0]?.batch_number || item.batch_number || 'N/A')}</td>
                <td>{item.entered_quantity} {item.sale_unit}</td>
                <td>₹{(item.selling_price / 100).toFixed(2)}</td>
                <td>{item.discount_amount > 0 ? `₹${(item.discount_amount / 100).toFixed(2)}` : '-'}</td>
                <td>₹{(item.line_total / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="totals">
          <div><span>Subtotal:</span> <span>₹{(sale.subtotal / 100).toFixed(2)}</span></div>
          {sale.discount_amount > 0 && (
            <div><span>Total Discount:</span> <span>-₹{(sale.discount_amount / 100).toFixed(2)}</span></div>
          )}
          <div><span>Total Tax:</span> <span>₹{(sale.tax_amount / 100).toFixed(2)}</span></div>
          <div className="grand-total"><span>Grand Total:</span> <span>₹{(sale.total_amount / 100).toFixed(2)}</span></div>
        </div>
        
        <div className="clear"></div>
        
        {sale.payments && sale.payments.length > 0 && (
          <div style={{ marginTop: '30px' }}>
            <h3>Payment Details</h3>
            <table style={{ width: '300px' }}>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {sale.payments.map((p, idx) => (
                  <tr key={idx}>
                    <td>{p.payment_method}</td>
                    <td>₹{(p.amount / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sale.received_amount !== undefined && sale.received_amount > 0 && (
              <p style={{ marginTop: '10px' }}>Received: ₹{(sale.received_amount / 100).toFixed(2)} | Change: ₹{((sale.change_amount || 0) / 100).toFixed(2)}</p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
