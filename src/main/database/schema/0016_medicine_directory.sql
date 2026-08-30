CREATE TABLE IF NOT EXISTS medicine_directory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT,
  name TEXT,
  generic_name TEXT,
  manufacturer TEXT,
  category TEXT,
  dosage_form TEXT,
  strength TEXT,
  unit TEXT,
  pack_type TEXT,
  units_per_pack INTEGER,
  pack_description TEXT
);

CREATE INDEX IF NOT EXISTS idx_med_dir_name
ON medicine_directory(name);

CREATE INDEX IF NOT EXISTS idx_med_dir_generic
ON medicine_directory(generic_name);

CREATE INDEX IF NOT EXISTS idx_med_dir_manufacturer
ON medicine_directory(manufacturer);
