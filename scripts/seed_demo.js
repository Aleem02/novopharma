const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

app.whenReady().then(() => {
  const { DatabaseManager } = require('./out/main/database/connection');
  const { MigrationRunner } = require('./out/main/database/migrations');
  const { ProductRepository } = require('./out/main/database/repositories/productRepository');
  const { SupplierRepository } = require('./out/main/database/repositories/supplierRepository');
  const { PurchaseService } = require('./out/main/services/purchaseService');

  async function seed() {
    const outDir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir);
    }
    const dbPath = path.join(outDir, 'novopharma_v1_demo.sqlite');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

  const db = DatabaseManager.initialize(dbPath);
  MigrationRunner.run(db);

  console.log('Database initialized and migrated:', dbPath);

  // 1. Create Supplier
  const supplier = SupplierRepository.create({
    name: 'PharmaCorp Distributors',
    contact_person: 'John Doe',
    phone: '9876543210',
    email: 'contact@pharmacorp.com',
    address: '123 Health Ave',
    gstin: '22AAAAA0000A1Z5',
    license_number: 'DL-12345'
  });

  // 2. Create Product (Pack)
  const product1 = ProductRepository.create({
    name: 'Neurobion Forte',
    generic_name: 'Vitamin B Complex',
    manufacturer: 'P&G Health',
    dosage_form: 'Tablet',
    unit: 'Tablet',
    pack_type: 'Strip',
    units_per_pack: 15,
    selling_price: 3500, // 35.00 INR MRP per strip initially
    tax_rate: 1200, // 12%
    is_active: 1
  });

  // 3. Create Product (Base Unit Only)
  const product2 = ProductRepository.create({
    name: 'Vicks VapoRub',
    generic_name: 'Camphor + Menthol',
    manufacturer: 'P&G',
    dosage_form: 'Ointment',
    unit: 'Bottle',
    units_per_pack: 1, // Base unit only
    selling_price: 8500,
    tax_rate: 1200,
    is_active: 1
  });

  const product3 = ProductRepository.create({
    name: 'Paracetamol',
    generic_name: 'Paracetamol 500mg',
    manufacturer: 'Generic Pharma',
    dosage_form: 'Tablet',
    unit: 'Tablet',
    pack_type: 'Strip',
    units_per_pack: 10,
    selling_price: 1500, // 15.00 INR MRP
    tax_rate: 1200,
    is_active: 1
  });

  // 4. Create Purchase Draft
  const draft = PurchaseService.createDraft({
    supplier_id: supplier.id,
    invoice_number: 'INV-DEMO-001',
    purchase_date: Date.now(),
    items: [
      {
        product_id: product1.id,
        batch_number: 'B202301',
        expiry_date: Date.now() + 31536000000,
        quantity: 10, // 10 Strips
        purchase_price: 2500, // 25.00
        mrp: 3500, // 35.00
        selling_price: 3400 // 34.00
      },
      {
        product_id: product2.id,
        batch_number: 'B202302',
        expiry_date: Date.now() + 31536000000,
        quantity: 5, // 5 Bottles
        purchase_price: 6000,
        mrp: 8500,
        selling_price: 8000
      },
      {
        product_id: product3.id,
        batch_number: 'EXP-BATCH',
        expiry_date: Date.now() - 86400000, // Expired yesterday
        quantity: 20, // 20 strips
        purchase_price: 1000,
        mrp: 1500,
        selling_price: 1500
      },
      {
        product_id: product3.id,
        batch_number: 'LOW-STOCK-BATCH',
        expiry_date: Date.now() + 31536000000,
        quantity: 1, // Only 1 strip (low stock)
        purchase_price: 1000,
        mrp: 1500,
        selling_price: 1500
      }
    ]
  });

  // 5. Complete Purchase
  PurchaseService.completePurchase(draft.id);

    console.log('Seed completed successfully!');
    console.log('Generated database at:', dbPath);
    app.quit();
  }

  seed().catch(err => {
    console.error(err);
    app.quit();
  });
});
