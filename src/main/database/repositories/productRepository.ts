import { DatabaseManager } from "../connection";
import {
  Product,
  CreateProductPayload,
  UpdateProductPayload,
  PaginationOptions,
  PaginatedResult,
} from "../../../shared/types";

export class ProductRepository {
  static create(payload: CreateProductPayload): Product {
    const db = DatabaseManager.getInstance();

    const stmt = db.prepare(`
      INSERT INTO products (
        name, generic_name, manufacturer, category, therapeutic_category,
        dosage_form, strength, unit, pack_type, units_per_pack, pack_description,
        hsn_code, drug_schedule, prescription_required,
        barcode, sku, reorder_level, min_stock, max_stock, rack, shelf, preferred_supplier_id,
        selling_price, tax_rate, is_active, 
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `);

    const now = Date.now();
    const result = stmt.run(
      payload.name,
      payload.generic_name || null,
      payload.manufacturer || null,
      payload.category || null,
      payload.therapeutic_category || null,
      payload.dosage_form || null,
      payload.strength || null,
      payload.unit || null,
      payload.pack_type || null,
      payload.units_per_pack ?? null,
      payload.pack_description || null,
      payload.hsn_code || null,
      payload.drug_schedule || null,
      payload.prescription_required ?? 0,
      payload.barcode || null,
      payload.sku || null,
      payload.reorder_level ?? 0,
      payload.min_stock ?? 0,
      payload.max_stock ?? 0,
      payload.rack || null,
      payload.shelf || null,
      payload.preferred_supplier_id ?? null,
      payload.selling_price,
      payload.tax_rate,
      payload.is_active !== undefined ? payload.is_active : 1,
      now,
      now,
    );

    return this.findById(result.lastInsertRowid as number) as Product;
  }

  static findById(id: number): Product | undefined {
    const db = DatabaseManager.getInstance();
    const stmt = db.prepare(`SELECT * FROM products WHERE id = ?`);
    const row = stmt.get(id) as Product | undefined;
    return row;
  }

  static update(id: number, payload: UpdateProductPayload): Product {
    const db = DatabaseManager.getInstance();

    const current = this.findById(id);
    if (!current) {
      throw new Error(`Product with ID ${id} not found`);
    }

    const updates: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return current;
    }

    updates.push(`updated_at = ?`);
    values.push(Date.now());
    values.push(id);

    const sql = `UPDATE products SET ${updates.join(", ")} WHERE id = ?`;

    db.prepare(sql).run(...values);

    return this.findById(id) as Product;
  }

  static getPaginatedProducts(
    options: PaginationOptions,
  ): PaginatedResult<Product> {
    const db = DatabaseManager.getInstance();
    let baseQuery = `FROM products WHERE 1=1`;
    const params: any[] = [];

    if (options.search) {
      baseQuery += ` AND (name LIKE ? OR generic_name LIKE ? OR barcode = ?)`;
      const searchParam = `%${options.search}%`;
      params.push(searchParam, searchParam, options.search);
    }

    if (options.filter) {
      if (options.filter === "ACTIVE") {
        baseQuery += ` AND is_active = 1`;
      } else if (options.filter === "INACTIVE") {
        baseQuery += ` AND is_active = 0`;
      } else if (options.filter === "PRESCRIPTION") {
        baseQuery += ` AND prescription_required = 1`;
      }
    }

    const countQuery = `SELECT COUNT(id) as total ${baseQuery}`;
    const totalRow = db.prepare(countQuery).get(...params) as { total: number };
    const total = totalRow.total;

    let orderBy = "ORDER BY name ASC";
    if (options.sortBy) {
      const dir = options.sortDirection === "DESC" ? "DESC" : "ASC";
      orderBy = `ORDER BY ${options.sortBy} ${dir}`; // Be careful of SQL injection, whitelist sortBy at IPC layer
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 25;
    const offset = (page - 1) * pageSize;

    const dataQuery = `SELECT * ${baseQuery} ${orderBy} LIMIT ? OFFSET ?`;
    const items = db
      .prepare(dataQuery)
      .all(...params, pageSize, offset) as Product[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static list(): Product[] {
    const db = DatabaseManager.getInstance();
    const stmt = db.prepare(`SELECT * FROM products ORDER BY name ASC`);
    return stmt.all() as Product[];
  }

  static search(query: string): Product[] {
    const db = DatabaseManager.getInstance();

    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // 1. Exact barcode lookup first
    const exactBarcodeStmt = db.prepare(
      `SELECT * FROM products WHERE barcode = ?`,
    );
    const exactMatch = exactBarcodeStmt.get(cleanQuery) as Product | undefined;
    if (exactMatch) {
      return [exactMatch];
    }

    // Clean and split query into words
    const words = cleanQuery.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return [];

    // Exact string matching variables for priority sort
    const exactStart = `${cleanQuery}%`;
    const exactBoundary = `% ${cleanQuery}%`;

    // Build word-by-word conditions
    const nameConditions = words.map(() => `name LIKE ?`).join(" AND ");
    const genericNameConditions = words
      .map(() => `generic_name LIKE ?`)
      .join(" AND ");

    // Generate word bindings for LIKE statements
    const wordBindings = words.map((w) => `%${w}%`);

    const bindings = [
      ...wordBindings, // For name
      ...wordBindings, // For generic_name
      cleanQuery, // For barcode fallback
      exactStart,
      exactBoundary,
    ];

    const stmt = db.prepare(`
      SELECT * FROM products 
      WHERE (${nameConditions})
         OR (${genericNameConditions})
         OR barcode = ?
      ORDER BY 
        CASE 
          WHEN name LIKE ? THEN 1
          WHEN name LIKE ? THEN 2
          ELSE 3
        END ASC,
        name ASC
      LIMIT 50
    `);
    return stmt.all(...bindings) as Product[];
  }

  static setActive(id: number, active: boolean): Product {
    return this.update(id, { is_active: active ? 1 : 0 });
  }
}
