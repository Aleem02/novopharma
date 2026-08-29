# NovoPharma — Testing & E2E Verification Checklists

This document contains step-by-step checklists to qualify a release candidate for production.

---

## 1. Clean-Machine Installation Checklist
Verify setup on a separate Windows machine/VM with NO development files.

- [ ] Run `NovoPharma-Setup-X.Y.Z.exe` installer.
- [ ] Confirm custom install path selection operates correctly.
- [ ] Launch application.
- [ ] Verify database initialization under `%APPDATA%/NovoPharma/novopharma_v1.sqlite`.
- [ ] Verify `identity.json` generated in `%APPDATA%/NovoPharma/` containing valid base64 key pair.
- [ ] Complete activation flow using credentials generated via the Super Admin portal.
- [ ] Perform application close and reopen; verify automatic login works.

---

## 2. Universal Unit & POS E2E Checklist
Verify the POS cart conversions and deductions.

### Test A: Tablets (Strip of 10)
- [ ] Set up product: Base Unit = `Tablet`, Pack Unit = `Strip`, Units Per Pack = `10`.
- [ ] Add 2 Strips to inventory.
- [ ] Go to POS, select product, sell **4 Tablets** (Base unit).
  - [ ] Deducted quantity in DB = `4` base units.
- [ ] Select product, sell **2 Strips** (Pack unit).
  - [ ] Deducted quantity in DB = `20` base units.

### Test B: Liquids/Syrups (100ml Bottle)
- [ ] Set up product: Base Unit = `ml`, Pack Unit = `Bottle`, Units Per Pack = `100`.
- [ ] Go to POS, sell **30 ml**.
  - [ ] Deducted quantity in DB = `30` base units.
- [ ] Go to POS, sell **2 Bottles**.
  - [ ] Deducted quantity in DB = `200` base units.

### Test C: Creams/Ointments (20g Tube)
- [ ] Set up product: Base Unit = `g`, Pack Unit = `Tube`, Units Per Pack = `20`.
- [ ] Go to POS, sell **5 g**.
  - [ ] Deducted quantity = `5` base units.
- [ ] Go to POS, sell **2 Tubes**.
  - [ ] Deducted quantity = `40` base units.

---

## 3. Pricing, Discounts & Payments Checklist

### POS Pricing Conversions
- [ ] Purchase: 20 Strips @ ₹90/Strip, MRP = ₹120/Strip, Selling Price = ₹110/Strip. (Pack size = 15 tablets).
- [ ] Verify unit price conversions:
  - [ ] Base Purchase Price = ₹6/Tablet
  - [ ] Base MRP = ₹8/Tablet
  - [ ] Base Selling Price = ₹7.33/Tablet
- [ ] Cart shows correct totals.

### Discounts
- [ ] Verify line discount percentage (e.g., 10% off line item).
- [ ] Verify line fixed discount (e.g., ₹10 off line item).
- [ ] Verify bill-level percentage discount.
- [ ] Verify bill-level fixed discount.
- [ ] Verify tax computation recalculates dynamically *after* applying both line and bill-level discounts.
- [ ] Verify price override works (up to but not exceeding MRP).
- [ ] Confirm negative or excessive discount values are rejected with clean UI warnings.

### Payments
- [ ] Cash payment: Enter received cash, verify change calculation.
- [ ] Split payment: split total using ₹200 Cash + ₹300 UPI.
- [ ] Underpayment: verify cart checkout is blocked if the payment amounts do not cover the bill total.

---

## 4. FEFO & Multi-Batch Sales Checklist
Verify auto-matching and inventory depletion across multiple active batches.

- [ ] Create Batch A (expiring in 3 months): quantity = 30 tablets.
- [ ] Create Batch B (expiring in 1 year): quantity = 30 tablets.
- [ ] Sell 40 tablets (4 Strips of 10) in POS.
- [ ] Verify that:
  - [ ] Batch A is completely depleted (30 tablets).
  - [ ] Batch B is partially depleted (10 tablets).
  - [ ] Cart/invoice correctly lists the single line item representing the sale.
  - [ ] DB `sale_item_batches` table maps the transaction to both Batch A and Batch B for precise tracking.

---

## 5. Sales Returns Checklist
Verify correct return calculations and inventory restoration.

- [ ] Sell 2 Strips (20 Tablets).
- [ ] Return 1 Strip (10 Tablets).
- [ ] Verify that:
  - [ ] Exactly 10 Tablets (base units) are restored to the active inventory batch.
  - [ ] Restored batch quantity reflects the update.
  - [ ] Refund calculated matches the exact historical price paid (including any discounts/overrides applied during checkout).

---

## 6. Database Migration & Upgrade Safety Checklist
Verify data persistence when upgrading.

- [ ] Install old release version (v1.0.0).
- [ ] Populate database with: 3 products, 2 suppliers, 5 customers, 2 purchases, and 4 sales.
- [ ] Run the update installer (v1.0.1) over the existing installation.
- [ ] Verify:
  - [ ] Application starts successfully.
  - [ ] All pre-existing data (products, batches, transaction histories, customers, settings) is fully intact.
  - [ ] Migration table (`_migrations`) includes the new migration entry.
  - [ ] Migration 0015 executed safely exactly once.

---

## 7. Automatic Updater Checklist

- [ ] Install Version A (configured to look at current repository).
- [ ] Publish Version B as a release on GitHub containing setup file and `latest.yml`.
- [ ] Start Version A and wait 10 seconds.
- [ ] Verify Update Available notification appears.
- [ ] Wait for background download completion.
- [ ] Click "Apply Update".
- [ ] Verify:
  - [ ] Verification backup is created under `%APPDATA%/NovoPharma/update_safety_backups/`.
  - [ ] App exits and triggers the silent installer.
  - [ ] Version B launches successfully.
  - [ ] Pre-existing database matches pre-update state.

---

## 8. Backup & Restore Checklist

- [ ] Trigger manual backup from Settings.
- [ ] Check backup destination directory for the generated `.db` file.
- [ ] Verify backup integrity check logic is executed.
- [ ] Simulate database restore from a backup file:
  - [ ] App disconnects active database connection gracefully.
  - [ ] App backups active db as a safety rollback file.
  - [ ] Overwrites file and deletes temporary WAL/SHM files.
  - [ ] App restarts/reloads cleanly showing the restored database records.
- [ ] Attempt to restore a corrupted/invalid backup file:
  - [ ] Confirm restore is blocked with a clean error message.
  - [ ] Active database remains untouched.

---

## 9. Super Admin Checklist

- [ ] Log in as Super Admin at `VITE_BACKEND_URL` portal.
- [ ] Create and configure a tenant pharmacy client.
- [ ] Generate activation credentials for a client installation.
- [ ] Toggle license status to **Inactive/Disabled** on the portal:
  - [ ] Verify desktop client is blocked from logging in or registering.
- [ ] Toggle license status to **Active** on the portal:
  - [ ] Verify desktop client activates successfully.
- [ ] Confirm that normal desktop users have no access to the Admin Portal.
- [ ] Confirm that Super Admin credentials are never embedded in the desktop codebase.
