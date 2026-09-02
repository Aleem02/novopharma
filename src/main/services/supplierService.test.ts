import { describe, it, expect, beforeEach } from "vitest";
import { DatabaseManager } from "../database/connection";
import { SupplierService } from "./supplierService";

describe("SupplierService", () => {
  beforeEach(() => {
    // Reset DB and apply migrations
    const db = DatabaseManager.initialize(":memory:");
    const runner = require("../database/migrationRunner").MigrationRunner;
    runner.run(db);
  });

  it("creates and retrieves a supplier", () => {
    const supplier = SupplierService.createSupplier({
      name: "Test Supplier",
      contact_person: "John Doe",
      phone: "1234567890",
      email: "john@test.com",
      address: "123 Test St",
      gstin: "22AAAAA0000A1Z5",
    });

    const supplierId = supplier.id;
    expect(supplierId).toBeGreaterThan(0);

    const retrievedSupplier = SupplierService.getSupplier(supplierId);
    expect(retrievedSupplier).toBeDefined();
    expect(retrievedSupplier?.name).toBe("Test Supplier");
    expect(retrievedSupplier?.is_active).toBe(1);
  });

  it("validates required fields", () => {
    expect(() => {
      SupplierService.createSupplier({ name: "" });
    }).toThrow("Supplier name is required");
  });

  it("updates a supplier", () => {
    const id = SupplierService.createSupplier({ name: "Old Name" }).id;
    SupplierService.updateSupplier(id, { name: "New Name" });
    const supplier = SupplierService.getSupplier(id);
    expect(supplier?.name).toBe("New Name");
  });

  it("searches for suppliers", () => {
    SupplierService.createSupplier({ name: "Alpha Pharma" });
    SupplierService.createSupplier({ name: "Beta Meds" });

    const results = SupplierService.searchSuppliers("Alpha");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Alpha Pharma");
  });

  it("toggles active status", () => {
    const id = SupplierService.createSupplier({ name: "Test" }).id;
    SupplierService.setSupplierActive(id, false);
    const inactive = SupplierService.getSupplier(id);
    expect(inactive?.is_active).toBe(0);

    SupplierService.setSupplierActive(id, true);
    const active = SupplierService.getSupplier(id);
    expect(active?.is_active).toBe(1);
  });
});
