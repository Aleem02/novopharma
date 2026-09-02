import { PingResponse, CreateProductPayload, UpdateProductPayload, MedicineDirectoryRecord } from '../../shared/types'

declare module '*.png' {
  const value: string;
  export default value;
}

declare module 'lucide-react';

declare global {
  interface Window {
    api: {
      ping: (payload: { message: string; timestamp: number }) => Promise<PingResponse>
      auth: {
        signIn: (payload: { email: unknown; password: unknown }) => Promise<any>
        signOut: () => Promise<void>
        isAuthenticated: () => Promise<boolean>
      }
      health: () => Promise<boolean>
      activation: {
        registerKey: (activationCode: string) => Promise<{ status: string, message?: string }>
        activate: () => Promise<{ status: string, message?: string, installationId?: string }>
        isActivated: () => Promise<boolean>
        syncStatus: () => Promise<void>
      }
      product: {
        list: (options?: any) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').Product>>
        get: (id: number) => Promise<import('../../shared/types').Product>
        create: (payload: import('../../shared/types').CreateProductPayload) => Promise<import('../../shared/types').Product>
        update: (id: number, payload: import('../../shared/types').UpdateProductPayload) => Promise<import('../../shared/types').Product>
        search: (query: string) => Promise<import('../../shared/types').Product[]>
        setActive: (id: number, active: boolean) => Promise<import('../../shared/types').Product>
      }
      medicineDirectory: {
        search: (query: string) => Promise<MedicineDirectoryRecord[]>
        status: () => Promise<{ state: string; error: string | null }>
      }
      supplier: {
        list: (options?: any) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').Supplier>>
        get: (id: number) => Promise<import('../../shared/types').Supplier>
        create: (payload: import('../../shared/types').CreateSupplierPayload) => Promise<import('../../shared/types').Supplier>
        update: (id: number, payload: import('../../shared/types').UpdateSupplierPayload) => Promise<import('../../shared/types').Supplier>
        search: (query: string) => Promise<import('../../shared/types').Supplier[]>
        setActive: (id: number, active: boolean) => Promise<import('../../shared/types').Supplier>
      }
      purchase: {
        list: (options?: any) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').Purchase>>
        get: (id: number) => Promise<import('../../shared/types').Purchase>
        createDraft: (payload: import('../../shared/types').CreatePurchasePayload) => Promise<import('../../shared/types').Purchase>
        updateDraft: (id: number, payload: import('../../shared/types').UpdatePurchasePayload) => Promise<import('../../shared/types').Purchase>
        complete: (id: number) => Promise<import('../../shared/types').Purchase>
      }
      inventory: {
        getSummary: () => Promise<import('../../shared/types').DashboardSummary>
        list: (options?: any) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').InventoryBatch>>
        getBatch: (productId: number, batchNumber: string) => Promise<import('../../shared/types').InventoryBatch | undefined>
        getBatchById: (id: number) => Promise<import('../../shared/types').InventoryBatch | undefined>
        updateBatch: (id: number, payload: Partial<import('../../shared/types').InventoryBatch>) => Promise<void>
        getActiveBatches: (productId: number) => Promise<import('../../shared/types').InventoryBatch[]>
      }
      sale: {
        list: (options?: any) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').Sale>>
        get: (id: number) => Promise<import('../../shared/types').Sale>
        create: (payload: import('../../shared/types').CreateSalePayload) => Promise<import('../../shared/types').Sale>
      }
      salesReturn: {
        list: () => Promise<import('../../shared/types').SalesReturn[]>
        get: (id: number) => Promise<import('../../shared/types').SalesReturn>
        create: (payload: import('../../shared/types').CreateSalesReturnPayload) => Promise<import('../../shared/types').SalesReturn>
      }
      purchaseReturn: {
        list: () => Promise<import('../../shared/types').PurchaseReturn[]>
        get: (id: number) => Promise<import('../../shared/types').PurchaseReturn>
        create: (payload: import('../../shared/types').CreatePurchaseReturnPayload) => Promise<import('../../shared/types').PurchaseReturn>
      }
      stockAdjustment: {
        list: () => Promise<import('../../shared/types').StockAdjustment[]>
        create: (payload: import('../../shared/types').CreateStockAdjustmentPayload) => Promise<import('../../shared/types').StockAdjustment>
      }
      dashboard: {
        getSummary: () => Promise<import('../../shared/types').DashboardSummary>
      }
      financial: {
        getSummary: (period: 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'MONTH') => Promise<import('../../shared/types').FinancialSummary>
      }
      customer: {
        list: (options?: any) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').Customer>>
        get: (id: number) => Promise<import('../../shared/types').Customer>
        create: (payload: import('../../shared/types').CreateCustomerPayload) => Promise<import('../../shared/types').Customer>
        update: (id: number, payload: import('../../shared/types').UpdateCustomerPayload) => Promise<import('../../shared/types').Customer>
        history: (id: number, page?: number, pageSize?: number) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').Sale>>
      }
      prescription: {
        list: (customerId: number, page?: number, pageSize?: number) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').Prescription>>
        get: (id: number) => Promise<import('../../shared/types').Prescription>
        create: (payload: import('../../shared/types').CreatePrescriptionPayload) => Promise<import('../../shared/types').Prescription>
      }
      settings: {
        getAll: () => Promise<Record<string, string>>
        update: (payload: Record<string, string>) => Promise<void>
        getVersion: () => Promise<{ version: string; build: string }>
      }
      report: {
        sales: (start: number, end: number, page?: number, pageSize?: number) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').Sale>>
        purchases: (start: number, end: number, page?: number, pageSize?: number) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').Purchase>>
        salesReturns: (start: number, end: number, page?: number, pageSize?: number) => Promise<import('../../shared/types').PaginatedResult<import('../../shared/types').SalesReturn>>
        inventory: (page?: number, pageSize?: number, lowStockOnly?: boolean) => Promise<import('../../shared/types').PaginatedResult<any>>
        financials: (start: number, end: number) => Promise<import('../../shared/types').FinancialSummary>
        inventoryReport: (start: number, end: number, page?: number, pageSize?: number) => Promise<import('../../shared/types').PaginatedResult<any>>
        medicinesReport: (start: number, end: number, page?: number, pageSize?: number) => Promise<import('../../shared/types').PaginatedResult<any>>
      }
      document: {
        exportInvoice: (id: number, format: 'PDF' | 'PRINT') => Promise<void>
        exportPrescription: (id: number, format: 'PDF' | 'PRINT') => Promise<void>
        exportReportCsv: (type: 'SALES' | 'FINANCIAL' | 'INVENTORY' | 'PURCHASES' | 'MEDICINES', start: number, end: number) => Promise<void>
      }
      database: {
        selectBackupLocation: () => Promise<string | null>
        runManualBackup: () => Promise<boolean>
        openBackupFolder: (path: string) => Promise<boolean>
        restore: () => Promise<boolean>
      }
      update: {
        check: () => Promise<void>
        download: () => Promise<void>
        apply: () => Promise<boolean>
        onStateChange: (callback: (data: any) => void) => void
        removeStateChangeListeners: () => void
      }
      print: {
        getPrinters: () => Promise<any[]>
        printDocument: (html: string, options: any) => Promise<void>
      }
    }
  }
}
