import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthScreen } from "./components/auth/AuthScreen";
import { MainLayout } from "./components/layout/MainLayout";
import { ProductMaster } from "./components/products/ProductMaster";
import { ProductForm } from "./components/products/ProductForm";
import { SupplierMaster } from "./components/suppliers/SupplierMaster";
import { SupplierForm } from "./components/suppliers/SupplierForm";
import { Customers } from "./components/customers/Customers";
import { CustomerDetail } from "./components/customers/CustomerDetail";
import { PurchaseMaster } from "./components/purchases/PurchaseMaster";
import { PurchaseForm } from "./components/purchases/PurchaseForm";
import { InventoryDashboard } from "./components/inventory/InventoryDashboard";
import { POSScreen } from "./components/sales/POSScreen";
import { SalesHistory } from "./components/sales/SalesHistory";
import { InvoiceView } from "./components/sales/InvoiceView";
import { Dashboard } from "./components/dashboard/Dashboard";
import { SalesReturns } from "./components/sales/SalesReturns";
import { SalesReturnForm } from "./components/sales/SalesReturnForm";
import { PurchaseReturns } from "./components/purchases/PurchaseReturns";
import { PurchaseReturnForm } from "./components/purchases/PurchaseReturnForm";
import { StockAdjustments } from "./components/inventory/StockAdjustments";
import { StockAdjustmentForm } from "./components/inventory/StockAdjustmentForm";
import { BatchDetails } from "./components/inventory/BatchDetails";
import { EditBatch } from "./components/inventory/EditBatch";
import { SettingsView } from "./components/settings/SettingsView";
import { ReportDashboard } from "./components/reports/ReportDashboard";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { ToastProvider } from "./components/ui/Toast";

const App: React.FC = () => {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<AuthScreen />} />
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Sales & POS */}
            <Route path="/sales/pos" element={<POSScreen />} />
            <Route path="/sales/history" element={<SalesHistory />} />
            <Route
              path="/sales/invoice/:invoiceNumber"
              element={<InvoiceView />}
            />
            <Route path="/sales/returns" element={<SalesReturns />} />
            <Route path="/sales/returns/new" element={<SalesReturnForm />} />

            {/* Products */}
            <Route path="/products" element={<ProductMaster />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/edit/:id" element={<ProductForm />} />

            {/* Suppliers */}
            <Route path="/suppliers" element={<SupplierMaster />} />
            <Route path="/suppliers/new" element={<SupplierForm />} />
            <Route path="/suppliers/edit/:id" element={<SupplierForm />} />

            {/* Customers */}
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />

            {/* Purchases */}
            <Route path="/purchases" element={<PurchaseMaster />} />
            <Route path="/purchases/new" element={<PurchaseForm />} />
            <Route path="/purchases/edit/:id" element={<PurchaseForm />} />
            <Route path="/purchases/returns" element={<PurchaseReturns />} />
            <Route
              path="/purchases/returns/new"
              element={<PurchaseReturnForm />}
            />

            {/* Inventory */}
            <Route path="/inventory" element={<InventoryDashboard />} />
            <Route path="/inventory/batch/:id" element={<BatchDetails />} />
            <Route path="/inventory/batch/:id/edit" element={<EditBatch />} />
            <Route
              path="/inventory/adjustments"
              element={<StockAdjustments />}
            />
            <Route
              path="/inventory/adjustments/new"
              element={<StockAdjustmentForm />}
            />

            {/* Settings & Reports */}
            <Route path="/settings" element={<SettingsView />} />
            <Route path="/reports" element={<ReportDashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </ToastProvider>
  );
};

export default App;
