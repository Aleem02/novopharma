import { DatabaseManager } from "../connection";
import {
  InventoryBatch,
  PaginationOptions,
  PaginatedResult,
} from "../../../shared/types";

export class InventoryRepository {
  static getBatch(
    productId: number,
    batchNumber: string,
  ): InventoryBatch | undefined {
    const db = DatabaseManager.getInstance();
    const stmt = db.prepare(
      `SELECT * FROM inventory_batches WHERE product_id = ? AND batch_number = ?`,
    );
    return stmt.get(productId, batchNumber) as InventoryBatch | undefined;
  }

  static getPaginatedBatches(
    options: PaginationOptions,
  ): PaginatedResult<InventoryBatch> {
    const db = DatabaseManager.getInstance();

    let baseQuery = `
      FROM inventory_batches b
      LEFT JOIN products p ON b.product_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (options.search) {
      baseQuery += ` AND (p.name LIKE ? OR p.generic_name LIKE ? OR b.batch_number LIKE ?)`;
      const searchParam = `%${options.search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (options.filter) {
      const now = Date.now();
      const ninetyDays = 90 * 24 * 60 * 60 * 1000;

      if (options.filter === "EXPIRED") {
        baseQuery += ` AND b.expiry_date < ?`;
        params.push(now);
      } else if (options.filter === "EXPIRING_SOON") {
        baseQuery += ` AND b.expiry_date >= ? AND b.expiry_date < ?`;
        params.push(now, now + ninetyDays);
      } else if (options.filter === "LOW_STOCK") {
        baseQuery += ` AND b.quantity > 0 AND b.quantity < 10`;
      }
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const totalRow = db.prepare(countQuery).get(...params) as { total: number };
    const total = totalRow.total;

    // Sort
    let orderBy = "ORDER BY b.expiry_date ASC"; // default
    if (options.sortBy) {
      const dir = options.sortDirection === "DESC" ? "DESC" : "ASC";
      if (options.sortBy === "name") orderBy = `ORDER BY p.name ${dir}`;
      else if (options.sortBy === "expiry_date")
        orderBy = `ORDER BY b.expiry_date ${dir}`;
      else if (options.sortBy === "quantity")
        orderBy = `ORDER BY b.quantity ${dir}`;
      else if (options.sortBy === "mrp") orderBy = `ORDER BY b.mrp ${dir}`;
    }

    // Pagination
    const page = options.page || 1;
    const pageSize = options.pageSize || 25;
    const offset = (page - 1) * pageSize;

    const dataQuery = `
      SELECT b.*, 
             p.id as p_id, p.name as p_name, p.generic_name as p_generic_name, p.manufacturer as p_manufacturer, p.barcode as p_barcode
      ${baseQuery}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    const paginatedParams = [...params, pageSize, offset];

    const rows = db.prepare(dataQuery).all(...paginatedParams) as any[];

    const items = rows.map((row) => {
      const batch: any = { ...row };
      // Remove joined product fields from root
      delete batch.p_id;
      delete batch.p_name;
      delete batch.p_generic_name;
      delete batch.p_manufacturer;
      delete batch.p_barcode;

      batch.product = {
        id: row.p_id,
        name: row.p_name,
        generic_name: row.p_generic_name,
        manufacturer: row.p_manufacturer,
        barcode: row.p_barcode,
      };
      return batch as InventoryBatch;
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static getSummary(): {
    totalProducts: number;
    activeBatches: number;
    expiringSoon: number;
    expired: number;
  } {
    const db = DatabaseManager.getInstance();
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;

    const totalProducts = (
      db.prepare(`SELECT COUNT(id) as count FROM products`).get() as {
        count: number;
      }
    ).count;
    const activeBatches = (
      db
        .prepare(
          `SELECT COUNT(id) as count FROM inventory_batches WHERE quantity > 0`,
        )
        .get() as { count: number }
    ).count;
    const expiringSoon = (
      db
        .prepare(
          `SELECT COUNT(id) as count FROM inventory_batches WHERE quantity > 0 AND expiry_date >= ? AND expiry_date < ?`,
        )
        .get(now, now + ninetyDays) as { count: number }
    ).count;
    const expired = (
      db
        .prepare(
          `SELECT COUNT(id) as count FROM inventory_batches WHERE quantity > 0 AND expiry_date < ?`,
        )
        .get(now) as { count: number }
    ).count;

    return { totalProducts, activeBatches, expiringSoon, expired };
  }

  static listAll(): InventoryBatch[] {
    const db = DatabaseManager.getInstance();
    const stmt = db.prepare(
      `SELECT * FROM inventory_batches ORDER BY expiry_date ASC`,
    );
    return stmt.all() as InventoryBatch[];
  }

  static findById(id: number): InventoryBatch | undefined {
    const db = DatabaseManager.getInstance();
    const stmt = db.prepare(`SELECT * FROM inventory_batches WHERE id = ?`);
    return stmt.get(id) as InventoryBatch | undefined;
  }

  static updateBatch(id: number, payload: Partial<InventoryBatch>): void {
    const db = DatabaseManager.getInstance();
    const updates: string[] = [];
    const values: any[] = [];

    if (payload.expiry_date !== undefined) {
      updates.push("expiry_date = ?");
      values.push(payload.expiry_date);
    }
    if (payload.mrp !== undefined) {
      updates.push("mrp = ?");
      values.push(payload.mrp);
    }
    if (payload.selling_price !== undefined) {
      updates.push("selling_price = ?");
      values.push(payload.selling_price);
    }

    if (updates.length === 0) return;

    updates.push("updated_at = ?");
    values.push(Date.now());

    values.push(id);

    const query = `UPDATE inventory_batches SET ${updates.join(", ")} WHERE id = ?`;
    db.prepare(query).run(...values);
  }
}
