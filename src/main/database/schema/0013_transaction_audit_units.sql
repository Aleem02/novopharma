-- NO_TRANSACTION
-- NovoPharma V1: Pharmacy Unit & Pricing Architecture (Transaction Audit Units)

-- 1. inventory_batches: Add auditing and pack size (quantity stays as base units)
ALTER TABLE inventory_batches ADD COLUMN entered_quantity REAL;
ALTER TABLE inventory_batches ADD COLUMN entered_unit TEXT;
ALTER TABLE inventory_batches ADD COLUMN units_per_pack INTEGER;

-- 2. purchase_items: Add base_quantity (quantity acts as entered_quantity, entered_unit added in v12)
ALTER TABLE purchase_items ADD COLUMN base_quantity INTEGER NOT NULL DEFAULT 0;

-- Backfill purchase_items.base_quantity safely assuming old quantity was base_quantity because units didn't fully exist
UPDATE purchase_items SET base_quantity = quantity;

-- 3. Safely recreate sale_items to drop NOT NULL from inventory_batch_id and batch_number
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
  mrp INTEGER NOT NULL CHECK(mrp >= 0),
  tax_rate INTEGER NOT NULL CHECK(tax_rate >= 0),
  tax_amount INTEGER NOT NULL CHECK(tax_amount >= 0),
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
  line_total INTEGER NOT NULL CHECK(line_total >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
);

-- Safely copy existing historical data (quantity -> base_quantity and entered_quantity)
INSERT INTO sale_items_new (
  id, sale_id, product_id, entered_quantity, sale_unit, base_quantity, 
  inventory_batch_id, batch_number, selling_price, mrp, tax_rate, 
  tax_amount, discount_amount, line_total, created_at
)
SELECT 
  id, sale_id, product_id, quantity, 'Base', quantity, 
  inventory_batch_id, batch_number, selling_price, mrp, tax_rate, 
  tax_amount, discount_amount, line_total, created_at 
FROM sale_items;

DROP TABLE sale_items;
ALTER TABLE sale_items_new RENAME TO sale_items;
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);

-- 4. Create sale_item_batches (Fulfillment mapping)
CREATE TABLE IF NOT EXISTS sale_item_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_item_id INTEGER NOT NULL,
  inventory_batch_id INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  base_quantity INTEGER NOT NULL CHECK(base_quantity > 0),
  selling_price INTEGER NOT NULL CHECK(selling_price >= 0),
  mrp INTEGER NOT NULL CHECK(mrp >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
);

-- Backfill sale_item_batches for existing historical sales
INSERT INTO sale_item_batches (
  sale_item_id, inventory_batch_id, batch_number, base_quantity, selling_price, mrp, created_at
)
SELECT 
  id, inventory_batch_id, batch_number, base_quantity, selling_price, mrp, created_at
FROM sale_items
WHERE inventory_batch_id IS NOT NULL;

COMMIT;
PRAGMA foreign_keys=on;

-- 5. sales_return_items: add entered unit auditing
ALTER TABLE sales_return_items ADD COLUMN entered_quantity REAL;
ALTER TABLE sales_return_items ADD COLUMN return_unit TEXT;

-- 6. purchase_return_items: add entered unit auditing
ALTER TABLE purchase_return_items ADD COLUMN entered_quantity REAL;
ALTER TABLE purchase_return_items ADD COLUMN return_unit TEXT;
