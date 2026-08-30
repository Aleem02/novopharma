import { contextBridge, ipcRenderer } from 'electron'
import { PingPayload, PingResponse } from '../shared/types'

// Explicitly exposed IPC APIs. 
// No generic ipcRenderer.invoke or ipcRenderer.send is exposed.

async function secureInvoke(channel: string, ...args: any[]) {
  try {
    return await ipcRenderer.invoke(channel, ...args)
  } catch (err: any) {
    if (err.message.includes('UNAUTHENTICATED') || err.message.includes('NOT_ACTIVATED')) {
      // @ts-ignore
      window.dispatchEvent(new CustomEvent('novo:auth_error', { detail: err.message }))
    } else if (err.message.includes('NETWORK_UNAVAILABLE')) {
      // @ts-ignore
      window.dispatchEvent(new CustomEvent('novo:network_error', { detail: err.message }))
    }
    
    // Dispatch a generic API error event to render Toast notifications globally
    // @ts-ignore
    window.dispatchEvent(new CustomEvent('api-error', { detail: err.message || 'An error occurred' }))
    throw err
  }
}

const api = {
  ping: (payload: PingPayload): Promise<PingResponse> => {
    return secureInvoke('api:ping', payload)
  },
  auth: {
    signIn: (payload: { email: unknown, password: unknown }) => {
      return secureInvoke('api:auth:signIn', payload)
    },
    signOut: () => {
      return secureInvoke('api:auth:signOut')
    },
    isAuthenticated: () => {
      return secureInvoke('api:auth:isAuthenticated')
    }
  },
  activation: {
    activate: () => secureInvoke('api:activation:activate'),
    isActivated: () => secureInvoke('api:activation:isActivated'),
    registerKey: (activationCode: string) => secureInvoke('api:activation:registerKey', activationCode)
  },
  health: () => secureInvoke('api:health'),
  product: {
    list: (options?: any) => secureInvoke('api:product:list', options),
    get: (id: number) => secureInvoke('api:product:get', id),
    create: (payload: any) => secureInvoke('api:product:create', payload),
    update: (id: number, payload: any) => secureInvoke('api:product:update', { id, payload }),
    search: (query: string) => secureInvoke('api:product:search', query),
    setActive: (id: number, active: boolean) => secureInvoke('api:product:setActive', { id, active })
  },
  medicineDirectory: {
    search: (query: string) => secureInvoke('api:medicineDirectory:search', query),
    status: () => secureInvoke('api:medicineDirectory:status')
  },
  supplier: {
    list: (options?: any) => secureInvoke('api:supplier:list', options),
    get: (id: number) => secureInvoke('api:supplier:get', id),
    create: (payload: any) => secureInvoke('api:supplier:create', payload),
    update: (id: number, payload: any) => secureInvoke('api:supplier:update', { id, payload }),
    search: (query: string) => secureInvoke('api:supplier:search', query),
    setActive: (id: number, active: boolean) => secureInvoke('api:supplier:setActive', { id, active })
  },
  purchase: {
    list: (options?: any) => secureInvoke('api:purchase:list', options),
    get: (id: number) => secureInvoke('api:purchase:get', id),
    createDraft: (payload: any) => secureInvoke('api:purchase:createDraft', payload),
    updateDraft: (id: number, payload: any) => secureInvoke('api:purchase:updateDraft', { id, payload }),
    complete: (id: number) => secureInvoke('api:purchase:complete', id)
  },
  inventory: {
    list: (options?: any) => secureInvoke('api:inventory:list', options),
    getSummary: () => secureInvoke('api:inventory:getSummary'),
    getBatch: (productId: number, batchNumber: string) => secureInvoke('api:inventory:getBatch', { productId, batchNumber }),
    getBatchById: (id: number) => secureInvoke('api:inventory:getBatchById', id),
    updateBatch: (id: number, payload: any) => secureInvoke('api:inventory:updateBatch', { id, payload }),
    getActiveBatches: (productId: number) => secureInvoke('api:inventory:getActiveBatches', productId)
  },
  sale: {
    list: (options?: any) => secureInvoke('api:sale:list', options),
    get: (id: number) => secureInvoke('api:sale:get', id),
    create: (payload: any) => secureInvoke('api:sale:create', payload)
  },
  salesReturn: {
    list: () => secureInvoke('api:sales-return:list'),
    get: (id: number) => secureInvoke('api:sales-return:get', id),
    create: (payload: any) => secureInvoke('api:sales-return:create', payload)
  },
  purchaseReturn: {
    list: () => secureInvoke('api:purchase-return:list'),
    get: (id: number) => secureInvoke('api:purchase-return:get', id),
    create: (payload: any) => secureInvoke('api:purchase-return:create', payload)
  },
  stockAdjustment: {
    list: () => secureInvoke('api:stock-adjustment:list'),
    create: (payload: any) => secureInvoke('api:stock-adjustment:create', payload)
  },
  dashboard: {
    getSummary: () => secureInvoke('api:dashboard:getSummary')
  },
  financial: {
    getSummary: (period: string) => secureInvoke('api:financial:getSummary', period)
  },
  customer: {
    list: (options?: any) => secureInvoke('api:customer:list', options),
    get: (id: number) => secureInvoke('api:customer:get', id),
    create: (payload: any) => secureInvoke('api:customer:create', payload),
    update: (id: number, payload: any) => secureInvoke('api:customer:update', { id, payload }),
    history: (id: number, page?: number, pageSize?: number) => secureInvoke('api:customer:history', { id, page, pageSize })
  },
  prescription: {
    list: (customerId: number, page?: number, pageSize?: number) => secureInvoke('api:prescription:list', { customerId, page, pageSize }),
    get: (id: number) => secureInvoke('api:prescription:get', id),
    create: (payload: any) => secureInvoke('api:prescription:create', payload)
  },
  settings: {
    getAll: () => secureInvoke('api:settings:getAll'),
    update: (payload: any) => secureInvoke('api:settings:update', payload)
  },
  report: {
    sales: (start: number, end: number, page?: number, pageSize?: number) => secureInvoke('api:report:sales', { start, end, page, pageSize }),
    purchases: (start: number, end: number, page?: number, pageSize?: number) => secureInvoke('api:report:purchases', { start, end, page, pageSize }),
    salesReturns: (start: number, end: number, page?: number, pageSize?: number) => secureInvoke('api:report:salesReturns', { start, end, page, pageSize }),
    inventory: (page?: number, pageSize?: number, lowStockOnly?: boolean) => secureInvoke('api:report:inventory', { page, pageSize, lowStockOnly }),
    financials: (start: number, end: number) => secureInvoke('api:report:financials', { start, end }),
    inventoryReport: (start: number, end: number, page?: number, pageSize?: number) => secureInvoke('api:report:inventoryReport', { start, end, page, pageSize }),
    medicinesReport: (start: number, end: number, page?: number, pageSize?: number) => secureInvoke('api:report:medicinesReport', { start, end, page, pageSize })
  },
  document: {
    exportInvoice: (id: number, format: 'PDF' | 'PRINT') => secureInvoke('api:document:exportInvoice', { id, format }),
    exportPrescription: (id: number, format: 'PDF' | 'PRINT') => secureInvoke('api:document:exportPrescription', { id, format }),
    exportReportCsv: (type: 'SALES' | 'FINANCIAL' | 'INVENTORY' | 'PURCHASES' | 'MEDICINES', start: number, end: number) => secureInvoke('api:document:exportReportCsv', { type, start, end })
  },
  database: {
    selectBackupLocation: () => secureInvoke('api:database:selectBackupLocation'),
    runManualBackup: () => secureInvoke('api:database:runManualBackup'),
    openBackupFolder: (path: string) => secureInvoke('api:database:openBackupFolder', path),
    restore: () => secureInvoke('api:database:restore')
  },
  update: {
    check: () => secureInvoke('api:update:check'),
    download: () => secureInvoke('api:update:download'),
    apply: () => secureInvoke('api:update:apply'),
    onStateChange: (callback: (data: any) => void) => {
      ipcRenderer.on('api:update:onStateChange', (_event, data) => callback(data))
    },
    removeStateChangeListeners: () => {
      ipcRenderer.removeAllListeners('api:update:onStateChange')
    }
  },
  print: {
    getPrinters: () => secureInvoke('api:print:getPrinters'),
    printDocument: (html: string, options: any) => secureInvoke('api:print:printDocument', { html, options })
  }
}

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error('Failed to expose api to contextBridge', error)
}
