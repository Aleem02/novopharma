CREATE TABLE IF NOT EXISTS purchase_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  return_number TEXT NOT NULL UNIQUE,
  return_date INTEGER NOT NULL,
  total_amount INTEGER NOT NULL CHECK(total_amount >= 0),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_return_id INTEGER NOT NULL,
  purchase_item_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  purchase_price INTEGER NOT NULL CHECK(purchase_price >= 0),
  mrp INTEGER NOT NULL CHECK(mrp >= 0),
  line_total INTEGER NOT NULL CHECK(line_total >= 0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON purchase_returns(return_date);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return_id ON purchase_return_items(purchase_return_id);
