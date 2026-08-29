CREATE TABLE IF NOT EXISTS sales_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  return_number TEXT NOT NULL UNIQUE,
  return_date INTEGER NOT NULL,
  refund_amount INTEGER NOT NULL CHECK(refund_amount >= 0),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_return_id INTEGER NOT NULL,
  sale_item_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  inventory_batch_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  original_selling_price INTEGER NOT NULL CHECK(original_selling_price >= 0),
  tax_rate INTEGER NOT NULL CHECK(tax_rate >= 0),
  tax_amount INTEGER NOT NULL CHECK(tax_amount >= 0),
  discount_amount INTEGER NOT NULL CHECK(discount_amount >= 0),
  refund_amount INTEGER NOT NULL CHECK(refund_amount >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON sales_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_return_id ON sales_return_items(sales_return_id);
