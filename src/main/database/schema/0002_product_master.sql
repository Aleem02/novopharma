-- Product / Medicine Master
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    generic_name TEXT,
    manufacturer TEXT,
    category TEXT,
    dosage_form TEXT,
    strength TEXT,
    unit TEXT,
    barcode TEXT UNIQUE,
    selling_price INTEGER NOT NULL CHECK (selling_price >= 0),
    tax_rate INTEGER NOT NULL CHECK (tax_rate >= 0),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
