/*
SFS BUSINESS MANAGEMENT - GOOGLE APPS SCRIPT BACKEND
-----------------------------------------------------
PHASE 3.1 — REVIEWED & FIXED

DATA SAFETY:
- Koi sheet clear nahi hoti, koi existing row automatically delete nahi hoti.
- Source sync ab manual products ko delete NAHI karta.
- Sirf missing columns / sheets add hoti hain.

IS VERSION MEIN KYA THEEK HUA (short):
 1. Refresh Source ab manual products delete nahi karta; duplicate source models ek row banate hain.
 2. Blank Modules wala comment/code ka tazaad khatam (blank = koi access nahi). Purane staff ke liye
    migrateBlankModulesToFull() ek dafa chala len (neeche likha hai).
 3. Login GET se band (ALLOW_GET_LOGIN=false). Bootstrap ab module permissions ke mutabiq data deta hai.
 4. Session mein sirf username hota hai; role/modules/status har request par live check hote hain
    (user disable / modules change foran lagu). Password badalne par baqi sessions khatam.
 5. Reorder Level 0 ab 0 hi rehta hai (pehle 5 ban jata tha).
 6. GST 0% ab sahi (pehle 18% ban jata tha) — outstanding, sales summary, payments.
 7. DC: same product do baar ho to stock check cumulative. DC edit pehle validate karta hai, phir likhta hai.
 8. Invoice: qty>0, rate>=0, DC ka wujood, DC ka customer, invoice qty <= DC qty (STRICT_INVOICE_VS_DC).
 9. Inactive product / customer DC mein block.
10. updateProduct partial update se purana data nahi mitata.
11. Saari write actions lock ke andar (duplicate ID race khatam).
12. Duplicate customer / supplier naam block. Password kam az kam 6 chars. Aakhri admin / khud ko disable nahi.
13. Login lockout CacheService mein (Script Properties nahi bharte); expired sessions ki safai.
14. Audit Log sheet (kis ne kya kiya), backupNow() / setupDailyBackup(), healthCheck().
15. Bootstrap / DC / stock movement tez (ek pass mein stock maps).
16. Reports: year filter durust, DC edit ke baad category units net hote hain.
17. Dates: 'YYYY-MM-DD' ab script timezone ke mutabiq (din aage-peeche nahi hota).
    ZAROORI: Apps Script > Project Settings > Time zone = (GMT+05:00) Karachi.

HATA DIYA: API_TOKEN (kahin use nahi hota tha) aur DEV_MODE (bina login admin access ka khatra).
*/

/* ---------- SETTINGS ---------- */

const ALLOW_GET_LOGIN = false;          // true = login GET (URL) se bhi ho sakta hai (password URL mein jata hai) — off rakhein
const HIDE_COST_FROM_STAFF = false;     // true = STAFF ko Cost Price nahi dikhega (aur wo cost edit nahi kar sakte)
const STRICT_INVOICE_VS_DC = true;      // true = invoice ki qty/models DC se match hon; false = sirf customer/DC ka wujood check
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_LOCK_LIMIT = 5;
const LOGIN_LOCK_SECONDS = 300;
const MIN_PASSWORD_LENGTH = 6;
const BACKUP_KEEP = 30;

const SOURCE = {
  stock: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-L0Qdw8fesYpscH6K9sA5WIXOTMp9-ja47HrnDoVoI814-v-lMjhze3LMfDK8mDDqj_gislv0ZmE8/pub?gid=909776740&single=true&output=csv',
  imports: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-L0Qdw8fesYpscH6K9sA5WIXOTMp9-ja47HrnDoVoI814-v-lMjhze3LMfDK8mDDqj_gislv0ZmE8/pub?gid=1078577908&single=true&output=csv',
  returns: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-L0Qdw8fesYpscH6K9sA5WIXOTMp9-ja47HrnDoVoI814-v-lMjhze3LMfDK8mDDqj_gislv0ZmE8/pub?gid=169812999&single=true&output=csv'
};

const MODULES = ['products','sales','accounts','parties','reports'];

const HEADERS = {
  'Products':['Product ID','Model / Part No.','Description','Category','Brand','Unit','Location','Cost Price','Sale Price','Current Stock','Product Image','Remarks','Status','Reorder Level'],
  'Inward':['Inward ID','Date','Product ID','Model / Part No.','Quantity','Source Type','Supplier','Supplier Reference','Purchase Cost','Remarks','Created By'],
  'Stock Movement':['Transaction ID','Date/Time','Type','Product ID','Model / Part No.','Quantity','Source / Destination','Reference Type','Reference No.','Created By'],
  'Delivery Challans':['DC No.','Date','Customer ID','Customer Name','Delivery Address','PO #','PO Date','STN','NTN','Product ID','Model / Part No.','Description','Quantity','Unit','Created By'],
  'Invoices':['Invoice No.','Date','Customer ID','Customer Name','PO #','PO Date','DC No.','DC Date','STN','NTN','Product ID','Model / Part No.','Description','Quantity','Rate / Unit','Amount','Created By','GST %'],
  'Quotations':['Quotation No.','Date','Customer ID','Customer Name','Address','PO #','PO Date','Validity','STN','NTN','Product ID','Model / Part No.','Description','Quantity','Unit','Rate / Unit','Amount','Created By'],
  'Customers':['Customer ID','Customer Name','Contact Person','Phone','Email','Address','NTN/Tax ID','Remarks','Status'],
  'Suppliers':['Supplier ID','Supplier Name','Contact Person','Phone','Email','Address','NTN/Tax ID','Remarks','Status'],
  'Users & Roles':['User ID','Name','Username','Role','Password','Status','Modules'],
  'Categories':['Category ID','Category Name'],
  'Payments':['Payment ID','Date','Customer ID','Customer Name','Invoice No.','Amount','Method','Reference','Remarks','Created By'],
  'Supplier Payments':['Payment ID','Date','Supplier ID','Supplier Name','Amount','Method','Reference','Remarks','Created By'],
  'Targets':['Year','Target Amount'],
  'Audit Log':['Time','User','Action','Details']
};

const WRITE_ACTIONS = [
  'saveProduct','product','updateProduct','setProductStatus',
  'saveCustomer','updateCustomer','setCustomerStatus',
  'saveSupplier','updateSupplier','setSupplierStatus',
  'saveInward','inward','saveDC','dc','updateDC','saveInvoice','invoice','saveQuotation','quotationHistory',
  'savePayment','saveSupplierPayment','saveTarget',
  'saveUser','updateUser','disableUser','changePassword',
  'refreshSource','sync'
];

/* ---------- SMALL HELPERS ---------- */

function errMsg_(err) { return String(err && err.message ? err.message : err); }
function isBlank_(v) { return v === '' || v === null || v === undefined; }
function num_(v) { const n = Number(String(v === null || v === undefined ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function round2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function normName_(s) { return String(s || '').trim().toLowerCase(); }

/* 'YYYY-MM-DD' ko script timezone ke din ke dopahar (12:00) par rakhta hai taake din aage-peeche na ho */
function toDate_(v) {
  if (v instanceof Date) return isNaN(v) ? '' : v;
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const d = new Date(s);
  return isNaN(d) ? '' : d;
}
function yearOf_(v) { const d = toDate_(v); return d ? d.getFullYear() : null; }

function gstOf_(v) {
  if (isBlank_(v)) return 18;
  const n = Number(v);
  return isNaN(n) ? 18 : n;          // 0 ab 0 hi rehta hai
}

/* ---------- WEB API ---------- */

function doGet(e) {
  const p = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
  const callback = String(p.callback || '').trim();
  delete p.callback;

  let result;
  try {
    const action = String(p.action || '').trim();

    if (p.data) {
      try {
        const packed = JSON.parse(decodeURIComponent(p.data));
        Object.keys(packed || {}).forEach(k => {
          if (k !== 'action' && k !== 'session' && k !== 'callback') p[k] = packed[k];
        });
      } catch (ignore) {}
    }

    if (action === 'login') {
      result = ALLOW_GET_LOGIN ? loginUser(p) : {ok:false, error:'Login GET par band hai. POST use karein.'};
    } else if (action === 'bootstrap') {
      result = bootstrap_(p);
    } else if (!action) {
      result = {ok:true, service:'SFS Business Management', message:'API is online', timestamp:new Date()};
    } else {
      result = {ok:false, error:'Unknown action: ' + action};
    }
  } catch (err) {
    result = {ok:false, error:errMsg_(err)};
  }

  if (callback) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) return out({ok:false, error:'Invalid callback'});
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return out(result);
}

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(p.action || '').trim();

    if (action === 'login') return out(loginUser(p));
    if (action === 'logout') return out(logoutUser_(p));
    if (action === 'bootstrap') return out(bootstrap_(p));

    const auth = requireSession_(p);
    if (!auth.ok) return out(auth);

    let lock = null;
    if (WRITE_ACTIONS.indexOf(action) !== -1) {
      lock = LockService.getScriptLock();
      try { lock.waitLock(30000); } catch (lockErr) {
        return out({ok:false, error:'System busy. Please try again.'});
      }
    }

    try {
      const res = dispatch_(action, p, auth.user);
      if (lock && res && res.ok) logAudit_(auth.user, action, p, res);
      return out(res);
    } finally {
      if (lock) lock.releaseLock();
    }
  } catch (err) {
    return out({ok:false, error:errMsg_(err)});
  }
}

function out(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function need_(user, mod, label) {
  return hasModule_(user, mod) ? null : {ok:false, error:'Aapko ' + label + ' ka access nahi hai.'};
}

function dispatch_(action, p, user) {
  let d;
  switch (action) {
    case 'saveProduct':
    case 'product':
      if ((d = need_(user, 'products', 'Products module'))) return d;
      p.user = user.username;
      return saveProduct(p, user);

    case 'updateProduct':
      if ((d = need_(user, 'products', 'Products module'))) return d;
      return updateProduct(p, user);

    case 'setProductStatus':
      return setProductStatus_(p, user);

    case 'updateCustomer':
      if ((d = need_(user, 'parties', 'Parties module'))) return d;
      return updateCustomer(p);

    case 'setCustomerStatus':
      return setCustomerStatus_(p, user);

    case 'updateSupplier':
      if ((d = need_(user, 'parties', 'Parties module'))) return d;
      return updateSupplier(p);

    case 'setSupplierStatus':
      return setSupplierStatus_(p, user);

    case 'saveInward':
    case 'inward':
      if ((d = need_(user, 'products', 'Products/Inward module'))) return d;
      p.user = user.username;
      return saveInward(p);

    case 'saveDC':
    case 'dc':
      if ((d = need_(user, 'sales', 'Sales module'))) return d;
      p.user = user.username;
      return saveDC(p);

    case 'updateDC':
      if ((d = need_(user, 'sales', 'Sales module'))) return d;
      p.user = user.username;
      return updateDC(p);

    case 'saveInvoice':
    case 'invoice':
      if ((d = need_(user, 'sales', 'Sales module'))) return d;
      p.user = user.username;
      return saveInvoice(p);

    case 'saveQuotation':
      if ((d = need_(user, 'sales', 'Sales module'))) return d;
      p.user = user.username;
      return saveQuotation(p);

    case 'quotationHistory':
      if ((d = need_(user, 'sales', 'Sales module'))) return d;
      return getQuotationHistory_();

    case 'savePayment':
      if ((d = need_(user, 'accounts', 'Accounts module'))) return d;
      p.user = user.username;
      return savePayment(p);

    case 'getOutstanding':
      if ((d = need_(user, 'accounts', 'Accounts module'))) return d;
      return getOutstandingForFrontend_(p);

    case 'getPaymentHistory':
      if ((d = need_(user, 'accounts', 'Accounts module'))) return d;
      return getPaymentHistory_(p);

    case 'saveSupplierPayment':
      if ((d = need_(user, 'accounts', 'Accounts module'))) return d;
      p.user = user.username;
      return saveSupplierPayment(p);

    case 'getSupplierOutstanding':
      if ((d = need_(user, 'accounts', 'Accounts module'))) return d;
      return getSupplierOutstandingForFrontend_(p);

    case 'getSupplierPaymentHistory':
      if ((d = need_(user, 'accounts', 'Accounts module'))) return d;
      return getSupplierPaymentHistory_(p);

    case 'getSalesSummary':
      if ((d = need_(user, 'reports', 'Reports module'))) return d;
      return getSalesSummaryForFrontend_(p);

    case 'saveTarget':
      if ((d = need_(user, 'reports', 'Reports module'))) return d;
      return saveTarget(p, user);

    case 'saveCustomer':
      if ((d = need_(user, 'parties', 'Parties module'))) return d;
      return saveCustomer_(p, user);

    case 'saveSupplier':
      if ((d = need_(user, 'parties', 'Parties module'))) return d;
      return saveSupplier_(p, user);

    case 'getLedger':
      if (!hasModule_(user, 'parties') && !hasModule_(user, 'accounts')) return {ok:false, error:'Aapko Ledger ka access nahi hai.'};
      return getLedgerForFrontend_(p);

    case 'getReports':
      if (!hasModule_(user, 'reports') && !hasModule_(user, 'sales')) return {ok:false, error:'Aapko Reports ka access nahi hai.'};
      return getReportsForFrontend_(p);

    case 'listUsers':
      return listUsers_(user);
    case 'saveUser':
      return saveUser_(p, user);
    case 'updateUser':
      return updateUser_(p, user);
    case 'disableUser':
      return disableUser_(p, user);
    case 'changePassword':
      return changePassword_(p, user);

    case 'refreshSource':
    case 'sync':
      if (String(user.role || '').toUpperCase() !== 'ADMIN') return {ok:false, error:'Only an Admin can refresh source data.'};
      syncSourceData();
      return {ok:true, message:'Source data refreshed'};

    case 'products':
      if ((d = need_(user, 'products', 'Products'))) return d;
      return getProducts(user);

    case 'stock':
      if ((d = need_(user, 'products', 'Stock'))) return d;
      return getStock(p);

    case 'stockMovement':
      if ((d = need_(user, 'products', 'Stock Movement'))) return d;
      return getStockMovement(p);

    case 'customers':
      if ((d = need_(user, 'parties', 'Customers'))) return d;
      return getCustomers();

    case 'suppliers':
      if ((d = need_(user, 'parties', 'Suppliers'))) return d;
      return getSuppliers();

    default:
      return {ok:false, error:'Unknown action: ' + action};
  }
}

/* ---------- AUDIT LOG ---------- */

function logAudit_(user, action, p, res) {
  try {
    const sh = ensureSheet('Audit Log', HEADERS['Audit Log']);
    const keys = ['model','no','invoiceNo','dc','name','username','customer','supplier','amount','status','year','role','category'];
    const parts = [];
    keys.forEach(k => {
      const v = p[k];
      if (v !== undefined && v !== null && v !== '' && typeof v !== 'object') parts.push(k + '=' + String(v).slice(0, 80));
    });
    if (res && res.id) parts.push('id=' + res.id);
    if (Array.isArray(p.items)) parts.push('items=' + p.items.length);
    if (Array.isArray(p.modules)) parts.push('modules=' + p.modules.join('|'));
    sh.appendRow([new Date(), user.username, action, parts.join('; ')]);
  } catch (ignore) {}
}

/* ---------- MODULE PERMISSION HELPERS ---------- */

function normalizeModules_(raw) {
  const arr = Array.isArray(raw)
    ? raw.map(s => String(s).trim().toLowerCase())
    : String(raw || '').split(',').map(s => s.trim().toLowerCase());
  return arr.filter(m => m && MODULES.indexOf(m) !== -1);
}

/* ADMIN = hamesha full access. STAFF = sirf wahi modules jo Modules column mein likhe hon.
   Blank Modules = KOI access nahi (secure default). Purane staff ke liye migrateBlankModulesToFull() chalayen. */
function hasModule_(user, module) {
  if (!user) return false;
  if (String(user.role || '').toUpperCase() === 'ADMIN') return true;
  const mods = normalizeModules_(user.modules);
  if (!mods.length) return false;
  return mods.indexOf(String(module).toLowerCase()) !== -1;
}

function ensureModulesColumn_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  if (!sh) return;
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (headers.indexOf('Modules') !== -1) return;
  sh.getRange(1, lastCol + 1).setValue('Modules');
}

/* EK DAFA chalayen (Apps Script editor > function chunein > Run):
   jin STAFF users ka Modules blank hai unko saare modules de deta hai taake purana access barqarar rahe.
   Baad mein Users page se har staff ke modules apni marzi se set karein. */
function migrateBlankModulesToFull() {
  const ctx = readUsersSheet_(true);
  if (!ctx) return 'Users & Roles sheet not found.';
  const cols = ctx.cols;
  if (cols.modules === -1) return 'Modules column not found.';
  let changed = 0;
  for (let i = 1; i < ctx.values.length; i++) {
    const role = cols.role !== -1 ? String(ctx.values[i][cols.role] || '').toUpperCase() : 'STAFF';
    if (role === 'ADMIN') continue;
    if (!String(ctx.values[i][cols.username] || '').trim()) continue;
    if (!normalizeModules_(ctx.values[i][cols.modules]).length) {
      ctx.sh.getRange(i + 1, cols.modules + 1).setValue(MODULES.join(','));
      changed++;
    }
  }
  CacheService.getScriptCache().removeAll([]);
  return 'Updated ' + changed + ' staff user(s).';
}

/* ---------- DATABASE SETUP ---------- */

function setupDatabase() {
  // Purani sheets mein default columns pehle (default values ke saath) lagao
  ensureReorderLevelColumn_();
  ensureInvoiceGstColumn_();

  Object.keys(HEADERS).forEach(name => { ensureSheet(name, HEADERS[name]); });

  ensureDefaultCategories_();
  ensureDefaultAdmin_();
  ensureModulesColumn_();
  syncSourceData();

  return 'Database setup complete. Existing writable data was preserved.';
}

function ensureSheet(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);

  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missing = headers.filter(h => existing.indexOf(h) === -1);
  if (missing.length) sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  return sh;
}

function ensureDefaultCategories_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Categories');
  if (!sh) return;
  const existing = sh.getDataRange().getValues();
  const names = {};
  existing.slice(1).forEach(r => { if (r[1]) names[String(r[1]).trim().toLowerCase()] = true; });

  const cats = [
    ['CAT-01','Airline Equipment'],
    ['CAT-02','Valves'],
    ['CAT-03','Cylinder'],
    ['CAT-04','Fittings/Tubing'],
    ['CAT-05','Others']
  ];
  const missing = cats.filter(r => !names[String(r[1]).toLowerCase()]);
  if (missing.length) sh.getRange(sh.getLastRow() + 1, 1, missing.length, 2).setValues(missing);
}

function getUserCols_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
  const find = (...names) => {
    for (const n of names) {
      const idx = headers.indexOf(n.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  };
  return {
    total: lastCol,
    id: find('user id', 'id'),
    name: find('name'),
    username: find('username'),
    role: find('role'),
    password: find('password', 'password hash'),
    status: find('status'),
    modules: find('modules')
  };
}

/* NOTE: default admin: username "admin", password "admin123" — pehli dafa login ke baad foran badlein. */
function ensureDefaultAdmin_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  if (!sh) return;
  ensureModulesColumn_();
  const cols = getUserCols_(sh);
  const values = sh.getDataRange().getValues();

  const hasAdmin = values.slice(1).some(r => String(r[cols.username] || '').trim().toLowerCase() === 'admin');
  if (!hasAdmin) {
    const row = new Array(cols.total).fill('');
    if (cols.id !== -1) row[cols.id] = 'USR-000001';
    if (cols.name !== -1) row[cols.name] = 'Administrator';
    if (cols.username !== -1) row[cols.username] = 'admin';
    if (cols.role !== -1) row[cols.role] = 'ADMIN';
    if (cols.password !== -1) row[cols.password] = hashPassword_('admin123');
    if (cols.status !== -1) row[cols.status] = 'Active';
    sh.appendRow(row);
  }
}

/* ---------- SOURCE DATA ---------- */

function parseCsv(text) { return Utilities.parseCsv(text); }

function fetchSource(url) {
  const response = UrlFetchApp.fetch(url, {muteHttpExceptions:true, followRedirects:true});
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw Error('Source download failed. HTTP ' + status);
  return parseCsv(response.getContentText());
}

function syncSourceData() {
  const stock = fetchSource(SOURCE.stock);
  const imp = fetchSource(SOURCE.imports);
  const ret = fetchSource(SOURCE.returns);
  writeSource('Source Stock', stock);
  writeSource('Source Imports', imp);
  writeSource('Source Returns', ret);
  syncProductsFromSource_(stock);
}

function writeSource(name, data) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  if (data.length && data[0].length) sh.getRange(1, 1, data.length, data[0].length).setValues(data);
  sh.setFrozenRows(1);
}

/* ---------- STOCK MAPS (ek pass mein saara stock) ---------- */

function buildStockMaps_() {
  const src = {}, mov = {};
  const s = SpreadsheetApp.getActive().getSheetByName('Source Stock');
  if (s && s.getLastRow() >= 5) {
    s.getDataRange().getValues().slice(4).forEach(r => {
      const m = String(r[0] || '').trim();
      if (!m) return;
      src[m] = (src[m] || 0) + (Number(String(r[6] || 0).replace(/,/g, '')) || 0);
    });
  }
  getMovementRows_().forEach(r => {
    const m = String(r[4] || '').trim();
    if (!m) return;
    mov[m] = (mov[m] || 0) + (Number(r[5]) || 0);
  });
  return {src:src, mov:mov, stock: m => (src[m] || 0) + (mov[m] || 0)};
}

/* ---------- PRODUCT MASTER ---------- */

/* Refresh Source: Products sheet ki koi row delete nahi hoti.
   - Source mein maujood models: description/location/image update, stock recalculate.
   - Source mein na hone wale (manual) products: jaise hain waise, sirf stock recalculate.
   - Source ke naye models: nayi row. Duplicate source models = ek hi row (qty jama). */
function syncProductsFromSource_(stock) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  if (!sh) throw Error('Products sheet not found.');
  const H = HEADERS.Products.length;
  const lastRow = sh.getLastRow();
  const existing = lastRow > 1 ? sh.getRange(2, 1, lastRow - 1, H).getValues() : [];

  const info = {}, order = [];
  stock.slice(4).forEach(r => {
    const model = String(r[0] || '').trim();
    if (!model) return;
    if (!info[model]) { info[model] = {loc:r[1] || '', desc:r[2] || '', img:r[4] || ''}; order.push(model); }
  });
  if (!order.length) return;

  const maps = buildStockMaps_();
  let maxId = 0;
  existing.forEach(r => {
    const m = String(r[0] || '').match(/^P-(\d+)$/);
    if (m) maxId = Math.max(maxId, Number(m[1]));
  });

  const seen = {};
  const rows = existing.map(r => {
    const row = r.slice();
    while (row.length < H) row.push('');
    const model = String(row[1] || '').trim();
    if (!model) return row;
    const inf = info[model];
    if (inf && !seen[model]) {
      row[2] = inf.desc || row[2];
      row[6] = inf.loc || row[6];
      row[10] = row[10] || inf.img;
    }
    row[5] = row[5] || 'Pcs';
    row[12] = row[12] || 'Active';
    row[13] = isBlank_(row[13]) ? 5 : row[13];
    row[9] = maps.stock(model);
    seen[model] = true;
    return row;
  });

  order.forEach(model => {
    if (seen[model]) return;
    maxId++;
    const inf = info[model];
    rows.push([
      'P-' + String(maxId).padStart(6, '0'), model, inf.desc, '', '', 'Pcs', inf.loc, '', '',
      maps.stock(model), inf.img, '', 'Active', 5
    ]);
    seen[model] = true;
  });

  sh.getRange(2, 1, rows.length, H).setValues(rows);
}

/* ---------- IDS ---------- */

function nextIds_(prefix, sheet, columnIndex, count) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheet);
  const numRows = sh ? sh.getLastRow() - 1 : 0;
  let max = 0;
  if (numRows > 0) {
    const re = new RegExp('^' + prefix + '(\\d+)$');
    sh.getRange(2, columnIndex, numRows, 1).getValues().forEach(r => {
      const m = String(r[0] || '').match(re);
      if (m) max = Math.max(max, Number(m[1]));
    });
  }
  const ids = [];
  for (let i = 1; i <= (count || 1); i++) ids.push(prefix + String(max + i).padStart(6, '0'));
  return ids;
}
function nextSafeId_(prefix, sheet, columnIndex) { return nextIds_(prefix, sheet, columnIndex, 1)[0]; }

function appendRows_(sheetName, rows) {
  if (!rows.length) return;
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) throw Error(sheetName + ' sheet not found.');
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

/* ---------- PRODUCTS ---------- */

function findProduct(model) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  const v = sh.getDataRange().getValues();
  const target = String(model).trim();
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][1]).trim() === target) return {row:i + 1, data:v[i]};
  }
  return null;
}

function getProductMap_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  const map = {};
  if (!sh) return map;
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    const m = String(v[i][1] || '').trim();
    if (m && !map[m]) map[m] = {row:i + 1, data:v[i]};
  }
  return map;
}

function ensureInvoiceGstColumn_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Invoices');
  if (!sh) return;
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('GST %') !== -1) return;
  const newCol = lastCol + 1;
  sh.getRange(1, newCol).setValue('GST %');
  const lastRow = sh.getLastRow();
  if (lastRow > 1) {
    const defaults = [];
    for (let i = 0; i < lastRow - 1; i++) defaults.push([18]);
    sh.getRange(2, newCol, lastRow - 1, 1).setValues(defaults);
  }
}

function ensureReorderLevelColumn_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  if (!sh) return;
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('Reorder Level') !== -1) return;
  const newCol = lastCol + 1;
  sh.getRange(1, newCol).setValue('Reorder Level');
  const lastRow = sh.getLastRow();
  if (lastRow > 1) {
    const defaults = [];
    for (let i = 0; i < lastRow - 1; i++) defaults.push([5]);
    sh.getRange(2, newCol, lastRow - 1, 1).setValues(defaults);
  }
}

function hideCost_(user) {
  return HIDE_COST_FROM_STAFF && String((user && user.role) || '').toUpperCase() !== 'ADMIN';
}

function validStatus_(s) {
  const v = String(s || 'Active').trim();
  if (v !== 'Active' && v !== 'Inactive') throw Error('Status Active ya Inactive hona chahiye.');
  return v;
}

function optionalMoney_(v, label) {
  if (isBlank_(v)) return '';
  const n = num_(v);
  if (n < 0) throw Error(label + ' negative nahi ho sakta.');
  return n;
}

function updateProduct(p, user) {
  const model = String(p.model || '').trim();
  const prod = findProduct(model);
  if (!prod) throw Error('Product not found: ' + model);

  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  const row = prod.row;

  // Resolve columns by header name so Reorder Level and Status cannot be mixed up.
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const col = name => {
    const target = String(name).trim().toLowerCase();
    const i = headers.findIndex(h => h.toLowerCase() === target);
    return i === -1 ? 0 : i + 1;
  };
  const has = k => p[k] !== undefined;
  const put = (name, value) => {
    const c = col(name);
    if (c) sh.getRange(row, c).setValue(value);
  };

  // Partial update: fields not sent by the frontend remain unchanged.
  if (has('description')) put('Description', p.description || '');
  if (has('category')) put('Category', p.category || '');
  if (has('brand')) put('Brand', p.brand || '');
  if (has('unit')) put('Unit', p.unit || 'Pcs');
  if (has('location')) put('Location', p.location || '');
  if (has('costPrice') && !hideCost_(user)) put('Cost Price', optionalMoney_(p.costPrice, 'Cost price'));
  if (has('salePrice')) put('Sale Price', optionalMoney_(p.salePrice, 'Sale price'));

  if (p.imageBase64 || has('image')) {
    const imageUrl = p.imageBase64 ? saveImageToDrive_(p.imageBase64, p.imageName) : (p.image || prod.data[10] || '');
    put('Product Image', imageUrl);
  }

  if (has('remarks')) put('Remarks', p.remarks || '');

  if (!isBlank_(p.reorderLevel)) {
    const rl = num_(p.reorderLevel);
    if (rl < 0) throw Error('Reorder level negative nahi ho sakta.');
    put('Reorder Level', rl);
  }

  return {ok:true};
}

function setProductStatus_(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return {ok:false, error:'Only an Admin can activate/deactivate products.'};
  }

  const model = String(p.model || '').trim();
  const prod = findProduct(model);
  if (!prod) throw Error('Product not found: ' + model);

  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const target = 'status';
  const i = headers.findIndex(h => h.toLowerCase() === target);
  if (i === -1) throw Error('Status column not found in Products sheet.');

  sh.getRange(prod.row, i + 1).setValue(validStatus_(p.status));
  return {ok:true};
}

function updateParty_(sheetName, nameCol, p) {
  const name = String(p.name || '').trim();
  if (!name) throw Error('Name is required.');
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][nameCol - 1] || '').trim().toLowerCase() === name.toLowerCase()) {
      sh.getRange(i + 1, nameCol + 1).setValue(p.contact || '');
      sh.getRange(i + 1, nameCol + 2).setValue(p.phone || '');
      sh.getRange(i + 1, nameCol + 3).setValue(p.email || '');
      sh.getRange(i + 1, nameCol + 4).setValue(p.address || '');
      sh.getRange(i + 1, nameCol + 5).setValue(p.ntn || '');
      sh.getRange(i + 1, nameCol + 6).setValue(p.remarks || '');
      return {ok:true};
    }
  }
  throw Error(sheetName.slice(0, -1) + ' not found: ' + name);
}

function setPartyStatus_(sheetName, nameCol, statusCol, p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return {ok:false, error:'Only an Admin can activate/deactivate.'};
  }
  const name = String(p.name || '').trim();
  const status = validStatus_(p.status);
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][nameCol - 1] || '').trim().toLowerCase() === name.toLowerCase()) {
      sh.getRange(i + 1, statusCol).setValue(status);
      return {ok:true};
    }
  }
  throw Error(sheetName.slice(0, -1) + ' not found: ' + name);
}

function updateCustomer(p) { return updateParty_('Customers', 2, p); }
function setCustomerStatus_(p, authUser) { return setPartyStatus_('Customers', 2, 9, p, authUser); }
function updateSupplier(p) { return updateParty_('Suppliers', 2, p); }
function setSupplierStatus_(p, authUser) { return setPartyStatus_('Suppliers', 2, 9, p, authUser); }

function saveImageToDrive_(base64Data, fileName) {
  if (!base64Data) return '';
  if (String(base64Data).length > 5 * 1024 * 1024) throw Error('Image bohat bari hai (max ~3MB).');
  const match = String(base64Data).match(/^data:(.+);base64,(.+)$/);
  const mimeType = match ? match[1] : 'image/jpeg';
  if (mimeType.indexOf('image/') !== 0) throw Error('Sirf image file upload karein.');
  try {
    const data = match ? match[2] : base64Data;
    const blob = Utilities.newBlob(Utilities.base64Decode(data), mimeType, fileName || 'product-image.jpg');
    const folder = getOrCreateFolder_('SFS Product Images');
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?export=view&id=' + file.getId();
  } catch (e) {
    throw Error('Image upload nahi ho saki: ' + errMsg_(e));
  }
}

function getOrCreateFolder_(name) {
  const folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function saveProduct(p, user) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  const model = String(p.model || '').trim();
  if (!model) throw Error('Model / Part No. is required.');
  if (findProduct(model)) throw Error('Product already exists: ' + model);

  const openingStock = num_(p.openingStock);
  if (openingStock < 0) throw Error('Opening stock negative nahi ho sakta.');
  const reorder = isBlank_(p.reorderLevel) ? 5 : num_(p.reorderLevel);
  if (reorder < 0) throw Error('Reorder level negative nahi ho sakta.');
  const cost = optionalMoney_(p.costPrice, 'Cost price');
  const price = optionalMoney_(p.salePrice, 'Sale price');

  const id = nextSafeId_('P-', 'Products', 1);
  const imageUrl = p.imageBase64 ? saveImageToDrive_(p.imageBase64, p.imageName) : (p.image || '');

  sh.appendRow([
    id, model, p.description || '', p.category || '', p.brand || '', p.unit || 'Pcs',
    p.location || '', cost, price, 0,
    imageUrl, p.remarks || '', 'Active', reorder
  ]);

  if (openingStock > 0) {
    const prod = findProduct(model);
    postMovements_([{type:'IN', prod:prod, qty:openingStock, party:'', refType:'Opening Stock', refNo:id}], p.user || 'Staff');
  }
  return {ok:true, id:id};
}

/* ---------- STOCK MOVEMENT ---------- */

function getMovementRows_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Stock Movement');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS['Stock Movement'].length).getValues();
}

function movementBalanceForModel_(model, movements) {
  const target = String(model).trim();
  let balance = 0;
  movements.forEach(r => {
    if (String(r[4] || '').trim() !== target) return;
    balance += Number(r[5] || 0);
  });
  return balance;
}

/* Ek saath kai movements likhta hai (ek write) aur phir sirf mutaasir products ka stock refresh karta hai */
function postMovements_(list, user) {
  if (!list.length) return;
  const sh = SpreadsheetApp.getActive().getSheetByName('Stock Movement');
  if (!sh) throw Error('Stock Movement sheet not found.');
  const ids = nextIds_('TX-', 'Stock Movement', 1, list.length);
  const now = new Date();
  const rows = list.map((m, i) => {
    const amount = Math.abs(Number(m.qty || 0));
    if (!(amount > 0)) throw Error('Quantity must be greater than zero.');
    const signed = (String(m.type).toUpperCase() === 'OUT') ? -amount : amount;
    return [ids[i], now, String(m.type).toUpperCase(), m.prod.data[0], m.prod.data[1], signed,
            m.party || '', m.refType || '', m.refNo || '', user || 'Staff'];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  refreshStocksForModels_(list.map(m => String(m.prod.data[1]).trim()));
}

function postMovement(type, prod, qty, party, refType, refNo, user) {
  postMovements_([{type:type, prod:prod, qty:qty, party:party, refType:refType, refNo:refNo}], user);
  return (String(type).toUpperCase() === 'OUT' ? -1 : 1) * Math.abs(Number(qty || 0));
}

function refreshStocksForModels_(models) {
  const set = {};
  models.forEach(m => { if (m) set[m] = true; });
  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  if (!sh || sh.getLastRow() < 2) return;
  const maps = buildStockMaps_();
  const vals = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    const m = String(vals[i][0] || '').trim();
    if (set[m]) sh.getRange(i + 2, 10).setValue(maps.stock(m));
  }
}

function refreshProductStock_(model) { refreshStocksForModels_([String(model).trim()]); }

function getSourceStockForModel_(model) {
  const maps = buildStockMaps_();
  return maps.src[String(model).trim()] || 0;
}

function getCurrentStock(model) {
  return buildStockMaps_().stock(String(model).trim());
}

/* ---------- INWARD ---------- */

function saveInward(p) {
  const prod = findProduct(p.model);
  if (!prod) throw Error('Product not found: ' + p.model);
  const qty = num_(p.qty || p.quantity);
  if (qty <= 0) throw Error('Inward quantity must be greater than zero.');
  const cost = optionalMoney_(p.purchaseCost, 'Purchase cost');
  const id = nextSafeId_('IN-', 'Inward', 1);
  const model = String(prod.data[1]).trim();

  appendRows_('Inward', [[
    id, toDate_(p.date) || new Date(), prod.data[0], model, qty,
    p.sourceType || '', String(p.supplier || '').trim(), p.supplierReference || '',
    cost, p.remarks || '', p.user || 'Staff'
  ]]);

  postMovements_([{type:'IN', prod:prod, qty:qty, party:String(p.supplier || '').trim(), refType:'Inward', refNo:id}], p.user || 'Staff');
  return {ok:true, id:id, currentStock:getCurrentStock(model)};
}

function numberExistsInSheet_(sheetName, value) {
  const v = String(value || '').trim();
  if (!v) return false;
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return false;
  const nums = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  return nums.some(r => String(r[0] || '').trim() === v);
}

/* ---------- CUSTOMER CHECK ---------- */

function resolveCustomer_(name, opts) {
  const n = String(name || '').trim();
  if (!n) throw Error('Customer name is required.');
  const c = objectsFromSheet_('Customers').find(x => normName_(x['Customer Name']) === normName_(n));
  if (c && String(c.Status || 'Active').toLowerCase() === 'inactive' && !(opts && opts.allowInactive)) {
    throw Error('Customer is inactive: ' + c['Customer Name']);
  }
  return c || null;
}

/* ---------- DELIVERY CHALLAN ---------- */

function prepareDcItems_(rawItems, pmap) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  if (!items.length) throw Error('Delivery Challan has no items.');
  return items.map(it => {
    const model = String(it.model || '').trim();
    const prod = pmap[model];
    if (!prod) throw Error('Product not found: ' + model);
    if (String(prod.data[12] || 'Active').toLowerCase() === 'inactive') throw Error('Product is inactive: ' + model);
    const qty = num_(it.qty);
    if (!(qty > 0)) throw Error('Invalid quantity for ' + model);
    return {item:it, prod:prod, model:model, qty:qty};
  });
}

/* Same product kai lines mein ho to unka total stock se compare hota hai */
function checkStockAvailability_(prepared, maps, credit) {
  const need = {};
  prepared.forEach(x => { need[x.model] = (need[x.model] || 0) + x.qty; });
  Object.keys(need).forEach(m => {
    const avail = maps.stock(m) + ((credit && credit[m]) || 0);
    if (need[m] > avail + 1e-9) {
      throw Error('Insufficient stock for ' + m + '. Available: ' + avail + ', requested: ' + need[m]);
    }
  });
}

function dcRow_(id, date, custId, custName, p, x) {
  return [
    id, date, custId, custName,
    p.address || '', p.po || '', toDate_(p.poDate), p.stn || '', p.ntn || '',
    x.prod.data[0], x.model, x.item.desc || x.prod.data[2], x.qty, x.item.unit || 'nos',
    p.user || 'Staff'
  ];
}

function saveDC(p) {
  const cust = resolveCustomer_(p.customer);
  const custName = cust ? cust['Customer Name'] : String(p.customer).trim();
  const custId = p.customerId || (cust ? cust['Customer ID'] : '');

  const id = String(p.no || '').trim() || nextSafeId_('DC-', 'Delivery Challans', 1);
  if (p.no && numberExistsInSheet_('Delivery Challans', id)) throw Error('Delivery Challan ' + id + ' already exists.');

  const pmap = getProductMap_();
  const prepared = prepareDcItems_(p.items, pmap);
  checkStockAvailability_(prepared, buildStockMaps_(), null);

  const date = toDate_(p.date) || new Date();
  appendRows_('Delivery Challans', prepared.map(x => dcRow_(id, date, custId, custName, p, x)));
  postMovements_(prepared.map(x => ({type:'OUT', prod:x.prod, qty:x.qty, party:custName, refType:'DC', refNo:id})), p.user || 'Staff');

  return {ok:true, id:id, message:'Delivery Challan saved successfully'};
}

function updateDC(p) {
  const no = String(p.no || '').trim();
  if (!no) throw Error('Delivery Challan number is required.');
  const invoiceExists = objectsFromSheet_('Invoices').some(r => String(r['DC No.'] || '').trim() === no);
  if (invoiceExists) throw Error('Cannot edit DC ' + no + ' — Invoice already created.');

  const sh = SpreadsheetApp.getActive().getSheetByName('Delivery Challans');
  const values = sh.getDataRange().getValues();
  const headerRow = values[0].map(String);
  const noCol = headerRow.indexOf('DC No.');
  const modelCol = headerRow.indexOf('Model / Part No.');
  const qtyCol = headerRow.indexOf('Quantity');

  const oldItems = [], rowsToDelete = [];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][noCol] || '').trim() === no) {
      oldItems.push({model:String(values[i][modelCol] || '').trim(), qty:Number(values[i][qtyCol] || 0)});
      rowsToDelete.push(i + 1);
    }
  }
  if (!rowsToDelete.length) throw Error('Delivery Challan not found: ' + no);

  // 1) Pehle sab validate karo (kuch likhne se pehle)
  const cust = resolveCustomer_(p.customer);
  const custName = cust ? cust['Customer Name'] : String(p.customer).trim();
  const custId = p.customerId || (cust ? cust['Customer ID'] : '');
  const pmap = getProductMap_();
  const prepared = prepareDcItems_(p.items, pmap);
  const credit = {};
  oldItems.forEach(it => { credit[it.model] = (credit[it.model] || 0) + it.qty; });
  checkStockAvailability_(prepared, buildStockMaps_(), credit);

  // 2) Phir likho: naye rows -> movements -> purani rows delete (kabhi data khoya nahi jata)
  const date = toDate_(p.date) || new Date();
  appendRows_('Delivery Challans', prepared.map(x => dcRow_(no, date, custId, custName, p, x)));

  const moves = [];
  oldItems.forEach(it => {
    const prod = pmap[it.model];
    if (prod && it.qty > 0) moves.push({type:'IN', prod:prod, qty:it.qty, party:custName, refType:'DC Edit Reversal', refNo:no});
  });
  prepared.forEach(x => moves.push({type:'OUT', prod:x.prod, qty:x.qty, party:custName, refType:'DC Edit', refNo:no}));
  postMovements_(moves, p.user || 'Staff');

  rowsToDelete.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));

  return {ok:true, id:no, message:'Delivery Challan updated successfully'};
}

/* ---------- INVOICE ---------- */


function ensureQuotationSheet_() {
  return ensureSheet('Quotations', HEADERS.Quotations);
}

function saveQuotation(p) {
  const sh = ensureQuotationSheet_();
  const no = String(p.no || '').trim() || nextSafeId_('QT-', 'Quotations', 1);
  if (numberExistsInSheet_('Quotations', no)) throw Error('Quotation number already exists: ' + no);
  const customer = String(p.customer || '').trim();
  if (!customer) throw Error('Customer is required.');
  const items = Array.isArray(p.items) ? p.items : [];
  const valid = items.filter(x => String(x.model || '').trim() && num_(x.qty) > 0);
  if (!valid.length) throw Error('At least one quotation item is required.');
  const pmap = getProductMap_();
  const rows = valid.map(x => {
    const model = String(x.model || '').trim();
    const prod = pmap[model];
    if (!prod) throw Error('Product not found: ' + model);
    if (String(prod.data[12] || 'Active').toLowerCase() === 'inactive') throw Error('Product is inactive: ' + model);
    const qty = num_(x.qty), rate = num_(x.rate);
    if (qty <= 0) throw Error('Invalid quantity for ' + model);
    if (rate < 0) throw Error('Invalid rate for ' + model);
    return [no,toDate_(p.date)||new Date(),p.customerId||'',customer,p.address||'',p.po||'',toDate_(p.poDate)||'',p.validity||'30 Days',p.stn||'',p.ntn||'',prod.data[0]||'',model,prod.data[2]||'',qty,x.unit||prod.data[5]||'Pcs',rate,round2_(qty*rate),p.user||'Staff'];
  });
  appendRows_('Quotations', rows);
  return {ok:true,id:no,subtotal:round2_(rows.reduce((a,r)=>a+Number(r[16]||0),0))};
}

function getQuotationHistory_() {
  const rows = objectsFromSheet_('Quotations');
  const map = {}, order = [];
  rows.forEach(r => {
    const no = String(r['Quotation No.'] || '').trim(); if (!no) return;
    if (!map[no]) { map[no]={no:no,date:r['Date'],customerId:r['Customer ID']||'',customer:r['Customer Name']||'',address:r['Address']||'',po:r['PO #']||'',poDate:r['PO Date']||'',validity:r['Validity']||'30 Days',stn:r['STN']||'',ntn:r['NTN']||'',createdBy:r['Created By']||'',items:[],subtotal:0}; order.push(no); }
    const qty=num_(r['Quantity']), rate=num_(r['Rate / Unit']);
    map[no].items.push({model:r['Model / Part No.']||'',desc:r['Description']||'',qty:qty,unit:r['Unit']||'Pcs',rate:rate});
    map[no].subtotal += num_(r['Amount']) || round2_(qty*rate);
  });
  return {ok:true,documents:order.reverse().map(no=>map[no])};
}

function saveInvoice(p) {
  ensureInvoiceGstColumn_();
  const dcNo = String(p.dc || '').trim();

  let dcDoc = null;
  if (dcNo) {
    dcDoc = buildDCDocuments_().find(d => d.no === dcNo);
    if (!dcDoc) throw Error('Delivery Challan not found: ' + dcNo);
  }

  const cust = resolveCustomer_(p.customer, {allowInactive: !!dcNo});
  const custName = cust ? cust['Customer Name'] : String(p.customer).trim();
  const custId = p.customerId || (cust ? cust['Customer ID'] : '');

  const id = String(p.no || '').trim() || nextSafeId_('INV-', 'Invoices', 1);
  if (p.no && numberExistsInSheet_('Invoices', id)) throw Error('Invoice ' + id + ' already exists.');

  if (dcNo) {
    const existingForDc = objectsFromSheet_('Invoices').some(r => String(r['DC No.'] || '').trim() === dcNo);
    if (existingForDc) throw Error('An invoice already exists for DC ' + dcNo + '.');
    if (dcDoc.customer && normName_(dcDoc.customer) !== normName_(custName)) {
      throw Error('DC ' + dcNo + ' ' + dcDoc.customer + ' ke naam hai, ' + custName + ' ke nahi.');
    }
  }

  const raw = Array.isArray(p.items) ? p.items : [];
  if (!raw.length) throw Error('Invoice has no items.');

  const pmap = getProductMap_();
  const items = raw.map(it => {
    const model = String(it.model || '').trim();
    const prod = pmap[model];
    if (!prod) throw Error('Product not found: ' + model);
    if (!dcNo && String(prod.data[12] || 'Active').toLowerCase() === 'inactive') throw Error('Product is inactive: ' + model);
    const qty = num_(it.qty), rate = num_(it.rate);
    if (!(qty > 0)) throw Error('Invalid quantity for ' + model);
    if (rate < 0) throw Error('Rate negative nahi ho sakta: ' + model);
    return {it:it, prod:prod, model:model, qty:qty, rate:rate};
  });

  if (dcDoc && STRICT_INVOICE_VS_DC) {
    const dcQty = {}, invQty = {};
    dcDoc.items.forEach(x => { const m = String(x.model).trim(); dcQty[m] = (dcQty[m] || 0) + Number(x.qty || 0); });
    items.forEach(x => { invQty[x.model] = (invQty[x.model] || 0) + x.qty; });
    Object.keys(invQty).forEach(m => {
      if (dcQty[m] === undefined) throw Error(m + ' DC ' + dcNo + ' mein nahi hai.');
      if (invQty[m] > dcQty[m] + 1e-9) throw Error(m + ': invoice qty (' + invQty[m] + ') DC qty (' + dcQty[m] + ') se zyada hai.');
    });
  }

  let gst = 18;
  if (!isBlank_(p.gstPercent)) {
    gst = Number(p.gstPercent);
    if (isNaN(gst) || gst < 0 || gst > 100) throw Error('GST % 0 se 100 ke beech hona chahiye.');
  }

  const date = toDate_(p.date) || new Date();
  const dcDate = toDate_(p.dcDate) || (dcDoc ? toDate_(dcDoc.date) : '');
  const poDate = toDate_(p.poDate);

  let subtotal = 0;
  const rows = items.map(x => {
    const amount = round2_(x.qty * x.rate);
    subtotal += amount;
    return [
      id, date, custId, custName,
      p.po || '', poDate, dcNo, dcDate, p.stn || '', p.ntn || '',
      x.prod.data[0], x.model, x.it.desc || x.prod.data[2], x.qty, x.rate, amount,
      p.user || 'Staff', gst
    ];
  });
  appendRows_('Invoices', rows);

  subtotal = round2_(subtotal);
  return {ok:true, id:id, subtotal:subtotal, gstPercent:gst, total:round2_(subtotal * (1 + gst / 100)), message:'Invoice saved successfully'};
}

/* ---------- LOGIN / USERS ---------- */

function readUsersSheet_(ensureModules) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  if (!sh) return null;
  if (ensureModules) ensureModulesColumn_();
  const cols = getUserCols_(sh);
  return {sh:sh, cols:cols, values:sh.getDataRange().getValues()};
}

function rowToUser_(r, cols) {
  return {
    id: cols.id !== -1 ? r[cols.id] : '',
    name: cols.name !== -1 ? r[cols.name] : (cols.username !== -1 ? r[cols.username] : ''),
    username: cols.username !== -1 ? String(r[cols.username] || '').trim() : '',
    role: cols.role !== -1 ? String(r[cols.role] || 'STAFF').toUpperCase() : 'STAFF',
    status: cols.status !== -1 ? String(r[cols.status] || 'Active') : 'Active',
    modules: cols.modules !== -1 ? normalizeModules_(r[cols.modules]) : []
  };
}

function findUserRow_(username) {
  const ctx = readUsersSheet_(false);
  if (!ctx || ctx.cols.username === -1) return null;
  const target = String(username || '').trim().toLowerCase();
  if (!target) return null;
  for (let i = 1; i < ctx.values.length; i++) {
    if (String(ctx.values[i][ctx.cols.username] || '').trim().toLowerCase() === target) {
      return {ctx:ctx, index:i, row:ctx.values[i]};
    }
  }
  return null;
}

function userCacheKey_(u) { return 'SFS_U_' + String(u || '').trim().toLowerCase(); }
function invalidateUserCache_(u) { try { CacheService.getScriptCache().remove(userCacheKey_(u)); } catch (ignore) {} }

/* Har request par user ki current role / status / modules (45 second cache; badlav par cache foran saaf) */
function getLiveUser_(username) {
  const cache = CacheService.getScriptCache();
  const key = userCacheKey_(username);
  const hit = cache.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (ignore) {} }
  const rec = findUserRow_(username);
  if (!rec) return null;
  const user = rowToUser_(rec.row, rec.ctx.cols);
  cache.put(key, JSON.stringify(user), 45);
  return user;
}

function loginUser(p) {
  const ctx = readUsersSheet_(true);
  if (!ctx) return {ok:false, error:'Users & Roles sheet not found.'};
  const cols = ctx.cols;
  if (cols.username === -1 || cols.password === -1) return {ok:false, error:'Users sheet missing Username or Password column.'};

  const username = String(p.username || '').trim();
  const password = String(p.password || '');
  if (!username) return {ok:false, error:'Username is required.'};

  const cache = CacheService.getScriptCache();
  const lockKey = 'SFS_LOGIN_' + username.toLowerCase();
  let attempts = 0, lastAttempt = 0;
  const lockRaw = cache.get(lockKey);
  if (lockRaw) {
    try { const l = JSON.parse(lockRaw); attempts = l.attempts || 0; lastAttempt = l.lastAttempt || 0; } catch (ignore) {}
  }
  if (attempts >= LOGIN_LOCK_LIMIT) {
    const waitMin = Math.max(1, Math.ceil((LOGIN_LOCK_SECONDS * 1000 - (Date.now() - lastAttempt)) / 60000));
    return {ok:false, error:'Too many failed attempts. Try again in ' + waitMin + ' minute(s).'};
  }

  const rows = ctx.values;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rowUsername = String(r[cols.username] || '').trim();
    const rowStatus = cols.status !== -1 ? String(r[cols.status] || 'Active') : 'Active';

    if (rowUsername.toLowerCase() === username.toLowerCase() && verifyPassword_(password, r[cols.password]) && rowStatus.toLowerCase() !== 'inactive') {
      cache.remove(lockKey);

      if (isLegacyPassword_(r[cols.password])) {
        ctx.sh.getRange(i + 1, cols.password + 1).setValue(hashPassword_(password));
      }

      cleanupSessionsThrottled_();

      const session = Utilities.getUuid();
      PropertiesService.getScriptProperties().setProperty(
        'SFS_SESSION_' + session,
        JSON.stringify({username:rowUsername, created:Date.now()})
      );
      const user = rowToUser_(r, cols);
      invalidateUserCache_(rowUsername);
      return {ok:true, session:session, user:user};
    }
  }

  cache.put(lockKey, JSON.stringify({attempts:attempts + 1, lastAttempt:Date.now()}), LOGIN_LOCK_SECONDS);
  return {ok:false, error:'Invalid username or password'};
}

function requireSession_(p) {
  const unauthorized = {ok:false, error:'Unauthorized'};
  const token = String(p.session || '').trim();
  if (!token) return unauthorized;

  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('SFS_SESSION_' + token);
  if (!raw) return unauthorized;

  let s;
  try { s = JSON.parse(raw); } catch (e) { return unauthorized; }
  if (!s || !s.username || !s.created || (Date.now() - Number(s.created)) > SESSION_TTL_MS) {
    props.deleteProperty('SFS_SESSION_' + token);
    return unauthorized;
  }

  const user = getLiveUser_(s.username);
  if (!user || String(user.status || 'Active').toLowerCase() === 'inactive') {
    props.deleteProperty('SFS_SESSION_' + token);
    return unauthorized;
  }
  return {ok:true, user:user, token:token};
}

function logoutUser_(p) {
  const token = String(p.session || '').trim();
  if (token) PropertiesService.getScriptProperties().deleteProperty('SFS_SESSION_' + token);
  return {ok:true};
}

/* Expired sessions + purane login-lock keys ki safai (ghante mein ek dafa login par; manual bhi chala sakte hain) */
function cleanupSessions() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  let removed = 0;
  Object.keys(all).forEach(k => {
    if (k.indexOf('SFS_LOGIN_LOCK_') === 0) { props.deleteProperty(k); removed++; return; }
    if (k.indexOf('SFS_SESSION_') !== 0) return;
    try {
      const s = JSON.parse(all[k]);
      if (!s.created || Date.now() - Number(s.created) > SESSION_TTL_MS) { props.deleteProperty(k); removed++; }
    } catch (e) { props.deleteProperty(k); removed++; }
  });
  return removed;
}

function cleanupSessionsThrottled_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const last = Number(props.getProperty('SFS_LAST_CLEANUP') || 0);
    if (Date.now() - last < 60 * 60 * 1000) return;
    props.setProperty('SFS_LAST_CLEANUP', String(Date.now()));
    cleanupSessions();
  } catch (ignore) {}
}

function revokeUserSessions_(username, exceptToken) {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const target = String(username || '').trim().toLowerCase();
  Object.keys(all).forEach(k => {
    if (k.indexOf('SFS_SESSION_') !== 0) return;
    if (exceptToken && k === 'SFS_SESSION_' + exceptToken) return;
    try {
      const s = JSON.parse(all[k]);
      if (String(s.username || '').trim().toLowerCase() === target) props.deleteProperty(k);
    } catch (ignore) {}
  });
}

function bootstrap_(p) {
  const auth = requireSession_(p);
  if (!auth.ok) return auth;
  const user = auth.user;

  ensureReorderLevelColumn_();
  ensureInvoiceGstColumn_();
  ensureModulesColumn_();

  const can = m => hasModule_(user, m);
  // Sales ko products + customers chahiye (DC / Invoice), Inward ko suppliers, Accounts ko customers/suppliers
  const seeProducts  = can('products') || can('sales') || can('reports');
  const seeCustomers = can('parties') || can('sales') || can('accounts');
  const seeSuppliers = can('parties') || can('accounts') || can('products');
  const seeMovements = can('products') || can('reports');

  const products = seeProducts ? objectsFromSheet_('Products') : [];
  const customers = seeCustomers ? objectsFromSheet_('Customers') : [];
  const suppliers = seeSuppliers ? objectsFromSheet_('Suppliers') : [];
  const movements = seeMovements ? getMovementObjectsForFrontend_().slice(-300) : [];

  if (products.length) {
    const maps = buildStockMaps_();
    const mask = hideCost_(user);
    products.forEach(prod => {
      const model = String(prod['Model / Part No.'] || '').trim();
      const stockQty = maps.stock(model);
      prod['Current Stock'] = stockQty;
      prod.currentStock = stockQty;
      if (mask) prod['Cost Price'] = '';
    });
  }

  return {
    ok:true,
    user:{
      id:user.id, name:user.name, username:user.username,
      role:String(user.role || 'STAFF').toUpperCase(),
      status:user.status || 'Active',
      modules:normalizeModules_(user.modules)
    },
    products:products,
    customers:customers,
    suppliers:suppliers,
    transactions:movements
  };
}

function objectsFromSheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).map(row => {
    const o = {};
    headers.forEach((h, i) => o[h] = row[i]);
    return o;
  });
}

function getMovementObjectsForFrontend_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Stock Movement');
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  return values.slice(1).map(r => {
    const qty = Number(r[5] || 0) || 0;
    return {
      'Date': r[1] || '',
      'Type': r[2] || '',
      'Model / Part No.': r[4] || '',
      'Qty IN': qty > 0 ? qty : 0,
      'Qty OUT': qty < 0 ? Math.abs(qty) : 0,
      'Party': r[6] || '',
      'Reference': [r[7], r[8]].filter(Boolean).join(' '),
      'Created By': r[9] || ''
    };
  });
}

function saveCustomer_(p, user) {
  const name = String(p.name || '').trim();
  if (!name) throw Error('Customer name is required.');
  if (objectsFromSheet_('Customers').some(c => normName_(c['Customer Name']) === normName_(name))) {
    throw Error('Customer already exists: ' + name);
  }
  const id = nextSafeId_('CUST-', 'Customers', 1);
  appendRows_('Customers', [[
    id, name,
    String(p.contact || p.contactPerson || '').trim(),
    String(p.phone || '').trim(), String(p.email || '').trim(),
    String(p.address || '').trim(), String(p.ntn || '').trim(),
    String(p.remarks || '').trim(), 'Active'
  ]]);
  return {ok:true, id:id};
}

function saveSupplier_(p, user) {
  const name = String(p.name || '').trim();
  if (!name) throw Error('Supplier name is required.');
  if (objectsFromSheet_('Suppliers').some(s => normName_(s['Supplier Name']) === normName_(name))) {
    throw Error('Supplier already exists: ' + name);
  }
  const id = nextSafeId_('SUP-', 'Suppliers', 1);
  appendRows_('Suppliers', [[
    id, name,
    String(p.contact || p.contactPerson || '').trim(),
    String(p.phone || '').trim(), String(p.email || '').trim(),
    String(p.address || '').trim(), String(p.ntn || '').trim(),
    String(p.remarks || '').trim(), 'Active'
  ]]);
  return {ok:true, id:id};
}

/* Ye stock (qty) ka movement hai; paisay ka ledger frontend Outstanding + Payments se banata hai */
function getLedgerForFrontend_(p) {
  const party = String(p.name || p.party || '').trim();
  const type = String(p.type || p.partyType || '').trim();
  const rows = getMovementObjectsForFrontend_().filter(x => normName_(x.Party) === normName_(party));
  return {
    ok:true, party:party, partyType:type,
    transactions: rows.map(x => ({
      date:x.Date, type:x.Type, ref:x.Reference,
      debit:x['Qty OUT'] || 0, credit:x['Qty IN'] || 0, remarks:''
    }))
  };
}

function getReportsForFrontend_(p) {
  const mode = String(p.mode || '').trim();
  if (mode === 'docs') return getDocumentHistory_(p);
  if (mode === 'document') return getDocument_(p);
  if (mode === 'price') return getPriceForModel_(p);

  const year = Number(p.year) || new Date().getFullYear();
  const invoices = objectsFromSheet_('Invoices');
  const products = objectsFromSheet_('Products');

  const sales = invoices.filter(x => yearOf_(x.Date) === year).map(x => ({
    date:x.Date,
    invoice:x['Invoice No.'] || x['Invoice No'] || '',
    customer:x['Customer Name'] || x.Customer || '',
    total:Number(x.Amount || 0) || 0
  }));

  // DC ki net units (DC edit ke reversal minus ho jate hain)
  const catByModel = {};
  products.forEach(pr => { catByModel[String(pr['Model / Part No.'] || '').trim()] = String(pr.Category || 'Others'); });
  const DC_REFS = {'DC':1, 'DC Edit':1, 'DC Edit Reversal':1, 'DC Edit Reversal Undo':1};
  const categorySales = {};
  getMovementRows_().forEach(r => {
    if (!DC_REFS[String(r[7] || '').trim()]) return;
    if (yearOf_(r[1]) !== year) return;
    const cat = catByModel[String(r[4] || '').trim()] || 'Others';
    categorySales[cat] = (categorySales[cat] || 0) - Number(r[5] || 0);
  });

  const movements = getMovementObjectsForFrontend_().filter(x => yearOf_(x.Date) === year).slice(-300);
  return {ok:true, sales:sales, categorySales:categorySales, movements:movements};
}

/* ---------- PAYMENTS ---------- */

function getPaymentsForInvoice_(invoiceNo) {
  const no = String(invoiceNo || '').trim();
  return objectsFromSheet_('Payments').filter(r => String(r['Invoice No.'] || '').trim() === no);
}

function invoiceTotal_(inv) {
  return round2_(Number(inv.subtotal || 0) * (1 + gstOf_(inv.gstPercent) / 100));
}

function savePayment(p) {
  const invoiceNo = String(p.invoiceNo || '').trim();
  const amount = num_(p.amount);
  if (!invoiceNo) throw Error('Invoice number is required.');
  if (amount <= 0) throw Error('Payment amount must be greater than zero.');

  const inv = buildInvoiceDocuments_().find(d => d.no === invoiceNo);
  if (!inv) throw Error('Invoice not found: ' + invoiceNo);

  const total = invoiceTotal_(inv);
  const alreadyPaid = getPaymentsForInvoice_(invoiceNo).reduce((a, x) => a + Number(x.Amount || 0), 0);
  const outstandingBefore = total - alreadyPaid;

  if (amount > outstandingBefore + 0.5) throw Error('Payment exceeds outstanding balance for ' + invoiceNo + '.');

  const id = nextSafeId_('PMT-', 'Payments', 1);
  appendRows_('Payments', [[
    id, toDate_(p.date) || new Date(), inv.customerId || '', inv.customer || '',
    invoiceNo, amount, p.method || '', p.reference || '', p.remarks || '',
    p.user || 'Staff'
  ]]);
  return {ok:true, id:id, outstanding:Math.max(0, round2_(outstandingBefore - amount))};
}

function getOutstandingForFrontend_(p) {
  const invoices = buildInvoiceDocuments_();
  const paidByInvoice = {};
  objectsFromSheet_('Payments').forEach(pmt => {
    const no = String(pmt['Invoice No.'] || '').trim();
    paidByInvoice[no] = (paidByInvoice[no] || 0) + Number(pmt.Amount || 0);
  });

  let rows = invoices.map(inv => {
    const total = invoiceTotal_(inv);
    const paid = paidByInvoice[inv.no] || 0;
    return {
      no:inv.no, date:inv.date, customer:inv.customer, customerId:inv.customerId,
      total:total, paid:paid, outstanding:Math.max(0, round2_(total - paid))
    };
  });

  if (p && p.customer) {
    const c = normName_(p.customer);
    rows = rows.filter(r => normName_(r.customer) === c);
  }
  if (!p || !p.includeSettled) rows = rows.filter(r => r.outstanding > 0.5);
  return {ok:true, rows:rows};
}

function getPaymentHistory_(p) {
  let rows = objectsFromSheet_('Payments');
  if (p && p.customer) {
    const c = normName_(p.customer);
    rows = rows.filter(r => normName_(r['Customer Name']) === c);
  }
  if (p && p.invoiceNo) {
    const no = String(p.invoiceNo).trim();
    rows = rows.filter(r => String(r['Invoice No.'] || '').trim() === no);
  }
  return {ok:true, payments:rows.reverse()};
}

function saveSupplierPayment(p) {
  const supplierName = String(p.supplier || '').trim();
  const amount = num_(p.amount);
  if (!supplierName) throw Error('Supplier is required.');
  if (amount <= 0) throw Error('Payment amount must be greater than zero.');

  const outstandingRows = getSupplierOutstandingForFrontend_({supplier:supplierName, includeSettled:true}).rows;
  const current = outstandingRows.find(r => r.supplier.toLowerCase() === supplierName.toLowerCase());
  const outstandingBefore = current ? current.outstanding : 0;

  if (amount > outstandingBefore + 0.5) throw Error('Payment exceeds outstanding for ' + supplierName + '.');

  const supplier = objectsFromSheet_('Suppliers').find(s => normName_(s['Supplier Name']) === normName_(supplierName));

  const id = nextSafeId_('SPMT-', 'Supplier Payments', 1);
  appendRows_('Supplier Payments', [[
    id, toDate_(p.date) || new Date(),
    supplier ? supplier['Supplier ID'] : '', supplierName,
    amount, p.method || '', p.reference || '', p.remarks || '', p.user || 'Staff'
  ]]);
  return {ok:true, id:id, outstanding:Math.max(0, round2_(outstandingBefore - amount))};
}

function getSupplierOutstandingForFrontend_(p) {
  const inwardRows = objectsFromSheet_('Inward');
  const payments = objectsFromSheet_('Supplier Payments');
  const suppliersList = objectsFromSheet_('Suppliers');

  function canonicalName_(raw) {
    const norm = normName_(raw);
    const match = suppliersList.find(s => normName_(s['Supplier Name']) === norm);
    return match ? match['Supplier Name'] : String(raw || '').trim();
  }

  const purchasedBySupplier = {}, paidBySupplier = {}, displayName = {};

  inwardRows.forEach(r => {
    const raw = String(r.Supplier || '').trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    purchasedBySupplier[key] = (purchasedBySupplier[key] || 0) + Number(r['Purchase Cost'] || 0);
    if (!displayName[key]) displayName[key] = canonicalName_(raw);
  });

  payments.forEach(r => {
    const raw = String(r['Supplier Name'] || '').trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    paidBySupplier[key] = (paidBySupplier[key] || 0) + Number(r.Amount || 0);
    if (!displayName[key]) displayName[key] = canonicalName_(raw);
  });

  const keys = new Set([...Object.keys(purchasedBySupplier), ...Object.keys(paidBySupplier)]);
  let rows = Array.from(keys).map(key => {
    const purchased = purchasedBySupplier[key] || 0;
    const paid = paidBySupplier[key] || 0;
    return {supplier:displayName[key] || key, purchased:purchased, paid:paid, outstanding:Math.max(0, round2_(purchased - paid))};
  });

  if (p && p.supplier) {
    const s = String(p.supplier).trim().toLowerCase();
    rows = rows.filter(r => r.supplier.toLowerCase() === s);
  }
  if (!p || !p.includeSettled) rows = rows.filter(r => r.outstanding > 0.5);
  return {ok:true, rows:rows};
}

function getSupplierPaymentHistory_(p) {
  let rows = objectsFromSheet_('Supplier Payments');
  if (p && p.supplier) {
    const s = normName_(p.supplier);
    rows = rows.filter(r => normName_(r['Supplier Name']) === s);
  }
  return {ok:true, payments:rows.reverse()};
}

/* ---------- TARGETS / SUMMARY ---------- */

function getTargetForYear_(year) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Targets');
  if (!sh || sh.getLastRow() < 2) return 0;
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(year).trim()) return Number(rows[i][1] || 0);
  }
  return 0;
}

function getSalesSummaryForFrontend_(p) {
  const year = String(p.year || new Date().getFullYear());
  const invoiceDocs = buildInvoiceDocuments_();
  const byCustomer = {};
  let totalSales = 0;

  invoiceDocs.forEach(inv => {
    const y = yearOf_(inv.date);
    if (y === null || String(y) !== year) return;
    const grand = invoiceTotal_(inv);
    const cust = String(inv.customer || '').trim();
    if (cust) byCustomer[cust] = (byCustomer[cust] || 0) + grand;
    totalSales += grand;
  });

  const customerSales = Object.keys(byCustomer)
    .map(c => ({customer:c, amount:byCustomer[c]}))
    .sort((a, b) => b.amount - a.amount);

  const target = getTargetForYear_(year);
  return {
    ok:true, year:year, totalSales:totalSales, target:target,
    remaining:Math.max(0, target - totalSales),
    customerSales:customerSales
  };
}

function saveTarget(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return {ok:false, error:'Only an Admin can set sales targets.'};
  }
  const year = String(p.year || new Date().getFullYear()).trim();
  if (!/^\d{4}$/.test(year)) throw Error('Year 4 digit hona chahiye.');
  const amount = num_(p.amount);
  if (amount < 0) throw Error('Target negative nahi ho sakta.');
  const sh = SpreadsheetApp.getActive().getSheetByName('Targets');
  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === year) {
      sh.getRange(i + 1, 2).setValue(amount);
      return {ok:true};
    }
  }
  sh.appendRow([year, amount]);
  return {ok:true};
}

/* ---------- DOCUMENT HISTORY ---------- */

function buildDCDocuments_() {
  const rows = objectsFromSheet_('Delivery Challans');
  const byNo = {};
  const order = [];

  rows.forEach(r => {
    const no = String(r['DC No.'] || '').trim();
    if (!no) return;
    if (!byNo[no]) {
      byNo[no] = {
        no:no, date:r['Date'], customerId:r['Customer ID'] || '',
        customer:r['Customer Name'] || '', address:r['Delivery Address'] || '',
        po:r['PO #'] || '', poDate:r['PO Date'] || '',
        stn:r['STN'] || '', ntn:r['NTN'] || '',
        createdBy:r['Created By'] || '', items:[]
      };
      order.push(no);
    }
    byNo[no].items.push({
      model:r['Model / Part No.'] || '', desc:r['Description'] || '',
      qty:Number(r['Quantity'] || 0), unit:r['Unit'] || ''
    });
  });
  return order.map(no => byNo[no]).reverse();
}

function buildInvoiceDocuments_() {
  const rows = objectsFromSheet_('Invoices');
  const byNo = {};
  const order = [];

  rows.forEach(r => {
    const no = String(r['Invoice No.'] || '').trim();
    if (!no) return;
    if (!byNo[no]) {
      byNo[no] = {
        no:no, date:r['Date'], customerId:r['Customer ID'] || '',
        customer:r['Customer Name'] || '', po:r['PO #'] || '', poDate:r['PO Date'] || '',
        dc:r['DC No.'] || '', dcDate:r['DC Date'] || '',
        stn:r['STN'] || '', ntn:r['NTN'] || '',
        createdBy:r['Created By'] || '',
        gstPercent:gstOf_(r['GST %']),
        items:[], subtotal:0
      };
      order.push(no);
    }
    const qty = Number(r['Quantity'] || 0);
    const rate = Number(r['Rate / Unit'] || 0);
    byNo[no].items.push({
      model:r['Model / Part No.'] || '', desc:r['Description'] || '',
      qty:qty, rate:rate
    });
    byNo[no].subtotal += Number(r['Amount'] || (qty * rate)) || 0;
  });
  return order.map(no => byNo[no]).reverse();
}

function getDocumentHistory_(p) {
  const type = String(p.type || '').toUpperCase();
  if (type === 'DC') return {ok:true, documents:buildDCDocuments_()};
  if (type === 'INVOICE') return {ok:true, documents:buildInvoiceDocuments_()};
  return {ok:false, error:'Unknown document type: ' + type};
}

function getDocument_(p) {
  const type = String(p.type || '').toUpperCase();
  const no = String(p.no || '').trim();
  const docs = type === 'DC' ? buildDCDocuments_() : type === 'INVOICE' ? buildInvoiceDocuments_() : [];
  const doc = docs.find(d => d.no === no);
  if (!doc) return {ok:false, error:'Document not found: ' + no};
  return {ok:true, document:doc};
}

function getPriceForModel_(p) {
  const prod = findProduct(p.model);
  if (!prod) return {ok:true, matched:false};
  const rate = Number(prod.data[8] || 0);
  return {ok:true, matched:rate > 0, rate:rate};
}

/* ---------- USERS ---------- */

function countActiveAdmins_(ctx, exceptUsername) {
  const cols = ctx.cols;
  const skip = String(exceptUsername || '').trim().toLowerCase();
  let n = 0;
  for (let i = 1; i < ctx.values.length; i++) {
    const u = String(ctx.values[i][cols.username] || '').trim().toLowerCase();
    if (!u || u === skip) continue;
    const role = cols.role !== -1 ? String(ctx.values[i][cols.role] || '').toUpperCase() : '';
    const status = cols.status !== -1 ? String(ctx.values[i][cols.status] || 'Active').toLowerCase() : 'active';
    if (role === 'ADMIN' && status !== 'inactive') n++;
  }
  return n;
}

function listUsers_(authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') return {ok:false, error:'Unauthorized'};
  const ctx = readUsersSheet_(true);
  if (!ctx) return {ok:false, error:'Users & Roles sheet not found.'};
  const cols = ctx.cols;
  return {
    ok:true,
    users: ctx.values.slice(1).filter(r => String(r[cols.username] || '').trim()).map(r => ({
      'User ID': cols.id !== -1 ? r[cols.id] : '',
      'Name': cols.name !== -1 ? r[cols.name] : '',
      'Username': cols.username !== -1 ? r[cols.username] : '',
      'Role': cols.role !== -1 ? r[cols.role] : '',
      'Status': cols.status !== -1 ? (r[cols.status] || 'Active') : 'Active',
      'Modules': cols.modules !== -1 ? normalizeModules_(r[cols.modules]) : []
    }))
  };
}

/* ---------- PASSWORD HASHING ---------- */

function generateSalt_() { return Utilities.getUuid().replace(/-/g, ''); }

function sha256Hex_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(b => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0')).join('');
}

function hashPassword_(password) {
  const salt = generateSalt_();
  return salt + '$' + sha256Hex_(salt + password);
}

function verifyPassword_(password, stored) {
  const s = String(stored || '');
  if (!s) return false;
  const sep = s.indexOf('$');
  if (sep === -1) return s === password;
  const salt = s.slice(0, sep);
  const hash = s.slice(sep + 1);
  return sha256Hex_(salt + password) === hash;
}

function isLegacyPassword_(stored) { return String(stored || '').indexOf('$') === -1; }

function cleanModulesInput_(raw) {
  return normalizeModules_(Array.isArray(raw) ? raw : String(raw || '')).join(',');
}

function saveUser_(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') return {ok:false, error:'Unauthorized'};
  const ctx = readUsersSheet_(true);
  if (!ctx) return {ok:false, error:'Users & Roles sheet not found.'};
  const cols = ctx.cols;
  const username = String(p.username || '').trim();

  if (!username) return {ok:false, error:'Username is required'};
  if (username.length < 3 || /\s/.test(username)) return {ok:false, error:'Username kam az kam 3 characters ka ho aur usmein space na ho.'};
  if (cols.username === -1) return {ok:false, error:'Users sheet has no Username column.'};

  const password = String(p.password || '');
  if (password.length < MIN_PASSWORD_LENGTH) return {ok:false, error:'Password kam az kam ' + MIN_PASSWORD_LENGTH + ' characters ka ho.'};

  const exists = ctx.values.slice(1).some(r => String(r[cols.username] || '').trim().toLowerCase() === username.toLowerCase());
  if (exists) return {ok:false, error:'Username already exists'};

  const role = String(p.role || 'STAFF').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF';

  const row = new Array(cols.total).fill('');
  if (cols.id !== -1) row[cols.id] = nextSafeId_('USR-', 'Users & Roles', cols.id + 1);
  if (cols.name !== -1) row[cols.name] = String(p.name || '').trim();
  row[cols.username] = username;
  if (cols.role !== -1) row[cols.role] = role;
  if (cols.password !== -1) row[cols.password] = hashPassword_(password);
  if (cols.status !== -1) row[cols.status] = 'Active';
  if (cols.modules !== -1) row[cols.modules] = cleanModulesInput_(p.modules);

  ctx.sh.appendRow(row);
  return {ok:true};
}

function updateUser_(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') return {ok:false, error:'Unauthorized'};
  const username = String(p.username || '').trim();
  if (!username) return {ok:false, error:'Username is required'};

  const ctx = readUsersSheet_(true);
  if (!ctx) return {ok:false, error:'Users & Roles sheet not found.'};
  const cols = ctx.cols;
  const isSelf = username.toLowerCase() === String(authUser.username || '').trim().toLowerCase();

  if (p.password && String(p.password).length < MIN_PASSWORD_LENGTH) {
    return {ok:false, error:'Password kam az kam ' + MIN_PASSWORD_LENGTH + ' characters ka ho.'};
  }

  for (let i = 1; i < ctx.values.length; i++) {
    if (String(ctx.values[i][cols.username] || '').trim().toLowerCase() === username.toLowerCase()) {
      const curRole = cols.role !== -1 ? String(ctx.values[i][cols.role] || '').toUpperCase() : 'STAFF';
      const newRole = p.role ? (String(p.role).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAFF') : curRole;

      if (curRole === 'ADMIN' && newRole !== 'ADMIN') {
        if (isSelf) return {ok:false, error:'Aap apna khud ka ADMIN role change nahi kar sakte.'};
        if (countActiveAdmins_(ctx, username) < 1) return {ok:false, error:'Kam az kam ek active ADMIN rehna zaroori hai.'};
      }

      if (cols.name !== -1 && p.name !== undefined) ctx.sh.getRange(i + 1, cols.name + 1).setValue(String(p.name || '').trim());
      if (cols.role !== -1 && p.role) ctx.sh.getRange(i + 1, cols.role + 1).setValue(newRole);
      if (cols.modules !== -1) ctx.sh.getRange(i + 1, cols.modules + 1).setValue(cleanModulesInput_(p.modules));
      if (cols.password !== -1 && p.password) {
        ctx.sh.getRange(i + 1, cols.password + 1).setValue(hashPassword_(String(p.password)));
        revokeUserSessions_(username, isSelf ? p.session : null);
      }
      invalidateUserCache_(username);
      return {ok:true};
    }
  }
  return {ok:false, error:'User not found'};
}

function disableUser_(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') return {ok:false, error:'Unauthorized'};
  const username = String(p.username || '').trim();
  if (!username) return {ok:false, error:'Username is required'};
  const status = validStatus_(p.status || 'Inactive');

  const ctx = readUsersSheet_(true);
  if (!ctx) return {ok:false, error:'Users & Roles sheet not found.'};
  const cols = ctx.cols;
  if (cols.username === -1) return {ok:false, error:'No Username column.'};
  if (cols.status === -1) return {ok:false, error:'No Status column.'};

  const isSelf = username.toLowerCase() === String(authUser.username || '').trim().toLowerCase();

  for (let i = 1; i < ctx.values.length; i++) {
    if (String(ctx.values[i][cols.username] || '').trim().toLowerCase() === username.toLowerCase()) {
      if (status === 'Inactive') {
        if (isSelf) return {ok:false, error:'Aap apna khud ka account disable nahi kar sakte.'};
        const role = cols.role !== -1 ? String(ctx.values[i][cols.role] || '').toUpperCase() : '';
        if (role === 'ADMIN' && countActiveAdmins_(ctx, username) < 1) {
          return {ok:false, error:'Kam az kam ek active ADMIN rehna zaroori hai.'};
        }
      }
      ctx.sh.getRange(i + 1, cols.status + 1).setValue(status);
      invalidateUserCache_(username);
      if (status === 'Inactive') revokeUserSessions_(username, null);
      return {ok:true};
    }
  }
  return {ok:false, error:'User not found'};
}

function changePassword_(p, authUser) {
  const current = String(p.currentPassword || '');
  const next = String(p.newPassword || '');
  if (!next || next.length < MIN_PASSWORD_LENGTH) return {ok:false, error:'New password must be at least ' + MIN_PASSWORD_LENGTH + ' characters.'};

  const ctx = readUsersSheet_(false);
  if (!ctx) return {ok:false, error:'Users & Roles sheet not found.'};
  const cols = ctx.cols;
  if (cols.username === -1 || cols.password === -1) return {ok:false, error:'Missing columns.'};

  for (let i = 1; i < ctx.values.length; i++) {
    if (String(ctx.values[i][cols.username] || '').trim().toLowerCase() === String(authUser.username || '').trim().toLowerCase()) {
      if (!verifyPassword_(current, ctx.values[i][cols.password])) return {ok:false, error:'Current password is incorrect.'};
      ctx.sh.getRange(i + 1, cols.password + 1).setValue(hashPassword_(next));
      revokeUserSessions_(authUser.username, String(p.session || '').trim());   // doosre devices ki sessions khatam
      return {ok:true};
    }
  }
  return {ok:false, error:'User not found'};
}

/* ---------- READ APIs ---------- */

function getProducts(user) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  const values = sh.getDataRange().getValues();
  if (hideCost_(user) && values.length) {
    const ci = values[0].map(String).indexOf('Cost Price');
    if (ci !== -1) for (let i = 1; i < values.length; i++) values[i][ci] = '';
  }
  return {ok:true, products:values};
}

function getStock(p) {
  const model = String(p.model || '').trim();
  const maps = buildStockMaps_();
  return {ok:true, model:model, sourceStock:maps.src[model] || 0, currentStock:maps.stock(model)};
}

function getStockMovement(p) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Stock Movement');
  if (!sh) return {ok:true, movements:[]};
  let rows = sh.getDataRange().getValues();
  if (p.model) {
    const target = String(p.model).trim();
    rows = [rows[0], ...rows.slice(1).filter(r => String(r[4]).trim() === target)];
  }
  return {ok:true, movements:rows};
}

function getCustomers() {
  return {ok:true, customers:SpreadsheetApp.getActive().getSheetByName('Customers').getDataRange().getValues()};
}

function getSuppliers() {
  return {ok:true, suppliers:SpreadsheetApp.getActive().getSheetByName('Suppliers').getDataRange().getValues()};
}

/* ---------- MAINTENANCE (editor se manually chalayen) ---------- */

/* Backup: is spreadsheet ki copy Drive ke "SFS Backups" folder mein (purani BACKUP_KEEP se zyada trash ho jati hain) */
function backupNow() {
  const ss = SpreadsheetApp.getActive();
  const folder = getOrCreateFolder_('SFS Backups');
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmm');
  DriveApp.getFileById(ss.getId()).makeCopy('SFS Backup ' + stamp, folder);

  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); files.push({f:f, t:f.getDateCreated().getTime()}); }
  files.sort((a, b) => b.t - a.t);
  files.slice(BACKUP_KEEP).forEach(x => x.f.setTrashed(true));
  return 'Backup done: SFS Backup ' + stamp;
}

/* Ek dafa chalayen: roz raat 2 baje automatic backup */
function setupDailyBackup() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'backupNow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupNow').timeBased().everyDays(1).atHour(2).create();
  return 'Daily backup trigger set (around 2 AM).';
}

/* Duplicate models dhoondta hai (koi change nahi karta) */
function findDuplicateProducts() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  if (!sh) return 'No Products sheet.';
  const v = sh.getDataRange().getValues();
  const seen = {}, dups = [];
  for (let i = 1; i < v.length; i++) {
    const m = String(v[i][1] || '').trim();
    if (!m) continue;
    if (seen[m]) dups.push(m + ' (rows ' + seen[m] + ' & ' + (i + 1) + ')'); else seen[m] = i + 1;
  }
  const msg = dups.length ? 'Duplicates: ' + dups.join(', ') : 'No duplicate products.';
  Logger.log(msg);
  return msg;
}

/* Sehat ki jaanch: timezone, default admin password, duplicate products, sessions */
function healthCheck() {
  const lines = [];
  lines.push('Time zone: ' + Session.getScriptTimeZone() + (Session.getScriptTimeZone() === 'Asia/Karachi' ? ' (OK)' : '  <-- Project Settings mein Asia/Karachi karein'));
  const rec = findUserRow_('admin');
  if (rec && rec.ctx.cols.password !== -1 && verifyPassword_('admin123', rec.row[rec.ctx.cols.password])) {
    lines.push('WARNING: admin ka password abhi bhi admin123 hai — foran badlein.');
  } else {
    lines.push('Admin password: default nahi hai (OK).');
  }
  lines.push(findDuplicateProducts());
  const sessions = Object.keys(PropertiesService.getScriptProperties().getProperties()).filter(k => k.indexOf('SFS_SESSION_') === 0).length;
  lines.push('Stored sessions: ' + sessions);
  const msg = lines.join('\n');
  Logger.log(msg);
  return msg;
}
