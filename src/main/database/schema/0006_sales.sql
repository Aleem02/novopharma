CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  sale_date INTEGER NOT NULL,
  subtotal INTEGER NOT NULL CHECK(subtotal >= 0),
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK(discount_amount >= 0),
  tax_amount INTEGER NOT NULL DEFAULT 0 CHECK(tax_amount >= 0),
  total_amount INTEGER NOT NULL CHECK(total_amount >= 0),
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  inventory_batch_id INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
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

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
