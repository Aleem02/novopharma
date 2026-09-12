import { DatabaseManager } from "../connection";
import {
  Sale,
  Product,
  Customer,
  Prescription,
  PaginationOptions,
  SalesFilterOptions,
  SalesPaginationOptions,
  SalesKpis,
  PaginatedResult,
} from "../../../shared/types";
import { CustomerRepository } from "./customerRepository";
import { PrescriptionRepository } from "./prescriptionRepository";

export class SaleRepository {
  static findById(id: number): Sale | undefined {
    const db = DatabaseManager.getInstance();
    const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as
      Sale | undefined;
    if (!sale) return undefined;

    const items = db
      .prepare(
        `
      SELECT si.*, 
             p.name as product_name, p.generic_name as product_generic_name, 
             p.barcode as product_barcode, p.strength as product_strength
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `,
      )
      .all(id) as any[];

    const itemIds = items.map((i) => i.id);
    let itemBatches: any[] = [];
    if (itemIds.length > 0) {
      itemBatches = db
        .prepare(
          `
        SELECT * FROM sale_item_batches WHERE sale_item_id IN (${itemIds.join(",")})
      `,
        )
        .all() as any[];
    }

    const payments = db
      .prepare("SELECT * FROM sale_payments WHERE sale_id = ?")
      .all(id) as any[];

    sale.items = items.map((item) => {
      const {
        product_name,
        product_generic_name,
        product_barcode,
        product_strength,
        ...rest
      } = item;
      return {
        ...rest,
        batches: itemBatches.filter((b) => b.sale_item_id === item.id),
        product: {
          id: item.product_id,
          name: product_name,
          generic_name: product_generic_name,
          barcode: product_barcode,
          strength: product_strength,
        } as Product,
      };
    });

    sale.payments = payments;
    sale.items_count = sale.items.length;
    sale.items_total_quantity = sale.items.reduce(
      (sum, item) => sum + (item.entered_quantity || 1),
      0,
    );

    if (sale.customer_id) {
      sale.customer = CustomerRepository.findById(sale.customer_id);
    }

    if (sale.prescription_id) {
      sale.prescription = PrescriptionRepository.findById(sale.prescription_id);
    }

    return sale;
  }

  static findByInvoiceNumber(invoiceNumber: string): Sale | undefined {
    const db = DatabaseManager.getInstance();
    const sale = db
      .prepare("SELECT id FROM sales WHERE invoice_number = ?")
      .get(invoiceNumber) as { id: number } | undefined;
    if (!sale) return undefined;
    return this.findById(sale.id);
  }

  private static buildWhereClause(options: SalesFilterOptions = {}): {
    whereClause: string;
    params: any[];
  } {
    let whereClause = `FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE 1=1`;
    const params: any[] = [];

    // Search: Invoice, Customer Name, Customer Phone, Product Name, Barcode, Generic Name
    if (options.search && options.search.trim().length > 0) {
      const cleanSearch = options.search.trim();
      const searchLike = `%${cleanSearch}%`;
      whereClause += ` AND (
        s.invoice_number LIKE ?
        OR c.name LIKE ?
        OR c.phone LIKE ?
        OR EXISTS (
          SELECT 1 FROM sale_items si
          JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = s.id
            AND (p.name LIKE ? OR p.barcode = ? OR p.generic_name LIKE ?)
        )
      )`;
      params.push(searchLike, searchLike, searchLike, searchLike, cleanSearch, searchLike);
    }

    // Date Range (Inclusive start, Exclusive end)
    if (typeof options.dateFrom === "number" && options.dateFrom > 0) {
      whereClause += ` AND s.sale_date >= ?`;
      params.push(options.dateFrom);
    }
    if (typeof options.dateTo === "number" && options.dateTo > 0) {
      whereClause += ` AND s.sale_date < ?`;
      params.push(options.dateTo);
    }

    // Status Filter
    if (options.status && options.status !== "ALL") {
      if (options.status === "COMPLETED") {
        whereClause += ` AND s.status = 'COMPLETED'`;
      } else if (options.status === "REFUNDED") {
        whereClause += ` AND s.status IN ('REFUNDED', 'RETURNED')`;
      } else if (options.status === "PARTIALLY_REFUNDED") {
        whereClause += ` AND s.status = 'PARTIALLY_REFUNDED'`;
      } else if (options.status === "CANCELLED") {
        whereClause += ` AND s.status = 'CANCELLED'`;
      } else if (options.status === "HELD") {
        whereClause += ` AND s.status = 'HELD'`;
      } else {
        whereClause += ` AND s.status = ?`;
        params.push(options.status);
      }
    }

    // Payment Method Filter
    if (options.paymentMethod && options.paymentMethod !== "ALL") {
      whereClause += ` AND (
        s.payment_method = ?
        OR EXISTS (
          SELECT 1 FROM sale_payments sp
          WHERE sp.sale_id = s.id AND sp.payment_method = ?
        )
      )`;
      params.push(options.paymentMethod, options.paymentMethod);
    }

    // Customer Filter
    if (options.customerId !== undefined && options.customerId !== null) {
      if (options.customerId === "WALK_IN") {
        whereClause += ` AND s.customer_id IS NULL`;
      } else if (typeof options.customerId === "number" && options.customerId > 0) {
        whereClause += ` AND s.customer_id = ?`;
        params.push(options.customerId);
      }
    }

    // Amount Range Filter (in paise)
    if (typeof options.minAmount === "number" && options.minAmount >= 0) {
      whereClause += ` AND s.total_amount >= ?`;
      params.push(options.minAmount);
    }
    if (typeof options.maxAmount === "number" && options.maxAmount >= 0) {
      whereClause += ` AND s.total_amount <= ?`;
      params.push(options.maxAmount);
    }

    return { whereClause, params };
  }

  static getPaginatedSales(
    options: SalesPaginationOptions,
  ): PaginatedResult<Sale> {
    const db = DatabaseManager.getInstance();
    const { whereClause, params } = this.buildWhereClause(options);

    const countQuery = `SELECT COUNT(s.id) as total ${whereClause}`;
    const totalRow = db.prepare(countQuery).get(...params) as { total: number };
    const total = totalRow ? totalRow.total : 0;

    // Strict whitelist sorting
    let orderBy = "ORDER BY s.sale_date DESC";
    if (options.sortBy) {
      const sortMap: Record<string, string> = {
        invoice_number: "s.invoice_number",
        invoice: "s.invoice_number",
        sale_date: "s.sale_date",
        date: "s.sale_date",
        total_amount: "s.total_amount",
        amount: "s.total_amount",
        customer_name: "c.name",
        customer: "c.name",
      };
      const col = sortMap[options.sortBy];
      if (col) {
        const dir = options.sortDirection === "ASC" ? "ASC" : "DESC";
        orderBy = `ORDER BY ${col} ${dir}`;
      }
    }

    const page = typeof options.page === "number" && options.page > 0 ? options.page : 1;
    const pageSize = typeof options.pageSize === "number" && options.pageSize > 0 ? options.pageSize : 25;
    const offset = (page - 1) * pageSize;

    const dataQuery = `
      SELECT s.*,
             c.name as customer_name, c.phone as customer_phone,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count,
             (SELECT COALESCE(SUM(si.entered_quantity), 0) FROM sale_items si WHERE si.sale_id = s.id) as items_total_quantity
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const items = db
      .prepare(dataQuery)
      .all(...params, pageSize, offset) as any[];

    const formattedItems = items.map((item) => {
      const { customer_name, customer_phone, items_count, items_total_quantity, ...sale } = item;
      sale.items_count = items_count || 0;
      sale.items_total_quantity = items_total_quantity || 0;
      if (sale.customer_id) {
        sale.customer = {
          id: sale.customer_id,
          name: customer_name,
          phone: customer_phone,
        } as Customer;
      }
      return sale as Sale;
    });

    return {
      items: formattedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  static getSalesKpis(options: SalesFilterOptions = {}): SalesKpis {
    const db = DatabaseManager.getInstance();
    const { whereClause, params } = this.buildWhereClause(options);
    const whereOnly = whereClause.substring(whereClause.indexOf("WHERE"));

    const kpiQuery = `
      SELECT 
        COUNT(s.id) as total_count,
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN s.total_amount ELSE 0 END), 0) as completed_amount,
        COALESCE(SUM(CASE WHEN s.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) as completed_count,
        COALESCE(SUM(CASE WHEN s.status IN ('REFUNDED', 'RETURNED') THEN 1 ELSE 0 END), 0) as refunded_count,
        COALESCE(SUM(CASE WHEN s.status IN ('REFUNDED', 'RETURNED') THEN s.total_amount ELSE 0 END), 0) as refunded_amount,
        COALESCE(SUM(CASE WHEN s.status = 'PARTIALLY_REFUNDED' THEN 1 ELSE 0 END), 0) as partial_refund_count,
        COALESCE((
          SELECT SUM(si.entered_quantity) 
          FROM sale_items si 
          JOIN sales s ON si.sale_id = s.id 
          LEFT JOIN customers c ON s.customer_id = c.id
          ${whereOnly}
        ), 0) as items_sold
      ${whereClause}
    `;

    const row = db.prepare(kpiQuery).get(...params, ...params) as any;

    const totalCount = row?.total_count || 0;
    const completedAmount = row?.completed_amount || 0;
    const completedCount = row?.completed_count || 0;
    const refundedCount = (row?.refunded_count || 0) + (row?.partial_refund_count || 0);
    const refundedAmount = row?.refunded_amount || 0;
    const itemsSold = Math.round(row?.items_sold || 0);

    const averageBill = completedCount > 0 ? Math.round(completedAmount / completedCount) : 0;

    // Calculate percentage change vs yesterday if period is today or no date range filter
    let salesChangePercent: number | undefined = undefined;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    const isTodayFilter = !options.dateFrom || (options.dateFrom >= todayStart && (!options.dateTo || options.dateTo <= todayEnd));

    if (isTodayFilter) {
      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
      const yesterdayEnd = todayStart;

      const yesterdayRow = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) as total 
        FROM sales 
        WHERE status = 'COMPLETED' AND sale_date >= ? AND sale_date < ?
      `).get(yesterdayStart, yesterdayEnd) as { total: number };

      const yesterdayAmount = yesterdayRow ? yesterdayRow.total : 0;

      if (yesterdayAmount > 0) {
        salesChangePercent = parseFloat((((completedAmount - yesterdayAmount) / yesterdayAmount) * 100).toFixed(1));
      } else if (completedAmount > 0) {
        salesChangePercent = 100;
      } else {
        salesChangePercent = 0;
      }
    }

    return {
      salesAmount: completedAmount,
      salesChangePercent,
      totalTransactionsCount: totalCount,
      completedTransactionsCount: completedCount,
      refundedTransactionsCount: refundedCount,
      averageBillAmount: averageBill,
      totalRefundsAmount: refundedAmount,
      totalRefundsCount: refundedCount,
      totalItemsSold: itemsSold,
    };
  }

  static getExportSales(options: SalesFilterOptions = {}): Sale[] {
    const db = DatabaseManager.getInstance();
    const { whereClause, params } = this.buildWhereClause(options);

    const exportQuery = `
      SELECT s.*,
             c.name as customer_name, c.phone as customer_phone,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count,
             (SELECT COALESCE(SUM(si.entered_quantity), 0) FROM sale_items si WHERE si.sale_id = s.id) as items_total_quantity
      ${whereClause}
      ORDER BY s.sale_date DESC
      LIMIT 10000
    `;

    const items = db.prepare(exportQuery).all(...params) as any[];

    return items.map((item) => {
      const { customer_name, customer_phone, items_count, items_total_quantity, ...sale } = item;
      sale.items_count = items_count || 0;
      sale.items_total_quantity = items_total_quantity || 0;
      if (sale.customer_id) {
        sale.customer = {
          id: sale.customer_id,
          name: customer_name,
          phone: customer_phone,
        } as Customer;
      }
      return sale as Sale;
    });
  }

  static list(): Sale[] {
    const db = DatabaseManager.getInstance();
    return db
      .prepare("SELECT * FROM sales ORDER BY sale_date DESC")
      .all() as Sale[];
  }
}
