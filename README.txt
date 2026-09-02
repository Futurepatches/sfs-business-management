SFS BUSINESS MANAGEMENT - LOGIN CONNECTION FIX

FRONTEND (GitHub Pages): upload these files to the repository root:
index.html
app.js
styles.css
config.js
logo.png

The Apps Script URL is already configured in config.js. The URL is NOT shown on the login screen.

BACKEND:
Code.gs is the matching backend for the existing "Users & Roles" sheet and session login.
Do NOT run setupDatabase() just to fix login.

IMPORTANT:
The Apps Script Web App /exec URL was tested and returned:
{"ok":true,"service":"SFS Business Management","message":"API is online"}

After uploading frontend files, hard refresh the GitHub Pages site (Ctrl+F5).
