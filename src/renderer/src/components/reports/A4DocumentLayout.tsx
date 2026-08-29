import React from 'react'

interface A4DocumentLayoutProps {
  settings: Record<string, string>
  title: string
  subtitle?: string
  columns: string[]
  rows: (string | number | React.ReactNode)[][]
  orientation?: 'portrait' | 'landscape'
}

export const A4DocumentLayout: React.FC<A4DocumentLayoutProps> = ({ 
  settings, title, subtitle, columns, rows, orientation = 'portrait' 
}) => {
  const styles = `
    @page { margin: 15mm; size: A4 ${orientation}; }
    body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; font-size: 12px; }
    h1 { text-align: center; color: #1a56db; margin: 0 0 5px 0; font-size: 24px; }
    .subtitle { text-align: center; color: #666; margin-bottom: 20px; font-size: 14px; }
    .header { text-align: left; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    .pharmacy-info h2 { margin: 0; font-size: 18px; }
    .pharmacy-info p { margin: 2px 0; font-size: 12px; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    tr { page-break-inside: avoid; }
    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
    th { background-color: #f9fafb; font-weight: bold; }
    .footer-note { text-align: center; font-size: 10px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; }
  `

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }}></style>
      <div>
        <div className="header">
          <div className="pharmacy-info">
            <h2>{settings.pharmacy_name || 'NovoPharma'}</h2>
            {settings.address && <p>{settings.address}</p>}
            {settings.phone && <p>Phone: {settings.phone}</p>}
            {settings.gst_number && <p>GSTIN: {settings.gst_number}</p>}
          </div>
        </div>

        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}

        <table>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="footer-note">
          Printed on {new Date().toLocaleString()} - NovoPharma Pharmacy System
        </div>
      </div>
    </>
  )
}
