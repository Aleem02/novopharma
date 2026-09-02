// Shared IPC Types
export interface PaginationOptions {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
  filter?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PingPayload {
  message: string
  timestamp: number
}

export interface PingResponse {
  success: boolean
  reply: string
}

export function isValidPingPayload(payload: any): payload is PingPayload {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false
  }
  
  const keys = Object.keys(payload)
  if (keys.length !== 2 || !keys.includes('message') || !keys.includes('timestamp')) {
    return false
  }
  
  return typeof payload.message === 'string' && typeof payload.timestamp === 'number'
}

export interface AuthStatusResponse {
  status: 'SUCCESS' | 'ERROR'
  message?: string
}

export type AuthState = 'SIGNED_IN' | 'SIGNED_OUT' | 'AUTHENTICATION_ERROR'

export interface UserMetadata {
  email: string | null
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ActivationResult {
  status: 'REGISTRATION_REQUIRED' | 'WAITING_FOR_APPROVAL' | 'ACTIVATING' | 'ACTIVE' | 'ERROR'
  message?: string
  installationId?: string
}

export interface RegistrationResult {
  status: 'PENDING_APPROVAL' | 'ERROR'
  code?: 'NOT_AUTHENTICATED' | 'INVALID_ACTIVATION_CODE' | 'ACTIVATION_CODE_EXPIRED' | 'ACTIVATION_CODE_ALREADY_USED' | 'PUBLIC_KEY_CONFLICT' | 'INSTALLATION_NOT_FOUND' | 'TENANT_SUSPENDED' | 'REGISTRATION_FAILED'
  message?: string
  installationId?: string
}

export interface Product {
  id: number
  name: string
  generic_name: string | null
  manufacturer: string | null
  category: string | null
  therapeutic_category: string | null
  dosage_form: string | null
  strength: string | null
  unit: string | null
  pack_type: string | null
  units_per_pack: number | null
  pack_description: string | null
  hsn_code: string | null
  drug_schedule: string | null
  prescription_required: number // 1 or 0
  barcode: string | null
  sku: string | null
  reorder_level: number
  min_stock: number
  max_stock: number
  rack: string | null
  shelf: string | null
  preferred_supplier_id: number | null
  selling_price: number // in paise
  tax_rate: number // 12.00% is 1200
  is_active: number // 1 or 0
  created_at: number
  updated_at: number
}

export interface CreateProductPayload {
  name: string
  generic_name?: string | null
  manufacturer?: string | null
  category?: string | null
  therapeutic_category?: string | null
  dosage_form?: string | null
  strength?: string | null
  unit?: string | null
  pack_type?: string | null
  units_per_pack?: number | null
  pack_description?: string | null
  hsn_code?: string | null
  drug_schedule?: string | null
  prescription_required?: number
  barcode?: string | null
  sku?: string | null
  reorder_level?: number
  min_stock?: number
  max_stock?: number
  rack?: string | null
  shelf?: string | null
  preferred_supplier_id?: number | null
  selling_price: number
  tax_rate: number
  is_active?: number
}

export interface UpdateProductPayload extends Partial<CreateProductPayload> {}

export interface ProductSearchQuery {
  query: string
}

export interface Supplier {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  gstin: string | null
  is_active: number
  created_at: number
  updated_at: number
}

export interface CreateSupplierPayload {
  name: string
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  gstin?: string | null
  is_active?: number
}

export interface UpdateSupplierPayload extends Partial<CreateSupplierPayload> {}

export type PurchaseStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'

export interface PurchaseItem {
  id: number
  purchase_id: number
  product_id: number
  batch_number: string
  expiry_date: number
  quantity: number // User-entered commercial quantity
  base_quantity: number // Inventory base quantity 
  purchase_price: number // User-entered pack price
  mrp: number // User-entered MRP
  selling_price: number // Calculated per-base-unit selling price
  entered_unit?: string | null
  entered_units_per_pack?: number | null
  created_at: number
}

export interface Purchase {
  id: number
  supplier_id: number
  supplier_name?: string
  invoice_number: string | null
  purchase_date: number
  total_amount: number
  status: PurchaseStatus
  created_at: number
  updated_at: number
  items?: PurchaseItem[] // Loaded relation
}

export interface CreatePurchaseItemPayload {
  product_id: number
  batch_number: string
  expiry_date: number
  quantity: number
  purchase_price: number
  mrp: number
  selling_price: number
  entered_unit?: string | null
  entered_units_per_pack?: number | null
}

export interface CreatePurchasePayload {
  supplier_id: number
  invoice_number?: string | null
  purchase_date: number
  items: CreatePurchaseItemPayload[]
}

export interface UpdatePurchasePayload {
  supplier_id?: number
  invoice_number?: string | null
  purchase_date?: number
  items?: CreatePurchaseItemPayload[]
}

export interface InventoryBatch {
  id: number
  product_id: number
  batch_number: string
  expiry_date: number
  quantity: number // Base units
  entered_quantity?: number | null
  entered_unit?: string | null
  units_per_pack?: number | null
  mrp: number // Per base unit
  purchase_price: number // Per base unit
  selling_price: number // Per base unit
  created_at: number
  updated_at: number
  
  // Joined relations
  product?: Product
}

// Sales & POS Types
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'OTHER' | string
export type SaleStatus = 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export type DiscountType = 'NONE' | 'PERCENTAGE' | 'FIXED'

export interface SalePayment {
  id?: number
  sale_id?: number
  payment_method: PaymentMethod
  amount: number
  reference_number?: string | null
  created_at?: number
}

export interface SaleItemBatch {
  id: number
  sale_item_id: number
  inventory_batch_id: number
  batch_number: string
  base_quantity: number
  selling_price: number // Per base unit
  mrp: number // Per base unit
  created_at: number
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  entered_quantity: number // Commercial quantity (e.g. 4)
  sale_unit: string // e.g. "Strip"
  base_quantity: number // E.g. 40
  inventory_batch_id?: number | null // Nullable now, historically populated
  batch_number?: string | null // Nullable now
  selling_price: number // Per base unit OR blended for the commercial row
  original_selling_price: number
  is_price_overridden: number
  override_reason?: string | null
  mrp: number // Per base unit
  tax_rate: number
  tax_amount: number
  discount_type?: DiscountType | null
  discount_value?: number | null
  discount_amount: number
  line_total: number
  created_at: number
  
  // Optional relations
  product?: Product
  batches?: SaleItemBatch[] // The underlying inventory fulfillments
}

export interface Sale {
  id: number
  invoice_number: string
  sale_date: number
  subtotal: number // total before tax and discount
  bill_discount_type?: DiscountType | null
  bill_discount_value?: number | null
  discount_amount: number
  tax_amount: number
  total_amount: number // final amount to pay
  payment_method: PaymentMethod // legacy
  received_amount?: number
  change_amount?: number
  status: SaleStatus
  created_at: number
  updated_at: number
  customer_id?: number | null
  prescription_id?: number | null
  
  // Optional relation
  items?: SaleItem[]
  payments?: SalePayment[]
  customer?: Customer
  prescription?: Prescription
}

export interface CreateSaleItemPayload {
  product_id: number
  quantity: number
  is_pack?: boolean
  discount_type?: DiscountType
  discount_value?: number
  is_price_overridden?: boolean
  overridden_price?: number // User entered overridden rate (per actual commercial unit)
  override_reason?: string
  selected_batch_id?: number
}

export interface POSCartItem {
  product: Product
  quantity: number
  is_pack?: boolean
  discount_type?: DiscountType
  discount_value?: number
  is_price_overridden?: boolean
  overridden_price?: number
  override_reason?: string
  active_batches?: InventoryBatch[]
  selected_batch_id?: number
}

export interface CreateSalePayload {
  payment_method?: PaymentMethod // Optional legacy
  payments: SalePayment[]
  received_amount?: number
  change_amount?: number
  bill_discount_type?: DiscountType
  bill_discount_value?: number
  customer_id?: number | null
  prescription_id?: number | null
  items: CreateSaleItemPayload[]
}



export interface SalesReturnItem {
  id: number
  sales_return_id: number
  sale_item_id: number
  product_id: number
  inventory_batch_id: number // Specific batch this return was restored to
  entered_quantity?: number | null
  return_unit?: string | null
  quantity: number // Base units restored
  original_selling_price: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  refund_amount: number
  created_at: number
  product?: Product
}

export interface SalesReturn {
  id: number
  sale_id: number
  return_number: string
  return_date: number
  refund_amount: number
  reason: string
  created_at: number
  items?: SalesReturnItem[]
}

export interface CreateSalesReturnPayload {
  sale_id: number
  reason: string
  items: Array<{
    sale_item_id: number
    quantity: number
    is_pack?: boolean
  }>
}

export interface PurchaseReturnItem {
  id: number
  purchase_return_id: number
  purchase_item_id: number
  product_id: number
  batch_number: string
  quantity: number
  purchase_price: number
  mrp: number
  line_total: number
  created_at: number
  product?: Product
}

export interface PurchaseReturn {
  id: number
  purchase_id: number
  return_number: string
  return_date: number
  total_amount: number
  reason: string
  created_at: number
  items?: PurchaseReturnItem[]
}

export interface CreatePurchaseReturnPayload {
  purchase_id: number
  reason: string
  items: Array<{
    purchase_item_id: number
    quantity: number
    is_pack?: boolean
  }>
}

export interface StockAdjustment {
  id: number
  product_id: number
  inventory_batch_id: number
  batch_number: string
  quantity: number
  type: 'INCREASE' | 'DECREASE'
  reason: string
  notes?: string | null
  adjusted_by?: string | null
  adjusted_at: number
  created_at: number
  product?: Product
}

export interface CreateStockAdjustmentPayload {
  inventory_batch_id: number
  quantity: number
  type: 'INCREASE' | 'DECREASE'
  reason: string
  notes?: string | null
}

export interface FinancialSummary {
  todaySales: number
  todayInvoicesCount: number
  cashSales: number
  cardSales: number
  upiSales: number
  totalDiscounts: number
  totalTax: number
  returnsRefunds: number
  netSales: number
}

export interface DashboardSummary {
  todaySales: number
  todayInvoicesCount: number
  totalProducts: number
  lowStockCount: number
  expiringSoonCount: number
  todayReturnsCount: number
  recentSales: Sale[]
  recentPurchases: Purchase[]
  recentReturns: SalesReturn[]
  recentAdjustments: StockAdjustment[]
}

// Customers & Prescriptions


export interface Customer {
  id: number
  name: string
  phone: string
  email: string | null
  address: string | null
  date_of_birth: string | null
  gender: string | null
  notes: string | null
  is_active: number
  created_at: number
  updated_at: number
}

export interface CreateCustomerPayload {
  name: string
  phone: string
  email?: string | null
  address?: string | null
  date_of_birth?: string | null
  gender?: string | null
  notes?: string | null
  is_active?: number
}

export interface UpdateCustomerPayload extends Partial<CreateCustomerPayload> {}

export interface PrescriptionItem {
  id: number
  prescription_id: number
  product_id: number | null
  medicine_name_snapshot: string
  strength_snapshot: string | null
  dosage_instructions: string
  frequency: string | null
  duration: string | null
  quantity: number
  notes: string | null
  created_at: number
}

export interface Prescription {
  id: number
  customer_id: number
  prescription_date: number
  doctor_name: string
  doctor_reg_number: string | null
  reference_number: string | null
  diagnosis_notes: string | null
  created_at: number
  updated_at: number
  items?: PrescriptionItem[]
}

export interface CreatePrescriptionItemPayload {
  product_id?: number | null
  medicine_name_snapshot: string
  strength_snapshot?: string | null
  dosage_instructions: string
  frequency?: string | null
  duration?: string | null
  quantity: number
  notes?: string | null
}

export interface CreatePrescriptionPayload {
  customer_id: number
  prescription_date: number
  doctor_name: string
  doctor_reg_number?: string | null
  reference_number?: string | null
  diagnosis_notes?: string | null
  items: CreatePrescriptionItemPayload[]
}

export interface MedicineDirectoryRecord {
  id?: number
  source_id?: string | null
  name: string
  generic_name?: string | null
  manufacturer?: string | null
  category?: string | null
  dosage_form?: string | null
  strength?: string | null
  unit?: string | null
  pack_type?: string | null
  units_per_pack?: number | null
  pack_description?: string | null
}
