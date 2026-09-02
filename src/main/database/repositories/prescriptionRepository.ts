import { DatabaseManager } from "../connection";
import { Prescription, PrescriptionItem } from "../../../shared/types";

export class PrescriptionRepository {
  static findById(id: number): Prescription | undefined {
    const db = DatabaseManager.getInstance();
    const prescription = db
      .prepare("SELECT * FROM prescriptions WHERE id = ?")
      .get(id) as Prescription | undefined;

    if (!prescription) return undefined;

    const items = db
      .prepare("SELECT * FROM prescription_items WHERE prescription_id = ?")
      .all(id) as PrescriptionItem[];
    prescription.items = items;

    return prescription;
  }

  static getCustomerPrescriptions(
    customerId: number,
    page: number = 1,
    pageSize: number = 50,
  ): { data: Prescription[]; total: number } {
    const db = DatabaseManager.getInstance();
    const offset = (page - 1) * pageSize;

    const countRow = db
      .prepare(
        "SELECT count(*) as count FROM prescriptions WHERE customer_id = ?",
      )
      .get(customerId) as { count: number };
    const total = countRow.count;

    const list = db
      .prepare(
        "SELECT * FROM prescriptions WHERE customer_id = ? ORDER BY prescription_date DESC LIMIT ? OFFSET ?",
      )
      .all(customerId, pageSize, offset) as Prescription[];

    const data = list.map((p) => {
      p.items = db
        .prepare("SELECT * FROM prescription_items WHERE prescription_id = ?")
        .all(p.id) as PrescriptionItem[];
      return p;
    });

    return { data, total };
  }
}
