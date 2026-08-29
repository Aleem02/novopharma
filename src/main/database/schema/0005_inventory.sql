-- Inventory & Batches
CREATE TABLE inventory_batches (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    mrp INTEGER NOT NULL CHECK (mrp >= 0),
    purchase_price INTEGER NOT NULL CHECK (purchase_price >= 0),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id),
    UNIQUE(product_id, batch_number)
);
