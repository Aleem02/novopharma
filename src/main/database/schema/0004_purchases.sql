-- Purchases / Goods Receipt
CREATE TABLE purchases (
    id INTEGER PRIMARY KEY,
    supplier_id INTEGER NOT NULL,
    invoice_number TEXT,
    purchase_date INTEGER NOT NULL,
    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE purchase_items (
    id INTEGER PRIMARY KEY,
    purchase_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    purchase_price INTEGER NOT NULL CHECK (purchase_price >= 0),
    mrp INTEGER NOT NULL CHECK (mrp >= 0),
    created_at INTEGER NOT NULL,
    FOREIGN KEY(purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id)
);
