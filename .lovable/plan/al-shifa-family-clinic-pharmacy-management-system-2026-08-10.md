# Al Shifa Family Clinic — Pharmacy Management System

The project is currently an empty template: one placeholder home page, no backend, no database, no auth. So everything is built from scratch, with Lovable Cloud as the backend (Postgres + auth + server logic).

Because this is a large system, it is built in staged phases. Each phase ends with a working, usable app.

## Design system

Deep medical navy primary, healthcare green secondary, white cards, very light neutral background, plus success/warning/danger/info tokens. The supplied logo is added as a project asset and used on login, sidebar, dashboard, invoices and settings.

## Data model (Lovable Cloud / Postgres)

Core tables: `profiles`, `user_roles` (admin / pharmacist / manager), `settings`, `categories`, `suppliers`, `patients`, `products`, `product_batches`, `stock_movements`, `sales`, `sale_items`, `purchases`, `purchase_items`, `sale_returns`, `return_items`, `expenses`, `audit_logs`.

Key rules baked into the schema:
- Money stored as integers in paisa (no floating point anywhere).
- Stock is never a writable number: quantity lives on batches, and every change writes a `stock_movements` row with a reason (purchase, sale, sale return, purchase return, damage, expired, adjustment, correction).
- Units use a base-unit model: each product has a base unit (e.g. tablet) plus pack conversions (1 box = 10 strips = 100 tablets); all stock is stored in base units, and the UI converts.
- Batches carry batch number, expiry, purchase price, quantity, supplier.
- Row-level security on every table; roles in a separate `user_roles` table checked by a security-definer function.

## Server-side business logic

Sales, purchases and returns run as single database transactions in Postgres functions, called from server functions — never assembled in the browser:
- `create_sale`: revalidates prices and stock server-side, allocates batches by First-Expiry-First-Out, rejects expired batches and insufficient stock, deducts stock, writes sale + items + movements + payment + profit + audit log, generates the invoice number, and is idempotent so a double click cannot create two sales.
- `create_purchase`: creates/updates batches, increases stock, writes movements and supplier balance.
- `create_sale_return`: validates returnable quantity against the original invoice, restores stock to the original batch, writes movements and audit log.

Errors surface as human messages ("Insufficient stock. Only 3 units available."), never raw database errors.

## Build phases

**Phase 1 — Foundation**
Enable Lovable Cloud, full schema + RLS + roles + business-logic functions, design tokens, app shell (sidebar on desktop, drawer on mobile), login page, protected routes, settings seeded with clinic branding.

**Phase 2 — Catalog & Inventory**
Medicine catalog (server-side search on brand/generic/strength/barcode, filters, sorting, pagination), add/edit medicine form with validation, product detail page (Overview / Batches / Stock History / Sales History / Analytics), inventory dashboard, low-stock page, expiry page with Expired / 30 / 60 / 90-day tabs.

**Phase 3 — POS & Invoicing**
New Sale screen: fast product search on the left, cart on the right, keyboard shortcuts, optional patient (walk-in / existing / quick create), decimal-safe totals, discount, paid, change. Complete Sale calls the server transaction. Professional invoice with print, PDF download and reprint, in A4 and thermal layouts. Sales history with filters, view/print/return actions and no delete.

**Phase 4 — Purchases, Suppliers, Patients, Returns**
New purchase and purchase history, supplier management with balances, patient records with purchase history, sale returns against an original invoice.

**Phase 5 — Dashboard, Reports, Expenses, Admin**
Real-data dashboard (today's sales, transactions, gross profit, inventory value, low stock, expiring, out of stock, sales trend, recent sales, top sellers, quick actions), sales / profit / inventory / product reports with export, expenses with categories and net profit, user & role management, admin-only audit log, settings.

**Phase 6 — Verification & polish**
Run the acceptance scenario end to end (Panadol 500mg at Rs.180 cost / Rs.220 sale, batch PAN001 exp 12/2027, 100 tablets; patient Ahmed Khan; sell 3 → subtotal Rs.660, paid Rs.1,000, change Rs.340, stock 97, profit Rs.120; return 1 → stock 98, net sold 2), verifying sales history, return history, stock ledger, product/patient history, dashboard, profit, audit log and invoice. Then empty/loading/error states, responsive checks and UI polish.

## Notes

- Demo/seed medicines are inserted through a clearly-marked seed migration so they can be removed before real use.
- Nothing in the UI edits stock directly; all inventory changes go through the ledger.
