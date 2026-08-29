# NovoPharma V1 - Product Requirements Document (PRD)

## Product Overview
**Product name:** NovoPharma  
**Product type:** Windows desktop pharmacy billing and inventory application.  

## V1 Business Model
- One pharmacy/client
- One owner user
- One production Windows PC
- One local SQLite database
- Lifetime entitlement
- Manual payment collection by NovoPharma administrator
- No online payment gateway
- No Razorpay
- No subscription billing

## V1 Scope (LOCKED)
V1 MUST support:
- Pharmacy onboarding
- Owner login
- Pharmacy information
- Medicine/product management
- Categories
- Manufacturers
- Suppliers
- Customers
- Purchases
- Purchase returns
- Inventory
- Batches
- Expiry tracking
- Sales/billing
- Sales returns
- Payments
- Expenses
- Reports
- Invoice printing
- Local SQLite database
- Background backup
- Google Drive backup
- NovoPharma cloud backup
- Manual backup
- Restore workflow
- Application updates
- Database migrations
- Super Admin
- Client entitlement management
- Installation authorization
- One authorized production installation per client

## Explicitly Out of V1 Scope
DO NOT implement or architect as required V1 functionality:
- Multi-PC synchronization
- Real-time multi-device data synchronization
- Cashier accounts
- Pharmacist accounts
- Staff accounts
- Role-based staff permissions
- Multi-branch
- Patient portal
- Patient-facing application
- Subscription billing
- Razorpay
- Online payment processing
- Cloud database as the live pharmacy transaction database
- Cloud-dependent billing
- Cloud-dependent inventory
- Complex pricing tiers
- Multi-tenant live POS synchronization

These may be considered for V2/V3 only.
