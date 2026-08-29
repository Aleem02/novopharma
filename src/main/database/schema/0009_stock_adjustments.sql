CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  inventory_batch_id INTEGER NOT NULL,
  batch_number TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  type TEXT NOT NULL CHECK(type IN ('INCREASE', 'DECREASE')),
  reason TEXT NOT NULL,
  notes TEXT,
  adjusted_by TEXT,
  adjusted_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (inventory_batch_id) REFERENCES inventory_batches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON stock_adjustments(adjusted_at);
