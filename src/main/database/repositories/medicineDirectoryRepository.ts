import { DatabaseManager } from "../connection";

export interface MedicineDirectoryRecord {
  id?: number;
  source_id?: string | null;
  name: string;
  generic_name?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  dosage_form?: string | null;
  strength?: string | null;
  unit?: string | null;
  pack_type?: string | null;
  units_per_pack?: number | null;
  pack_description?: string | null;
}

export class MedicineDirectoryRepository {
  static getCount(): number {
    const db = DatabaseManager.getInstance();
    const row = db
      .prepare("SELECT COUNT(*) as count FROM medicine_directory")
      .get() as { count: number };
    return row?.count || 0;
  }

  static isPopulated(): boolean {
    return this.getCount() > 0;
  }

  static clear(): void {
    const db = DatabaseManager.getInstance();
    db.prepare("DELETE FROM medicine_directory").run();
  }

  static bulkInsert(records: MedicineDirectoryRecord[]): void {
    const db = DatabaseManager.getInstance();
    const stmt = db.prepare(`
      INSERT INTO medicine_directory (
        source_id, name, generic_name, manufacturer, category,
        dosage_form, strength, unit, pack_type, units_per_pack, pack_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows: MedicineDirectoryRecord[]) => {
      for (const row of rows) {
        stmt.run(
          row.source_id || null,
          row.name,
          row.generic_name || null,
          row.manufacturer || null,
          row.category || null,
          row.dosage_form || null,
          row.strength || null,
          row.unit || null,
          row.pack_type || null,
          row.units_per_pack !== undefined && row.units_per_pack !== null
            ? row.units_per_pack
            : null,
          row.pack_description || null,
        );
      }
    });

    // Chunk size of 10,000 for optimal transactional throughput
    const chunkSize = 10000;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      insertMany(chunk);
    }
  }

  static search(query: string): MedicineDirectoryRecord[] {
    const db = DatabaseManager.getInstance();
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // Split search query into individual words
    const words = cleanQuery.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return [];

    // Build word-by-word conditions
    const conditions = words.map(() => {
      return `(name LIKE ? OR generic_name LIKE ? OR manufacturer LIKE ? OR strength LIKE ?)`;
    });

    const bindings: any[] = [];
    for (const word of words) {
      const likeParam = `%${word}%`;
      bindings.push(likeParam, likeParam, likeParam, likeParam);
    }

    // Bindings for priority sorting: exact/starts-with matches should appear first
    const exactStart = `${cleanQuery}%`;
    const exactBoundary = `% ${cleanQuery}%`;
    const genericStart = `${cleanQuery}%`;

    bindings.push(exactStart, exactBoundary, genericStart);

    const sql = `
      SELECT * FROM medicine_directory
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        CASE
          WHEN name LIKE ? THEN 1
          WHEN name LIKE ? THEN 2
          WHEN generic_name LIKE ? THEN 3
          ELSE 4
        END ASC,
        name ASC
      LIMIT 50
    `;

    const stmt = db.prepare(sql);
    return stmt.all(...bindings) as MedicineDirectoryRecord[];
  }
}
