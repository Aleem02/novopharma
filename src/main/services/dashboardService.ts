import { DatabaseManager } from "../database/connection";
import {
  DashboardSummary,
  Sale,
  Purchase,
  SalesReturn,
  StockAdjustment,
  SalesTrendItem,
  TopSellingProduct,
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

    // 4. Low stock count (active products with aggregate usable unexpired inventory <= 10)
    const lowStockRow = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM products p 
      LEFT JOIN (
        SELECT product_id, SUM(quantity) as qty 
        FROM inventory_batches 
        WHERE expiry_date >= ?
        GROUP BY product_id
      ) b ON p.id = b.product_id 
      WHERE p.is_active = 1 AND COALESCE(b.qty, 0) <= 10
    `,
      )
      .get(now) as { count: number };

    // 5. Expiring soon count (unexpired batches expiring in the next 90 days with quantity > 0)
    const ninetyDaysFromNow = now + 90 * 24 * 60 * 60 * 1000;
    const expiringSoonRow = db
      .prepare(
        `
      SELECT COUNT(id) as count 
      FROM inventory_batches 
      WHERE expiry_date > ? AND expiry_date <= ? AND quantity > 0
    `,
      )
      .get(now, ninetyDaysFromNow) as { count: number };

    // 6. Expired count (batches past expiry date with quantity > 0)
    const expiredRow = db
      .prepare(
        `
      SELECT COUNT(id) as count 
      FROM inventory_batches 
      WHERE expiry_date <= ? AND quantity > 0
    `,
      )
      .get(now) as { count: number };

    // 7. Recent Sales (last 5)
    const recentSaleIds = db
      .prepare("SELECT id FROM sales ORDER BY sale_date DESC LIMIT 5")
      .all() as { id: number }[];
    const recentSales = recentSaleIds.map((row) =>
      SaleRepository.findById(row.id)!,
    ) as Sale[];

    // 8. Recent Purchases (last 5)
    const recentPurchaseIds = db
      .prepare("SELECT id FROM purchases ORDER BY purchase_date DESC LIMIT 5")
      .all() as { id: number }[];
    const recentPurchases = recentPurchaseIds.map((row) =>
      PurchaseRepository.findById(row.id)!,
    ) as Purchase[];

    // 9. Recent Returns (last 5)
    const recentReturnIds = db
      .prepare("SELECT id FROM sales_returns ORDER BY return_date DESC LIMIT 5")
      .all() as { id: number }[];
    const recentReturns = recentReturnIds.map((row) =>
      SalesReturnRepository.findById(row.id)!,
    ) as SalesReturn[];

    // 10. Recent Adjustments (last 5)
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
      expiredCount: expiredRow.count,
      todayReturnsCount: todayReturnsRow.count,
      recentSales,
      recentPurchases,
      recentReturns,
      recentAdjustments,
    };
  }

  static getSalesTrend(startDate: number, endDate: number): SalesTrendItem[] {
    const db = DatabaseManager.getInstance();

    const grossSalesRows = db
      .prepare(
        `
        SELECT 
          date(sale_date / 1000, 'unixepoch', 'localtime') as date_str,
          COALESCE(SUM(total_amount), 0) as gross_total
        FROM sales
        WHERE sale_date >= ? AND sale_date <= ? AND status != 'CANCELLED'
        GROUP BY date_str
        ORDER BY date_str ASC
      `,
      )
      .all(startDate, endDate) as { date_str: string; gross_total: number }[];

    const refundRows = db
      .prepare(
        `
        SELECT 
          date(sr.return_date / 1000, 'unixepoch', 'localtime') as date_str,
          COALESCE(SUM(sri.refund_amount), 0) as refund_total
        FROM sales_returns sr
        JOIN sales_return_items sri ON sr.id = sri.sales_return_id
        WHERE sr.return_date >= ? AND sr.return_date <= ?
        GROUP BY date_str
      `,
      )
      .all(startDate, endDate) as { date_str: string; refund_total: number }[];

    const map = new Map<string, { gross: number; refunds: number }>();

    for (const r of grossSalesRows) {
      if (r.date_str) {
        map.set(r.date_str, { gross: r.gross_total, refunds: 0 });
      }
    }

    for (const r of refundRows) {
      if (r.date_str) {
        const existing = map.get(r.date_str) || { gross: 0, refunds: 0 };
        existing.refunds += r.refund_total;
        map.set(r.date_str, existing);
      }
    }

    const dates = Array.from(map.keys()).sort();
    return dates.map((d) => {
      const entry = map.get(d)!;
      return {
        date: d,
        amount: Math.max(0, entry.gross - entry.refunds),
      };
    });
  }

  static getTopSellingProducts(
    startDate: number,
    endDate: number,
    limit: number = 5,
  ): TopSellingProduct[] {
    const db = DatabaseManager.getInstance();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

    const salesRows = db
      .prepare(
        `
        SELECT 
          p.id as productId,
          p.name as productName,
          COALESCE(SUM(si.base_quantity), 0) as quantitySold,
          COALESCE(SUM(si.line_total), 0) as salesAmount
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        JOIN products p ON si.product_id = p.id
        WHERE s.sale_date >= ? AND s.sale_date <= ? AND s.status != 'CANCELLED'
        GROUP BY p.id, p.name
      `,
      )
      .all(startDate, endDate) as {
      productId: number;
      productName: string;
      quantitySold: number;
      salesAmount: number;
    }[];

    const returnRows = db
      .prepare(
        `
        SELECT 
          sri.product_id as productId,
          COALESCE(SUM(sri.quantity), 0) as returnedQuantity,
          COALESCE(SUM(sri.refund_amount), 0) as returnedRefund
        FROM sales_returns sr
        JOIN sales_return_items sri ON sr.id = sri.sales_return_id
        WHERE sr.return_date >= ? AND sr.return_date <= ?
        GROUP BY sri.product_id
      `,
      )
      .all(startDate, endDate) as {
      productId: number;
      returnedQuantity: number;
      returnedRefund: number;
    }[];

    const returnMap = new Map<number, { returnedQty: number; returnedRefund: number }>();
    for (const r of returnRows) {
      returnMap.set(r.productId, {
        returnedQty: r.returnedQuantity,
        returnedRefund: r.returnedRefund,
      });
    }

    const results: TopSellingProduct[] = salesRows.map((item) => {
      const ret = returnMap.get(item.productId) || { returnedQty: 0, returnedRefund: 0 };
      return {
        productId: item.productId,
        productName: item.productName,
        quantitySold: Math.max(0, item.quantitySold - ret.returnedQty),
        salesAmount: Math.max(0, item.salesAmount - ret.returnedRefund),
      };
    });

    results.sort((a, b) => {
      if (b.salesAmount !== a.salesAmount) {
        return b.salesAmount - a.salesAmount;
      }
      return b.quantitySold - a.quantitySold;
    });

    return results.slice(0, safeLimit);
  }
}
