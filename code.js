/*
SFS BUSINESS MANAGEMENT - GOOGLE APPS SCRIPT BACKEND
-----------------------------------------------------
PHASE 2 COMPLETE / SAFE REPLACEMENT

IMPORTANT:
- The ORIGINAL LIVE INVENTORY is READ-ONLY.
- This Google Sheet is the writable database for the new software.
- Source Stock / Source Imports / Source Returns are copied into this database.
- Products keeps the product master and uploaded image URLs.
- Current Stock is calculated from the read-only Source Stock baseline
  plus/minus NEW software Stock Movement transactions.
- OPENING/source stock is NOT posted as a second stock transaction.
  This prevents double counting.
- Existing Customers, Suppliers and transactions are preserved when setupDatabase()
  is run again. It no longer clears the writable database.

DEPLOYMENT:
1) Paste this complete file into Apps Script as Code.gs.
2) Keep the SOURCE URLs exactly as supplied below.
3) Change API_TOKEN from the placeholder to your private token.
4) Run setupDatabase() once and authorize.
5) Deploy -> New deployment -> Web app
   Execute as: Me
   Who has access: Anyone with the link (or your preferred restricted setting)
6) Keep the same /exec URL in the frontend Settings.
*/

const API_TOKEN = 'SFS_2026_MY_SECRET_8472';

// TEMPORARY DEVELOPMENT MODE: login bypass. Now DISABLED — real sessions are enforced.
const DEV_MODE = false; // Backend-only; never put this in frontend code.

const SOURCE = {
  stock: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-L0Qdw8fesYpscH6K9sA5WIXOTMp9-ja47HrnDoVoI814-v-lMjhze3LMfDK8mDDqj_gislv0ZmE8/pub?gid=909776740&single=true&output=csv',
  imports: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-L0Qdw8fesYpscH6K9sA5WIXOTMp9-ja47HrnDoVoI814-v-lMjhze3LMfDK8mDDqj_gislv0ZmE8/pub?gid=1078577908&single=true&output=csv',
  returns: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-L0Qdw8fesYpscH6K9sA5WIXOTMp9-ja47HrnDoVoI814-v-lMjhze3LMfDK8mDDqj_gislv0ZmE8/pub?gid=169812999&single=true&output=csv'
};

const HEADERS = {
  'Products':['Product ID','Model / Part No.','Description','Category','Brand','Unit','Location','Cost Price','Sale Price','Current Stock','Product Image','Remarks','Status','Reorder Level'],
  'Inward':['Inward ID','Date','Product ID','Model / Part No.','Quantity','Source Type','Supplier','Supplier Reference','Purchase Cost','Remarks','Created By'],
  'Stock Movement':['Transaction ID','Date/Time','Type','Product ID','Model / Part No.','Quantity','Source / Destination','Reference Type','Reference No.','Created By'],
  'Delivery Challans':['DC No.','Date','Customer ID','Customer Name','Delivery Address','PO #','PO Date','STN','NTN','Product ID','Model / Part No.','Description','Quantity','Unit','Created By'],
  'Invoices':['Invoice No.','Date','Customer ID','Customer Name','PO #','PO Date','DC No.','DC Date','STN','NTN','Product ID','Model / Part No.','Description','Quantity','Rate / Unit','Amount','Created By','GST %'],
  'Customers':['Customer ID','Customer Name','Contact Person','Phone','Email','Address','NTN/Tax ID','Remarks','Status'],
  'Suppliers':['Supplier ID','Supplier Name','Contact Person','Phone','Email','Address','NTN/Tax ID','Remarks','Status'],
  'Users & Roles':['User ID','Name','Username','Role','Password','Status'],
  'Categories':['Category ID','Category Name'],
  'Payments':['Payment ID','Date','Customer ID','Customer Name','Invoice No.','Amount','Method','Reference','Remarks','Created By'],
  'Supplier Payments':['Payment ID','Date','Supplier ID','Supplier Name','Amount','Method','Reference','Remarks','Created By'],
  'Targets':['Year','Target Amount']
};

/* ---------- WEB API ---------- */

function doGet(e) {
  try {
    const p = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
    const callback = String(p.callback || '').trim();
    delete p.callback;

    let result;
    const action = String(p.action || '').trim();

    // Support packed JSON payloads used by the browser JSONP fallback.
    if (p.data) {
      try {
        const packed = JSON.parse(decodeURIComponent(p.data));
        Object.keys(packed || {}).forEach(k => { p[k] = packed[k]; });
      } catch (ignore) {}
    }

    if (action === 'login') {
      result = loginUser(p);
    } else if (action === 'bootstrap') {
      result = bootstrap_(p);
    } else if (!action) {
      result = {
        ok:true,
        service:'SFS Business Management',
        message:'API is online',
        timestamp:new Date()
      };
    } else {
      result = {ok:false,error:'Unknown action: '+action};
    }

    if (callback) {
      // JSONP callback name is restricted to safe JavaScript identifier characters.
      if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
        return out({ok:false,error:'Invalid callback'});
      }
      return ContentService
        .createTextOutput(callback+'('+JSON.stringify(result)+');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return out(result);
  } catch (err) {
    const result = {ok:false,error:String(err && err.message ? err.message : err)};
    const callback = String(e && e.parameter && e.parameter.callback || '').trim();
    if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
      return ContentService
        .createTextOutput(callback+'('+JSON.stringify(result)+');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return out(result);
  }
}

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(p.action || '').trim();

    // Login is the only public application action.
    if (action === 'login') return out(loginUser(p));

    // Everything else requires a server-side session.
    if (action === 'logout') return out(logoutUser_(p));
    if (action === 'bootstrap') return out(bootstrap_(p));

    const auth = requireSession_(p);
    if (!auth.ok) return out(auth);

    // Stock-affecting actions are serialized so two near-simultaneous
    // requests (e.g. a fast double-click, or a slow network retry) can
    // never both pass a stock check before either one has actually
    // written its update.
    const STOCK_LOCKED_ACTIONS = ['saveInward','inward','saveDC','dc','updateDC','saveInvoice','invoice','saveProduct','product','savePayment','saveSupplierPayment'];
    let lock = null;
    if (STOCK_LOCKED_ACTIONS.indexOf(action) !== -1) {
      lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000);
      } catch (lockErr) {
        return out({ok:false,error:'System is busy processing another save. Please try again in a moment.'});
      }
    }

    try {
      switch (action) {
      case 'saveProduct':
      case 'product':
        p.user = auth.user.username;
        return out(saveProduct(p));

      case 'updateProduct':
        return out(updateProduct(p));

      case 'setProductStatus':
        return out(setProductStatus_(p, auth.user));

      case 'updateCustomer':
        return out(updateCustomer(p));

      case 'setCustomerStatus':
        return out(setCustomerStatus_(p, auth.user));

      case 'updateSupplier':
        return out(updateSupplier(p));

      case 'setSupplierStatus':
        return out(setSupplierStatus_(p, auth.user));

      case 'saveInward':
      case 'inward':
        p.user = auth.user.username;
        return out(saveInward(p));

      case 'saveDC':
      case 'dc':
        p.user = auth.user.username;
        return out(saveDC(p));

      case 'updateDC':
        p.user = auth.user.username;
        return out(updateDC(p));

      case 'savePayment':
        p.user = auth.user.username;
        return out(savePayment(p));

      case 'getOutstanding':
        return out(getOutstandingForFrontend_(p));

      case 'getSalesSummary':
        return out(getSalesSummaryForFrontend_(p));

      case 'saveTarget':
        return out(saveTarget(p, auth.user));

      case 'getPaymentHistory':
        return out(getPaymentHistory_(p));

      case 'saveSupplierPayment':
        p.user = auth.user.username;
        return out(saveSupplierPayment(p));

      case 'getSupplierOutstanding':
        return out(getSupplierOutstandingForFrontend_(p));

      case 'getSupplierPaymentHistory':
        return out(getSupplierPaymentHistory_(p));

      case 'saveInvoice':
      case 'invoice':
        p.user = auth.user.username;
        return out(saveInvoice(p));

      case 'saveCustomer':
        return out(saveCustomer_(p, auth.user));

      case 'saveSupplier':
        return out(saveSupplier_(p, auth.user));

      case 'getLedger':
        return out(getLedgerForFrontend_(p));

      case 'getReports':
        return out(getReportsForFrontend_(p));

      case 'listUsers':
        return out(listUsers_(auth.user));

      case 'saveUser':
        return out(saveUser_(p, auth.user));

      case 'disableUser':
        return out(disableUser_(p, auth.user));

      case 'changePassword':
        return out(changePassword_(p, auth.user));

      case 'refreshSource':
      case 'sync':
        if (String(auth.user.role || '').toUpperCase() !== 'ADMIN') {
          return out({ok:false,error:'Only an Admin can refresh the source data snapshot.'});
        }
        syncSourceData();
        return out({ok:true, message:'Source data refreshed'});

      case 'products':
        return out(getProducts());

      case 'stock':
        return out(getStock(p));

      case 'stockMovement':
        return out(getStockMovement(p));

      case 'customers':
        return out(getCustomers());

      case 'suppliers':
        return out(getSuppliers());

      default:
        return out({ok:false,error:'Unknown action: '+action});
      }
    } finally {
      if (lock) lock.releaseLock();
    }
  } catch (err) {
    return out({ok:false,error:String(err && err.message ? err.message : err)});
  }
}
function out(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- DATABASE SETUP ---------- */

function setupDatabase() {
  const ss=SpreadsheetApp.getActive();

  Object.keys(HEADERS).forEach(name => {
    ensureSheet(name,HEADERS[name]);
  });

  ensureDefaultCategories_();
  ensureDefaultAdmin_();
  syncSourceData();

  return 'Database setup complete. Existing writable data was preserved.';
}

function ensureSheet(name,headers) {
  const ss=SpreadsheetApp.getActive();
  let sh=ss.getSheetByName(name);

  if(!sh) {
    sh=ss.insertSheet(name);
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    return sh;
  }

  if(sh.getLastRow()===0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }

  return sh;
}

function ensureDefaultCategories_() {
  const sh=SpreadsheetApp.getActive().getSheetByName('Categories');
  if(!sh) return;

  const existing=sh.getDataRange().getValues();
  const names={};

  existing.slice(1).forEach(r => {
    if(r[1]) names[String(r[1]).trim().toLowerCase()]=true;
  });

  const cats=[
    ['CAT-01','Airline Equipment'],
    ['CAT-02','Valves'],
    ['CAT-03','Cylinder'],
    ['CAT-04','Fittings/Tubing'],
    ['CAT-05','Others']
  ];

  const missing=cats.filter(r => !names[String(r[1]).toLowerCase()]);

  if(missing.length) {
    sh.getRange(sh.getLastRow()+1,1,missing.length,2).setValues(missing);
  }
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
    status: find('status')
  };
}

function ensureDefaultAdmin_() {
  const sh=SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  if(!sh) return;

  const cols = getUserCols_(sh);
  const values=sh.getDataRange().getValues();

  const hasAdmin=values.slice(1).some(r =>
    String(r[cols.username] || '').trim().toLowerCase()==='admin'
  );

  if(!hasAdmin) {
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

function parseCsv(text) {
  return Utilities.parseCsv(text);
}

function fetchSource(url) {
  const response=UrlFetchApp.fetch(url,{
    muteHttpExceptions:true,
    followRedirects:true
  });

  const status=response.getResponseCode();

  if(status < 200 || status >= 300) {
    throw Error('Source download failed. HTTP '+status);
  }

  return parseCsv(response.getContentText());
}

function syncSourceData() {
  const stock=fetchSource(SOURCE.stock);
  const imp=fetchSource(SOURCE.imports);
  const ret=fetchSource(SOURCE.returns);

  writeSource('Source Stock',stock);
  writeSource('Source Imports',imp);
  writeSource('Source Returns',ret);

  syncProductsFromSource_(stock);
}

function writeSource(name,data) {
  const ss=SpreadsheetApp.getActive();
  let sh=ss.getSheetByName(name) || ss.insertSheet(name);

  sh.clearContents();

  if(data.length && data[0].length) {
    sh.getRange(1,1,data.length,data[0].length).setValues(data);
  }

  sh.setFrozenRows(1);
}

/* ---------- PRODUCT MASTER ---------- */

function syncProductsFromSource_(stock) {
  const ss=SpreadsheetApp.getActive();
  const sh=ss.getSheetByName('Products');

  if(!sh) throw Error('Products sheet not found.');

  const existing=sh.getDataRange().getValues();
  const byModel={};

  existing.slice(1).forEach(r => {
    if(r[1]) byModel[String(r[1]).trim()]=r;
  });

  const movements=getMovementRows_();
  const rows=[];

  // Row 4 headers hain (index 3), data Row 5 se shuru hota hai (index 4)
  stock.slice(4).forEach((r,i) => {
    const model=String(r[0] || '').trim(); // Model column A (index 0)
    if(!model) return;

    const old=byModel[model] || [];

    const sourceQty=Number(String(r[6] || 0).replace(/,/g,'')) || 0; // Total Stock column G (index 6)
    const currentStock=sourceQty + movementBalanceForModel_(model,movements);

    rows.push([
      old[0] || ('P-'+String(i+1).padStart(5,'0')),
      model,
      r[2] || '', // Description column C (index 2)
      old[3] || '',
      old[4] || '',
      old[5] || 'Pcs',
      r[1] || old[6] || '', // Location column B (index 1)
      old[7] || '',
      old[8] || '',
      currentStock,
      old[10] || r[4] || '', // Image column E (index 4)
      old[11] || '',
      old[12] || 'Active',
      old[13] || 5 // Reorder Level — preserve existing, default new products to 5
    ]);
  });

  if(!rows.length) return;

  if(sh.getLastRow()>1) {
    sh.getRange(2, 1, sh.getLastRow()-1, HEADERS.Products.length).clearContent();
  }

  sh.getRange(2, 1, rows.length, HEADERS.Products.length).setValues(rows);
}

/* ---------- IDS ---------- */

function nextId(prefix,sheet,col) {
  const sh=SpreadsheetApp.getActive().getSheetByName(sheet);
  const n=Math.max(0,sh.getLastRow()-1)+1;
  return prefix+String(n).padStart(6,'0');
}

function nextSafeId_(prefix,sheet,columnIndex) {
  const sh=SpreadsheetApp.getActive().getSheetByName(sheet);
  const numRows=sh.getLastRow()-1;

  let max=0;

  if (numRows > 0) {
    const values=sh.getRange(2, columnIndex, numRows, 1).getValues();
    values.forEach(r => {
      const m=String(r[0] || '').match(new RegExp('^'+prefix+'(\\d+)$'));
      if(m) max=Math.max(max,Number(m[1]));
    });
  }

  return prefix+String(max+1).padStart(6,'0');
}

/* ---------- PRODUCTS ---------- */

function findProduct(model) {
  const sh=SpreadsheetApp.getActive().getSheetByName('Products');
  const v=sh.getDataRange().getValues();
  const target=String(model).trim();

  for(let i=1;i<v.length;i++) {
    if(String(v[i][1]).trim()===target) {
      return {row:i+1,data:v[i]};
    }
  }

  return null;
}

function ensureInvoiceGstColumn_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Invoices');
  if (!sh) return;

  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('GST %') !== -1) return; // already migrated

  const newCol = lastCol + 1;
  sh.getRange(1, newCol).setValue('GST %');

  const lastRow = sh.getLastRow();
  if (lastRow > 1) {
    const defaults = [];
    for (let i = 0; i < lastRow - 1; i++) defaults.push([18]); // old invoices were always 18%
    sh.getRange(2, newCol, lastRow - 1, 1).setValues(defaults);
  }
}

function ensureReorderLevelColumn_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  if (!sh) return;

  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;

  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headers.indexOf('Reorder Level') !== -1) return; // already migrated

  const newCol = lastCol + 1;
  sh.getRange(1, newCol).setValue('Reorder Level');

  const lastRow = sh.getLastRow();
  if (lastRow > 1) {
    const defaults = [];
    for (let i = 0; i < lastRow - 1; i++) defaults.push([5]);
    sh.getRange(2, newCol, lastRow - 1, 1).setValues(defaults);
  }
}

function updateProduct(p) {
  const model = String(p.model || '').trim();
  const prod = findProduct(model);
  if (!prod) throw Error('Product not found: ' + model);

  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  const row = prod.row;

  const imageUrl = p.imageBase64 ? saveImageToDrive_(p.imageBase64, p.imageName) : (p.image || prod.data[10] || '');

  sh.getRange(row, 3).setValue(p.description || '');
  sh.getRange(row, 4).setValue(p.category || '');
  sh.getRange(row, 5).setValue(p.brand || '');
  sh.getRange(row, 6).setValue(p.unit || 'Pcs');
  sh.getRange(row, 7).setValue(p.location || '');
  sh.getRange(row, 8).setValue(p.costPrice || '');
  sh.getRange(row, 9).setValue(p.salePrice || '');
  sh.getRange(row, 11).setValue(imageUrl);
  sh.getRange(row, 12).setValue(p.remarks || '');
  if (p.reorderLevel !== undefined && p.reorderLevel !== '') {
    sh.getRange(row, 14).setValue(Number(p.reorderLevel));
  }

  return { ok:true };
}

function setProductStatus_(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return { ok:false, error:'Only an Admin can activate/deactivate products.' };
  }

  const model = String(p.model || '').trim();
  const prod = findProduct(model);
  if (!prod) throw Error('Product not found: ' + model);

  const sh = SpreadsheetApp.getActive().getSheetByName('Products');
  sh.getRange(prod.row, 13).setValue(String(p.status || 'Active'));

  return { ok:true };
}

function updateParty_(sheetName, nameCol, p, statusCol) {
  const name = String(p.name || '').trim();
  if (!name) throw Error('Name is required.');

  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][nameCol - 1] || '').trim().toLowerCase() === name.toLowerCase()) {
      sh.getRange(i + 1, nameCol + 1).setValue(p.contact || '');  // Contact Person
      sh.getRange(i + 1, nameCol + 2).setValue(p.phone || '');    // Phone
      sh.getRange(i + 1, nameCol + 3).setValue(p.email || '');    // Email
      sh.getRange(i + 1, nameCol + 4).setValue(p.address || '');  // Address
      sh.getRange(i + 1, nameCol + 5).setValue(p.ntn || '');      // NTN/Tax ID
      sh.getRange(i + 1, nameCol + 6).setValue(p.remarks || '');  // Remarks
      return { ok:true };
    }
  }

  throw Error(sheetName.slice(0, -1) + ' not found: ' + name);
}

function setPartyStatus_(sheetName, nameCol, statusCol, p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return { ok:false, error:'Only an Admin can activate/deactivate ' + sheetName.toLowerCase() + '.' };
  }

  const name = String(p.name || '').trim();
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][nameCol - 1] || '').trim().toLowerCase() === name.toLowerCase()) {
      sh.getRange(i + 1, statusCol).setValue(String(p.status || 'Active'));
      return { ok:true };
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

  try {
    const match = String(base64Data).match(/^data:(.+);base64,(.+)$/);
    const mimeType = match ? match[1] : 'image/jpeg';
    const data = match ? match[2] : base64Data;

    const blob = Utilities.newBlob(Utilities.base64Decode(data), mimeType, fileName || 'product-image.jpg');
    const folder = getOrCreateProductImagesFolder_();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return 'https://drive.google.com/uc?export=view&id=' + file.getId();
  } catch (e) {
    return '';
  }
}

function getOrCreateProductImagesFolder_() {
  const folders = DriveApp.getFoldersByName('SFS Product Images');
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder('SFS Product Images');
}

function saveProduct(p) {
  const sh=SpreadsheetApp.getActive().getSheetByName('Products');
  const id=nextSafeId_('P-','Products',1);

  const model=String(p.model || '').trim();

  if(!model) throw Error('Model / Part No. is required.');

  if(findProduct(model)) {
    throw Error('Product already exists: '+model);
  }

  const imageUrl = p.imageBase64 ? saveImageToDrive_(p.imageBase64, p.imageName) : (p.image || '');

  sh.appendRow([
    id,
    model,
    p.description || '',
    p.category || '',
    p.brand || '',
    p.unit || 'Pcs',
    p.location || '',
    p.costPrice || '',
    p.salePrice || '',
    0,
    imageUrl,
    p.remarks || '',
    'Active',
    Number(p.reorderLevel || 5)
  ]);

  const openingStock=Number(p.openingStock || 0);
  if(openingStock>0) {
    const prod=findProduct(model);
    postMovement('IN', prod, openingStock, '', 'Opening Stock', id, p.user || 'Staff');
  }

  return {ok:true,id:id};
}

/* ---------- STOCK MOVEMENT ---------- */

function getMovementRows_() {
  const sh=SpreadsheetApp.getActive().getSheetByName('Stock Movement');

  if(!sh || sh.getLastRow()<2) return [];

  return sh.getRange(
    2,
    1,
    sh.getLastRow()-1,
    HEADERS['Stock Movement'].length
  ).getValues();
}

function movementBalanceForModel_(model,movements) {
  const target=String(model).trim();
  let balance=0;

  movements.forEach(r => {
    const m=String(r[4] || '').trim();
    if(m!==target) return;
    balance += Number(r[5] || 0);
  });

  return balance;
}

function postMovement(type,prod,qty,party,refType,refNo,user) {
  const sh=SpreadsheetApp.getActive().getSheetByName('Stock Movement');

  if(!sh) throw Error('Stock Movement sheet not found.');

  const amount=Math.abs(Number(qty || 0));

  if(amount<=0) throw Error('Quantity must be greater than zero.');

  const signed=(String(type).toUpperCase()==='OUT')
    ? -amount
    : amount;

  sh.appendRow([
    nextSafeId_('TX-','Stock Movement',1),
    new Date(),
    String(type).toUpperCase(),
    prod.data[0],
    prod.data[1],
    signed,
    party || '',
    refType || '',
    refNo || '',
    user || 'Staff'
  ]);

  refreshProductStock_(prod.data[1]);

  return signed;
}

function refreshProductStock_(model) {
  const prod=findProduct(model);

  if(!prod) return;

  const sourceStock=getSourceStockForModel_(model);
  const movements=getMovementRows_();
  const current=sourceStock+movementBalanceForModel_(model,movements);

  SpreadsheetApp.getActive()
    .getSheetByName('Products')
    .getRange(prod.row,10)
    .setValue(current);
}

function getSourceStockForModel_(model) {
  const sh=SpreadsheetApp.getActive().getSheetByName('Source Stock');

  if(!sh || sh.getLastRow()<5) return 0;

  const rows=sh.getDataRange().getValues();
  const target=String(model).trim();

  let qty=0;

  // Row 4 headers hain, data Row 5 (index 4) se shuru hota hai
  rows.slice(4).forEach(r => {
    if(String(r[0] || '').trim()===target) {
      qty += Number(String(r[6] || 0).replace(/,/g,'')) || 0; // Column G (index 6) Total Stock
    }
  });

  return qty;
}

/* ---------- INWARD ---------- */

function saveInward(p) {
  const id=nextSafeId_('IN-','Inward',1);
  const prod=findProduct(p.model);

  if(!prod) {
    throw Error('Product not found: '+p.model);
  }

  const qty=Number(p.qty || p.quantity || 0);

  if(qty<=0) {
    throw Error('Inward quantity must be greater than zero.');
  }

  SpreadsheetApp.getActive()
    .getSheetByName('Inward')
    .appendRow([
      id,
      p.date || new Date(),
      prod.data[0],
      p.model,
      qty,
      p.sourceType || '',
      p.supplier || '',
      p.supplierReference || '',
      p.purchaseCost || '',
      p.remarks || '',
      p.user || 'Staff'
    ]);

  postMovement(
    'IN',
    prod,
    qty,
    p.supplier || '',
    'Inward',
    id,
    p.user || 'Staff'
  );

  return {
    ok:true,
    id:id,
    currentStock:getCurrentStock(p.model)
  };
}

function numberExistsInSheet_(sheetName, value) {
  const v = String(value || '').trim();
  if (!v) return false;

  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return false;

  const nums = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  return nums.some(r => String(r[0] || '').trim() === v);
}

/* ---------- DELIVERY CHALLAN ---------- */

function saveDC(p) {
  const id=p.no || nextSafeId_('DC-','Delivery Challans',1);

  if (p.no && numberExistsInSheet_('Delivery Challans', p.no)) {
    throw Error('Delivery Challan '+p.no+' already exists. If you clicked Save twice, this one was already recorded — check Delivery Challan History.');
  }

  const sh=SpreadsheetApp.getActive().getSheetByName('Delivery Challans');

  const items=p.items || [];

  if(!items.length) {
    throw Error('Delivery Challan has no items.');
  }

  const validated=[];

  items.forEach(it => {
    const prod=findProduct(it.model);

    if(!prod) {
      throw Error('Product not found: '+it.model);
    }

    const qty=Number(it.qty || 0);

    if(qty<=0) {
      throw Error('Invalid quantity for '+it.model);
    }

    const available=getCurrentStock(it.model);

    if(qty>available) {
      throw Error(
        'Insufficient stock for '+it.model+
        '. Available: '+available+
        ', requested: '+qty
      );
    }

    validated.push({
      item:it,
      prod:prod,
      qty:qty
    });
  });

  validated.forEach(x => {
    const it=x.item;
    const prod=x.prod;

    sh.appendRow([
      id,
      p.date || new Date(),
      p.customerId || '',
      p.customer || '',
      p.address || '',
      p.po || '',
      p.poDate || '',
      p.stn || '',
      p.ntn || '',
      prod.data[0],
      it.model,
      it.desc || prod.data[2],
      x.qty,
      it.unit || 'nos',
      p.user || 'Staff'
    ]);

    postMovement(
      'OUT',
      prod,
      x.qty,
      p.customer || '',
      'DC',
      id,
      p.user || 'Staff'
    );
  });

  return {
    ok:true,
    id:id,
    message:'Delivery Challan saved successfully'
  };
}

function updateDC(p) {
  const no = String(p.no || '').trim();
  if (!no) throw Error('Delivery Challan number is required.');

  const invoiceExists = objectsFromSheet_('Invoices')
    .some(r => String(r['DC No.'] || '').trim() === no);

  if (invoiceExists) {
    throw Error('Cannot edit Delivery Challan '+no+' — an Invoice has already been created against it. Ask an admin if this really needs to change.');
  }

  const sh = SpreadsheetApp.getActive().getSheetByName('Delivery Challans');
  const values = sh.getDataRange().getValues();
  const headerRow = values[0];

  const noCol = headerRow.indexOf('DC No.');
  const modelCol = headerRow.indexOf('Model / Part No.');
  const qtyCol = headerRow.indexOf('Quantity');

  const oldItems = [];
  const rowsToDelete = [];

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][noCol] || '').trim() === no) {
      oldItems.push({
        model: values[i][modelCol],
        qty: Number(values[i][qtyCol] || 0)
      });
      rowsToDelete.push(i + 1); // 1-based sheet row number
    }
  }

  if (!rowsToDelete.length) throw Error('Delivery Challan not found: ' + no);

  const items = p.items || [];
  if (!items.length) throw Error('Delivery Challan has no items.');

  // Temporarily reverse the old stock deduction so we can validate the
  // new item list against true available stock (covers both increases
  // and decreases in quantity, and item swaps).
  oldItems.forEach(it => {
    const prod = findProduct(it.model);
    if (prod && it.qty > 0) {
      postMovement('IN', prod, it.qty, p.customer || '', 'DC Edit Reversal', no, p.user || 'Staff');
    }
  });

  const validated = [];
  try {
    items.forEach(it => {
      const prod = findProduct(it.model);
      if (!prod) throw Error('Product not found: ' + it.model);

      const qty = Number(it.qty || 0);
      if (qty <= 0) throw Error('Invalid quantity for ' + it.model);

      const available = getCurrentStock(it.model);
      if (qty > available) {
        throw Error('Insufficient stock for ' + it.model + '. Available: ' + available + ', requested: ' + qty);
      }

      validated.push({ item: it, prod: prod, qty: qty });
    });
  } catch (err) {
    // Validation failed — undo the reversal so stock isn't left wrong.
    oldItems.forEach(it => {
      const prod = findProduct(it.model);
      if (prod && it.qty > 0) {
        postMovement('OUT', prod, it.qty, p.customer || '', 'DC Edit Reversal Undo', no, p.user || 'Staff');
      }
    });
    throw err;
  }

  // Remove old item rows (delete bottom-up so row numbers stay valid).
  rowsToDelete.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));

  validated.forEach(x => {
    const it = x.item;
    const prod = x.prod;

    sh.appendRow([
      no,
      p.date || new Date(),
      p.customerId || '',
      p.customer || '',
      p.address || '',
      p.po || '',
      p.poDate || '',
      p.stn || '',
      p.ntn || '',
      prod.data[0],
      it.model,
      it.desc || prod.data[2],
      x.qty,
      it.unit || 'nos',
      p.user || 'Staff'
    ]);

    postMovement('OUT', prod, x.qty, p.customer || '', 'DC Edit', no, p.user || 'Staff');
  });

  return { ok:true, id:no, message:'Delivery Challan updated successfully' };
}

/* ---------- INVOICE ---------- */

function saveInvoice(p) {
  ensureInvoiceGstColumn_();

  const id=p.no || nextSafeId_('INV-','Invoices',1);

  if (p.no && numberExistsInSheet_('Invoices', p.no)) {
    throw Error('Invoice '+p.no+' already exists. If you clicked Save twice, this one was already recorded — check Invoice History.');
  }

  const dcNo = String(p.dc || '').trim();
  if (dcNo) {
    const existingForDc = objectsFromSheet_('Invoices').some(r => String(r['DC No.'] || '').trim() === dcNo);
    if (existingForDc) {
      throw Error('An invoice already exists for Delivery Challan ' + dcNo + '. Check Invoice History.');
    }
  }

  const sh=SpreadsheetApp.getActive().getSheetByName('Invoices');
  const items=p.items || [];

  if(!items.length) {
    throw Error('Invoice has no items.');
  }

  const gstPercent = p.gstPercent !== undefined && p.gstPercent !== '' ? Number(p.gstPercent) : 18;

  items.forEach(it => {
    const prod=findProduct(it.model);

    if(!prod) {
      throw Error('Product not found: '+it.model);
    }

    const qty=Number(it.qty || 0);
    const rate=Number(it.rate || 0);

    sh.appendRow([
      id,
      p.date || new Date(),
      p.customerId || '',
      p.customer || '',
      p.po || '',
      p.poDate || '',
      p.dc || '',
      p.dcDate || '',
      p.stn || '',
      p.ntn || '',
      prod.data[0],
      it.model,
      it.desc || prod.data[2],
      qty,
      rate,
      qty*rate,
      p.user || 'Staff',
      gstPercent
    ]);
  });

  return {
    ok:true,
    id:id,
    message:'Invoice saved successfully'
  };
}

/* ---------- LOGIN / USERS ---------- */

function loginUser(p) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');

  if (!sh) return {ok:false,error:'Users & Roles sheet not found.'};

  const cols = getUserCols_(sh);
  if (cols.username === -1 || cols.password === -1) {
    return {ok:false,error:'Users & Roles sheet is missing a Username or Password column.'};
  }

  const username = String(p.username || '').trim();
  const password = String(p.password || '');

  if (!username) return {ok:false,error:'Username is required.'};

  const props = PropertiesService.getScriptProperties();
  const lockKey = 'SFS_LOGIN_LOCK_' + username.toLowerCase();
  const lockRaw = props.getProperty(lockKey);
  const LOCK_LIMIT = 5;
  const LOCK_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  if (lockRaw) {
    const lock = JSON.parse(lockRaw);
    const elapsed = Date.now() - lock.lastAttempt;

    if (lock.attempts >= LOCK_LIMIT && elapsed < LOCK_WINDOW_MS) {
      const waitMin = Math.ceil((LOCK_WINDOW_MS - elapsed) / 60000);
      return {ok:false, error:'Too many failed login attempts. Try again in ' + waitMin + ' minute(s).'};
    }

    if (elapsed >= LOCK_WINDOW_MS) {
      props.deleteProperty(lockKey); // cooldown expired, start fresh
    }
  }

  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rowUsername = String(r[cols.username] || '').trim();
    const rowStatus = cols.status !== -1 ? String(r[cols.status] || 'Active') : 'Active';

    if (
      rowUsername === username &&
      verifyPassword_(password, r[cols.password]) &&
      rowStatus.toLowerCase() !== 'inactive'
    ) {
      props.deleteProperty(lockKey); // successful login clears any lockout

      if (isLegacyPassword_(r[cols.password])) {
        // Transparently upgrade this account to a salted hash now that
        // we've verified the plain-text password was correct.
        sh.getRange(i + 1, cols.password + 1).setValue(hashPassword_(password));
      }

      const session = Utilities.getUuid();
      const userObj = {
        id: cols.id !== -1 ? r[cols.id] : '',
        name: cols.name !== -1 ? r[cols.name] : rowUsername,
        username: rowUsername,
        role: cols.role !== -1 ? String(r[cols.role] || 'STAFF').toUpperCase() : 'STAFF',
        status: rowStatus
      };

      PropertiesService.getScriptProperties().setProperty(
        'SFS_SESSION_' + session,
        JSON.stringify(Object.assign({}, userObj, {created: Date.now()}))
      );

      return {
        ok:true,
        session:session,
        user:userObj
      };
    }
  }

  // Failed attempt — record it against this username for rate-limiting.
  const prevAttempts = lockRaw ? JSON.parse(lockRaw).attempts : 0;
  props.setProperty(lockKey, JSON.stringify({attempts: prevAttempts + 1, lastAttempt: Date.now()}));

  return {ok:false,error:'Invalid username or password'};
}

function requireSession_(p) {
  const token = String(p.session || '').trim();

  if (DEV_MODE) {
    return {ok:true,user:{id:'DEV-000001',name:'Administrator',username:'admin',role:'ADMIN',status:'Active',created:Date.now()}};
  }

  if (!token) {
    return {ok:false,error:'Unauthorized'};
  }

  const raw = PropertiesService.getScriptProperties()
    .getProperty('SFS_SESSION_' + token);

  if (!raw) {
    return {ok:false,error:'Unauthorized'};
  }

  try {
    const user = JSON.parse(raw);

    if (user.created && (Date.now() - Number(user.created)) > 12 * 60 * 60 * 1000) {
      PropertiesService.getScriptProperties()
        .deleteProperty('SFS_SESSION_' + token);
      return {ok:false,error:'Unauthorized'};
    }

    return {ok:true,user:user};
  } catch (e) {
    return {ok:false,error:'Unauthorized'};
  }
}

function logoutUser_(p) {
  const token = String(p.session || '').trim();
  if (token) {
    PropertiesService.getScriptProperties()
      .deleteProperty('SFS_SESSION_' + token);
  }
  return {ok:true};
}

function bootstrap_(p) {
  const auth = requireSession_(p);
  if (!auth.ok) return auth;

  ensureReorderLevelColumn_();
  ensureInvoiceGstColumn_();

  const products = objectsFromSheet_('Products');
  const customers = objectsFromSheet_('Customers');
  const suppliers = objectsFromSheet_('Suppliers');

  const movements = getMovementObjectsForFrontend_();

  const source = readSourceObjects_();
  products.forEach(prod => {
    const model = String(prod['Model / Part No.'] || '').trim();
    const base = sourceQtyForFrontend_(model, source);
    const stockQty = base + movementBalanceForFrontend_(model, movements);
    prod['Current Stock'] = stockQty;
    prod.currentStock = stockQty; // alias: frontend (app.js) reads this camelCase key
  });

  return {
    ok:true,
    user:{
      id:auth.user.id,
      name:auth.user.name,
      username:auth.user.username,
      role:String(auth.user.role || 'STAFF').toUpperCase(),
      status:auth.user.status || 'Active'
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
    headers.forEach((h,i) => o[h] = row[i]);
    return o;
  });
}

function readSourceObjects_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Source Stock');
  if (!sh || sh.getLastRow() < 5) return [];

  const values = sh.getDataRange().getValues();

  // Row 4 headers hain (index 3), data Row 5 (index 4) se shuru hota hai.
  // sourceQtyForFrontend_ positional access (r[0], r[6]) use karta hai,
  // isliye yahan raw rows (arrays) return karna hai, header-keyed objects nahi.
  return values.slice(4);
}

function sourceQtyForFrontend_(model, source) {
  const target = String(model || '').trim();
  let total = 0;

  source.forEach(r => {
    const rowModel = String(r[0] || r['Model / Part No.'] || '').trim();
    if (rowModel !== target) return;
    
    // Column G (index 6) Total Stock hai
    total += Number(String(
      r[6] ?? r['TOTAL STOCK'] ?? r.Qty ?? r.Quantity ?? r.Stock ?? 0
    ).replace(/,/g,'')) || 0;
  });

  return total;
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

function movementBalanceForFrontend_(model, tx) {
  const target = String(model || '').trim();
  return tx.reduce((sum,x) => {
    if (String(x['Model / Part No.'] || '').trim() !== target) return sum;
    return sum + Number(x['Qty IN'] || 0) - Number(x['Qty OUT'] || 0);
  }, 0);
}

function saveCustomer_(p, user) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Customers');
  const id = nextSafeId_('CUST-','Customers',1);

  sh.appendRow([
    id,
    String(p.name || '').trim(),
    String(p.contact || p.contactPerson || '').trim(),
    String(p.phone || '').trim(),
    String(p.email || '').trim(),
    String(p.address || '').trim(),
    String(p.ntn || '').trim(),
    String(p.remarks || '').trim(),
    'Active'
  ]);

  return {ok:true,id:id};
}

function saveSupplier_(p, user) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Suppliers');
  const id = nextSafeId_('SUP-','Suppliers',1);

  sh.appendRow([
    id,
    String(p.name || '').trim(),
    String(p.contact || p.contactPerson || '').trim(),
    String(p.phone || '').trim(),
    String(p.email || '').trim(),
    String(p.address || '').trim(),
    String(p.ntn || '').trim(),
    String(p.remarks || '').trim(),
    'Active'
  ]);

  return {ok:true,id:id};
}

function getLedgerForFrontend_(p) {
  const party = String(p.name || p.party || '').trim();
  const type = String(p.type || p.partyType || '').trim();

  const rows = getMovementObjectsForFrontend_()
    .filter(x => String(x.Party || '').trim() === party);

  return {
    ok:true,
    party:party,
    partyType:type,
    transactions:rows.map(x => ({
      date:x.Date,
      type:x.Type,
      ref:x.Reference,
      debit:x['Qty OUT'] || 0,
      credit:x['Qty IN'] || 0,
      remarks:''
    }))
  };
}

function getReportsForFrontend_(p) {
  const mode = String(p.mode || '').trim();
  if (mode === 'docs') return getDocumentHistory_(p);
  if (mode === 'document') return getDocument_(p);
  if (mode === 'price') return getPriceForModel_(p);

  const tx = getMovementObjectsForFrontend_();
  const products = objectsFromSheet_('Products');
  const invoices = objectsFromSheet_('Invoices');

  const year = String(p.year || new Date().getFullYear());
  const sales = invoices.filter(x => {
    const d = x.Date ? new Date(x.Date) : null;
    return !d || String(d.getFullYear()) === year;
  }).map(x => ({
    date:x.Date,
    invoice:x['Invoice No.'] || x['Invoice No'] || '',
    customer:x['Customer Name'] || x.Customer || '',
    total:Number(x.Amount || 0) || 0
  }));

  const categorySales = {};
  tx.forEach(x => {
    if (String(x.Type || '').toUpperCase() !== 'OUT') return;
    const model = String(x['Model / Part No.'] || '').trim();
    const prod = products.find(p => String(p['Model / Part No.'] || '').trim() === model);
    const cat = prod ? String(prod.Category || 'Others') : 'Others';
    categorySales[cat] = (categorySales[cat] || 0) + Number(x['Qty OUT'] || 0);
  });

  return {
    ok:true,
    sales:sales,
    categorySales:categorySales,
    movements:tx
  };
}

/* ---------- PAYMENTS (BANK / RECEIVABLES) ---------- */

function getPaymentsForInvoice_(invoiceNo) {
  const no = String(invoiceNo || '').trim();
  return objectsFromSheet_('Payments').filter(r => String(r['Invoice No.'] || '').trim() === no);
}

function invoiceTotal_(inv) {
  // Matches the GST calc used on the printed invoice (printInvoice in app.js).
  return Number(inv.subtotal || 0) * 1.18;
}

function savePayment(p) {
  const invoiceNo = String(p.invoiceNo || '').trim();
  const amount = Number(p.amount || 0);

  if (!invoiceNo) throw Error('Invoice number is required.');
  if (amount <= 0) throw Error('Payment amount must be greater than zero.');

  const inv = buildInvoiceDocuments_().find(d => d.no === invoiceNo);
  if (!inv) throw Error('Invoice not found: ' + invoiceNo);

  const total = invoiceTotal_(inv);
  const alreadyPaid = getPaymentsForInvoice_(invoiceNo).reduce((a, x) => a + Number(x.Amount || 0), 0);
  const outstandingBefore = total - alreadyPaid;

  if (amount > outstandingBefore + 0.5) {
    throw Error('Payment (' + amount.toFixed(2) + ') exceeds outstanding balance (' + outstandingBefore.toFixed(2) + ') for invoice ' + invoiceNo + '.');
  }

  const id = nextSafeId_('PMT-', 'Payments', 1);
  const sh = SpreadsheetApp.getActive().getSheetByName('Payments');

  sh.appendRow([
    id,
    p.date || new Date(),
    inv.customerId || '',
    inv.customer || '',
    invoiceNo,
    amount,
    p.method || '',
    p.reference || '',
    p.remarks || '',
    p.user || 'Staff'
  ]);

  return {
    ok: true,
    id: id,
    outstanding: Math.max(0, outstandingBefore - amount)
  };
}

function getOutstandingForFrontend_(p) {
  const invoices = buildInvoiceDocuments_();
  const payments = objectsFromSheet_('Payments');

  const paidByInvoice = {};
  payments.forEach(pmt => {
    const no = String(pmt['Invoice No.'] || '').trim();
    paidByInvoice[no] = (paidByInvoice[no] || 0) + Number(pmt.Amount || 0);
  });

  let rows = invoices.map(inv => {
    const total = invoiceTotal_(inv);
    const paid = paidByInvoice[inv.no] || 0;
    return {
      no: inv.no,
      date: inv.date,
      customer: inv.customer,
      customerId: inv.customerId,
      total: total,
      paid: paid,
      outstanding: Math.max(0, total - paid)
    };
  });

  if (p && p.customer) {
    const c = String(p.customer).toLowerCase();
    rows = rows.filter(r => String(r.customer || '').toLowerCase() === c);
  }

  if (!p || !p.includeSettled) {
    rows = rows.filter(r => r.outstanding > 0.5);
  }

  return { ok: true, rows: rows };
}

function getPaymentHistory_(p) {
  let rows = objectsFromSheet_('Payments');

  if (p && p.customer) {
    const c = String(p.customer).toLowerCase();
    rows = rows.filter(r => String(r['Customer Name'] || '').toLowerCase() === c);
  }

  if (p && p.invoiceNo) {
    const no = String(p.invoiceNo).trim();
    rows = rows.filter(r => String(r['Invoice No.'] || '').trim() === no);
  }

  return { ok: true, payments: rows.reverse() };
}

function saveSupplierPayment(p) {
  const supplierName = String(p.supplier || '').trim();
  const amount = Number(p.amount || 0);

  if (!supplierName) throw Error('Supplier is required.');
  if (amount <= 0) throw Error('Payment amount must be greater than zero.');

  const outstandingRows = getSupplierOutstandingForFrontend_({supplier: supplierName, includeSettled: true}).rows;
  const current = outstandingRows.find(r => r.supplier.toLowerCase() === supplierName.toLowerCase());
  const outstandingBefore = current ? current.outstanding : 0;

  if (amount > outstandingBefore + 0.5) {
    throw Error('Payment (' + amount.toFixed(2) + ') exceeds outstanding balance (' + outstandingBefore.toFixed(2) + ') for ' + supplierName + '. Check the amount — the field may not have been cleared before typing.');
  }

  const supplier = objectsFromSheet_('Suppliers').find(
    s => String(s['Supplier Name'] || '').trim().toLowerCase() === supplierName.toLowerCase()
  );

  const id = nextSafeId_('SPMT-', 'Supplier Payments', 1);
  const sh = SpreadsheetApp.getActive().getSheetByName('Supplier Payments');

  sh.appendRow([
    id,
    p.date || new Date(),
    supplier ? supplier['Supplier ID'] : '',
    supplierName,
    amount,
    p.method || '',
    p.reference || '',
    p.remarks || '',
    p.user || 'Staff'
  ]);

  return { ok:true, id:id, outstanding: Math.max(0, outstandingBefore - amount) };
}

function getSupplierOutstandingForFrontend_(p) {
  const inwardRows = objectsFromSheet_('Inward');
  const payments = objectsFromSheet_('Supplier Payments');
  const suppliersList = objectsFromSheet_('Suppliers');

  function canonicalName_(raw) {
    const norm = String(raw || '').trim().toLowerCase();
    const match = suppliersList.find(s => String(s['Supplier Name'] || '').trim().toLowerCase() === norm);
    return match ? match['Supplier Name'] : String(raw || '').trim();
  }

  const purchasedBySupplier = {}; // keyed by normalized (trimmed, lowercase) supplier name
  const paidBySupplier = {};
  const displayName = {};

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
    return {
      supplier: displayName[key] || key,
      purchased: purchased,
      paid: paid,
      outstanding: Math.max(0, purchased - paid)
    };
  });

  if (p && p.supplier) {
    const s = String(p.supplier).trim().toLowerCase();
    rows = rows.filter(r => r.supplier.toLowerCase() === s);
  }

  if (!p || !p.includeSettled) {
    rows = rows.filter(r => r.outstanding > 0.5);
  }

  return { ok:true, rows: rows };
}

function getSupplierPaymentHistory_(p) {
  let rows = objectsFromSheet_('Supplier Payments');

  if (p && p.supplier) {
    const s = String(p.supplier).toLowerCase();
    rows = rows.filter(r => String(r['Supplier Name'] || '').toLowerCase() === s);
  }

  return { ok:true, payments: rows.reverse() };
}

/* ---------- SALES TARGET / CUSTOMER SALES SUMMARY ---------- */

function getTargetForYear_(year) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Targets');
  if (!sh || sh.getLastRow() < 2) return 0;

  const rows = sh.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(year).trim()) {
      return Number(rows[i][1] || 0);
    }
  }
  return 0;
}

function getSalesSummaryForFrontend_(p) {
  const year = String(p.year || new Date().getFullYear());
  const invoiceDocs = buildInvoiceDocuments_();

  const byCustomer = {};
  let totalSales = 0;

  invoiceDocs.forEach(inv => {
    const d = inv.date ? new Date(inv.date) : null;
    if (d && !isNaN(d) && String(d.getFullYear()) !== year) return;

    const grand = Number(inv.subtotal || 0) * (1 + Number(inv.gstPercent || 18) / 100);
    const cust = String(inv.customer || '').trim();

    if (cust) byCustomer[cust] = (byCustomer[cust] || 0) + grand;
    totalSales += grand;
  });

  const customerSales = Object.keys(byCustomer)
    .map(c => ({ customer: c, amount: byCustomer[c] }))
    .sort((a, b) => b.amount - a.amount);

  const target = getTargetForYear_(year);

  return {
    ok: true,
    year: year,
    totalSales: totalSales,
    target: target,
    remaining: Math.max(0, target - totalSales),
    customerSales: customerSales
  };
}

function saveTarget(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return { ok:false, error:'Only an Admin can set sales targets.' };
  }

  const year = String(p.year || new Date().getFullYear()).trim();
  const amount = Number(p.amount || 0);

  const sh = SpreadsheetApp.getActive().getSheetByName('Targets');
  const rows = sh.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === year) {
      sh.getRange(i + 1, 2).setValue(amount);
      return { ok:true };
    }
  }

  sh.appendRow([year, amount]);
  return { ok:true };
}

/* ---------- DOCUMENT HISTORY (Delivery Challans / Invoices) ---------- */
/* Each DC/Invoice is stored as one row per item line. These helpers
   group the rows back into document objects with an items[] array,
   which is what the frontend's History pages expect. */

function buildDCDocuments_() {
  const rows = objectsFromSheet_('Delivery Challans');
  const byNo = {};
  const order = [];

  rows.forEach(r => {
    const no = String(r['DC No.'] || '').trim();
    if (!no) return;

    if (!byNo[no]) {
      byNo[no] = {
        no: no,
        date: r['Date'],
        customerId: r['Customer ID'] || '',
        customer: r['Customer Name'] || '',
        address: r['Delivery Address'] || '',
        po: r['PO #'] || '',
        poDate: r['PO Date'] || '',
        stn: r['STN'] || '',
        ntn: r['NTN'] || '',
        createdBy: r['Created By'] || '',
        items: []
      };
      order.push(no);
    }

    byNo[no].items.push({
      model: r['Model / Part No.'] || '',
      desc: r['Description'] || '',
      qty: Number(r['Quantity'] || 0),
      unit: r['Unit'] || ''
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
        no: no,
        date: r['Date'],
        customerId: r['Customer ID'] || '',
        customer: r['Customer Name'] || '',
        po: r['PO #'] || '',
        poDate: r['PO Date'] || '',
        dc: r['DC No.'] || '',
        dcDate: r['DC Date'] || '',
        stn: r['STN'] || '',
        ntn: r['NTN'] || '',
        createdBy: r['Created By'] || '',
        gstPercent: r['GST %'] !== undefined && r['GST %'] !== '' ? Number(r['GST %']) : 18,
        items: [],
        subtotal: 0
      };
      order.push(no);
    }

    const qty = Number(r['Quantity'] || 0);
    const rate = Number(r['Rate / Unit'] || 0);

    byNo[no].items.push({
      model: r['Model / Part No.'] || '',
      desc: r['Description'] || '',
      qty: qty,
      rate: rate
    });

    byNo[no].subtotal += Number(r['Amount'] || (qty * rate)) || 0;
  });

  return order.map(no => byNo[no]).reverse();
}

function getDocumentHistory_(p) {
  const type = String(p.type || '').toUpperCase();

  if (type === 'DC') return { ok:true, documents: buildDCDocuments_() };
  if (type === 'INVOICE') return { ok:true, documents: buildInvoiceDocuments_() };

  return { ok:false, error:'Unknown document type: ' + type };
}

function getDocument_(p) {
  const type = String(p.type || '').toUpperCase();
  const no = String(p.no || '').trim();

  const docs = type === 'DC' ? buildDCDocuments_()
    : type === 'INVOICE' ? buildInvoiceDocuments_()
    : [];

  const doc = docs.find(d => d.no === no);
  if (!doc) return { ok:false, error:'Document not found: ' + no };

  return { ok:true, document: doc };
}

function getPriceForModel_(p) {
  const prod = findProduct(p.model);
  if (!prod) return { ok:true, matched:false };

  const rate = Number(prod.data[8] || 0); // Products header index 8 = Sale Price

  return { ok:true, matched: rate > 0, rate: rate };
}

function listUsers_(authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return {ok:false,error:'Unauthorized'};
  }

  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  const cols = getUserCols_(sh);
  const values = sh.getDataRange().getValues();

  return {
    ok:true,
    users:values.slice(1).map(r => ({
      'User ID': cols.id !== -1 ? r[cols.id] : '',
      'Name': cols.name !== -1 ? r[cols.name] : '',
      'Username': cols.username !== -1 ? r[cols.username] : '',
      'Role': cols.role !== -1 ? r[cols.role] : '',
      'Status': cols.status !== -1 ? (r[cols.status] || 'Active') : 'Active'
    }))
  };
}

/* ---------- PASSWORD HASHING ---------- */
/* Passwords are stored as "salt$hash" (SHA-256 of salt+password).
   Older plain-text passwords are still recognized on login (backward
   compatibility) and are silently upgraded to the hashed format the
   moment that user logs in successfully. */

function generateSalt_() {
  return Utilities.getUuid().replace(/-/g, '');
}

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
  if (sep === -1) {
    // Legacy plain-text password — compare directly.
    return s === password;
  }

  const salt = s.slice(0, sep);
  const hash = s.slice(sep + 1);
  return sha256Hex_(salt + password) === hash;
}

function isLegacyPassword_(stored) {
  return String(stored || '').indexOf('$') === -1;
}

function saveUser_(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return {ok:false,error:'Unauthorized'};
  }

  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  const cols = getUserCols_(sh);
  const username = String(p.username || '').trim();

  if (!username) return {ok:false,error:'Username is required'};
  if (cols.username === -1) return {ok:false,error:'Users & Roles sheet has no Username column.'};

  const existing = sh.getDataRange().getValues().slice(1)
    .some(r => String(r[cols.username] || '').trim().toLowerCase() === username.toLowerCase());

  if (existing) return {ok:false,error:'Username already exists'};

  const row = new Array(cols.total).fill('');
  if (cols.id !== -1) row[cols.id] = nextSafeId_('USR-','Users & Roles', cols.id + 1);
  if (cols.name !== -1) row[cols.name] = String(p.name || '').trim();
  row[cols.username] = username;
  if (cols.role !== -1) row[cols.role] = String(p.role || 'STAFF').toUpperCase();
  if (cols.password !== -1) row[cols.password] = hashPassword_(String(p.password || ''));
  if (cols.status !== -1) row[cols.status] = 'Active';

  sh.appendRow(row);

  return {ok:true};
}

function disableUser_(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return {ok:false,error:'Unauthorized'};
  }

  const username = String(p.username || '').trim();
  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  const cols = getUserCols_(sh);
  if (cols.username === -1) return {ok:false,error:'Users & Roles sheet has no Username column.'};
  if (cols.status === -1) return {ok:false,error:'Users & Roles sheet has no Status column.'};

  const values = sh.getDataRange().getValues();

  for (let i=1;i<values.length;i++) {
    if (String(values[i][cols.username] || '').trim() === username) {
      sh.getRange(i+1,cols.status+1).setValue(String(p.status || 'Inactive'));
      return {ok:true};
    }
  }

  return {ok:false,error:'User not found'};
}

function changePassword_(p, authUser) {
  const current = String(p.currentPassword || '');
  const next = String(p.newPassword || '');

  if (!next || next.length < 6) {
    return {ok:false,error:'New password must be at least 6 characters.'};
  }

  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  const cols = getUserCols_(sh);
  if (cols.username === -1 || cols.password === -1) {
    return {ok:false,error:'Users & Roles sheet is missing a Username or Password column.'};
  }

  const values = sh.getDataRange().getValues();

  for (let i=1;i<values.length;i++) {
    if (String(values[i][cols.username] || '').trim() === String(authUser.username || '').trim()) {
      if (!verifyPassword_(current, values[i][cols.password])) {
        return {ok:false,error:'Current password is incorrect.'};
      }

      sh.getRange(i+1,cols.password+1).setValue(hashPassword_(next));
      return {ok:true};
    }
  }

  return {ok:false,error:'User not found'};
}

/* ---------- READ APIs ---------- */

function getProducts() {
  const sh=SpreadsheetApp.getActive().getSheetByName('Products');

  return {
    ok:true,
    products:sh.getDataRange().getValues()
  };
}

function getStock(p) {
  const model=String(p.model || '').trim();

  return {
    ok:true,
    model:model,
    sourceStock:getSourceStockForModel_(model),
    currentStock:getCurrentStock(model)
  };
}

function getCurrentStock(model) {
  const source=getSourceStockForModel_(model);
  const movements=getMovementRows_();

  return source+movementBalanceForModel_(model,movements);
}

function getStockMovement(p) {
  const sh=SpreadsheetApp.getActive().getSheetByName('Stock Movement');

  if(!sh) return {ok:true,movements:[]};

  let rows=sh.getDataRange().getValues();

  if(p.model) {
    const target=String(p.model).trim();

    rows=[
      rows[0],
      ...rows.slice(1).filter(r=>String(r[4]).trim()===target)
    ];
  }

  return {
    ok:true,
    movements:rows
  };
}

function getCustomers() {
  return {
    ok:true,
    customers:SpreadsheetApp.getActive()
      .getSheetByName('Customers')
      .getDataRange()
      .getValues()
  };
}

function getSuppliers() {
  return {
    ok:true,
    suppliers:SpreadsheetApp.getActive()
      .getSheetByName('Suppliers')
      .getDataRange()
      .getValues()
  };
}

/* ---------- LEDGER ---------- */

function getLedger(p) {
  const party=String(p.party || '').trim();
  const type=String(p.partyType || '').toLowerCase();

  const movements=getMovementRows_();

  const rows=movements.filter(r =>
    String(r[6] || '').trim()===party
  );

  return {
    ok:true,
    party:party,
    partyType:type,
    movements:rows
  };
}

/* ---------- REPORTS ---------- */

function getReports(p) {
  const tx=getMovementRows_();
  const products=SpreadsheetApp.getActive()
    .getSheetByName('Products')
    .getDataRange()
    .getValues();

  const monthlySales={};
  const categorySales={};
  let totalIn=0;
  let totalOut=0;

  tx.forEach(r => {
    const date=r[1] ? new Date(r[1]) : new Date();
    const type=String(r[2] || '').toUpperCase();
    const qty=Number(r[5] || 0);
    const model=String(r[4] || '').trim();

    if(qty>0) totalIn+=qty;
    if(qty<0) totalOut+=Math.abs(qty);

    if(type==='OUT') {
      const key=Utilities.formatDate(
        date,
        Session.getScriptTimeZone(),
        'yyyy-MM'
      );

      monthlySales[key]=(monthlySales[key] || 0)+Math.abs(qty);

      const productRow=products.slice(1).find(
        r=>String(r[1]).trim()===model
      );

      const category=productRow
        ? String(productRow[3] || 'Others')
        : 'Others';

      categorySales[category]=
        (categorySales[category] || 0)+Math.abs(qty);
    }
  });

  return {
    ok:true,
    totalIn:totalIn,
    totalOut:totalOut,
    monthlySales:monthlySales,
    categorySales:categorySales
  };
}
