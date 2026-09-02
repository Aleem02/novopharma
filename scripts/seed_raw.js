const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const outDir = path.join(process.cwd(), "scratch");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}
const dbPath = path.join(outDir, "novopharma_v1_demo_updated.sqlite");
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Run migrations
const schemaDir = path.join(process.cwd(), "src/main/database/schema");
const files = fs
  .readdirSync(schemaDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(schemaDir, file), "utf8");

  if (sql.includes("-- NO_TRANSACTION")) {
    const stmts = sql.split(";").filter((s) => s.trim().length > 0);
    for (const stmt of stmts) {
      try {
        db.exec(stmt + ";");
      } catch (err) {
        console.log(
          `Error in non-transactional statement from ${file}: ${err.message}`,
        );
      }
    }
  } else {
    db.exec(sql);
  }
}

// 1. Create Supplier
const insertSupplier = db.prepare(`
  INSERT INTO suppliers (name, contact_person, phone, email, address, gstin, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
`);
const supplierInfo = insertSupplier.run(
  "PharmaCorp Distributors",
  "John Doe",
  "9876543210",
  "contact@pharmacorp.com",
  "123 Health Ave",
  "22AAAAA0000A1Z5",
  Date.now(),
  Date.now(),
);
const supplierId = supplierInfo.lastInsertRowid;

// 2. Create Products
const insertProduct = db.prepare(`
  INSERT INTO products (
    name, generic_name, manufacturer, dosage_form, unit, pack_type, units_per_pack, selling_price, tax_rate, is_active, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
`);

const p1 = insertProduct.run(
  "Neurobion Forte",
  "Vitamin B Complex",
  "P&G Health",
  "Tablet",
  "Tablet",
  "Strip",
  15,
  3500,
  1200,
  Date.now(),
  Date.now(),
);
const product1Id = p1.lastInsertRowid;

const p2 = insertProduct.run(
  "Vicks VapoRub",
  "Camphor + Menthol",
  "P&G",
  "Ointment",
  "Bottle",
  null,
  1,
  8500,
  1200,
  Date.now(),
  Date.now(),
);
const product2Id = p2.lastInsertRowid;

const p3 = insertProduct.run(
  "Paracetamol",
  "Paracetamol 500mg",
  "Generic Pharma",
  "Tablet",
  "Tablet",
  "Strip",
  10,
  1500,
  1200,
  Date.now(),
  Date.now(),
);
const product3Id = p3.lastInsertRowid;

// 3. Create Purchase & Inventory Batches
const insertPurchase = db.prepare(`
  INSERT INTO purchases (supplier_id, invoice_number, purchase_date, total_amount, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?)
`);
const purchase = insertPurchase.run(
  supplierId,
  "INV-DEMO-001",
  Date.now(),
  25000 + 30000 + 20000 + 1000,
  Date.now(),
  Date.now(),
);
const purchaseId = purchase.lastInsertRowid;

const insertPurchaseItem = db.prepare(`
  INSERT INTO purchase_items (purchase_id, product_id, batch_number, expiry_date, quantity, purchase_price, mrp, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertBatch = db.prepare(`
  INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, purchase_price, mrp, selling_price, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Item 1: product1 (10 strips = 150 tablets)
insertPurchaseItem.run(
  purchaseId,
  product1Id,
  "B202301",
  Date.now() + 31536000000,
  10,
  2500,
  3500,
  Date.now(),
);
insertBatch.run(
  product1Id,
  "B202301",
  Date.now() + 31536000000,
  150,
  166,
  233,
  226,
  Date.now(),
  Date.now(),
); // Prices normalized per tablet

// Item 2: product2 (5 bottles = 5 bottles)
insertPurchaseItem.run(
  purchaseId,
  product2Id,
  "B202302",
  Date.now() + 31536000000,
  5,
  6000,
  8500,
  Date.now(),
);
insertBatch.run(
  product2Id,
  "B202302",
  Date.now() + 31536000000,
  5,
  6000,
  8500,
  8000,
  Date.now(),
  Date.now(),
);

// Item 3: product3 Expired (20 strips = 200 tablets)
insertPurchaseItem.run(
  purchaseId,
  product3Id,
  "EXP-BATCH",
  Date.now() - 86400000,
  20,
  1000,
  1500,
  Date.now(),
);
insertBatch.run(
  product3Id,
  "EXP-BATCH",
  Date.now() - 86400000,
  200,
  100,
  150,
  150,
  Date.now(),
  Date.now(),
);

// Item 4: product3 Low Stock (1 strip = 10 tablets)
insertPurchaseItem.run(
  purchaseId,
  product3Id,
  "LOW-STOCK-BATCH",
  Date.now() + 31536000000,
  1,
  1000,
  1500,
  Date.now(),
);
insertBatch.run(
  product3Id,
  "LOW-STOCK-BATCH",
  Date.now() + 31536000000,
  10,
  100,
  150,
  150,
  Date.now(),
  Date.now(),
);

console.log("Seed completed successfully!");
console.log("Generated database at:", dbPath);
