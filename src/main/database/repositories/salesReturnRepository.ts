import { DatabaseManager } from "../connection";
import { SalesReturn, Product } from "../../../shared/types";

export class SalesReturnRepository {
  static findById(id: number): SalesReturn | undefined {
    const db = DatabaseManager.getInstance();
    const salesReturn = db
      .prepare("SELECT * FROM sales_returns WHERE id = ?")
      .get(id) as SalesReturn | undefined;
    if (!salesReturn) return undefined;

    const items = db
      .prepare(
        `
      SELECT sri.*, 
             p.name as product_name, p.generic_name as product_generic_name, 
             p.barcode as product_barcode, p.strength as product_strength
      FROM sales_return_items sri
      JOIN products p ON sri.product_id = p.id
      WHERE sri.sales_return_id = ?
    `,
      )
      .all(id) as any[];

    salesReturn.items = items.map((item) => {
      const {
        product_name,
        product_generic_name,
        product_barcode,
        product_strength,
        ...rest
      } = item;
      return {
        ...rest,
        product: {
          id: item.product_id,
          name: product_name,
          generic_name: product_generic_name,
          barcode: product_barcode,
          strength: product_strength,
        } as Product,
      };
    });

    return salesReturn;
  }

  static findByReturnNumber(returnNumber: string): SalesReturn | undefined {
    const db = DatabaseManager.getInstance();
    const row = db
      .prepare("SELECT id FROM sales_returns WHERE return_number = ?")
      .get(returnNumber) as { id: number } | undefined;
    if (!row) return undefined;
    return this.findById(row.id);
  }

  static list(): SalesReturn[] {
    const db = DatabaseManager.getInstance();
    const list = db
      .prepare("SELECT * FROM sales_returns ORDER BY return_date DESC")
      .all() as SalesReturn[];
    return list.map((item) => this.findById(item.id)!);
  }

  static getAlreadyReturnedQuantity(saleItemId: number): number {
    const db = DatabaseManager.getInstance();
    const row = db
      .prepare(
        `
      SELECT COALESCE(SUM(quantity), 0) as total 
      FROM sales_return_items 
      WHERE sale_item_id = ?
    `,
      )
      .get(saleItemId) as { total: number };
    return row.total;
  }
}
