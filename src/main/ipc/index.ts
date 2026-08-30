import { ipcMain, IpcMainInvokeEvent, app, dialog, BrowserWindow, shell } from 'electron'
import * as crypto from 'crypto'
import { Logger } from '../infrastructure/logger'
import { FirebaseAuthService } from '../services/firebaseAuth'
import { ActivationService } from '../services/activationService'
import { ApiClient } from '../services/apiClient'
import { InstallationRegistrationService } from '../services/installationRegistrationService'
import { AuthStatusResponse, PingResponse, ActivationResult, isValidPingPayload } from '../../shared/types'
import { ProductService } from '../services/productService'
import { enforceSecureIpc } from './securityGuard'
import { SupplierService } from '../services/supplierService'
import { PurchaseService } from '../services/purchaseService'
import { InventoryService } from '../services/inventoryService'
import { SaleService } from '../services/saleService'
import { SalesReturnService } from '../services/salesReturnService'
import { PurchaseReturnService } from '../services/purchaseReturnService'
import { StockAdjustmentService } from '../services/stockAdjustmentService'
import { DashboardService } from '../services/dashboardService'
import { FinancialService } from '../services/financialService'
import { InstallationIdentityService } from '../security/installationIdentity'
import { CustomerService } from '../services/customerService'
import { PrescriptionService } from '../services/prescriptionService'
import { SettingService } from '../services/settingService'
import { ReportService } from '../services/reportService'
import { DocumentService } from '../services/documentService'
import { BackupService, BackupManager } from '../services/backupService'
import { UpdateService } from '../services/updateService'
import { PrintingService } from '../services/printingService'
import { MedicineDirectoryService } from '../services/medicineDirectoryService'

export function setupIpcHandlers() {
  ipcMain.handle('api:ping', async (event: IpcMainInvokeEvent, payload: unknown): Promise<PingResponse> => {
    // A. Validate Sender
    const url = event.senderFrame?.url
    let isTrusted = false

    if (url) {
      if (app.isPackaged) {
        isTrusted = url.startsWith('file://') && url.includes('renderer/index.html')
      } else {
        isTrusted = url.startsWith(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
      }
    }

    if (!isTrusted) {
      Logger.error('IPC', 'Unauthorized sender attempted IPC call', { url })
      throw new Error('Unauthorized sender')
    }

    // B. Validate Payload Schema
    if (!isValidPingPayload(payload)) {
      Logger.error('IPC', 'Invalid PingPayload schema received')
      throw new Error('Invalid IPC payload schema')
    }

    Logger.info('IPC', 'Ping received', payload)

    return {
      success: true,
      reply: `Pong! Received ${payload.message}`
    }
  })

  // Auth Handlers
  ipcMain.handle('api:auth:signIn', async (event: IpcMainInvokeEvent, payload: unknown): Promise<AuthStatusResponse> => {
    // Validate Sender
    const url = event.senderFrame?.url
    let isTrusted = false
    if (url) {
      if (app.isPackaged) {
        isTrusted = url.startsWith('file://') && url.includes('renderer/index.html')
      } else {
        isTrusted = url.startsWith(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
      }
    }
    if (!isTrusted) {
      Logger.error('IPC', 'Unauthorized sender attempted auth call', { url })
      throw new Error('Unauthorized sender')
    }

    if (typeof payload !== 'object' || payload === null) {
      return { status: 'ERROR', message: 'Invalid payload.' }
    }
    const { email, password } = payload as Record<string, unknown>
    return await FirebaseAuthService.signIn(email, password)
  })

  ipcMain.handle('api:auth:signOut', async (event: IpcMainInvokeEvent): Promise<void> => {
    // Validate Sender
    const url = event.senderFrame?.url
    let isTrusted = false
    if (url) {
      if (app.isPackaged) {
        isTrusted = url.startsWith('file://') && url.includes('renderer/index.html')
      } else {
        isTrusted = url.startsWith(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
      }
    }
    if (!isTrusted) {
      Logger.error('IPC', 'Unauthorized sender attempted auth call', { url })
      throw new Error('Unauthorized sender')
    }

    await FirebaseAuthService.signOut()
  })

  ipcMain.handle('api:auth:isAuthenticated', async (): Promise<boolean> => {
    return await FirebaseAuthService.isAuthenticated()
  })

  // Activation Handlers
  ipcMain.handle('api:activation:activate', async (event: IpcMainInvokeEvent): Promise<ActivationResult> => {
    // Validate Sender
    const url = event.senderFrame?.url
    let isTrusted = false
    if (url) {
      if (app.isPackaged) {
        isTrusted = url.startsWith('file://') && url.includes('renderer/index.html')
      } else {
        isTrusted = url.startsWith(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
      }
    }
    if (!isTrusted) {
      Logger.error('IPC', 'Unauthorized sender attempted activation call', { url })
      throw new Error('Unauthorized sender')
    }

    return await ActivationService.activateInstallation()
  })

  ipcMain.handle('api:activation:isActivated', async (event: IpcMainInvokeEvent): Promise<boolean> => {
    // Validate Sender
    const url = event.senderFrame?.url
    let isTrusted = false
    if (url) {
      if (app.isPackaged) {
        isTrusted = url.startsWith('file://') && url.includes('renderer/index.html')
      } else {
        isTrusted = url.startsWith(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
      }
    }
    if (!isTrusted) {
      Logger.error('IPC', 'Unauthorized sender attempted activation call', { url })
      throw new Error('Unauthorized sender')
    }

    return InstallationIdentityService.isActivated()
  })


  ipcMain.handle('api:activation:registerKey', async (event: IpcMainInvokeEvent, activationCode: unknown): Promise<any> => {
    // Validate Sender
    const url = event.senderFrame?.url
    let isTrusted = false
    if (url) {
      if (app.isPackaged) {
        isTrusted = url.startsWith('file://') && url.includes('renderer/index.html')
      } else {
        isTrusted = url.startsWith(process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173')
      }
    }
    if (!isTrusted) {
      Logger.error('IPC', 'Unauthorized sender attempted registerKey call', { url })
      throw new Error('Unauthorized sender')
    }

    return await InstallationRegistrationService.registerKey(activationCode)
  })

  // Health Check
  ipcMain.handle('api:health', async (event: IpcMainInvokeEvent): Promise<boolean> => {
    await enforceSecureIpc(event)
    const result = await ApiClient.testHealth()
    return result.healthy
  })

  // Product Master
  ipcMain.handle('api:product:list', async (event: IpcMainInvokeEvent, options: any = {}) => {
    await enforceSecureIpc(event)
    
    // Validate and whitelist pagination options
    const safeOptions: any = {
      page: typeof options?.page === 'number' && options.page > 0 ? options.page : 1,
      pageSize: typeof options?.pageSize === 'number' && options.pageSize > 0 ? options.pageSize : 25,
    }
    
    if (typeof options?.search === 'string' && options.search.trim().length > 0) {
      safeOptions.search = options.search.trim()
    }
    
    if (typeof options?.filter === 'string' && ['ALL', 'ACTIVE', 'INACTIVE', 'PRESCRIPTION'].includes(options.filter)) {
      safeOptions.filter = options.filter
    }
    
    if (typeof options?.sortBy === 'string' && ['name', 'barcode', 'selling_price', 'quantity'].includes(options.sortBy)) {
      safeOptions.sortBy = options.sortBy
      safeOptions.sortDirection = options?.sortDirection === 'DESC' ? 'DESC' : 'ASC'
    }

    // If no pagination options passed, the frontend is probably legacy code, but we should enforce pagination anyway
    return ProductService.getPaginatedProducts(safeOptions)
  })

  ipcMain.handle('api:product:get', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event)
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return ProductService.getProduct(id)
  })

  ipcMain.handle('api:product:create', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    return ProductService.createProduct(payload as any)
  })

  ipcMain.handle('api:product:update', async (event: IpcMainInvokeEvent, { id, payload }: { id: number, payload: unknown }) => {
    await enforceSecureIpc(event, { isMutation: true })
    return ProductService.updateProduct(id, payload as any)
  })

  ipcMain.handle('api:product:search', async (event: IpcMainInvokeEvent, query: unknown) => {
    await enforceSecureIpc(event)
    if (typeof query !== 'string') throw new Error('Invalid query')
    return ProductService.searchProducts(query)
  })

  ipcMain.handle('api:product:setActive', async (event: IpcMainInvokeEvent, { id, active }: { id: number, active: boolean }) => {
    await enforceSecureIpc(event, { isMutation: true })
    return ProductService.setProductActive(id, active)
  })

  ipcMain.handle('api:medicineDirectory:search', async (event: IpcMainInvokeEvent, query: unknown) => {
    await enforceSecureIpc(event)
    if (typeof query !== 'string') throw new Error('Invalid query')
    const trimmedQuery = query.trim()
    return MedicineDirectoryService.search(trimmedQuery)
  })

  ipcMain.handle('api:medicineDirectory:status', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    return MedicineDirectoryService.getStatus()
  })

  // Supplier Management
  ipcMain.handle('api:supplier:list', async (event: IpcMainInvokeEvent, options: any = {}) => {
    await enforceSecureIpc(event)
    
    // Validate and whitelist pagination options
    const safeOptions: any = {
      page: typeof options?.page === 'number' && options.page > 0 ? options.page : 1,
      pageSize: typeof options?.pageSize === 'number' && options.pageSize > 0 ? options.pageSize : 25,
    }
    
    if (typeof options?.search === 'string' && options.search.trim().length > 0) {
      safeOptions.search = options.search.trim()
    }
    
    if (typeof options?.filter === 'string' && ['ALL', 'ACTIVE', 'INACTIVE'].includes(options.filter)) {
      safeOptions.filter = options.filter
    }
    
    if (typeof options?.sortBy === 'string' && ['name', 'contact_person', 'phone'].includes(options.sortBy)) {
      safeOptions.sortBy = options.sortBy
      safeOptions.sortDirection = options?.sortDirection === 'DESC' ? 'DESC' : 'ASC'
    }

    return SupplierService.getPaginatedSuppliers(safeOptions)
  })

  ipcMain.handle('api:supplier:get', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event)
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return SupplierService.getSupplier(id)
  })

  ipcMain.handle('api:supplier:create', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    return SupplierService.createSupplier(payload as any)
  })

  ipcMain.handle('api:supplier:update', async (event: IpcMainInvokeEvent, { id, payload }: { id: number, payload: unknown }) => {
    await enforceSecureIpc(event, { isMutation: true })
    return SupplierService.updateSupplier(id, payload as any)
  })

  ipcMain.handle('api:supplier:search', async (event: IpcMainInvokeEvent, query: unknown) => {
    await enforceSecureIpc(event)
    if (typeof query !== 'string') throw new Error('Invalid query')
    return SupplierService.searchSuppliers(query)
  })

  ipcMain.handle('api:supplier:setActive', async (event: IpcMainInvokeEvent, { id, active }: { id: number, active: boolean }) => {
    await enforceSecureIpc(event, { isMutation: true })
    return SupplierService.setSupplierActive(id, active)
  })

  // Purchases
  ipcMain.handle('api:purchase:list', async (event: IpcMainInvokeEvent, options: any = {}) => {
    await enforceSecureIpc(event)
    
    const safeOptions: any = {
      page: typeof options?.page === 'number' && options.page > 0 ? options.page : 1,
      pageSize: typeof options?.pageSize === 'number' && options.pageSize > 0 ? options.pageSize : 25,
    }
    
    if (typeof options?.search === 'string' && options.search.trim().length > 0) {
      safeOptions.search = options.search.trim()
    }
    
    if (typeof options?.filter === 'string' && ['ALL', 'DRAFT', 'COMPLETED', 'CANCELLED'].includes(options.filter)) {
      safeOptions.filter = options.filter
    }
    
    if (typeof options?.sortBy === 'string' && ['invoice_number', 'purchase_date', 'total_amount'].includes(options.sortBy)) {
      safeOptions.sortBy = options.sortBy
      safeOptions.sortDirection = options?.sortDirection === 'DESC' ? 'DESC' : 'ASC'
    }

    return PurchaseService.getPaginatedPurchases(safeOptions)
  })

  ipcMain.handle('api:purchase:get', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event)
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return PurchaseService.getPurchase(id)
  })

  ipcMain.handle('api:purchase:createDraft', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    return PurchaseService.createDraft(payload as any)
  })

  ipcMain.handle('api:purchase:updateDraft', async (event: IpcMainInvokeEvent, { id, payload }: { id: number, payload: unknown }) => {
    await enforceSecureIpc(event, { isMutation: true })
    return PurchaseService.updateDraft(id, payload as any)
  })

  ipcMain.handle('api:purchase:complete', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return PurchaseService.completePurchase(id)
  })

  // Inventory
  ipcMain.handle('api:inventory:list', async (event: IpcMainInvokeEvent, options: any = {}) => {
    await enforceSecureIpc(event)
    
    // Validate and whitelist pagination options
    const safeOptions: any = {
      page: typeof options?.page === 'number' && options.page > 0 ? options.page : 1,
      pageSize: typeof options?.pageSize === 'number' && options.pageSize > 0 ? options.pageSize : 25,
    }
    
    if (typeof options?.search === 'string' && options.search.trim().length > 0) {
      safeOptions.search = options.search.trim()
    }
    
    if (typeof options?.filter === 'string' && ['ALL', 'EXPIRED', 'EXPIRING_SOON', 'LOW_STOCK'].includes(options.filter)) {
      safeOptions.filter = options.filter
    }
    
    if (typeof options?.sortBy === 'string' && ['name', 'expiry_date', 'quantity', 'mrp'].includes(options.sortBy)) {
      safeOptions.sortBy = options.sortBy
      safeOptions.sortDirection = options?.sortDirection === 'DESC' ? 'DESC' : 'ASC'
    }

    return InventoryService.getPaginatedBatches(safeOptions)
  })

  ipcMain.handle('api:inventory:getSummary', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    return InventoryService.getSummary()
  })

  ipcMain.handle('api:inventory:getBatch', async (event: IpcMainInvokeEvent, { productId, batchNumber }: { productId: number, batchNumber: string }) => {
    await enforceSecureIpc(event)
    return InventoryService.getInventoryBatch(productId, batchNumber)
  })

  ipcMain.handle('api:inventory:getActiveBatches', async (event: IpcMainInvokeEvent, productId: unknown) => {
    await enforceSecureIpc(event)
    if (typeof productId !== 'number') throw new Error('Invalid product ID')
    return InventoryService.getActiveBatches(productId)
  })

  ipcMain.handle('api:inventory:getBatchById', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event)
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return InventoryService.getBatchById(id)
  })

  ipcMain.handle('api:inventory:updateBatch', async (event: IpcMainInvokeEvent, { id, payload }: { id: number, payload: any }) => {
    await enforceSecureIpc(event, { isMutation: true })
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return InventoryService.updateBatch(id, payload)
  })

  // Sales
  ipcMain.handle('api:sale:list', async (event: IpcMainInvokeEvent, options: any = {}) => {
    await enforceSecureIpc(event)
    
    const safeOptions: any = {
      page: typeof options?.page === 'number' && options.page > 0 ? options.page : 1,
      pageSize: typeof options?.pageSize === 'number' && options.pageSize > 0 ? options.pageSize : 25,
    }
    
    if (typeof options?.search === 'string' && options.search.trim().length > 0) {
      safeOptions.search = options.search.trim()
    }
    
    if (typeof options?.filter === 'string' && ['ALL', 'COMPLETED', 'RETURNED', 'CANCELLED', 'HELD'].includes(options.filter)) {
      safeOptions.filter = options.filter
    }
    
    if (typeof options?.sortBy === 'string' && ['invoice_number', 'sale_date', 'total_amount'].includes(options.sortBy)) {
      safeOptions.sortBy = options.sortBy
      safeOptions.sortDirection = options?.sortDirection === 'DESC' ? 'DESC' : 'ASC'
    }

    return SaleService.getPaginatedSales(safeOptions)
  })

  ipcMain.handle('api:sale:get', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event)
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return SaleService.getSale(id)
  })

  ipcMain.handle('api:sale:create', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    return SaleService.createSale(payload as any)
  })

  // Sales Returns
  ipcMain.handle('api:sales-return:list', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    return SalesReturnService.listReturns()
  })

  ipcMain.handle('api:sales-return:get', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event)
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return SalesReturnService.getReturn(id)
  })

  ipcMain.handle('api:sales-return:create', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    return SalesReturnService.createReturn(payload as any)
  })

  // Purchase Returns
  ipcMain.handle('api:purchase-return:list', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    return PurchaseReturnService.listReturns()
  })

  ipcMain.handle('api:purchase-return:get', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event)
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return PurchaseReturnService.getReturn(id)
  })

  ipcMain.handle('api:purchase-return:create', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    return PurchaseReturnService.createReturn(payload as any)
  })

  // Stock Adjustments
  ipcMain.handle('api:stock-adjustment:list', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    return StockAdjustmentService.listAdjustments()
  })

  ipcMain.handle('api:stock-adjustment:create', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    return StockAdjustmentService.createAdjustment(payload as any)
  })

  // Dashboard Summary
  ipcMain.handle('api:dashboard:getSummary', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    return DashboardService.getSummary()
  })

  // Financial Summary
  ipcMain.handle('api:financial:getSummary', async (event: IpcMainInvokeEvent, period: unknown) => {
    await enforceSecureIpc(event)
    if (typeof period !== 'string' || !['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'MONTH'].includes(period)) {
      throw new Error('Invalid period')
    }
    return FinancialService.getSummary(period as any)
  })

  // Customers
  ipcMain.handle('api:customer:list', async (event: IpcMainInvokeEvent, options: any = {}) => {
    await enforceSecureIpc(event)
    const safeOptions: any = {
      page: typeof options?.page === 'number' && options.page > 0 ? options.page : 1,
      pageSize: typeof options?.pageSize === 'number' && options.pageSize > 0 ? options.pageSize : 25,
    }
    if (typeof options?.search === 'string' && options.search.trim().length > 0) {
      safeOptions.search = options.search.trim()
    }
    if (typeof options?.sortBy === 'string' && ['name', 'created_at'].includes(options.sortBy)) {
      safeOptions.sortBy = options.sortBy
      safeOptions.sortDirection = options?.sortDirection === 'DESC' ? 'DESC' : 'ASC'
    }
    
    // Support legacy (page, pageSize, query) signature temporarily
    if (options && typeof options === 'object' && options.query) {
       safeOptions.search = options.query
    }

    return CustomerService.getPaginatedCustomers(safeOptions)
  })

  ipcMain.handle('api:customer:get', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event)
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return CustomerService.getCustomer(id)
  })

  ipcMain.handle('api:customer:create', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    return CustomerService.createCustomer(payload as any)
  })

  ipcMain.handle('api:customer:update', async (event: IpcMainInvokeEvent, { id, payload }: { id: number, payload: unknown }) => {
    await enforceSecureIpc(event, { isMutation: true })
    return CustomerService.updateCustomer(id, payload as any)
  })

  ipcMain.handle('api:customer:history', async (event: IpcMainInvokeEvent, { id, page, pageSize }: { id: number, page?: number, pageSize?: number }) => {
    await enforceSecureIpc(event)
    return CustomerService.getCustomerSales(id, page, pageSize)
  })

  // Prescriptions
  ipcMain.handle('api:prescription:list', async (event: IpcMainInvokeEvent, { customerId, page, pageSize }: { customerId: number, page?: number, pageSize?: number }) => {
    await enforceSecureIpc(event)
    return PrescriptionService.getCustomerPrescriptions(customerId, page, pageSize)
  })

  ipcMain.handle('api:prescription:get', async (event: IpcMainInvokeEvent, id: unknown) => {
    await enforceSecureIpc(event)
    if (typeof id !== 'number') throw new Error('Invalid ID')
    return PrescriptionService.getPrescription(id)
  })

  ipcMain.handle('api:prescription:create', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    return PrescriptionService.createPrescription(payload as any)
  })

  // Settings
  ipcMain.handle('api:settings:getAll', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    return SettingService.getAllSettings()
  })

  ipcMain.handle('api:settings:update', async (event: IpcMainInvokeEvent, payload: unknown) => {
    await enforceSecureIpc(event, { isMutation: true })
    SettingService.updateSettings(payload as any)
  })

  // Reports
  ipcMain.handle('api:report:sales', async (event: IpcMainInvokeEvent, { start, end, page, pageSize }: any) => {
    await enforceSecureIpc(event)
    return ReportService.getSales(start, end, page, pageSize)
  })
  ipcMain.handle('api:report:purchases', async (event: IpcMainInvokeEvent, { start, end, page, pageSize }: any) => {
    await enforceSecureIpc(event)
    return ReportService.getPurchases(start, end, page, pageSize)
  })
  ipcMain.handle('api:report:salesReturns', async (event: IpcMainInvokeEvent, { start, end, page, pageSize }: any) => {
    await enforceSecureIpc(event)
    return ReportService.getSalesReturns(start, end, page, pageSize)
  })
  ipcMain.handle('api:report:inventory', async (event: IpcMainInvokeEvent, { page, pageSize, lowStockOnly }: any) => {
    await enforceSecureIpc(event)
    return ReportService.getInventory(page, pageSize, lowStockOnly)
  })
  ipcMain.handle('api:report:financials', async (event: IpcMainInvokeEvent, { start, end }: any) => {
    await enforceSecureIpc(event)
    return ReportService.getFinancials(start, end)
  })
  ipcMain.handle('api:report:inventoryReport', async (event: IpcMainInvokeEvent, { start, end, page, pageSize }: any) => {
    await enforceSecureIpc(event)
    return ReportService.getInventoryReport(start, end, page, pageSize)
  })
  ipcMain.handle('api:report:medicinesReport', async (event: IpcMainInvokeEvent, { start, end, page, pageSize }: any) => {
    await enforceSecureIpc(event)
    return ReportService.getMedicinesReport(start, end, page, pageSize)
  })

  // Documents
  ipcMain.handle('api:document:exportInvoice', async (event: IpcMainInvokeEvent, { id, format }: any) => {
    await enforceSecureIpc(event)
    await DocumentService.exportInvoice(id, format)
  })
  ipcMain.handle('api:document:exportPrescription', async (event: IpcMainInvokeEvent, { id, format }: any) => {
    await enforceSecureIpc(event)
    await DocumentService.exportPrescription(id, format)
  })
  ipcMain.handle('api:document:exportReportCsv', async (event: IpcMainInvokeEvent, { type, start, end }: any) => {
    await enforceSecureIpc(event)
    await DocumentService.exportReportCsv(type, start, end)
  })

  // Database Backup & Restore
  ipcMain.handle('api:database:selectBackupLocation', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new Error('No window context')

    const result = await dialog.showOpenDialog(win, {
      title: 'Select Backup Folder',
      properties: ['openDirectory', 'createDirectory']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('api:database:runManualBackup', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    try {
      await BackupManager.runManualBackup()
      return true
    } catch (e: any) {
      Logger.error('IPC', `Manual backup failed: ${e.message}`)
      throw e
    }
  })

  ipcMain.handle('api:database:openBackupFolder', async (event: IpcMainInvokeEvent, folderPath: string) => {
    await enforceSecureIpc(event)
    try {
      if (!folderPath) throw new Error('No folder path provided')
      await shell.openPath(folderPath)
      return true
    } catch (e: any) {
      Logger.error('IPC', `Failed to open backup folder: ${e.message}`)
      throw e
    }
  })

  ipcMain.handle('api:database:restore', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event, { isMutation: true })
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new Error('No window context')

    const result = await dialog.showOpenDialog(win, {
      title: 'Select Backup to Restore',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['sqlite', 'db'] }]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      // Show confirmation dialog before destructive action
      const confirm = await dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Cancel', 'Restore and Overwrite Data'],
        defaultId: 0,
        title: 'Confirm Restore',
        message: 'Are you absolutely sure you want to restore this backup?',
        detail: 'This will overwrite your current database. A safety backup will be created, but you should only proceed if necessary. The application will reload automatically.'
      })

      if (confirm.response === 1) {
        await BackupService.restoreBackup(result.filePaths[0])
        return true
      }
    }
    return false
  })

  // Printing
  ipcMain.handle('api:print:getPrinters', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    return await PrintingService.getPrinters()
  })

  ipcMain.handle('api:print:printDocument', async (event: IpcMainInvokeEvent, { html, options }: any) => {
    await enforceSecureIpc(event)
    await PrintingService.printDocument(html, options)
  })

  // Updates
  ipcMain.handle('api:update:check', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event)
    await UpdateService.checkForUpdates()
    return true
  })

  ipcMain.handle('api:update:apply', async (event: IpcMainInvokeEvent) => {
    await enforceSecureIpc(event, { isMutation: true })
    return await UpdateService.applyUpdate()
  })
}
