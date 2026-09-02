# NovoPharma — Pharmacy Owner Client Guide

Welcome to NovoPharma! This guide provides everything you need to set up, operate, and maintain your pharmacy billing and inventory system.

---

## 1. Installation & First Launch

### Installation

1. Double-click the file `NovoPharma-Setup-X.Y.Z.exe` that you received from your administrator.
2. Select your preferred installation directory or leave the default path.
3. Click **Install**. Once finished, check the box to launch NovoPharma.

### First-Launch Activation

Before using the app, your machine must be registered and activated:

1. Ensure your computer is connected to the internet.
2. On the launch screen, enter the **Email** and **Password** provided by your administrator.
3. The app will verify your subscription license. Once verified, it will initialize your local database and take you to the main dashboard.

---

## 2. Setting Up Your Pharmacy

### Add Suppliers

To purchase stock, you must register your distributors first:

1. Go to **Tools** → **Supplier Master** in the top menu bar.
2. Click **Add Supplier** (or `F3`).
3. Enter the Supplier Name, Contact Details, and GSTIN.
4. Click **Save**.

### Add Medicines

Before logging transactions, you must add products to your catalog:

1. Go to **Tools** → **Product Master** in the top menu bar.
2. Click **Add Product**.
3. Specify the details:
   - **Product Name** & **Generic Name** (Active ingredient)
   - **Category** (e.g., Tablet, Capsule, Syrup)
   - **Base Unit:** The smallest individual unit (e.g., `Tablet` for pills, `ml` for liquids). All inventory values are tracked in this unit.
   - **Pack Unit:** The wholesale container unit (e.g., `Strip`, `Bottle`, `Tube`).
   - **Units Per Pack:** Number of base units inside a pack (e.g., `10` Tablets per Strip).
4. Click **Save**.

---

## 3. Stock Purchases (Stock In)

1. Go to **Purchasing** → **Purchases**.
2. Click **New Purchase Bill**.
3. Select your **Supplier** and input the **Invoice Number** and **Invoice Date**.
4. In the product entry grid:
   - Search for a medicine.
   - Select the unit type (**Packs** or **Base Units**).
   - Enter quantity (e.g., 20 Strips).
   - Input the **Purchase Price per pack/unit**, **MRP**, and **Selling Price**.
   - Specify the **Batch Number** and **Expiry Date** printed on the packaging.
5. Click **Add to Invoice**.
6. When done entering products, click **Complete Purchase**. This immediately allocates stock to your inventory.

---

## 4. Billing Customers (Point of Sale - POS)

1. Go to **Sales** → **POS Terminal** (or press `Ctrl+N`).
2. Select a customer or leave the default `Walk-in Customer`.
3. In the product entry bar, scan a barcode or type a product name.
4. Once added, customize the line items:
   - Change the unit type (switch from base unit to pack unit if the customer is buying a full pack).
   - Adjust the quantity.
   - Apply a **Discount** (Click the discount column to add a percentage or flat amount discount).
   - If allowed, click the **Rate** column to perform a manual price override.
5. Apply any **Bill-level Discount** on the sidebar.
6. Choose payment method: **Cash**, **UPI**, **Card**, or **Split Payment** (e.g. some cash, some UPI).
7. Input amount received and click **Complete Sale**.
8. The print preview modal will appear for you to print the receipt or invoice.

---

## 5. Sales & Purchase Returns

### Customer Returns (Sales Return)

1. Go to **Sales** → **Sales Returns**.
2. Search for the customer's invoice.
3. Select the items being returned, the return quantities, and choose the return type (e.g., standard refund or expired return).
4. Click **Submit Return**. Stock is automatically restored to its batch, and the refund is computed using the historical price paid.

### Supplier Returns (Purchase Return)

1. Go to **Purchasing** → **Purchase Returns**.
2. Create a return bill, select the supplier, choose the inventory batch, enter the return quantity, and complete.

---

## 6. Database Backups & Restores

### Automatic Backups

NovoPharma automatically saves a safety copy of your database:

- Every **2 hours** of continuous operation.
- Immediately when you **close** the application.
- Right before installing any application **update**.

### Manual Backups

1. Go to **Tools** → **Settings**.
2. Verify your **Backup Location** is configured (preferably a separate USB drive or synced cloud folder like Google Drive / OneDrive).
3. Click **Create Backup Now**.

### Restoring Data

In case of a computer failure, your data can be restored:

1. Under **Settings** → **Restore Backup**, click **Select Backup File**.
2. Select your latest `.db` backup file and click **Restore**. The app will validate the file, apply it, and refresh your dashboard.

---

## 7. Updates

- When a new update is available, you will see a banner in the top-right corner.
- The update will download in the background. Once completed, click **Apply Update**.
- The app will securely back up your database, install the new version, and restart automatically. **All your sales, products, and inventory records are completely safe and preserved during updates.**

---

## 8. Troubleshooting & Support

### Native Database Errors

If you see an error saying `better-sqlite3 native module load failure`, restart your computer. If it persists, contact support to reinstall the database driver.

### Database Lock Alerts

Only one instance of NovoPharma can run at a time to prevent data corruption. If you see a warning that the database is locked, check your Windows Task Manager and close any duplicate `NovoPharma` processes.

### Support Contact

- **Support Email:** support@novopharma.test
- **Support Hotline:** +91-98765-43210
- **Admin Portal (License Keys):** https://novopharma-admin.vercel.app
