SFS BUSINESS MANAGEMENT - FRONTEND FINAL

1. Replace these files in the GitHub Pages repository:
   index.html
   app.js
   styles.css
   config.js
   price-list.js
   Keep your existing logo.png.

2. ONE-TIME configuration:
   Open config.js and replace:
   PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE
   with the existing deployed Apps Script /exec URL.

   This is the only frontend configuration. Users do NOT enter the URL at login.

3. Do NOT replace Code.gs with this package.
   Do NOT run setupDatabase() for this frontend upload.

4. Price list:
   Only matched stock products are included.
   Model = Price List column A.
   Rate = Price List column R.
   500 existing stock products matched; unmatched products are not assigned guessed prices.

5. Invoice:
   Standard sale price is auto-filled, but the final Rate / Unit remains editable.
   There is NO discount field.

6. Delivery Challan:
   Saves stock OUT. Invoice does not reduce stock again.

7. Source inventory:
   Original live inventory remains read-only.
