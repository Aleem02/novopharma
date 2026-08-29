import { BrowserWindow, PrinterInfo } from 'electron'
import { Logger } from '../infrastructure/logger'

export interface PrintOptions {
  silent?: boolean;
  deviceName?: string;
  copies?: number;
  margins?: { marginType: 'default' | 'none' | 'printableArea' | 'custom' };
  landscape?: boolean;
  pageSize?: 'A4' | 'A5' | 'Letter' | 'Legal' | 'Custom' | { width: number; height: number };
}

export class PrintingService {
  static async getPrinters(): Promise<PrinterInfo[]> {
    // If there's already a main window, we can use its webContents, but creating a temporary one is safe.
    const win = new BrowserWindow({ show: false })
    try {
      const printers = await win.webContents.getPrintersAsync()
      return printers
    } catch (error) {
      Logger.error('PrintingService', 'Failed to get printers', error)
      return []
    } finally {
      if (!win.isDestroyed()) {
        win.destroy()
      }
    }
  }

  static async printDocument(html: string, options: PrintOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      let isSettled = false
      const win = new BrowserWindow({ show: false })
      
      const cleanup = () => {
        if (!win.isDestroyed()) {
          win.destroy()
        }
      }

      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      
      win.webContents.on('did-finish-load', () => {
        if (isSettled) return
        
        const printOpts: Electron.WebContentsPrintOptions = {
          silent: options.silent ?? true,
          printBackground: true,
          deviceName: options.deviceName,
          copies: options.copies ?? 1,
          margins: options.margins ?? { marginType: 'printableArea' },
          landscape: options.landscape ?? false,
          pageSize: options.pageSize as any
        }

        win.webContents.print(printOpts, (success, failureReason) => {
          if (isSettled) return
          isSettled = true
          cleanup()
          
          if (!success && failureReason !== 'cancelled') {
            Logger.error('PrintingService', `Print failed: ${failureReason}`)
            reject(new Error(`Print failed: ${failureReason}`))
          } else {
            resolve()
          }
        })
      })
      
      win.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
        if (isSettled) return
        isSettled = true
        cleanup()
        
        Logger.error('PrintingService', `Failed to load HTML for printing: ${errorDescription}`)
        reject(new Error(`Failed to load HTML for printing: ${errorDescription}`))
      })
    })
  }
}
