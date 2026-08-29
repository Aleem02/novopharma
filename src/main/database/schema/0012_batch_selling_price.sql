-- Add selling_price to inventory_batches
ALTER TABLE inventory_batches ADD COLUMN selling_price INTEGER NOT NULL DEFAULT 0;

-- Set default selling_price to mrp for existing batches (safe backfill)
UPDATE inventory_batches SET selling_price = mrp;

-- Add selling_price and commercial context to purchase_items
ALTER TABLE purchase_items ADD COLUMN selling_price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_items ADD COLUMN entered_unit TEXT;
ALTER TABLE purchase_items ADD COLUMN entered_units_per_pack INTEGER;

-- Set default selling_price to mrp for existing purchase_items (safe backfill)
UPDATE purchase_items SET selling_price = mrp;
