import { renderToString } from 'react-dom/server'
import React from 'react'

export const renderToPrintHtml = (component: React.ReactElement, title: string = 'Print Document') => {
  const htmlContent = renderToString(component)
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <meta charset="utf-8">
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `
}
