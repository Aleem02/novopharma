import { BrowserWindow, dialog } from "electron";
import * as fs from "fs";
import { SaleService } from "./saleService";
import { PrescriptionService } from "./prescriptionService";
import { ReportService } from "./reportService";
import { SettingService } from "./settingService";
import { Logger } from "../infrastructure/logger";
import { CustomerService } from "./customerService";

export class DocumentService {
  private static async renderHtmlToPdf(html: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({ show: false });
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      win.webContents.on("did-finish-load", async () => {
        try {
          const pdfData = await win.webContents.printToPDF({
            printBackground: true,
            margins: { marginType: "printableArea" },
          });
          win.close();
          resolve(pdfData);
        } catch (e) {
          win.close();
          reject(e);
        }
      });
    });
  }

  private static async renderHtmlAndPrint(html: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const win = new BrowserWindow({ show: false });
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      win.webContents.on("did-finish-load", () => {
        win.webContents.print(
          { silent: false, printBackground: true },
          (success, failureReason) => {
            win.close();
            if (!success && failureReason !== "cancelled") {
              reject(new Error(`Print failed: ${failureReason}`));
            } else {
              resolve();
            }
          },
        );
      });
    });
  }

  private static getInvoiceHtml(saleId: number): string {
    const sale = SaleService.getSale(saleId);
    const settings = SettingService.getAllSettings();

    const itemsHtml =
      sale.items
        ?.map(
          (i) => `
      <tr>
        <td>${i.product?.name || "Unknown"}</td>
        <td>${i.batches && i.batches.length > 1 ? "MULTI" : i.batches?.[0]?.batch_number || i.batch_number || "N/A"}</td>
        <td>${i.entered_quantity} ${i.sale_unit}</td>
        <td>${(i.selling_price / 100).toFixed(2)}</td>
        <td>${(i.tax_rate / 100).toFixed(2)}%</td>
        <td>${(i.line_total / 100).toFixed(2)}</td>
      </tr>
    `,
        )
        .join("") || "";

    let customerHtml = "";
    if (sale.customer_id) {
      try {
        const customer = CustomerService.getCustomer(sale.customer_id);
        customerHtml = `<div class="customer-info"><strong>Billed To:</strong> ${customer.name} (Ph: ${customer.phone})</div>`;
      } catch (e) {
        // ignore
      }
    }

    return `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { text-align: center; color: #1a56db; }
            .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .pharmacy-info { font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f9fafb; }
            .totals { margin-top: 20px; float: right; width: 300px; }
            .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
            .totals .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>TAX INVOICE</h1>
          <div class="header">
            <div class="pharmacy-info">
              <h2>${settings.pharmacy_name || "NovoPharma"}</h2>
              <p>${settings.address || ""}</p>
              <p>Phone: ${settings.phone || ""}</p>
              <p>GSTIN: ${settings.gst_number || ""}</p>
            </div>
            <div class="invoice-details">
              <h3>Invoice #: ${sale.invoice_number}</h3>
              <p>Date: ${new Date(sale.sale_date).toLocaleString()}</p>
              <p>Status: ${sale.status}</p>
            </div>
          </div>
          ${customerHtml}
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Batch</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Tax %</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="totals">
            <div><span>Subtotal:</span> <span>₹${(sale.subtotal / 100).toFixed(2)}</span></div>
            <div><span>Tax:</span> <span>₹${(sale.tax_amount / 100).toFixed(2)}</span></div>
            <div><span>Discount:</span> <span>₹${(sale.discount_amount / 100).toFixed(2)}</span></div>
            <div class="grand-total"><span>Total:</span> <span>₹${(sale.total_amount / 100).toFixed(2)}</span></div>
          </div>
        </body>
      </html>
    `;
  }

  static async exportInvoice(
    saleId: number,
    format: "PDF" | "PRINT",
  ): Promise<void> {
    const html = this.getInvoiceHtml(saleId);
    if (format === "PRINT") {
      await this.renderHtmlAndPrint(html);
    } else {
      const pdf = await this.renderHtmlToPdf(html);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Save Invoice PDF",
        defaultPath: `Invoice_${saleId}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!canceled && filePath) {
        fs.writeFileSync(filePath, pdf);
      }
    }
  }

  private static getPrescriptionHtml(prescriptionId: number): string {
    const p = PrescriptionService.getPrescription(prescriptionId);
    const settings = SettingService.getAllSettings();

    let customerHtml = "";
    try {
      const customer = CustomerService.getCustomer(p.customer_id);
      customerHtml = `<p><strong>Patient Name:</strong> ${customer.name} (Ph: ${customer.phone})</p>`;
    } catch (e) {
      // ignore
    }

    const itemsHtml =
      p.items
        ?.map(
          (i) => `
      <li>
        <strong>${i.medicine_name_snapshot}</strong> 
        ${i.strength_snapshot ? `(${i.strength_snapshot})` : ""} - Qty: ${i.quantity}
        <br>
        <small>Dosage: ${i.dosage_instructions} | Freq: ${i.frequency || "-"} | Duration: ${i.duration || "-"}</small>
        ${i.notes ? `<br><small>Notes: ${i.notes}</small>` : ""}
      </li>
    `,
        )
        .join("") || "";

    return `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { text-align: center; color: #1a56db; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .content { margin-top: 20px; }
            ul { list-style-type: none; padding-left: 0; }
            li { border-bottom: 1px solid #eee; padding: 10px 0; }
          </style>
        </head>
        <body>
          <h1>PRESCRIPTION RECORD</h1>
          <div class="header">
            <div>
              <h2>${settings.pharmacy_name || "NovoPharma"}</h2>
            </div>
            <div>
              <p>Date: ${new Date(p.prescription_date).toLocaleDateString()}</p>
              <p>Dr. ${p.doctor_name} ${p.doctor_reg_number ? `(${p.doctor_reg_number})` : ""}</p>
            </div>
          </div>
          <div class="content">
            ${customerHtml}
            ${p.diagnosis_notes ? `<p><strong>Diagnosis:</strong> ${p.diagnosis_notes}</p>` : ""}
            <h3>Medicines</h3>
            <ul>
              ${itemsHtml}
            </ul>
          </div>
        </body>
      </html>
    `;
  }

  static async exportPrescription(
    prescriptionId: number,
    format: "PDF" | "PRINT",
  ): Promise<void> {
    const html = this.getPrescriptionHtml(prescriptionId);
    if (format === "PRINT") {
      await this.renderHtmlAndPrint(html);
    } else {
      const pdf = await this.renderHtmlToPdf(html);
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Save Prescription PDF",
        defaultPath: `Prescription_${prescriptionId}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!canceled && filePath) {
        fs.writeFileSync(filePath, pdf);
      }
    }
  }

  static async exportReportCsv(
    type: "SALES" | "FINANCIAL" | "INVENTORY" | "PURCHASES" | "MEDICINES",
    start: number,
    end: number,
  ): Promise<void> {
    let csv = "";
    if (type === "SALES") {
      const res = ReportService.getSales(start, end, 1, 1000000);
      csv = "Invoice Number,Date,Status,Payment Method,Subtotal,Tax,Total\n";
      res.items.forEach((s) => {
        csv += `${s.invoice_number},${new Date(s.sale_date).toISOString()},${s.status},${s.payment_method},${(s.subtotal / 100).toFixed(2)},${(s.tax_amount / 100).toFixed(2)},${(s.total_amount / 100).toFixed(2)}\n`;
      });
    } else if (type === "FINANCIAL") {
      const summary = ReportService.getFinancials(start, end);
      csv = "Metric,Value\n";
      csv += `Gross Sales,${(summary.todaySales / 100).toFixed(2)}\n`;
      csv += `Returns,${(summary.returnsRefunds / 100).toFixed(2)}\n`;
      csv += `Net Sales,${(summary.netSales / 100).toFixed(2)}\n`;
      csv += `Total Tax,${(summary.totalTax / 100).toFixed(2)}\n`;
    } else if (type === "INVENTORY") {
      const res = ReportService.getInventoryReport(start, end, 1, 1000000);
      csv =
        "Product Name,Batch Number,Expiry Date,Quantity,MRP,Purchase Price,Received Date\n";
      res.items.forEach((ib) => {
        csv += `"${ib.product_name || ""}",${ib.batch_number},${new Date(ib.expiry_date).toISOString().split("T")[0]},${ib.quantity},${(ib.mrp / 100).toFixed(2)},${(ib.purchase_price / 100).toFixed(2)},${new Date(ib.created_at).toISOString()}\n`;
      });
    } else if (type === "PURCHASES") {
      const res = ReportService.getPurchases(start, end, 1, 1000000);
      csv = "Invoice Number,Supplier,Purchase Date,Status,Total Amount\n";
      res.items.forEach((p) => {
        csv += `${p.invoice_number || ""},"${p.supplier_name || p.supplier_id}",${new Date(p.purchase_date).toISOString().split("T")[0]},${p.status},${(p.total_amount / 100).toFixed(2)}\n`;
      });
    } else if (type === "MEDICINES") {
      const res = ReportService.getMedicinesReport(start, end, 1, 1000000);
      csv =
        "Name,Generic Name,Manufacturer,Category,Dosage Form,Strength,Unit,Barcode,Selling Price,Tax Rate,Is Active,Created Date\n";
      res.items.forEach((m) => {
        csv += `"${m.name || ""}","${m.generic_name || ""}","${m.manufacturer || ""}","${m.category || ""}","${m.dosage_form || ""}","${m.strength || ""}","${m.unit || ""}","${m.barcode || ""}",${(m.selling_price / 100).toFixed(2)},${m.tax_rate}%,${m.is_active ? "Active" : "Inactive"},${new Date(m.created_at).toISOString()}\n`;
      });
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `Save ${type} Report CSV`,
      defaultPath: `${type}_Report.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (!canceled && filePath) {
      fs.writeFileSync(filePath, csv);
    }
  }
}
