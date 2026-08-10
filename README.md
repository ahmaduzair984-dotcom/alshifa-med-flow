# Al Shifa Pharmacy

MASTER LOVABLE BUILD PROMPT

AL SHIFA FAMILY CLINIC — PHARMACY & CLINIC MANAGEMENT SYSTEM

Build a complete, production-quality web application for:

AL SHIFA FAMILY CLINIC

Dr. Saqlain Abbas Chattha

This is a real clinic pharmacy management system, not a demo, mockup, or simple CRUD application.

The primary purpose is to allow Al Shifa Family Clinic to manage its pharmacy inventory, medicine catalog, purchases, sales, patients, stock, batches, expiry dates, invoices, financial reports and audit history.

1. PRODUCT VISION

Create a modern pharmacy/POS management system that is:

Fast

Professional

Extremely easy to use

Responsive

Reliable

Suitable for daily clinic use

Designed for Pakistani clinic/pharmacy workflows

Optimized for desktop/laptop POS use

Fully usable on tablets and mobile phones

The application should feel like a commercial pharmacy management product, not a student project.

The primary user should be able to open the system and immediately understand:

How much was sold today

What medicines are in stock

What is running low

What is expiring

How much profit was made

How to make a new sale

How to add stock

2. BRANDING

Use the following exact branding throughout the application:

AL SHIFA FAMILY CLINIC

Dr. Saqlain Abbas Chattha

Use the supplied Al Shifa Family Clinic logo wherever appropriate.

The visual identity should be based around:

Deep medical blue/navy

Healthcare green

White

Very light neutral backgrounds

Do not use excessive colors.

Create a professional design system with:

Primary color

Secondary color

Background

Cards

Borders

Text hierarchy

Success

Warning

Danger

Information

The logo should appear in:

Login page

Sidebar/header

Dashboard

Invoice

Printable documents

Settings/branding section

Keep the logo visually clean and don't distort it.

3. TECHNOLOGY

Use the technologies supported by Lovable that are appropriate for a production application.

Preferred:

React

TypeScript

Tailwind CSS

shadcn/ui

Supabase

PostgreSQL

Modern responsive architecture

Use reusable components.

Keep business logic separate from UI.

Do not create unnecessary complexity.

4. DATABASE / BACKEND

If an existing Supabase/PostgreSQL database or schema is connected, inspect and reuse it.

Do NOT unnecessarily recreate existing tables.

The intended architecture contains entities such as:

products

product batches

stock movements

sales

sale items

patients

purchases

purchase items

suppliers

returns

return items

expenses

audit logs

users

roles

permissions

settings

The database should remain the source of truth.

5. CRITICAL INVENTORY RULE

Inventory must NOT simply be a manually editable stock number.

Use:

Product

Batch

Stock Movement Ledger

as the inventory architecture.

Every stock change must have a reason:

Purchase

Sale

Sale Return

Purchase Return

Damage

Expired

Manual Adjustment

Stock Correction

Every movement should be traceable.

6. UNIT SYSTEM

Support different pharmacy units.

Examples:

Box

Strip

Tablet

Bottle

Tube

Vial

Ampoule

Piece

Sachet

Use a base-unit architecture.

Example:

1 Box = 10 Strips

1 Strip = 10 Tablets

Therefore:

1 Box = 100 Tablets

The system must be capable of selling:

1 box

1 strip

3 tablets

while maintaining accurate inventory.

Do not create inconsistent stock calculations between frontend and backend.

7. BATCH MANAGEMENT

Every medicine should support batches.

A batch should contain:

Batch number

Expiry date

Purchase price

Quantity

Supplier

Multiple batches of the same medicine must be supported.

Example:

Panadol 500mg:

Batch PAN001
Expiry 12/2027
Quantity 50

Batch PAN002
Expiry 06/2028
Quantity 100

8. FEFO

Use:

First Expiry, First Out

When selling a medicine with multiple batches, consume stock from the batch that expires first.

Do not duplicate FEFO logic in the UI if backend business logic already exists.

The frontend should use the existing transaction/business logic.

Expired stock must not be sold.

9. DASHBOARD

Create a beautiful professional dashboard.

Top cards:

Today's Sales

Rs. 42,850

Transactions

37

Today's Gross Profit

Rs. 8,620

Inventory Value

Rs. 684,500

Low Stock

12

Expiring Soon

8

Out of Stock

4

These values must come from the real database.

Do NOT use hard-coded demo statistics after the application is connected.

Dashboard sections:

Sales trend

Recent sales

Top-selling medicines

Low-stock medicines

Expiring medicines

Quick actions

Quick actions:

New Sale

Add Medicine

Add Stock

Add Patient

View Reports

10. SIDEBAR

Create a clean sidebar.

Navigation:

Dashboard

New Sale

Pharmacy

Medicine Catalog

Inventory

Low Stock

Expiring Medicines

Purchases

New Purchase

Purchase History

Suppliers

Patients

Sales

Sales History

Returns

Invoices

Reports

Expenses

Users

Settings

Use professional icons.

Make sidebar responsive.

On mobile, convert it to a drawer/bottom-friendly navigation.

11. MEDICINE CATALOG

Create a professional medicine catalog.

Table columns:

Medicine

Generic

Strength

Form

Manufacturer

Stock

Selling Price

Status

Features:

Search

Filters

Sorting

Pagination

Add Medicine

Edit

View

Activate/deactivate

Search should support:

Brand name

Generic name

Strength

Barcode

Example:

Searching:

pana

should find:

Panadol 500mg
Panadol Extra

12. MEDICINE FORM

Fields:

Brand name

Generic name

Category

Strength

Dosage form

Manufacturer

Base unit

Pack size

Selling price

Purchase price

Minimum stock

Barcode

Prescription required

Notes

Validate everything.

Prevent:

Negative prices

Invalid quantities

Duplicate barcodes

Invalid data

13. PRODUCT DETAIL PAGE

Clicking a medicine should open:

Panadol 500mg

Display:

Current Stock

Selling Price

Purchase Cost

Stock Value

Minimum Stock

Expiry Status

Total Sold

Revenue

Gross Profit

Tabs:

Overview

Batches

Stock History

Sales History

Analytics

14. INVENTORY PAGE

Create a dedicated inventory dashboard.

Show:

Total products

Total stock

Inventory value

Low-stock products

Out-of-stock products

Expiring products

Expired products

Filters:

All

In Stock

Low Stock

Out of Stock

Expiring

Expired

Each product should provide access to:

Batches

Stock history

Add stock

15. LOW STOCK

Dedicated page:

LOW STOCK

Display:

Product

Current Stock

Minimum Stock

Supplier

Last Purchase

Provide:

Add Stock

button.

Use clear warning indicators.

16. EXPIRY MANAGEMENT

Dedicated expiry page.

Tabs:

Expired

30 Days

60 Days

90 Days

Display:

Product

Batch

Expiry

Quantity

Purchase Cost

Stock Value

Use appropriate warning states.

17. NEW SALE / POS

This is the most important screen.

Make it extremely fast.

Layout:

LEFT SIDE

Search products.

Show product cards/results:

Medicine

Strength

Form

Price

Available stock

RIGHT SIDE

Current cart.

Cart:

Product

Batch

Quantity

Unit

Unit Price

Discount

Total

Remove

18. POS CALCULATOR

Automatically calculate:

Quantity × Unit Price

Subtotal

Discount

Grand Total

Amount Paid

Change

Example:

Panadol:

2 × Rs.220 = Rs.440

Brufen:

1 × Rs.350 = Rs.350

Cetrizine:

2 × Rs.120 = Rs.240

Subtotal:

Rs.1,030

Discount:

Rs.30

Grand Total:

Rs.1,000

Paid:

Rs.1,500

Change:

Rs.500

Use decimal-safe financial calculations.

Do NOT rely on floating-point arithmetic for financial logic.

19. PATIENT SELECTION

Patient selection must be optional.

Allow:

Walk-in Customer

OR

Existing Patient

OR

Create New Patient

Do not force staff to create a patient for every sale.

20. COMPLETE SALE

When the user clicks:

COMPLETE SALE

Use the existing backend sale transaction/business logic.

The system must:

Validate stock

Allocate correct batch

Apply FEFO

Deduct stock

Create sale

Create sale items

Calculate profit

Create stock movements

Record payment

Create audit log

Generate invoice number

All in one safe database transaction.

If the transaction fails:

Show error

Keep cart intact

Do not create partial sale

Prevent double-click duplicate sales.

21. INVOICE

Create a professional invoice.

Header:

AL SHIFA FAMILY CLINIC

Dr. Saqlain Abbas Chattha

Include:

Invoice number

Date/time

Patient

Items

Quantity

Unit price

Discount

Subtotal

Grand total

Paid

Change

Payment method

Footer

Buttons:

Print

Download PDF

Reprint

The invoice should look good on both A4 and thermal receipt formats if practical.

22. SALES HISTORY

Create:

SALES HISTORY

Filters:

Date

Patient

Product

User

Payment method

Columns:

Invoice

Date

Patient

Items

Total

Payment

User

Status

Actions:

View

Print

Return

Do not provide a normal delete button for completed financial transactions.

23. PRODUCT SALES HISTORY

For every medicine show:

Total units sold

Revenue

Cost

Gross profit

Transactions

Average selling price

Date filtering.

24. PURCHASES

Create:

NEW PURCHASE

Fields:

Supplier

Purchase invoice/reference

Date

Products

Batch

Expiry

Quantity

Purchase price

Selling price

Discount

Total

Saving a purchase must:

Increase inventory

Create/update batch

Create stock movement

Record purchase

Update supplier balance if applicable

25. SUPPLIERS

Supplier management.

Fields:

Name

Company

Contact

Phone

Address

Email

Notes

Supplier dashboard:

Total purchases

Paid

Outstanding

Purchase history

26. RETURNS

Create:

SALE RETURN

Select original invoice.

Show:

Product

Original quantity

Already returned

Returnable quantity

Allow user to select return quantity.

Use existing return business logic.

Do not manually manipulate inventory from the UI.

27. PATIENTS

Patient fields:

Patient ID

Name

Phone

Age

Gender

Address

Notes

Registration date

Patient profile:

Personal information

Purchase history

Invoices

Total purchases

28. REPORTS

Create professional reports.

Sales Report

Daily

Weekly

Monthly

Custom

Profit Report

Revenue

Cost

Gross profit

Inventory Report

Stock

Inventory value

Low stock

Expired

Expiring

Product Report

Top selling

Highest revenue

Highest profit

Slow moving

Allow export where appropriate.

29. EXPENSES

Create:

EXPENSES

Fields:

Date

Category

Description

Amount

Payment method

Notes

Categories:

Rent

Electricity

Salaries

Transport

Supplies

Miscellaneous

Calculate:

Gross Profit

minus Expenses

equals

Net Profit

30. USERS

Implement authentication and roles.

ADMIN

Full access.

STAFF / PHARMACIST

Sales

Patients

Inventory viewing

Permitted returns

MANAGER / ACCOUNTANT

Reports

Purchases

Expenses

Financial information

Protect access server-side.

Do not merely hide buttons.

31. AUDIT LOG

Create admin-only audit history.

Show:

Date/time

User

Action

Entity

Description

Changes

Examples:

Selling price:

Rs.220 → Rs.230

Stock:

50 → 45

Sale:

INV-1056

Audit logs must not be freely deletable.

32. SETTINGS

Settings should include:

Clinic name

Doctor name

Clinic address

Phone

Logo

Currency

Invoice footer

Expiry warning thresholds

Low-stock defaults

Receipt settings

User preferences

Default currency:

PKR / Rs.

33. RESPONSIVE DESIGN

Desktop:

Full sidebar + full POS.

Tablet:

Responsive two-column/optimized layout.

Mobile:

Drawer navigation.

Cards instead of large tables where appropriate.

The system should remain usable on a phone.

34. UX

Prioritize speed.

A staff member should be able to:

Open New Sale

↓

Search medicine

↓

Click medicine

↓

Set quantity

↓

Add another medicine

↓

See total

↓

Enter payment

↓

Complete sale

in as few steps as possible.

Use keyboard shortcuts where useful.

35. ERROR HANDLING

Never expose technical database errors.

Instead of:

"Postgres constraint violation"

show:

"Insufficient stock. Only 3 units are currently available."

Use clear toast notifications and inline validation.

36. EMPTY STATES

Create useful empty states.

Example:

"No medicines have been added yet."

Button:

Add Medicine

Every page should handle empty/loading/error states professionally.

37. PERFORMANCE

The application may eventually contain:

Thousands of medicines

Thousands of batches

Tens of thousands of sales

Do not load the entire database into the browser.

Use:

Pagination

Search

Filtering

Indexed queries

Server-side operations

38. SECURITY

Implement:

Authentication

Authorization

Server-side validation

Protected routes

Secure database access

RLS where appropriate

No exposed secrets

Environment variables

Never trust client-side:

Prices

Stock

Discounts

Profit

Payment calculations

Validate important financial/inventory operations on the server.

39. TESTING

Do not break existing tests.

If an existing backend/business layer already exists, reuse it.

Test:

Product creation

Unit conversion

Batch creation

Purchase

Stock increase

Sale

FEFO

Insufficient stock

Sale return

Discounts

Payment/change

Profit

Expiry

Low stock

Multiple batches

Permissions

Audit logging

40. DEMO DATA

Create realistic demo data only where needed for development.

Examples:

Panadol 500mg

Brufen 400mg

Cetrizine 10mg

Augmentin 625mg

Paracetamol syrup

etc.

Clearly separate seed/demo data from real production data.

41. CRITICAL RULES

DO NOT:

Build fake buttons

Use fake statistics after backend connection

Create duplicate inventory logic

Create a second stock system

Use floating point for money

Allow expired medicines to be sold

Allow negative stock

Delete completed financial transactions

Hard-code medicine prices

Hard-code inventory

Store secrets in frontend code

DO:

Reuse existing business logic

Use database as source of truth

Use transactions for financial/inventory operations

Keep audit trails

Make the POS extremely fast

Make the interface polished

Make everything responsive

Validate server-side

42. DEVELOPMENT APPROACH

Before making major changes:

Inspect the existing project.

Inspect existing database/schema.

Inspect existing APIs/services.

Inspect existing authentication.

Identify what is already working.

Reuse existing functionality.

Only build missing pieces.

Do not rewrite working backend functionality simply to fit a preferred architecture.

43. BUILD PRIORITY

Build in this order:

PRIORITY 1

Application shell

PRIORITY 2

Authentication

PRIORITY 3

Medicine Catalog

PRIORITY 4

Inventory

PRIORITY 5

New Sale / POS

PRIORITY 6

Invoice

PRIORITY 7

Sales History

PRIORITY 8

Purchases

PRIORITY 9

Suppliers

PRIORITY 10

Patients

PRIORITY 11

Returns

PRIORITY 12

Dashboard

PRIORITY 13

Reports

PRIORITY 14

Expenses

PRIORITY 15

Users & Permissions

PRIORITY 16

Audit Logs

PRIORITY 17

Settings

PRIORITY 18

Testing & Production Polish

44. FINAL ACCEPTANCE TEST

The completed application must successfully perform this real-world scenario:

Create:

Panadol 500mg

Purchase price:

Rs.180

Selling price:

Rs.220

Batch:

PAN001

Expiry:

12/2027

Stock:

100 tablets

Create patient:

Ahmed Khan

Make sale:

3 tablets

Expected:

Subtotal = Rs.660

Paid = Rs.1,000

Change = Rs.340

Remaining stock = 97

Gross profit = Rs.120

Then return 1 tablet.

Expected final stock:

98 tablets

Expected net sold quantity:

2 tablets

Verify that:

Sale appears in Sales History

Return appears in Return History

Stock Ledger is correct

Product History is correct

Patient History is correct

Dashboard is correct

Profit is correct

Audit Log is correct

Invoice is correct

45. FINAL INSTRUCTION

Do not give me another theoretical plan.

Do not just describe the application.

BUILD THE APPLICATION.

Inspect the existing project first.

Preserve anything that already works.

Implement the missing functionality.

Test each major workflow.

Fix errors.

Then polish the UI.

The final result should be a real, usable:

AL SHIFA FAMILY CLINIC

PHARMACY MANAGEMENT SYSTEM

for:

Dr. Saqlain Abbas Chattha

Start now. Attached is the logo of Al Shifa Family Clinic.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e7e0b016-8ca6-4bc9-8932-5ecfdc67884c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
