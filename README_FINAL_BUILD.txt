SFS BUSINESS MANAGEMENT — FINAL BUILD
======================================

This package is based on the working SFS frontend/database files already
created and the supplied original Delivery Challan and Invoice workbooks.

WHAT IS INCLUDED
----------------
- Final login UI: Username + Password only. No Apps Script URL field.
- Products with category and image upload.
- Customers and Suppliers with styled cards and ledger buttons.
- Inward / Purchase.
- Stock movement.
- Delivery Challan.
- Invoice.
- Reports.
- Admin / Staff users.
- A4 print layouts rebuilt from the supplied SFS DC and Invoice workbooks.

SOURCE-FORMAT DETAILS IMPLEMENTED
----------------------------------
Delivery Challan:
- STANDARD FLUID SYSTEMS heading/logo
- CHALLAN title
- M/S, DATE, Challan #, Customer ID, PO #, PO Date, STN, NTN, Address
- Item / Description / ITEM CODE / Qty. / Rate /Unit / Amount
- Total
- Thank you for Your Business!
- Receiver's Name & Sign
- SFS address/contact footer

Invoice:
- STANDARD FLUID SYSTEMS header
- INVOICE title
- M/S, Date, Invoice#, Address
- P.O#, P.O. Date
- Delivery Challan # and date
- S.T.N# / N.T.N#
- Item / Description / ITEM CODE / Qty. / Rate /Unit / Amount
- Sub Total
- ADD GST 18 %
- TOTAL
- Rupees in words
- A.CODE 84-4 / General Industrial Machinery & Equipment
- FOR STANDARD FLUID SYSTEMS
- SFS address/contact footer

IMPORTANT PRICING RULE
----------------------
No discount field is shown.
Invoice rate is prefilled from the product Sale Price when a model is selected,
but the rate remains editable for client-specific pricing.

DATABASE SAFETY
---------------
- Original live inventory remains read-only.
- Software database is the writable database.
- Do not run setupDatabase() unless specifically instructed.
- Do not overwrite Source Stock.

DEPLOYMENT
----------
1. Upload/replace these GitHub Pages files:
   index.html
   app.js
   styles.css
   config.js
   logo.png

2. In config.js, replace:
   PASTE_YOUR_EXISTING_WEB_APP_EXEC_URL_HERE
   with the SAME /exec URL from the Web App deployment that currently
   connects to your working SFS database.

3. Keep the Apps Script backend deployment that matches the database.
   The included Code.gs is the session-based backend used by this frontend.

4. Hard refresh the website: Ctrl+F5.

5. Login with your existing credentials.

DO NOT PUT THE WEB APP URL INTO THE LOGIN SCREEN.
It is configured once in config.js.

DC/INVOICE TEST
---------------
Create a test DC with one existing product.
Use Save & Print and verify the A4 layout.
Then create an invoice against that DC.
Invoice does not deduct stock again; the DC is the stock OUT transaction.

The supplied workbooks were:
- 247-2026-Metier Impression-CHALLAN.xlsx
- 2009-2026-Metier-Impression-Bill.xlsx
