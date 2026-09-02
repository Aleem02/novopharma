import { DatabaseManager } from "../database/connection";
import {
  PaginatedResult,
  Sale,
  Purchase,
  SalesReturn,
  InventoryBatch,
  PurchaseReturn,
} from "../../shared/types";
import { FinancialService } from "./financialService";

export class ReportService {
  static getSales(
    start: number,
    end: number,
    page: number = 1,
    pageSize: number = 50,
  ): PaginatedResult<Sale> {
    const db = DatabaseManager.getInstance();
    const offset = (page - 1) * pageSize;

    const countRow = db
      .prepare(
        "SELECT COUNT(*) as total FROM sales WHERE sale_date >= ? AND sale_date <= ?",
      )
      .get(start, end) as { total: number };
    const total = countRow.total;

    const rows = db
      .prepare(
        "SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? ORDER BY sale_date DESC LIMIT ? OFFSET ?",
      )
      .all(start, end, pageSize, offset) as Sale[];

    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static getPurchases(
    start: number,
    end: number,
    page: number = 1,
    pageSize: number = 50,
  ): PaginatedResult<Purchase> {
    const db = DatabaseManager.getInstance();
    const offset = (page - 1) * pageSize;

    const countRow = db
      .prepare(
        "SELECT COUNT(*) as total FROM purchases WHERE purchase_date >= ? AND purchase_date <= ?",
      )
      .get(start, end) as { total: number };
    const total = countRow.total;

    const rows = db
      .prepare(
        `
      SELECT p.*, s.name as supplier_name 
      FROM purchases p 
      JOIN suppliers s ON p.supplier_id = s.id 
      WHERE p.purchase_date >= ? AND p.purchase_date <= ? 
      ORDER BY p.purchase_date DESC 
      LIMIT ? OFFSET ?
    `,
      )
      .all(start, end, pageSize, offset) as Purchase[];

    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static getSalesReturns(
    start: number,
    end: number,
    page: number = 1,
    pageSize: number = 50,
  ): PaginatedResult<SalesReturn> {
    const db = DatabaseManager.getInstance();
    const offset = (page - 1) * pageSize;

    const countRow = db
      .prepare(
        "SELECT COUNT(*) as total FROM sales_returns WHERE return_date >= ? AND return_date <= ?",
      )
      .get(start, end) as { total: number };
    const total = countRow.total;

    const rows = db
      .prepare(
        "SELECT * FROM sales_returns WHERE return_date >= ? AND return_date <= ? ORDER BY return_date DESC LIMIT ? OFFSET ?",
      )
      .all(start, end, pageSize, offset) as SalesReturn[];

    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static getInventory(
    page: number = 1,
    pageSize: number = 50,
    lowStockOnly: boolean = false,
  ): PaginatedResult<any> {
    const db = DatabaseManager.getInstance();
    const offset = (page - 1) * pageSize;

    let whereClause = "WHERE quantity > 0";
    if (lowStockOnly) {
      whereClause += " AND quantity <= 10"; // simplistic low stock
    }

    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM inventory_batches ${whereClause}`)
      .get() as { total: number };
    const total = countRow.total;

    const rows = db
      .prepare(
        `
      SELECT ib.*, p.name as product_name 
      FROM inventory_batches ib 
      JOIN products p ON ib.product_id = p.id 
      ${whereClause} 
      ORDER BY ib.expiry_date ASC 
      LIMIT ? OFFSET ?
    `,
      )
      .all(pageSize, offset);

    return {
      items: rows as any[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static getFinancials(start: number, end: number) {
    return FinancialService.getSummaryByDateRange(start, end);
  }

  static getInventoryReport(
    start: number,
    end: number,
    page: number = 1,
    pageSize: number = 50,
  ): PaginatedResult<any> {
    const db = DatabaseManager.getInstance();
    const offset = (page - 1) * pageSize;

    const countRow = db
      .prepare(
        "SELECT COUNT(*) as total FROM inventory_batches WHERE created_at >= ? AND created_at <= ?",
      )
      .get(start, end) as { total: number };
    const total = countRow.total;

    const rows = db
      .prepare(
        `
      SELECT ib.*, p.name as product_name 
      FROM inventory_batches ib 
      JOIN products p ON ib.product_id = p.id 
      WHERE ib.created_at >= ? AND ib.created_at <= ? 
      ORDER BY ib.created_at DESC 
      LIMIT ? OFFSET ?
    `,
      )
      .all(start, end, pageSize, offset);

    return {
      items: rows as any[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static getMedicinesReport(
    start: number,
    end: number,
    page: number = 1,
    pageSize: number = 50,
  ): PaginatedResult<any> {
    const db = DatabaseManager.getInstance();
    const offset = (page - 1) * pageSize;

    const countRow = db
      .prepare(
        "SELECT COUNT(*) as total FROM products WHERE created_at >= ? AND created_at <= ?",
      )
      .get(start, end) as { total: number };
    const total = countRow.total;

    const rows = db
      .prepare(
        "SELECT * FROM products WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
      )
      .all(start, end, pageSize, offset);

    return {
      items: rows as any[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
