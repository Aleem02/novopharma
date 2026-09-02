import { DatabaseManager } from "../connection";
import {
  Customer,
  Sale,
  PaginationOptions,
  PaginatedResult,
} from "../../../shared/types";

export class CustomerRepository {
  static findById(id: number): Customer | undefined {
    const db = DatabaseManager.getInstance();
    return db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as
      Customer | undefined;
  }

  static getPaginatedCustomers(
    options: PaginationOptions,
  ): PaginatedResult<Customer> {
    const db = DatabaseManager.getInstance();

    const page = options.page || 1;
    const pageSize = options.pageSize || 25;
    const offset = (page - 1) * pageSize;

    let countSql = "SELECT count(*) as count FROM customers WHERE 1=1";
    let dataSql = "SELECT * FROM customers WHERE 1=1";
    const countParams: any[] = [];
    const dataParams: any[] = [];

    if (options.search) {
      countSql += " AND (name LIKE ? OR phone LIKE ?)";
      dataSql += " AND (name LIKE ? OR phone LIKE ?)";
      countParams.push(`%${options.search}%`, `%${options.search}%`);
      dataParams.push(`%${options.search}%`, `%${options.search}%`);
    }

    if (options.search) {
      dataSql +=
        " ORDER BY CASE WHEN name LIKE ? THEN 1 WHEN name LIKE ? THEN 2 ELSE 3 END ASC, created_at DESC LIMIT ? OFFSET ?";
      dataParams.push(`${options.search}%`, `% ${options.search}%`);
    } else {
      let orderBy = "ORDER BY created_at DESC";
      if (options.sortBy) {
        const dir = options.sortDirection === "DESC" ? "DESC" : "ASC";
        orderBy = `ORDER BY ${options.sortBy} ${dir}`;
      }
      dataSql += ` ${orderBy} LIMIT ? OFFSET ?`;
    }

    const countRow = db.prepare(countSql).get(...countParams) as {
      count: number;
    };
    const total = countRow.count;

    dataParams.push(pageSize, offset);
    const items = db.prepare(dataSql).all(...dataParams) as Customer[];

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static getCustomerSales(
    customerId: number,
    page: number = 1,
    pageSize: number = 50,
  ): { data: Sale[]; total: number } {
    const db = DatabaseManager.getInstance();
    const offset = (page - 1) * pageSize;

    const countRow = db
      .prepare("SELECT count(*) as count FROM sales WHERE customer_id = ?")
      .get(customerId) as { count: number };
    const total = countRow.count;

    const data = db
      .prepare(
        "SELECT * FROM sales WHERE customer_id = ? ORDER BY sale_date DESC LIMIT ? OFFSET ?",
      )
      .all(customerId, pageSize, offset) as Sale[];

    return { data, total };
  }
}
