-- Add missing fields to Product / Medicine Master
ALTER TABLE products ADD COLUMN therapeutic_category TEXT;
ALTER TABLE products ADD COLUMN pack_type TEXT;
ALTER TABLE products ADD COLUMN units_per_pack INTEGER;
ALTER TABLE products ADD COLUMN pack_description TEXT;
ALTER TABLE products ADD COLUMN hsn_code TEXT;
ALTER TABLE products ADD COLUMN drug_schedule TEXT;
ALTER TABLE products ADD COLUMN prescription_required INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN sku TEXT;
ALTER TABLE products ADD COLUMN reorder_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN min_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN max_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN rack TEXT;
ALTER TABLE products ADD COLUMN shelf TEXT;
ALTER TABLE products ADD COLUMN preferred_supplier_id INTEGER REFERENCES suppliers(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL AND sku != '';
