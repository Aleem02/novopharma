CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  date_of_birth TEXT,
  gender TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  prescription_date INTEGER NOT NULL,
  doctor_name TEXT NOT NULL,
  doctor_reg_number TEXT,
  reference_number TEXT,
  diagnosis_notes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL,
  product_id INTEGER, 
  medicine_name_snapshot TEXT NOT NULL,
  strength_snapshot TEXT,
  dosage_instructions TEXT NOT NULL,
  frequency TEXT,
  duration TEXT,
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT;
ALTER TABLE sales ADD COLUMN prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE RESTRICT;
