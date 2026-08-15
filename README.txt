SFS BUSINESS MANAGEMENT – COMPLETE PACKAGE
==============================================

What is included:
- Products / live stock connection
- Product Model / Part No. is clickable; no View button
- Existing product image URLs are preserved/read from the live source
- Five categories
- Inward / Purchase entry
- Delivery Challan entry + print preview
- Invoice entry + print preview
- Customer / Supplier records
- Reports / movement area
- Google Apps Script backend (Code.gs)
- Safe migration: original live Google Sheet remains read-only

IMPORTANT:
The old live inventory is the source of truth for the existing stock. The app reads:
Stock gid 1719776219
Import gid 1389271409
Return gid 1032386368

DO NOT give the old published sheet write access.

For permanent staff entry:
1. Create a NEW blank Google Sheet.
2. Extensions > Apps Script.
3. Paste Code.gs.
4. Change API_TOKEN to a private value.
5. Run setupDatabase() once.
6. Deploy as Web App.
7. Put the /exec URL + same token into Settings in the web app.

The Apps Script copies the live Stock/Import/Return data into separate tabs and creates the new database tabs.
It also keeps product image URLs and Model/Part No. associations.

Company document format:
- Delivery Challan layout follows the supplied SFS / Metier Challan structure.
- Invoice layout follows the supplied SFS / Metier Invoice structure.
- Company header/address information from the supplied files is included in the print templates.

The GitHub Pages frontend can be hosted free. Google Apps Script can provide the write-back database without paid hosting.
