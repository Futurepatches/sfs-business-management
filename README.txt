SFS BUSINESS MANAGEMENT - COMPLETE WORKING PACKAGE

This package is designed around:
- Original SFS live Google Sheet as READ-ONLY source.
- Separate Google Sheet database for new transactions.
- Google Apps Script backend.
- GitHub Pages frontend.

FILES:
Code.gs       -> paste into the bound Apps Script project of the NEW database sheet.
index.html    -> GitHub Pages frontend.
styles.css    -> frontend styling.
app.js        -> frontend logic.
logo.png      -> copy the existing SFS logo from your repository.

IMPORTANT SETUP:
1. Keep the original live inventory sheet untouched.
2. Create/open the separate SFS Business Management DATABASE Google Sheet.
3. Extensions -> Apps Script.
4. Replace Code.gs with this Code.gs.
5. Save.
6. Run setupDatabase once and authorize.
7. Deploy -> New deployment -> Web app.
   Execute as: Me
   Who has access: Anyone
8. Copy the Web App URL.
9. In GitHub Pages software, Settings -> paste the Web App URL -> Save Settings.
10. Login with initial admin: admin / admin123.
11. Immediately change the admin password from Settings -> Change My Password.
12. Admin can create staff accounts from Users / Staff.

SECURITY NOTE:
This version removes the need for a frontend API secret token. Authentication is performed by the Apps Script backend. Do not put passwords or Google credentials in GitHub files.

SOURCE:
The Code.gs contains the three published read-only source CSV URLs already used by the current SFS stock site. It refreshes SourceStock/SourceImports/SourceReturns and syncs Products without modifying the original source.

STOCK LOGIC:
Current stock = original source current stock + new IN transactions - new OUT transactions.
Delivery Challan creates OUT stock transaction. Invoice records the sale/ledger but does NOT reduce stock a second time.

PRODUCT IMAGES:
Existing source image URLs are preserved when available. New product images can be uploaded through Add Product; Apps Script stores them in a Google Drive folder named SFS Product Images.
