import { DatabaseManager } from "../database/connection";
import { SalesReturnRepository } from "../database/repositories/salesReturnRepository";
import { SaleRepository } from "../database/repositories/saleRepository";
import {
  CreateSalesReturnPayload,
  SalesReturn,
  ApiError,
} from "../../shared/types";
import { executeTransaction } from "../database/transactions";

export class SalesReturnService {
  static createReturn(payload: CreateSalesReturnPayload): SalesReturn {
    return executeTransaction(DatabaseManager.getInstance(), () => {
      const db = DatabaseManager.getInstance();
      const now = Date.now();

      const sale = SaleRepository.findById(payload.sale_id);
      if (!sale) {
        throw new ApiError(404, `Sale with ID ${payload.sale_id} not found`);
      }

      if (!payload.items || payload.items.length === 0) {
        throw new ApiError(400, "Return must contain at least one item");
      }

      // Generate secure return number
      const lastIdRow = db
        .prepare("SELECT id FROM sales_returns ORDER BY id DESC LIMIT 1")
        .get() as { id: number } | undefined;
      const nextId = (lastIdRow?.id || 0) + 1;
      const returnNumber = `RET-${String(nextId).padStart(6, "0")}`;

      let totalRefund = 0;
      const returnItemsToInsert: Array<{
        sale_item_id: number;
        product_id: number;
        inventory_batch_id: number;
        entered_quantity: number;
        return_unit: string;
        quantity: number;
        original_selling_price: number;
        tax_rate: number;
        tax_amount: number;
        discount_amount: number;
        refund_amount: number;
      }> = [];

      // Prepare statements
      const updateBatchStmt = db.prepare(`
        UPDATE inventory_batches 
        SET quantity = quantity + ?, updated_at = ?
        WHERE id = ?
      `);

      for (const item of payload.items) {
        const saleItem = sale.items?.find((si) => si.id === item.sale_item_id);
        if (!saleItem) {
          throw new ApiError(
            400,
            `Sale item ID ${item.sale_item_id} not found on invoice ${sale.invoice_number}`,
          );
        }

        const product = saleItem.product;
        const unitsPerPack = product?.units_per_pack || 1;
        const requestedReturnBaseQty = item.is_pack
          ? item.quantity * unitsPerPack
          : item.quantity;
        const enteredReturnQty = item.quantity;
        const returnUnit = item.is_pack
          ? product?.pack_type || "Pack"
          : product?.unit || "Unit";

        if (
          !Number.isInteger(requestedReturnBaseQty) ||
          requestedReturnBaseQty <= 0
        ) {
          throw new ApiError(
            400,
            `Return quantity must resolve to a positive integer`,
          );
        }

        const alreadyReturned =
          SalesReturnRepository.getAlreadyReturnedQuantity(item.sale_item_id);
        if (alreadyReturned + requestedReturnBaseQty > saleItem.base_quantity) {
          throw new ApiError(
            400,
            `Cannot return more than originally sold. Sold: ${saleItem.base_quantity}, Already Returned: ${alreadyReturned}, Attempted: ${requestedReturnBaseQty}`,
          );
        }

        let remainingQtyToReturn = requestedReturnBaseQty;
        const batches = [...(saleItem.batches || [])].reverse(); // LIFO return

        // Fallback for legacy sales that don't have sale_item_batches
        if (batches.length === 0 && saleItem.inventory_batch_id) {
          batches.push({
            id: 0,
            sale_item_id: saleItem.id,
            inventory_batch_id: saleItem.inventory_batch_id,
            batch_number: saleItem.batch_number!,
            base_quantity: saleItem.base_quantity,
            selling_price: saleItem.selling_price,
            mrp: saleItem.mrp,
            created_at: saleItem.created_at,
          });
        }

        for (const batch of batches) {
          if (remainingQtyToReturn <= 0) break;

          const batchAlreadyReturnedRow = db
            .prepare(
              `
             SELECT SUM(quantity) as total FROM sales_return_items 
             WHERE sale_item_id = ? AND inventory_batch_id = ?
           `,
            )
            .get(saleItem.id, batch.inventory_batch_id) as {
            total: number | null;
          };

          const batchAlreadyReturned = batchAlreadyReturnedRow?.total || 0;
          const batchAvailableToReturn =
            batch.base_quantity - batchAlreadyReturned;

          if (batchAvailableToReturn <= 0) continue;

          const qtyToReturnToThisBatch = Math.min(
            batchAvailableToReturn,
            remainingQtyToReturn,
          );

          const apportionedDiscount = Math.round(
            (saleItem.discount_amount * qtyToReturnToThisBatch) /
              saleItem.base_quantity,
          );
          const apportionedTax = Math.round(
            (saleItem.tax_amount * qtyToReturnToThisBatch) /
              saleItem.base_quantity,
          );

          // Use overridden price if applicable, otherwise use the specific batch's selling price
          const effectiveSellingPrice = saleItem.is_price_overridden
            ? saleItem.selling_price
            : batch.selling_price;
          const lineTotal = qtyToReturnToThisBatch * effectiveSellingPrice;
          const refundAmount = lineTotal - apportionedDiscount;

          returnItemsToInsert.push({
            sale_item_id: saleItem.id,
            product_id: saleItem.product_id,
            inventory_batch_id: batch.inventory_batch_id,
            entered_quantity: enteredReturnQty,
            return_unit: returnUnit,
            quantity: qtyToReturnToThisBatch,
            original_selling_price: effectiveSellingPrice,
            tax_rate: saleItem.tax_rate,
            tax_amount: apportionedTax,
            discount_amount: apportionedDiscount,
            refund_amount: refundAmount,
          });

          totalRefund += refundAmount;

          // Restock ONLY if the item is not damaged or expired
          if (
            payload.reason !== "Damaged / Defective" &&
            payload.reason !== "Expired Medicine"
          ) {
            updateBatchStmt.run(
              qtyToReturnToThisBatch,
              now,
              batch.inventory_batch_id,
            );
          }

          remainingQtyToReturn -= qtyToReturnToThisBatch;
        }

        if (remainingQtyToReturn > 0) {
          throw new ApiError(
            500,
            `Failed to fully apportion return to batches for sale item ${saleItem.id}`,
          );
        }
      }

      // 2. Insert Sales Return record
      const returnStmt = db.prepare(`
        INSERT INTO sales_returns (
          sale_id, return_number, return_date, refund_amount, reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      const returnResult = returnStmt.run(
        payload.sale_id,
        returnNumber,
        now,
        totalRefund,
        payload.reason,
        now,
      );
      const salesReturnId = returnResult.lastInsertRowid as number;

      // 3. Insert Sales Return Items
      const returnItemStmt = db.prepare(`
        INSERT INTO sales_return_items (
          sales_return_id, sale_item_id, product_id, inventory_batch_id, entered_quantity, return_unit, quantity,
          original_selling_price, tax_rate, tax_amount, discount_amount, refund_amount, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ri of returnItemsToInsert) {
        returnItemStmt.run(
          salesReturnId,
          ri.sale_item_id,
          ri.product_id,
          ri.inventory_batch_id,
          ri.entered_quantity,
          ri.return_unit,
          ri.quantity,
          ri.original_selling_price,
          ri.tax_rate,
          ri.tax_amount,
          ri.discount_amount,
          ri.refund_amount,
          now,
        );
      }

      // 4. Update Original Sale status if fully returned
      // Check cumulative quantities
      let totalSold = 0;
      let totalReturned = 0;

      for (const si of sale.items || []) {
        totalSold += si.base_quantity;
        const totalReturnedForItem =
          SalesReturnRepository.getAlreadyReturnedQuantity(si.id);
        totalReturned += totalReturnedForItem;
      }

      let newStatus: string = sale.status;
      if (totalReturned > 0) {
        if (totalReturned >= totalSold) {
          newStatus = "REFUNDED";
        } else {
          newStatus = "PARTIALLY_REFUNDED";
        }
      }

      if (newStatus !== sale.status) {
        db.prepare(
          "UPDATE sales SET status = ?, updated_at = ? WHERE id = ?",
        ).run(newStatus, now, sale.id);
      }

      return SalesReturnRepository.findById(salesReturnId) as SalesReturn;
    });
  }

  static getReturn(id: number): SalesReturn {
    const sr = SalesReturnRepository.findById(id);
    if (!sr) throw new ApiError(404, "Sales return not found");
    return sr;
  }

  static listReturns(): SalesReturn[] {
    return SalesReturnRepository.list();
  }
}
