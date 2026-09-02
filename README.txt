SFS BUSINESS MANAGEMENT - CONNECTION FIX

1. Replace the GitHub Pages frontend files with ALL files in this folder:
   index.html, app.js, styles.css, config.js, logo.png

2. Apps Script:
   Replace Code.gs with the Code.gs in this package.
   Save it, then Deploy > Manage deployments > Web app > Edit > New version > Deploy.
   Keep Execute as: Me and access: Anyone with the link (or your existing working access setting).

3. DO NOT run setupDatabase().

The frontend first tries POST and automatically falls back to JSONP GET. This avoids the browser CORS/redirect problem that can cause 'Connection error' with Apps Script Web Apps from GitHub Pages.
