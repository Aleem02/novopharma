-- Migration 0017: Remove obsolete SQLite medicine_directory table & indexes
-- In NovoPharma v1.5.0, medicine_directory dataset is searched in-memory from bundled JSON.
DROP TABLE IF EXISTS medicine_directory;
