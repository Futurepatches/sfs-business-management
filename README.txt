SFS BUSINESS MANAGEMENT — CONNECTION FIX

1. GitHub Pages:
   Replace these files in the repository root:
   index.html
   app.js
   styles.css
   config.js
   logo.png

2. Google Apps Script:
   Replace Code.gs with the supplied Code.gs.
   SAVE.
   Deploy > Manage deployments > Edit the Web app deployment.
   Create/select a NEW VERSION and Deploy.
   Keep the existing /exec URL.

3. IMPORTANT:
   Do NOT run setupDatabase().
   Do NOT create a new database.
   Do NOT change the original live inventory.

4. Hard refresh GitHub Pages after deployment: Ctrl+F5.

The backend now supports JSONP GET fallback, which fixes browsers that block
GitHub Pages POST/fetch requests to Apps Script.
