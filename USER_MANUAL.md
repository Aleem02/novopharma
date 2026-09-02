# NovoPharma — Comprehensive User Manual (V1.2.2)

Welcome to the official user manual for **NovoPharma**, your premium Windows desktop pharmacy management, inventory control, and Point-of-Sale (POS) billing system. This guide covers every feature, screen, field option, and workflow in detail.

---

## Table of Contents
1. [System Overview & Key Concepts](#1-system-overview--key-concepts)
2. [License Activation & First Launch](#2-license-activation--first-launch)
3. [The Main Dashboard](#3-the-main-dashboard)
4. [Supplier Master Module](#4-supplier-master-module)
5. [Product Master (Medicine Catalog)](#5-product-master-medicine-catalog)
6. [Purchases Module (Stock Inflow)](#6-purchases-module-stock-inflow)
7. [Inventory Management & Stock Adjustments](#7-inventory-management--stock-adjustments)
8. [Point of Sale (POS) Billing Terminal](#8-point-of-sale-pos-billing-terminal)
9. [Customer & Prescription Directory](#9-customer--prescription-directory)
10. [Sales & Purchase Returns](#10-sales--purchase-returns)
11. [Financial Reporting & Analytics](#11-financial-reporting--analytics)
12. [System Settings & Backups](#12-system-settings--backups)
13. [Keyboard Shortcut Reference Card](#13-keyboard-shortcut-reference-card)
14. [Troubleshooting & Maintenance](#14-troubleshooting--maintenance)

---

## 1. System Overview & Key Concepts

NovoPharma operates on a **dual-unit tracking system** combined with **batch-level inventory tracking** to ensure compliance and high profitability.

### Key Concepts

* **Base Unit (Loose Unit):** The smallest individual consumable quantity (e.g., `Tablet`, `Capsule`, `ml`, `gm`). All internal stock counts, sales statistics, and unit valuations are calculated using this unit.
* **Pack Unit (Wholesale Unit):** The wholesale package in which you purchase or sell items in bulk (e.g., `Strip` of 10 tablets, `Box` of 50 capsules, `Bottle` of syrup).
* **Conversion Rate (Units Per Pack):** The exact number of base units inside a pack unit. For example, if a strip contains 10 tablets, the conversion rate is `10`.
* **Batch-Level Inventory:** Inventory is tracked by distinct manufacturer batches. Each batch has its own:
  - Batch Number
  - Expiry Date
  - Purchase Price (Cost Price)
  - Maximum Retail Price (MRP)
  - Selling Price (configurable retail price)
  - Current Stock (units left)

---

## 2. License Activation & First Launch

When you launch NovoPharma for the first time, or after resetting your database, you will be greeted by the **License Activation Screen**.

### Activation Workflow
1. Connect your computer to the internet.
2. Enter the **Email Address** and **Password** provided by your administrator.
3. Click **Activate License**.
4. The system validates your license key against the central server:
   - Upon success, the app generates a hardware-locked installation signature on your PC.
   - It initializes your secure local SQLite database.
   - It redirects you automatically to the dashboard.
5. If the activation fails, verify your internet connection and credentials.

---

## 3. The Main Dashboard

The Dashboard provides a real-time overview of your pharmacy's financial health, inventory alerts, and operations.

### Key Sections:

* **Top Financial KPIs (Key Performance Indicators):**
  - **Gross Sales:** Total sales revenue collected over the selected period.
  - **Net Profit:** Profit margin calculated as `Sales Revenue - Cost of Goods Sold (COGS)`.
  - **Low Stock Items:** Count of products whose total stock falls below their configured Minimum Reorder Level.
  - **Expiring Batches:** Count of batches that are already expired or will expire within the next 90 days.
* **Low Stock Alerts Panel:** Lists all products needing immediate purchase orders. Shows current stock vs. reorder levels.
* **Near-Expiry Alerts Panel:** Color-coded list of batches approaching their expiration:
  - > [!WARNING]
    > **Yellow Alert:** Batches expiring within 90 days.
  - > [!CAUTION]
    > **Red Alert:** Batches that are already expired and must be quarantined immediately.
* **Recent Transactions:** The last 5 sales processed at the POS, detailing invoice numbers, times, customer names, and net values.

---

## 4. Supplier Master Module

The Supplier Master holds directories for all distributors and wholesale agents from whom you source medicines.

### How to Register a Supplier:
1. Navigate to **Tools** → **Supplier Master** (or press `F3` globally).
2. Click the **+ Add Supplier** button.
3. Complete the form fields:
   - **Supplier Name:** (Required) Business name.
   - **Contact Name:** Primary contact person.
   - **Phone Number:** Mobile or landline.
   - **Email:** Business email address.
   - **GSTIN:** (Optional) 15-character Goods and Services Tax Identification Number.
   - **Address:** Office or warehouse location.
4. Click **Save**.

---

## 5. Product Master (Medicine Catalog)

The Product Master is your global catalog. It contains the naming and default packaging parameters of the medicines you carry, independent of batch numbers and quantities.

### How to Add a Medicine to the Catalog:
1. Navigate to **Tools** → **Product Master** in the top menu bar.
2. Click **+ Add Product**.
3. Complete the form:
   - **Product Name:** (Required) e.g., `Dolo 650`.
   - **Generic Name (Composition):** (Required) e.g., `Paracetamol 650mg`.
   - **Category:** e.g., `Tablet`, `Capsule`, `Syrup`, `Ointment`, `Inhaler`.
   - **Base Unit:** The smallest unit sold (e.g., `Tablet`).
   - **Pack Unit:** The wholesale container unit (e.g., `Strip`).
   - **Units Per Pack:** The conversion rate (e.g., `10` tablets per strip).
   - **GST (%):** The tax rate applicable (e.g., `5%`, `12%`, `18%`).
   - **HSN Code:** Standard customs/tax code.
   - **Min Reorder Level (Base Units):** Trigger count for low-stock alerts.
   - **Prescription Required:** Check this box if the medicine is a Schedule H/H1 or Rx-only drug. The POS will display alerts and prompt for prescription registration if checked.
4. Click **Save**.

---

## 6. Purchases Module (Stock Inflow)

The Purchase screen allows you to log wholesale shipments from suppliers, register batches, and add stock to the inventory.

### Purchase Workflow:
1. Navigate to **Purchasing** → **New Purchase Bill**.
2. Select your **Supplier** from the dropdown.
3. Enter the **Invoice Number** and **Invoice Date** listed on the physical invoice sheet.
4. Add items using the entry form:
   - **Search Product:** Type the product name or generic composition.
   - **Purchase Type:** Choose **Packs** (e.g. buying 10 strips) or **Loose Units** (e.g. buying 5 individual bottles).
   - **Quantity:** Number of packs/units received.
   - **Purchase Price:** Cost price per pack/unit.
   - **MRP:** Maximum Retail Price printed on the pack/unit.
   - **Selling Price:** Retail price at which you intend to sell this batch.
   - **Batch Number:** (Required) Printed batch code.
   - **Expiry Date:** Month and Year of expiration.
5. Click **Add to Invoice**. The item will populate in the purchase grid below.
6. Click **Complete Purchase** to save. The database commits all items, increases inventory counts, and creates an audit trail.

---

## 7. Inventory Management & Stock Adjustments

The Inventory screen lets you track, filter, and adjust active pharmacy stock.

### Inventory Master:
* Displays current stock levels of all products.
* Expand any product row to see individual active batches, their locations, costs, selling prices, and expiry statuses.

### Stock Adjustments:
If stock is lost, broken, stolen, or expired, you must manually adjust inventory values:
1. Navigate to **Inventory** → **Stock Adjustments**.
2. Click **+ New Adjustment**.
3. Fill out the adjustment parameters:
   - **Search Batch:** Search for the specific product batch code.
   - **Adjustment Type:** Select **Add Stock** (e.g. found inventory) or **Reduce Stock** (e.g. theft, breakage, expiration).
   - **Quantity (Base Units):** Number of individual tablets/units to adjust.
   - **Reason:** Select the appropriate category (e.g., `Breakage`, `Expiration`, `Theft`, `Data Correction`).
   - **Notes:** Add descriptive comments for auditor reference.
4. Click **Submit Adjustment**. The inventory updates instantly, and an audit trail log is created.

---

## 8. Point of Sale (POS) Billing Terminal

The POS Terminal is the core billing interface of your pharmacy. It is optimized for rapid keyboard-only operations.

```
+-------------------------------------------------------------+
| [F1] Search Medicines  | [F2] Customer Search | [F8] Pay    |
+-------------------------------------------------------------+
| Patient: Walk-in       | Doctor: Dr. Sharma   | Items: 3    |
+-------------------------------------------------------------+
| Cart Items:                                                 |
| 1. DOLO 650 (Batch: D99)       - 1 Strip (10 Tabs)  - ₹20.00|
| 2. AUGZIN 200 (Batch: A12)     - 5 Tabs             - ₹15.00|
+-------------------------------------------------------------+
| Discounts: 5%          | Tax: ₹1.75           | Total: ₹35.00|
+-------------------------------------------------------------+
```

### Core POS Billing Workflow:

1. **Focus the Terminal:** Press `F1` to automatically clear and focus the product search bar.
2. **Add Items:** 
   - Scan a barcode or type a product name.
   - Use the **Arrow keys** to navigate search suggestions.
   - Press **Enter** to add the highlighted item to the cart.
3. **Configure Cart Items:**
   - **Unit Toggle:** Press the `/` key or click the unit label to switch between buying a full **Pack** (e.g. Strip) or a **Loose Unit** (e.g. 5 Tablets).
   - **Adjust Quantity:** Type the number or use `+` / `-` keys to increment/decrement.
   - **Item Discount:** Apply percentage discounts directly on individual rows.
   - **Price Override:** If authorized, click the selling rate to alter the rate for this customer.
4. **Prescription Check:** If an item requires a prescription, the system checks if a customer record with an attached prescription is linked. If not, it prompts a **Pharmacist Override Dialog** to proceed safely.
5. **Add Customer Details:** Press `F2` to focus the Customer details field.
   - Type the customer's name or phone number.
   - Navigate suggestions with arrow keys and select with **Enter**.
   - If they are a new customer, click **+ New** to register them.
6. **Checkout (Payment):** Press `F8` or click the Checkout button.
   - **Select Payment Method:** Choose **Cash**, **UPI**, **Card**, or **Split Payment** (allows combining Cash and UPI).
   - **Received Amount:** Enter the cash received. The POS computes the exact change due.
   - **Complete Bill:** Press `Enter` or click **Complete Sale** to save the sale, deduct stock, and open the thermal receipt print preview.

---

## 9. Customer & Prescription Directory

Track patient history, chronic disease records, and prescriptions for recurring refills.

### Creating a Customer & Prescription:
1. Navigate to **Customers** in the main menu.
2. Click **+ New Customer**.
3. Input the customer's Name, Phone, and Address.
4. Inside the customer detail view, click **+ Add Prescription**.
5. Complete the Prescription parameters:
   - **Doctor Name:** Prescribing physician.
   - **Prescription Date:** Issuance date.
   - **Reference Number:** Rx slip identifier.
   - **Search & Add Medicines:** Search from your catalog, input the **Dosage Instructions** (e.g., `1-0-1 after meals`), and specify the total **Quantity (in base units)** required.
6. Click **Save Prescription**.

---

## 10. Sales & Purchase Returns

Manage customer returns and distributor returns with automated inventory and financial calculation.

### Sales Return (Customer Return):
1. Navigate to **Sales** → **Sales Returns**.
2. Input the **Invoice Number** to locate the purchase.
3. Choose the items and specify the quantities being returned.
4. Select the return reason:
   - **Sellable:** Items are returned to inventory stock.
   - **Damaged / Expired:** Items are marked as waste and quarantined.
5. Click **Complete Return**. The system computes the refund amount using the original purchase price (less discounts applied).

### Purchase Return (Supplier Return):
1. Navigate to **Purchasing** → **Purchase Returns**.
2. Click **+ Create Return**.
3. Select the **Supplier** and select the product batch.
4. Enter the return quantity and the credit note details.
5. Click **Submit Return**. Stock is subtracted from inventory.

---

## 11. Financial Reporting & Analytics

NovoPharma automatically aggregates all transactional entries to generate daily, weekly, monthly, or custom-range business performance reports.

### Report Metrics:
* **Profit & Loss (P&L):** Displays gross sales, discounts given, net returns, cost of goods sold, and net profits.
* **Tax Summary:** Segregates SGST, CGST, and IGST components on sales and purchases for filing compliance.
* **Expired Losses Log:** Reports financial losses incurred due to damaged or expired stock.
* **Fast/Slow Moving Products:** Analyzes sales frequency to help you optimize purchasing budgets.

---

## 12. System Settings & Backups

Configure hardware integration and local security parameters.

### 1. General Settings:
* **Pharmacy Name, Address, Phone, & GSTIN:** Details displayed on the headers of sales receipts.

### 2. Printing Settings:
* **Printer Profile:** Select your printer driver.
* **Paper Size:** Choose **80mm Thermal**, **58mm Thermal**, or **A4/A5 Laser**.
* **Auto-Print:** Toggle whether receipts should print automatically upon completing a sale.

### 3. Database Management & Backups:
* **Backup Destination:** Set this path to a secondary storage drive (e.g., USB drive, external disk, or local Google Drive / OneDrive folder).
* **Backup Frequency:** Automated backups run every **2 hours** of usage and immediately upon application exit.
* **Create Backup Now:** Click this button to force an instant manual backup.
* **Restore Backup:** Select a valid `.db` file to restore your database.

---

## 13. Keyboard Shortcut Reference Card

Print or share these shortcuts to speed up daily pharmacy tasks:

| Key Command | Scope | Action |
|---|---|---|
| `Ctrl + N` | Global | Launch POS terminal screen |
| `F1` | POS Screen | Clear and focus product search box |
| `F2` | POS Screen | Focus customer search input |
| `F8` | POS Screen | Open payment checkout screen |
| `+` / `-` | POS Grid | Increment / Decrement quantity |
| `/` | POS Grid | Toggle unit between **Pack** and **Loose Unit** |
| `Esc` | Modals / POS | Close dropdowns, clear active input, or cancel modal |
| `F3` | Global | Open Supplier Master |

---

## 14. Troubleshooting & Maintenance

### Common Issues & Resolutions:

#### 1. "Database is locked" Alert
* **Cause:** A second instance of NovoPharma is running in the background, locking the SQLite database.
* **Resolution:** Close the app. Open Windows **Task Manager** (`Ctrl + Shift + Esc`), search for any background `NovoPharma` or `electron` processes, right-click, and select **End Task**. Restart the app.

#### 2. Programmatic Input Focus Freeze
* **Cause:** Focusing search boxes during route changes can cause focus race conditions in Chromium.
* **Resolution:** NovoPharma uses a deferred focus handler. If a field fails to respond to keyboard inputs, press `Esc` to reset the event loop focus, or click outside and back into the field.

#### 3. Update Failures
* **Cause:** The auto-updater requires a backup before applying update files. If database transactions are active, updates will abort.
* **Resolution:** Ensure the POS checkout screen is closed and you have no active edits open before clicking "Apply Update".

---
*For additional support, please contact the support desk at **support@novopharma.test** or call **+91-98765-43210**.*
