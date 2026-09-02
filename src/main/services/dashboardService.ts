import { DatabaseManager } from "../database/connection";
import {
  DashboardSummary,
  Sale,
  Purchase,
  SalesReturn,
  StockAdjustment,
} from "../../shared/types";
import { SaleRepository } from "../database/repositories/saleRepository";
import { PurchaseRepository } from "../database/repositories/purchaseRepository";
import { SalesReturnRepository } from "../database/repositories/salesReturnRepository";
import { StockAdjustmentRepository } from "../database/repositories/stockAdjustmentRepository";

export class DashboardService {
  static getSummary(): DashboardSummary {
    const db = DatabaseManager.getInstance();
    const now = Date.now();

    // Start of today local time
    const startOfToday = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    ).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

    // 1. Today's sales (gross total_amount of completed sales)
    const todaySalesRow = db
      .prepare(
        `
      SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(id) as count 
      FROM sales 
      WHERE sale_date >= ? AND sale_date <= ? AND status != 'CANCELLED'
    `,
      )
      .get(startOfToday, endOfToday) as { total: number; count: number };

    // 2. Today's returns (refunds total_amount)
    const todayReturnsRow = db
      .prepare(
        `
      SELECT COALESCE(SUM(refund_amount), 0) as total, COUNT(id) as count 
      FROM sales_returns 
      WHERE return_date >= ? AND return_date <= ?
    `,
      )
      .get(startOfToday, endOfToday) as { total: number; count: number };

    // 3. Active products count
    const totalProductsRow = db
      .prepare("SELECT COUNT(id) as count FROM products WHERE is_active = 1")
      .get() as { count: number };

    // 4. Low stock count (active products with total inventory <= 10)
    const lowStockRow = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM products p 
      LEFT JOIN (
        SELECT product_id, SUM(quantity) as qty 
        FROM inventory_batches 
        GROUP BY product_id
      ) b ON p.id = b.product_id 
      WHERE p.is_active = 1 AND COALESCE(b.qty, 0) <= 10
    `,
      )
      .get() as { count: number };

    // 5. Expiring soon count (batches expiring in the next 30 days)
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;
    const expiringSoonRow = db
      .prepare(
        `
      SELECT COUNT(id) as count 
      FROM inventory_batches 
      WHERE expiry_date > ? AND expiry_date <= ? AND quantity > 0
    `,
      )
      .get(now, thirtyDaysFromNow) as { count: number };

    // 6. Recent Sales (last 5)
    const recentSaleIds = db
      .prepare("SELECT id FROM sales ORDER BY sale_date DESC LIMIT 5")
      .all() as { id: number }[];
    const recentSales = recentSaleIds.map((row) =>
      SaleRepository.findById(row.id)!,
    ) as Sale[];

    // 7. Recent Purchases (last 5)
    const recentPurchaseIds = db
      .prepare("SELECT id FROM purchases ORDER BY purchase_date DESC LIMIT 5")
      .all() as { id: number }[];
    const recentPurchases = recentPurchaseIds.map((row) =>
      PurchaseRepository.findById(row.id)!,
    ) as Purchase[];

    // 8. Recent Returns (last 5)
    const recentReturnIds = db
      .prepare("SELECT id FROM sales_returns ORDER BY return_date DESC LIMIT 5")
      .all() as { id: number }[];
    const recentReturns = recentReturnIds.map((row) =>
      SalesReturnRepository.findById(row.id)!,
    ) as SalesReturn[];

    // 9. Recent Adjustments (last 5)
    const recentAdjustmentIds = db
      .prepare(
        "SELECT id FROM stock_adjustments ORDER BY adjusted_at DESC LIMIT 5",
      )
      .all() as { id: number }[];
    const recentAdjustments = recentAdjustmentIds.map((row) =>
      StockAdjustmentRepository.findById(row.id)!,
    ) as StockAdjustment[];

    return {
      todaySales: todaySalesRow.total,
      todayInvoicesCount: todaySalesRow.count,
      totalProducts: totalProductsRow.count,
      lowStockCount: lowStockRow.count,
      expiringSoonCount: expiringSoonRow.count,
      todayReturnsCount: todayReturnsRow.count,
      recentSales,
      recentPurchases,
      recentReturns,
      recentAdjustments,
    };
  }
}
