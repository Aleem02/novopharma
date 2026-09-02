import { DatabaseManager } from "../connection";
import { PurchaseReturn, Product } from "../../../shared/types";

export class PurchaseReturnRepository {
  static findById(id: number): PurchaseReturn | undefined {
    const db = DatabaseManager.getInstance();
    const pr = db
      .prepare("SELECT * FROM purchase_returns WHERE id = ?")
      .get(id) as PurchaseReturn | undefined;
    if (!pr) return undefined;

    const items = db
      .prepare(
        `
      SELECT pri.*, 
             p.name as product_name, p.generic_name as product_generic_name, 
             p.barcode as product_barcode, p.strength as product_strength
      FROM purchase_return_items pri
      JOIN products p ON pri.product_id = p.id
      WHERE pri.purchase_return_id = ?
    `,
      )
      .all(id) as any[];

    pr.items = items.map((item) => {
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

    return pr;
  }

  static findByReturnNumber(returnNumber: string): PurchaseReturn | undefined {
    const db = DatabaseManager.getInstance();
    const row = db
      .prepare("SELECT id FROM purchase_returns WHERE return_number = ?")
      .get(returnNumber) as { id: number } | undefined;
    if (!row) return undefined;
    return this.findById(row.id);
  }

  static list(): PurchaseReturn[] {
    const db = DatabaseManager.getInstance();
    const list = db
      .prepare("SELECT * FROM purchase_returns ORDER BY return_date DESC")
      .all() as PurchaseReturn[];
    return list.map((item) => this.findById(item.id)!);
  }

  static getAlreadyReturnedQuantity(purchaseItemId: number): number {
    const db = DatabaseManager.getInstance();
    const row = db
      .prepare(
        `
      SELECT COALESCE(SUM(quantity), 0) as total 
      FROM purchase_return_items 
      WHERE purchase_item_id = ?
    `,
      )
      .get(purchaseItemId) as { total: number };
    return row.total;
  }
}
