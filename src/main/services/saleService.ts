import { DatabaseManager } from "../database/connection";
import { SaleRepository } from "../database/repositories/saleRepository";
import { ProductRepository } from "../database/repositories/productRepository";
import { SettingRepository } from "../database/repositories/settingRepository";
import {
  CreateSalePayload,
  Sale,
  ApiError,
  InventoryBatch,
  PaginationOptions,
  PaginatedResult,
} from "../../shared/types";
import { executeTransaction } from "../database/transactions";

export class SaleService {
  static createSale(payload: CreateSalePayload): Sale {
    return executeTransaction(DatabaseManager.getInstance(), () => {
      const db = DatabaseManager.getInstance();
      const now = Date.now();

      if (!payload.items || payload.items.length === 0) {
        throw new ApiError(400, "Sale must contain at least one item");
      }

      // 1. Payment Validation
      if (!payload.payments || payload.payments.length === 0) {
        // Fallback to legacy
        if (payload.payment_method) {
          payload.payments = [
            { payment_method: payload.payment_method, amount: 0 },
          ]; // Amount will be calculated below
        } else {
          throw new ApiError(400, "At least one payment method is required");
        }
      }
      for (const p of payload.payments) {
        if (p.amount < 0)
          throw new ApiError(400, "Payment amounts cannot be negative");
      }

      // Generate invoice number securely within the transaction
      const prefix = SettingRepository.get("invoice_prefix") || "INV-";
      const nextIdStr = SettingRepository.get("next_invoice_number") || "1";
      const nextId = parseInt(nextIdStr, 10) || 1;

      const invoiceNumber = `${prefix}${String(nextId).padStart(6, "0")}`;

      // Validate Invoice Uniqueness
      const checkInvoice = db
        .prepare("SELECT id FROM sales WHERE invoice_number = ?")
        .get(invoiceNumber);
      if (checkInvoice) {
        throw new ApiError(
          400,
          `Invoice sequence conflict: ${invoiceNumber} already exists. Please verify settings.`,
        );
      }

      // Increment and save immediately
      SettingRepository.set("next_invoice_number", (nextId + 1).toString());

      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      let grandTotal = 0;

      const saleItemsToInsert: Array<{
        product_id: number;
        entered_quantity: number;
        sale_unit: string;
        base_quantity: number;
        selling_price: number;
        original_selling_price: number;
        is_price_overridden: number;
        override_reason: string | null;
        mrp: number;
        tax_rate: number;
        tax_amount: number;
        discount_type: string | null;
        discount_value: number | null;
        discount_amount: number;
        line_total: number;
        batches: Array<{
          inventory_batch_id: number;
          batch_number: string;
          base_quantity: number;
          selling_price: number;
          mrp: number;
        }>;
      }> = [];

      // Prepare statements for stock
      const getBatchesStmt = db.prepare(`
        SELECT * FROM inventory_batches 
        WHERE product_id = ? AND quantity > 0 AND expiry_date >= ?
        ORDER BY expiry_date ASC
      `);

      const updateBatchQtyStmt = db.prepare(`
        UPDATE inventory_batches SET quantity = quantity - ?, updated_at = ?
        WHERE id = ?
      `);

      let saleGrossTotal = 0; // Sum of line totals before any bill discount

      for (const item of payload.items) {
        const product = ProductRepository.findById(item.product_id);
        if (!product)
          throw new ApiError(400, `Product ID ${item.product_id} not found`);
        if (product.is_active === 0)
          throw new ApiError(
            400,
            `Product ${product.name} is inactive and cannot be sold`,
          );
        if (!Number.isInteger(item.quantity) || item.quantity <= 0)
          throw new ApiError(
            400,
            `Quantity for ${product.name} must be a positive integer`,
          );
        if (
          product.selling_price < 0 ||
          product.tax_rate < 0 ||
          product.tax_rate > 10000
        ) {
          throw new ApiError(
            400,
            `Invalid financial configuration for product ${product.name}`,
          );
        }

        // Find available unexpired batches (FEFO by default, or user-selected batch first)
        let batches = getBatchesStmt.all(
          item.product_id,
          now,
        ) as InventoryBatch[];
        if (item.selected_batch_id) {
          const selected = batches.find((b) => b.id === item.selected_batch_id);
          if (selected) {
            batches = [
              selected,
              ...batches.filter((b) => b.id !== item.selected_batch_id),
            ];
          }
        }

        const unitsPerPack = product.units_per_pack || 1;
        const requestedQuantity = item.is_pack
          ? item.quantity * unitsPerPack
          : item.quantity;
        const enteredUnit = item.is_pack
          ? product.pack_type || "Pack"
          : product.unit || "Unit";
        const enteredQuantity = item.quantity;

        if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
          throw new ApiError(
            400,
            `Resolved quantity for ${product.name} must be a positive integer`,
          );
        }

        let remainingQtyToFulfill = requestedQuantity;
        const itemBatches: any[] = [];
        let blendedMrpSum = 0;
        let blendedSellingPriceSum = 0;

        for (const batch of batches) {
          if (remainingQtyToFulfill <= 0) break;

          const qtyFromThisBatch = Math.min(
            batch.quantity,
            remainingQtyToFulfill,
          );

          const actualSellingPrice =
            batch.selling_price > 0
              ? batch.selling_price
              : product.selling_price;
          const actualMrp = batch.mrp > 0 ? batch.mrp : product.selling_price;

          blendedSellingPriceSum += actualSellingPrice * qtyFromThisBatch;
          blendedMrpSum += actualMrp * qtyFromThisBatch;

          itemBatches.push({
            inventory_batch_id: batch.id,
            batch_number: batch.batch_number,
            base_quantity: qtyFromThisBatch,
            selling_price: actualSellingPrice,
            mrp: actualMrp,
          });

          updateBatchQtyStmt.run(qtyFromThisBatch, now, batch.id);
          remainingQtyToFulfill -= qtyFromThisBatch;
        }

        if (remainingQtyToFulfill > 0) {
          throw new ApiError(
            400,
            `Insufficient stock for ${product.name}. Requested: ${requestedQuantity}, Available: ${requestedQuantity - remainingQtyToFulfill}`,
          );
        }

        // Calculate blended prices per base unit
        const blendedSellingPrice = Math.round(
          blendedSellingPriceSum / requestedQuantity,
        );
        const blendedMrp = Math.round(blendedMrpSum / requestedQuantity);

        const originalCommercialSellingPrice = item.is_pack
          ? blendedSellingPrice * unitsPerPack
          : blendedSellingPrice;
        const commercialMrp = item.is_pack
          ? blendedMrp * unitsPerPack
          : blendedMrp;

        let finalCommercialSellingPrice = originalCommercialSellingPrice;

        if (item.is_price_overridden && item.overridden_price !== undefined) {
          if (item.overridden_price < 0)
            throw new ApiError(
              400,
              `Overridden price for ${product.name} cannot be negative`,
            );
          if (item.overridden_price > commercialMrp)
            throw new ApiError(
              400,
              `Overridden price for ${product.name} cannot exceed MRP of ${commercialMrp}`,
            );
          finalCommercialSellingPrice = item.overridden_price;
        }

        // Calculate line gross (inclusive of tax) based on final selling price
        const lineGross = finalCommercialSellingPrice * enteredQuantity;

        // Calculate Line Discount
        let lineDiscountAmount = 0;
        if (item.discount_type === "PERCENTAGE" && item.discount_value) {
          if (item.discount_value > 100 || item.discount_value < 0)
            throw new ApiError(
              400,
              `Invalid percentage discount for ${product.name}`,
            );
          lineDiscountAmount = Math.round(
            (lineGross * item.discount_value) / 100,
          );
        } else if (item.discount_type === "FIXED" && item.discount_value) {
          if (item.discount_value > lineGross || item.discount_value < 0)
            throw new ApiError(
              400,
              `Invalid fixed discount for ${product.name}`,
            );
          lineDiscountAmount = item.discount_value;
        }

        const discountedLineTotal = lineGross - lineDiscountAmount;

        // Final line tax calculation (inclusive tax extracted from discounted total)
        // Wait, bill discounts will further reduce the taxable amount.
        // We will calculate exact tax after bill discounts later. For now, store the raw discounted total.

        // Calculate tax per line right now, assuming no bill discount yet. We will recalculate if bill discount exists.
        const lineTaxAmount = Math.round(
          (discountedLineTotal * product.tax_rate) / (10000 + product.tax_rate),
        );

        saleItemsToInsert.push({
          product_id: product.id,
          entered_quantity: enteredQuantity,
          sale_unit: enteredUnit,
          base_quantity: requestedQuantity,

          // We store per-base-unit values for consistency in legacy fields
          selling_price:
            item.is_price_overridden && item.overridden_price !== undefined
              ? Math.round(
                  item.overridden_price / (item.is_pack ? unitsPerPack : 1),
                )
              : blendedSellingPrice,
          original_selling_price: blendedSellingPrice,
          is_price_overridden: item.is_price_overridden ? 1 : 0,
          override_reason: item.override_reason || null,
          mrp: blendedMrp,

          tax_rate: product.tax_rate,
          tax_amount: lineTaxAmount, // Might be adjusted below
          discount_type: item.discount_type || null,
          discount_value: item.discount_value || null,
          discount_amount: lineDiscountAmount,
          line_total: discountedLineTotal, // Final line amount
          batches: itemBatches,
        });

        saleGrossTotal += discountedLineTotal;
        subtotal +=
          lineGross -
          Math.round(
            (lineGross * product.tax_rate) / (10000 + product.tax_rate),
          );
      }

      // Calculate Bill Level Discount
      let billDiscountAmount = 0;
      if (
        payload.bill_discount_type === "PERCENTAGE" &&
        payload.bill_discount_value
      ) {
        if (
          payload.bill_discount_value > 100 ||
          payload.bill_discount_value < 0
        )
          throw new ApiError(400, `Invalid bill percentage discount`);
        billDiscountAmount = Math.round(
          (saleGrossTotal * payload.bill_discount_value) / 100,
        );
      } else if (
        payload.bill_discount_type === "FIXED" &&
        payload.bill_discount_value
      ) {
        if (
          payload.bill_discount_value > saleGrossTotal ||
          payload.bill_discount_value < 0
        )
          throw new ApiError(400, `Invalid bill fixed discount`);
        billDiscountAmount = payload.bill_discount_value;
      }

      totalDiscount =
        saleItemsToInsert.reduce((sum, item) => sum + item.discount_amount, 0) +
        billDiscountAmount;
      grandTotal = saleGrossTotal - billDiscountAmount;

      // If there is a bill discount, we must apportion it to correctly calculate total tax.
      // Easiest is to sum all tax amounts apportioned.
      totalTax = 0;
      subtotal = 0;

      for (const item of saleItemsToInsert) {
        // Apportion bill discount
        let apportionedBillDiscount = 0;
        if (billDiscountAmount > 0 && saleGrossTotal > 0) {
          apportionedBillDiscount = Math.round(
            (item.line_total / saleGrossTotal) * billDiscountAmount,
          );
        }

        const finalTaxableLineAmount =
          item.line_total - apportionedBillDiscount;
        const finalLineTax = Math.round(
          (finalTaxableLineAmount * item.tax_rate) / (10000 + item.tax_rate),
        );

        item.tax_amount = finalLineTax;
        totalTax += finalLineTax;
        subtotal +=
          item.line_total +
          item.discount_amount -
          Math.round(
            ((item.line_total + item.discount_amount) * item.tax_rate) /
              (10000 + item.tax_rate),
          );
      }

      // Calculate Payments
      let totalReceived = payload.received_amount || 0;
      let totalPaymentEntries = payload.payments.reduce(
        (sum, p) => sum + p.amount,
        0,
      );

      // Legacy fallback
      if (payload.payments.length === 1 && payload.payments[0].amount === 0) {
        payload.payments[0].amount = grandTotal;
        totalPaymentEntries = grandTotal;
        if (payload.received_amount === undefined) totalReceived = grandTotal;
      }

      if (totalPaymentEntries < grandTotal) {
        throw new ApiError(
          400,
          `Insufficient payment. Total: ${grandTotal}, Provided: ${totalPaymentEntries}`,
        );
      }

      const changeAmount =
        payload.change_amount !== undefined
          ? payload.change_amount
          : totalReceived > grandTotal
            ? totalReceived - grandTotal
            : 0;

      // Insert Sale
      const saleStmt = db.prepare(`
        INSERT INTO sales (
          invoice_number, sale_date, subtotal, 
          bill_discount_type, bill_discount_value, discount_amount, 
          tax_amount, total_amount, payment_method, received_amount, change_amount, 
          status, created_at, updated_at, customer_id, prescription_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)
      `);

      const primaryPaymentMethod =
        payload.payments.length > 0
          ? payload.payments[0].payment_method
          : "CASH";

      const saleResult = saleStmt.run(
        invoiceNumber,
        now,
        subtotal,
        payload.bill_discount_type || null,
        payload.bill_discount_value || null,
        totalDiscount,
        totalTax,
        grandTotal,
        primaryPaymentMethod,
        totalReceived,
        changeAmount,
        now,
        now,
        payload.customer_id || null,
        payload.prescription_id || null,
      );

      const saleId = saleResult.lastInsertRowid as number;

      // Insert Sale Items
      const itemStmt = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, entered_quantity, sale_unit, base_quantity, 
          selling_price, original_selling_price, is_price_overridden, override_reason, mrp, 
          tax_rate, tax_amount, discount_type, discount_value, discount_amount, line_total, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const batchStmt = db.prepare(`
        INSERT INTO sale_item_batches (
          sale_item_id, inventory_batch_id, batch_number, base_quantity, selling_price, mrp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const si of saleItemsToInsert) {
        const result = itemStmt.run(
          saleId,
          si.product_id,
          si.entered_quantity,
          si.sale_unit,
          si.base_quantity,
          si.selling_price,
          si.original_selling_price,
          si.is_price_overridden,
          si.override_reason,
          si.mrp,
          si.tax_rate,
          si.tax_amount,
          si.discount_type,
          si.discount_value,
          si.discount_amount,
          si.line_total,
          now,
        );
        const saleItemId = result.lastInsertRowid as number;

        for (const b of si.batches) {
          batchStmt.run(
            saleItemId,
            b.inventory_batch_id,
            b.batch_number,
            b.base_quantity,
            b.selling_price,
            b.mrp,
            now,
          );
        }
      }

      // Insert Payments
      const paymentStmt = db.prepare(`
        INSERT INTO sale_payments (
           sale_id, payment_method, amount, reference_number, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `);

      for (const p of payload.payments) {
        if (p.amount > 0) {
          paymentStmt.run(
            saleId,
            p.payment_method,
            p.amount,
            p.reference_number || null,
            now,
          );
        }
      }

      return SaleRepository.findById(saleId) as Sale;
    });
  }

  static getSale(id: number): Sale {
    const sale = SaleRepository.findById(id);
    if (!sale) throw new ApiError(404, "Sale not found");

    const db = DatabaseManager.getInstance();
    const payments = db
      .prepare("SELECT * FROM sale_payments WHERE sale_id = ?")
      .all(id) as any[];
    sale.payments = payments;
    return sale;
  }

  static getSaleByInvoiceNumber(invoiceNumber: string): Sale {
    const sale = SaleRepository.findByInvoiceNumber(invoiceNumber);
    if (!sale) throw new ApiError(404, "Sale not found");

    const db = DatabaseManager.getInstance();
    const payments = db
      .prepare("SELECT * FROM sale_payments WHERE sale_id = ?")
      .all(sale.id) as any[];
    sale.payments = payments;
    return sale;
  }

  static getPaginatedSales(options: PaginationOptions): PaginatedResult<Sale> {
    return SaleRepository.getPaginatedSales(options);
  }

  static listSales(): Sale[] {
    const sales = SaleRepository.list();
    return sales;
  }
}
