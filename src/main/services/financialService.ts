import { DatabaseManager } from "../database/connection";
import { FinancialSummary } from "../../shared/types";

export class FinancialService {
  static getPeriodRange(
    period: "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "MONTH",
  ): { start: number; end: number } {
    const now = new Date();
    const end = now.getTime();

    // Start of today
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();

    switch (period) {
      case "TODAY":
        return { start: startOfToday, end };
      case "YESTERDAY": {
        const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
        return { start: startOfYesterday, end: startOfToday - 1 };
      }
      case "LAST_7_DAYS": {
        const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;
        return { start: sevenDaysAgo, end };
      }
      case "MONTH": {
        const startOfMonth = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        ).getTime();
        return { start: startOfMonth, end };
      }
      default:
        return { start: startOfToday, end };
    }
  }

  static getSummary(
    period: "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "MONTH",
  ): FinancialSummary {
    const { start, end } = this.getPeriodRange(period);
    return this.getSummaryByDateRange(start, end);
  }

  static getSummaryByDateRange(start: number, end: number): FinancialSummary {
    const db = DatabaseManager.getInstance();

    // Completed sales in period
    const sales = db
      .prepare(
        `
      SELECT 
        COALESCE(SUM(total_amount), 0) as gross_sales,
        COUNT(id) as invoice_count,
        COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN total_amount ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'UPI' THEN total_amount ELSE 0 END), 0) as upi_sales,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(tax_amount), 0) as total_tax
      FROM sales 
      WHERE sale_date >= ? AND sale_date <= ? AND status != 'CANCELLED'
    `,
      )
      .get(start, end) as any;

    // Returns in period
    const returns = db
      .prepare(
        `
      SELECT 
        COALESCE(SUM(sri.refund_amount), 0) as refunds,
        COALESCE(SUM(CASE WHEN s.payment_method = 'CASH' THEN sri.refund_amount ELSE 0 END), 0) as cash_refunds,
        COALESCE(SUM(CASE WHEN s.payment_method = 'CARD' THEN sri.refund_amount ELSE 0 END), 0) as card_refunds,
        COALESCE(SUM(CASE WHEN s.payment_method = 'UPI' THEN sri.refund_amount ELSE 0 END), 0) as upi_refunds,
        COALESCE(SUM(sri.tax_amount), 0) as returned_tax
      FROM sales_returns sr
      JOIN sales s ON sr.sale_id = s.id
      JOIN sales_return_items sri ON sr.id = sri.sales_return_id
      WHERE sr.return_date >= ? AND sr.return_date <= ?
    `,
      )
      .get(start, end) as any;

    const grossSales = sales.gross_sales;
    const returnsRefunds = returns.refunds;
    const netSales = grossSales - returnsRefunds;
    const netTax = sales.total_tax - returns.returned_tax;

    return {
      todaySales: grossSales,
      todayInvoicesCount: sales.invoice_count,
      cashSales: sales.cash_sales - returns.cash_refunds,
      cardSales: sales.card_sales - returns.card_refunds,
      upiSales: sales.upi_sales - returns.upi_refunds,
      totalDiscounts: sales.total_discounts,
      totalTax: netTax,
      returnsRefunds: returnsRefunds,
      netSales: netSales,
    };
  }
}
