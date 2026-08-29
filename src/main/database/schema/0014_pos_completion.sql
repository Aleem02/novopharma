-- NO_TRANSACTION
-- NovoPharma V1: POS Completion (Discounts, Price Overrides, Payments)

-- 1. Extend sales table for bill-level discounts and payment tracking
ALTER TABLE sales ADD COLUMN bill_discount_type TEXT;
ALTER TABLE sales ADD COLUMN bill_discount_value INTEGER;
ALTER TABLE sales ADD COLUMN received_amount INTEGER;
ALTER TABLE sales ADD COLUMN change_amount INTEGER;

-- 2. Safely recreate sale_items to add discount details and overrides
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

CREATE TABLE sale_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  entered_quantity REAL NOT NULL DEFAULT 0,
  sale_unit TEXT NOT NULL DEFAULT 'Base',
  base_quantity INTEGER NOT NULL DEFAULT 0,
  inventory_batch_id INTEGER,
  batch_number TEXT,
  selling_price INTEGER NOT NULL CHECK(selling_price >= 0),
  original_selling_price INTEGER NOT NULL DEFAULT 0 CHECK(original_selling_price >= 0),
  is_price_overridden INTEGER NOT NULL DEFAULT 0,
  override_reason TEXT,
  mrp INTEGER NOT NULL CHECK(mrp >= 0),
  tax_rate INTEGER NOT NULL CHECK(tax_rate >= 0),
  tax_amount INTEGER NOT NULL CHECK(tax_amount >= 0),
  discount_type TEXT,
  discount_value INTEGER,
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
  line_total INTEGER NOT NULL CHECK(line_total >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
);

-- Copy existing historical data
INSERT INTO sale_items_new (
  id, sale_id, product_id, entered_quantity, sale_unit, base_quantity, 
  inventory_batch_id, batch_number, selling_price, original_selling_price, 
  mrp, tax_rate, tax_amount, discount_amount, line_total, created_at
)
SELECT 
  id, sale_id, product_id, entered_quantity, sale_unit, base_quantity, 
  inventory_batch_id, batch_number, selling_price, selling_price, 
  mrp, tax_rate, tax_amount, discount_amount, line_total, created_at 
FROM sale_items;

DROP TABLE sale_items;
ALTER TABLE sale_items_new RENAME TO sale_items;
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);

COMMIT;
PRAGMA foreign_keys=on;

-- 3. Create sale_payments for Split Payments
CREATE TABLE IF NOT EXISTS sale_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount >= 0),
  reference_number TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- Backfill sale_payments for existing historical sales
INSERT INTO sale_payments (
  sale_id, payment_method, amount, created_at
)
SELECT 
  id, payment_method, total_amount, created_at
FROM sales;
