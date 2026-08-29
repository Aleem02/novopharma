"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var better_sqlite3_1 = __importDefault(require("better-sqlite3"));
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var DB_PATH = path.join(process.cwd(), 'mock-novopharma-v1-demo.sqlite');
var REPORT_PATH = path.join(process.cwd(), 'mock-novopharma-v1-demo-report.md');
if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
}
console.log('Generating mock database at:', DB_PATH);
var db = new better_sqlite3_1.default(DB_PATH);
db.pragma('foreign_keys = ON');
// 1. Run Migrations directly by reading the SQL files
var schemaDir = path.join(process.cwd(), 'src', 'main', 'database', 'schema');
var files = fs.readdirSync(schemaDir).filter(function (f) { return f.endsWith('.sql'); }).sort();
db.prepare("\n  CREATE TABLE IF NOT EXISTS _migrations (\n    id INTEGER PRIMARY KEY,\n    name TEXT NOT NULL,\n    applied_at INTEGER NOT NULL\n  )\n").run();
var _loop_1 = function (file) {
    var sql = fs.readFileSync(path.join(schemaDir, file), 'utf-8');
    var id = parseInt(file.split('_')[0], 10);
    var name_1 = file.replace('.sql', '');
    db.transaction(function () {
        db.exec(sql);
        db.prepare('INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)').run(id, name_1, Date.now());
    })();
    console.log("Applied migration: ".concat(name_1));
};
for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
    var file = files_1[_i];
    _loop_1(file);
}
var now = Date.now();
var oneDay = 24 * 60 * 60 * 1000;
var oneMonth = 30 * oneDay;
// Helper to run inside transaction
var runTransaction = db.transaction(function (fn) { return fn(); });
runTransaction(function () {
    // --- SETTINGS ---
    var settings = [
        { key: 'pharmacy_name', value: 'NovoCare Pharmacy Demo' },
        { key: 'address', value: '123 Demo Market, Chennai, Tamil Nadu' },
        { key: 'phone', value: '9000000000' },
        { key: 'gst_number', value: '33AAAAA0000A1Z5' },
        { key: 'invoice_prefix', value: 'DEMO-' },
        { key: 'next_invoice_number', value: '1041' }
    ];
    var insertSetting = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
    for (var _i = 0, settings_1 = settings; _i < settings_1.length; _i++) {
        var s = settings_1[_i];
        insertSetting.run(s.key, s.value, now);
    }
    // --- SUPPLIERS ---
    var insertSupplier = db.prepare("\n    INSERT INTO suppliers (name, contact_person, phone, email, address, gstin, is_active, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)\n  ");
    var suppliers = [
        ['MediCorp Distributors', 'Rajesh Kumar', '9876543210', 'contact@medicorp.demo', 'Chennai South', '33BBBBB1111B1Z1'],
        ['PharmaPlus Wholesale', 'Anitha S', '9876543211', 'sales@pharmaplus.demo', 'Bangalore East', '29CCCCC2222C2Z2'],
        ['LifeCare Logistics', 'Vikram Singh', '9876543212', 'orders@lifecare.demo', 'Hyderabad West', '36DDDDD3333D3Z3'],
        ['Global Meds', 'Sarah John', '9876543213', 'info@globalmeds.demo', 'Mumbai Central', '27EEEEE4444E4Z4'],
        ['HealthFirst Suppliers', 'Mohan Das', '9876543214', 'supply@healthfirst.demo', 'Delhi North', '07FFFFF5555F5Z5'],
        ['Apex Pharma', 'Karthik R', '9876543215', 'apex@apexpharma.demo', 'Kochi', '32GGGGG6666G6Z6']
    ];
    var supplierIds = [];
    for (var _a = 0, suppliers_1 = suppliers; _a < suppliers_1.length; _a++) {
        var s = suppliers_1[_a];
        var res = insertSupplier.run.apply(insertSupplier, __spreadArray(__spreadArray([], s, false), [now, now], false));
        supplierIds.push(res.lastInsertRowid);
    }
    // --- PRODUCTS ---
    var insertProduct = db.prepare("\n    INSERT INTO products (name, generic_name, manufacturer, category, dosage_form, strength, unit, barcode, selling_price, tax_rate, is_active, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var productsData = [
        // name, generic, manufacturer, category, form, strength, unit, barcode, sp, tax, active
        ['Dolo 650', 'Paracetamol', 'Micro Labs', 'Fever', 'Tablet', '650mg', 'Strip', '10001', 3000, 12, 1], // 30.00
        ['Augmentin 625 Duo', 'Amoxicillin + Clavulanic Acid', 'GSK', 'Antibiotic', 'Tablet', '625mg', 'Strip', '10002', 20000, 12, 1],
        ['Pan 40', 'Pantoprazole', 'Alkem', 'Antacid', 'Tablet', '40mg', 'Strip', '10003', 15000, 12, 1],
        ['Cetaphil Lotion', 'Moisturizer', 'Galderma', 'Skincare', 'Lotion', '', 'Bottle', '10004', 45000, 18, 1],
        ['Vicks VapoRub', 'Camphor + Menthol', 'P&G', 'Cold', 'Ointment', '50g', 'Bottle', '10005', 8500, 12, 1],
        ['Calpol 250', 'Paracetamol', 'GSK', 'Fever', 'Syrup', '250mg', 'Bottle', '10006', 4000, 12, 1],
        ['Allegra 120', 'Fexofenadine', 'Sanofi', 'Allergy', 'Tablet', '120mg', 'Strip', '10007', 18000, 12, 1],
        ['Thyronorm 50mcg', 'Thyroxine', 'Abbott', 'Thyroid', 'Tablet', '50mcg', 'Bottle', '10008', 12000, 12, 1],
        ['Glycomet 500', 'Metformin', 'USV', 'Diabetes', 'Tablet', '500mg', 'Strip', '10009', 5000, 12, 1],
        ['Telma 40', 'Telmisartan', 'Glenmark', 'Hypertension', 'Tablet', '40mg', 'Strip', '10010', 14000, 12, 1],
        ['Evion 400', 'Vitamin E', 'Merck', 'Vitamin', 'Capsule', '400mg', 'Strip', '10011', 3500, 18, 1],
        ['Soframycin', 'Framycetin', 'Sanofi', 'Antibiotic', 'Cream', '30g', 'Tube', '10012', 4500, 12, 1],
        ['BeloDrop', 'Carboxymethylcellulose', 'Sun Pharma', 'Eye Drop', 'Drop', '0.5%', 'Bottle', '10013', 11000, 12, 1],
        ['Shelcal 500', 'Calcium + Vit D3', 'Torrent', 'Supplement', 'Tablet', '500mg', 'Strip', '10014', 11500, 18, 1],
        ['Ascoril LS', 'Ambroxol + Levosalbutamol', 'Glenmark', 'Cough', 'Syrup', '100ml', 'Bottle', '10015', 10500, 12, 1],
        ['Ciplox 500', 'Ciprofloxacin', 'Cipla', 'Antibiotic', 'Tablet', '500mg', 'Strip', '10016', 4000, 12, 1],
        ['Zifi 200', 'Cefixime', 'FDC', 'Antibiotic', 'Tablet', '200mg', 'Strip', '10017', 11000, 12, 1],
        ['Deriva CMS', 'Adapalene + Clindamycin', 'Glenmark', 'Skincare', 'Gel', '15g', 'Tube', '10018', 25000, 18, 1],
        ['Neurobion Forte', 'Vitamin B Complex', 'P&G', 'Vitamin', 'Tablet', '', 'Strip', '10019', 3200, 18, 1],
        ['Volini Gel', 'Diclofenac', 'Sun Pharma', 'Pain Relief', 'Gel', '30g', 'Tube', '10020', 10000, 12, 1],
        ['Aciloc 150', 'Ranitidine', 'Cadila', 'Antacid', 'Tablet', '150mg', 'Strip', '10021', 2000, 12, 1],
        ['Combiflam', 'Ibuprofen + Paracetamol', 'Sanofi', 'Pain Relief', 'Tablet', '', 'Strip', '10022', 4000, 12, 1],
        ['Zincovit', 'Multivitamin', 'Apex', 'Vitamin', 'Tablet', '', 'Strip', '10023', 10500, 18, 1],
        ['Becosules', 'B Complex + Vit C', 'Pfizer', 'Vitamin', 'Capsule', '', 'Strip', '10024', 4500, 18, 1],
        ['Old Med', 'Unknown', 'Unknown', 'General', 'Tablet', '10mg', 'Strip', '10025', 1000, 12, 0] // Inactive product
    ];
    var productIds = [];
    var productsMap = new Map();
    for (var i = 0; i < productsData.length; i++) {
        var p = productsData[i];
        var res = insertProduct.run.apply(insertProduct, __spreadArray(__spreadArray([], p, false), [now, now], false));
        var pid = res.lastInsertRowid;
        productIds.push(pid);
        productsMap.set(pid, {
            name: p[0],
            sp: p[8],
            tax: p[9]
        });
    }
    // --- PURCHASES & INVENTORY ---
    var insertPurchase = db.prepare("\n    INSERT INTO purchases (supplier_id, invoice_number, purchase_date, total_amount, status, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?)\n  ");
    var insertPurchaseItem = db.prepare("\n    INSERT INTO purchase_items (purchase_id, product_id, batch_number, expiry_date, quantity, purchase_price, mrp, created_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var insertInventoryBatch = db.prepare("\n    INSERT INTO inventory_batches (product_id, batch_number, expiry_date, quantity, mrp, purchase_price, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var batchesMap = new Map(); // batch_id -> {product_id, qty, sp, tax, mrp, batch_number}
    var allPurchaseIds = [];
    var purchaseItemsMap = new Map();
    var batchCounter = 1;
    // Create ~25 purchases
    for (var i = 0; i < 25; i++) {
        var supplierId = supplierIds[i % supplierIds.length];
        var purchaseDate = now - (30 - i) * oneDay;
        // Create purchase draft
        var res = insertPurchase.run(supplierId, "INV-PUR-".concat(1000 + i), purchaseDate, 0, 'COMPLETED', purchaseDate, purchaseDate);
        var purchaseId = res.lastInsertRowid;
        allPurchaseIds.push(purchaseId);
        var totalAmount = 0;
        // Add 1-4 items per purchase
        var numItems = (i % 4) + 1;
        for (var j = 0; j < numItems; j++) {
            var productId = productIds[(i + j) % productIds.length];
            var prod = productsMap.get(productId);
            var batchNo = "B".concat(10000 + batchCounter);
            batchCounter++;
            var qty = 50 + (i * 10);
            var pp = Math.floor(prod.sp * 0.7); // 30% margin
            var mrp = Math.floor(prod.sp * 1.1); // MRP slightly higher than SP
            // Some expiry near, some far
            var expiry = (i % 5 === 0) ? now + (15 * oneDay) : now + (365 * oneDay);
            var piRes = insertPurchaseItem.run(purchaseId, productId, batchNo, expiry, qty, pp, mrp, purchaseDate);
            purchaseItemsMap.set(piRes.lastInsertRowid, { purchaseId: purchaseId, productId: productId, batchNo: batchNo, qty: qty, pp: pp, mrp: mrp });
            totalAmount += (qty * pp);
            // Create Inventory Batch
            var ibRes = insertInventoryBatch.run(productId, batchNo, expiry, qty, mrp, pp, purchaseDate, purchaseDate);
            batchesMap.set(ibRes.lastInsertRowid, {
                id: ibRes.lastInsertRowid,
                product_id: productId,
                batch_number: batchNo,
                quantity: qty,
                sp: prod.sp,
                tax: prod.tax,
                mrp: mrp
            });
        }
        // Update purchase total
        db.prepare('UPDATE purchases SET total_amount = ? WHERE id = ?').run(totalAmount, purchaseId);
    }
    // --- CUSTOMERS ---
    var insertCustomer = db.prepare("\n    INSERT INTO customers (name, phone, email, address, date_of_birth, gender, notes, is_active, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var customersData = [
        ['Rahul Sharma', '9000100001', 'rahul@demo.demo', 'T Nagar, Chennai', '1985-05-15', 'Male', 'Regular customer', 1],
        ['Priya Patel', '9000100002', 'priya@demo.demo', 'Adyar, Chennai', '1990-08-22', 'Female', '', 1],
        ['Amit Kumar', '9000100003', '', 'Velachery, Chennai', '1975-12-10', 'Male', 'Diabetic', 1],
        ['Sneha Reddy', '9000100004', 'sneha@demo.demo', 'Anna Nagar, Chennai', '1995-03-30', 'Female', '', 1],
        ['Ravi Varma', '9000100005', '', 'Guindy, Chennai', '1980-11-05', 'Male', '', 1],
        ['Lakshmi N', '9000100006', 'lakshmi@demo.demo', 'Mylapore, Chennai', '1965-02-18', 'Female', 'BP patient', 1],
        ['Suresh Menon', '9000100007', '', 'Tambaram, Chennai', '1970-07-25', 'Male', '', 1],
        ['Kavita Rao', '9000100008', 'kavita@demo.demo', 'OMR, Chennai', '1988-09-14', 'Female', '', 1],
        ['Vinod Singh', '9000100009', '', 'Porur, Chennai', '1992-04-01', 'Male', '', 1],
        ['Anjali Desai', '9000100010', 'anjali@demo.demo', 'Thiruvanmiyur, Chennai', '1982-06-20', 'Female', '', 1],
        ['Deepak Gupta', '9000100011', '', 'Besant Nagar, Chennai', '1978-01-12', 'Male', '', 1],
        ['Neha Shah', '9000100012', 'neha@demo.demo', 'Nungambakkam, Chennai', '1998-10-08', 'Female', '', 1]
    ];
    var customerIds = [];
    for (var _b = 0, customersData_1 = customersData; _b < customersData_1.length; _b++) {
        var c = customersData_1[_b];
        var res = insertCustomer.run.apply(insertCustomer, __spreadArray(__spreadArray([], c, false), [now, now], false));
        customerIds.push(res.lastInsertRowid);
    }
    // --- PRESCRIPTIONS ---
    var insertPrescription = db.prepare("\n    INSERT INTO prescriptions (customer_id, prescription_date, doctor_name, doctor_reg_number, reference_number, diagnosis_notes, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var insertPrescriptionItem = db.prepare("\n    INSERT INTO prescription_items (prescription_id, product_id, medicine_name_snapshot, strength_snapshot, dosage_instructions, frequency, duration, quantity, notes, created_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var prescriptionIds = [];
    for (var i = 0; i < 15; i++) {
        var custId = customerIds[i % customerIds.length];
        var pDate = now - (20 - i) * oneDay;
        var res = insertPrescription.run(custId, pDate, "Dr. Fictional ".concat(i), "MCI-DEMO-".concat(100 + i), "RX-DEMO-".concat(100 + i), 'Viral fever and cough', pDate, pDate);
        var presId = res.lastInsertRowid;
        prescriptionIds.push(presId);
        // Link a real product
        var prod1Id = productIds[i % productIds.length];
        var prod1 = productsMap.get(prod1Id);
        insertPrescriptionItem.run(presId, prod1Id, prod1.name, '500mg', 'After meals', '1-0-1', '5 Days', 10, '', pDate);
        // Link an external/custom product
        if (i % 3 === 0) {
            insertPrescriptionItem.run(presId, null, 'Custom Herb Extract', '', 'With warm water', '0-0-1', '10 Days', 10, 'External medicine', pDate);
        }
    }
    // --- SALES (POS) ---
    var insertSale = db.prepare("\n    INSERT INTO sales (invoice_number, sale_date, subtotal, discount_amount, tax_amount, total_amount, payment_method, status, customer_id, prescription_id, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var insertSaleItem = db.prepare("\n    INSERT INTO sale_items (sale_id, product_id, inventory_batch_id, batch_number, quantity, selling_price, mrp, tax_rate, tax_amount, discount_amount, line_total, created_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var deductBatch = db.prepare("UPDATE inventory_batches SET quantity = quantity - ? WHERE id = ?");
    var salesMap = new Map();
    var saleItemsMap = new Map();
    // Fetch batches for FEFO
    var getBatchesForProduct = function (pid) {
        return Array.from(batchesMap.values()).filter(function (b) { return b.product_id === pid && b.quantity > 0; }).sort(function (a, b) { return a.expiry_date - b.expiry_date; });
    };
    var invoiceNum = 1001;
    for (var i = 0; i < 40; i++) {
        var sDate = now - (15 - i) * oneDay;
        var custId = null;
        var presId = null;
        if (i % 3 === 0) {
            custId = customerIds[i % customerIds.length];
        }
        if (i % 5 === 0) {
            presId = prescriptionIds[i % prescriptionIds.length];
            custId = db.prepare('SELECT customer_id FROM prescriptions WHERE id = ?').get(presId).customer_id;
        }
        var payMethod = ['Cash', 'Card', 'UPI'][i % 3];
        // Draft sale first
        var sRes = insertSale.run("DEMO-".concat(invoiceNum++), sDate, 0, 0, 0, 0, payMethod, 'COMPLETED', custId, presId, sDate, sDate);
        var saleId = sRes.lastInsertRowid;
        var subtotal = 0;
        var taxAmount = 0;
        var totalAmount = 0;
        var numItems = (i % 3) + 1;
        for (var j = 0; j < numItems; j++) {
            var pid = productIds[(i + j) % productIds.length];
            var requiredQty = (j + 1) * 2;
            var availableBatches = getBatchesForProduct(pid);
            for (var _c = 0, availableBatches_1 = availableBatches; _c < availableBatches_1.length; _c++) {
                var batch = availableBatches_1[_c];
                if (requiredQty <= 0)
                    break;
                var deductQty = Math.min(requiredQty, batch.quantity);
                requiredQty -= deductQty;
                var lineSub = deductQty * batch.sp;
                var lineTax = Math.floor(lineSub * (batch.tax / 100));
                var lineTotal = lineSub + lineTax;
                var siRes = insertSaleItem.run(saleId, pid, batch.id, batch.batch_number, deductQty, batch.sp, batch.mrp, batch.tax, lineTax, 0, lineTotal, sDate);
                saleItemsMap.set(siRes.lastInsertRowid, {
                    saleId: saleId,
                    productId: pid,
                    batchId: batch.id,
                    qty: deductQty,
                    sp: batch.sp,
                    tax: batch.tax,
                    lineTax: lineTax,
                    lineTotal: lineTotal
                });
                batch.quantity -= deductQty;
                deductBatch.run(deductQty, batch.id);
                subtotal += lineSub;
                taxAmount += lineTax;
                totalAmount += lineTotal;
            }
        }
        db.prepare('UPDATE sales SET subtotal = ?, tax_amount = ?, total_amount = ? WHERE id = ?').run(subtotal, taxAmount, totalAmount, saleId);
        salesMap.set(saleId, { totalAmount: totalAmount, subtotal: subtotal, taxAmount: taxAmount });
    }
    // --- SALES RETURNS ---
    var insertSalesReturn = db.prepare("\n    INSERT INTO sales_returns (sale_id, return_number, return_date, refund_amount, reason, created_at)\n    VALUES (?, ?, ?, ?, ?, ?)\n  ");
    var insertSalesReturnItem = db.prepare("\n    INSERT INTO sales_return_items (sales_return_id, sale_item_id, product_id, inventory_batch_id, quantity, original_selling_price, tax_rate, tax_amount, discount_amount, refund_amount, created_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var restoreBatch = db.prepare("UPDATE inventory_batches SET quantity = quantity + ? WHERE id = ?");
    var returnNum = 101;
    var saleItemIds = Array.from(saleItemsMap.keys());
    for (var i = 0; i < 8; i++) {
        var saleItemId = saleItemIds[i * 2]; // Pick some deterministic items
        var sItem = saleItemsMap.get(saleItemId);
        var rDate = now - (5 - i) * oneDay;
        // Return half or full
        var returnQty = Math.ceil(sItem.qty / 2);
        if (returnQty <= 0)
            continue;
        var refundSub = returnQty * sItem.sp;
        var refundTax = Math.floor(refundSub * (sItem.tax / 100));
        var refundTotal = refundSub + refundTax;
        var srRes = insertSalesReturn.run(sItem.saleId, "SR-".concat(returnNum++), rDate, refundTotal, 'Patient allergic', rDate);
        var srId = srRes.lastInsertRowid;
        insertSalesReturnItem.run(srId, saleItemId, sItem.productId, sItem.batchId, returnQty, sItem.sp, sItem.tax, refundTax, 0, refundTotal, rDate);
        // Restore batch inventory
        restoreBatch.run(returnQty, sItem.batchId);
        batchesMap.get(sItem.batchId).quantity += returnQty;
        // Update sale status based on partial vs full
        var newStatus = returnQty === sItem.qty ? 'REFUNDED' : 'PARTIALLY_REFUNDED'; // Simplified for demo
        db.prepare('UPDATE sales SET status = ? WHERE id = ?').run(newStatus, sItem.saleId);
    }
    // --- PURCHASE RETURNS ---
    var insertPurchaseReturn = db.prepare("\n    INSERT INTO purchase_returns (purchase_id, return_number, return_date, total_amount, reason, created_at)\n    VALUES (?, ?, ?, ?, ?, ?)\n  ");
    var insertPurchaseReturnItem = db.prepare("\n    INSERT INTO purchase_return_items (purchase_return_id, purchase_item_id, product_id, batch_number, quantity, purchase_price, mrp, line_total, created_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var prNum = 201;
    var purchaseItemIds = Array.from(purchaseItemsMap.keys());
    var _loop_2 = function (i) {
        var pItemId = purchaseItemIds[i * 3];
        var pItem = purchaseItemsMap.get(pItemId);
        var prDate = now - (3 - i) * oneDay;
        // Try to return a small amount
        var returnQty = 5;
        // Find batch to deduct
        var batch = Array.from(batchesMap.values()).find(function (b) { return b.product_id === pItem.productId && b.batch_number === pItem.batchNo; });
        if (batch && batch.quantity >= returnQty) {
            var lineTotal = returnQty * pItem.pp;
            var prRes = insertPurchaseReturn.run(pItem.purchaseId, "PR-".concat(prNum++), prDate, lineTotal, 'Near Expiry', prDate);
            var prId = prRes.lastInsertRowid;
            insertPurchaseReturnItem.run(prId, pItemId, pItem.productId, pItem.batchNo, returnQty, pItem.pp, pItem.mrp, lineTotal, prDate);
            deductBatch.run(returnQty, batch.id);
            batch.quantity -= returnQty;
        }
    };
    for (var i = 0; i < 4; i++) {
        _loop_2(i);
    }
    // --- STOCK ADJUSTMENTS ---
    var insertStockAdj = db.prepare("\n    INSERT INTO stock_adjustments (product_id, inventory_batch_id, batch_number, quantity, type, reason, notes, adjusted_by, adjusted_at, created_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    var activeBatches = Array.from(batchesMap.values()).filter(function (b) { return b.quantity > 10; });
    for (var i = 0; i < 8; i++) {
        var batch = activeBatches[i % activeBatches.length];
        var adjDate = now - i * oneDay;
        if (i % 2 === 0) {
            // DECREASE
            var adjQty = 2;
            insertStockAdj.run(batch.product_id, batch.id, batch.batch_number, adjQty, 'DECREASE', 'Physical count correction', 'Missing units', 'System', adjDate, adjDate);
            deductBatch.run(adjQty, batch.id);
            batch.quantity -= adjQty;
        }
        else {
            // INCREASE
            var adjQty = 5;
            insertStockAdj.run(batch.product_id, batch.id, batch.batch_number, adjQty, 'INCREASE', 'Opening stock correction', 'Found extra', 'System', adjDate, adjDate);
            restoreBatch.run(adjQty, batch.id);
            batch.quantity += adjQty;
        }
    }
});
console.log('Validating Database...');
var integrity = db.prepare('PRAGMA integrity_check').get();
var fks = db.pragma('foreign_key_check');
var migrationsCount = db.prepare('SELECT count(*) as c FROM _migrations').get();
var report = "# Mock Database Generation Report\n\n";
report += "- Database Path: ".concat(DB_PATH, "\n");
report += "- Integrity Check: ".concat(integrity.integrity_check, "\n");
report += "- Foreign Key Check: ".concat(fks.length === 0 ? 'Passed (0 errors)' : 'FAILED', "\n");
report += "- Applied Migrations: ".concat(migrationsCount.c, " (Expected 10)\n\n");
report += "## Record Counts\n";
var tables = [
    'settings', 'audit_logs', 'products', 'suppliers', 'purchases', 'purchase_items', 'inventory_batches',
    'sales', 'sale_items', 'sales_returns', 'sales_return_items', 'purchase_returns', 'purchase_return_items',
    'stock_adjustments', 'customers', 'prescriptions', 'prescription_items', '_migrations'
];
for (var _a = 0, tables_1 = tables; _a < tables_1.length; _a++) {
    var t = tables_1[_a];
    var c = db.prepare("SELECT count(*) as count FROM ".concat(t)).get();
    report += "- **".concat(t, "**: ").concat(c.count, "\n");
}
report += "\n## Financial Summary (Derived)\n";
var grossSales = db.prepare('SELECT sum(total_amount) as sum FROM sales').get();
var totalRefunds = db.prepare('SELECT sum(refund_amount) as sum FROM sales_returns').get();
var refundSum = totalRefunds.sum || 0;
var grossSum = grossSales.sum || 0;
report += "- Gross Sales: \u20B9 ".concat((grossSum / 100).toFixed(2), "\n");
report += "- Total Refunds: \u20B9 ".concat((refundSum / 100).toFixed(2), "\n");
report += "- Net Sales: \u20B9 ".concat(((grossSum - refundSum) / 100).toFixed(2), "\n");
report += "\n## Inventory Summary (Derived)\n";
var totalInv = db.prepare('SELECT sum(quantity) as sum FROM inventory_batches').get();
report += "- Total Units in Stock: ".concat(totalInv.sum, "\n");
fs.writeFileSync(REPORT_PATH, report);
console.log('Report generated at:', REPORT_PATH);
db.close();
process.exit(0);
