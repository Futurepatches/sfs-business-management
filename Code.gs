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

const API_TOKEN = 'SFS_2026_MY_SECRET_8472'; // Backend-only; never put this in frontend code.

const SOURCE = {
  stock: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS4E1DvaV4RzuMHMENiroSR4WYZjT0usnqAgUwX-W44ADM-sB1Gz8lYNvK51-WP88BYi4lYLxwZaU3/pub?gid=1719776219&single=true&output=csv',
  imports: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS4E1DvaV4RzuMHMENiroSR4WYZjT0usnqAgUwX-W44ADM-sB1Gz8lYNvK51-WP88BYi4lYLxwZaU3/pub?gid=1389271409&single=true&output=csv',
  returns: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSS4E1DvaV4RzuMHMENiroSR4WYZjT0usnqAgUwX-W44ADM-sB1Gz8lYNvK51-WP88BYi4lYLxwZaU3/pub?gid=1032386368&single=true&output=csv'
};

const HEADERS = {
  'Products':['Product ID','Model / Part No.','Description','Category','Brand','Unit','Location','Cost Price','Sale Price','Current Stock','Product Image','Remarks','Status'],
  'Inward':['Inward ID','Date','Product ID','Model / Part No.','Quantity','Source Type','Supplier','Supplier Reference','Purchase Cost','Remarks','Created By'],
  'Stock Movement':['Transaction ID','Date/Time','Type','Product ID','Model / Part No.','Quantity','Source / Destination','Reference Type','Reference No.','Created By'],
  'Delivery Challans':['DC No.','Date','Customer ID','Customer Name','Delivery Address','PO #','PO Date','STN','NTN','Product ID','Model / Part No.','Description','Quantity','Unit','Created By'],
  'Invoices':['Invoice No.','Date','Customer ID','Customer Name','PO #','PO Date','DC No.','DC Date','STN','NTN','Product ID','Model / Part No.','Description','Quantity','Rate / Unit','Amount','Created By'],
  'Customers':['Customer ID','Customer Name','Contact Person','Phone','Email','Address','NTN/Tax ID','Remarks','Status'],
  'Suppliers':['Supplier ID','Supplier Name','Contact Person','Phone','Email','Address','NTN/Tax ID','Remarks','Status'],
  'Users & Roles':['User ID','Name','Username','Role','Password','Status'],
  'Categories':['Category ID','Category Name']
};

/* ---------- WEB API ---------- */

function doGet(e) {
  try {
    var q = (e && e.parameter) || {};
    if (!q.action) return out({ok:true,service:'SFS Business Management',message:'API is online',timestamp:new Date()});
    var p = {};
    Object.keys(q).forEach(function(k){ if(k !== 'callback') p[k] = q[k]; });
    if (p.data) { try { p = Object.assign(p, JSON.parse(decodeURIComponent(p.data))); } catch(ignore){} }
    var result = handleRequest_(p);
    var cb = String(q.callback || '');
    if (cb && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)) {
      return ContentService.createTextOutput(cb + '(' + JSON.stringify(result) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return out(result);
  } catch(err) { return out({ok:false,error:String(err && err.message ? err.message : err)}); }
}

function doPost(e) {
  try {
    var p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return out(handleRequest_(p));
  } catch (err) {
    return out({ok:false,error:String(err && err.message ? err.message : err)});
  }
}

function handleRequest_(p) {
  try {
    var action = String(p.action || '').trim();
    if (action === 'login') return loginUser(p);
    if (action === 'logout') return logoutUser_(p);
    if (action === 'bootstrap') return bootstrap_(p);
    var auth = requireSession_(p);
    if (!auth.ok) return auth;
    switch (action) {
      case 'saveProduct': case 'product': return saveProduct(p);
      case 'saveInward': case 'inward': p.user=auth.user.username; return saveInward(p);
      case 'saveDC': case 'dc': p.user=auth.user.username; return saveDC(p);
      case 'saveInvoice': case 'invoice': p.user=auth.user.username; return saveInvoice(p);
      case 'saveCustomer': return saveCustomer_(p,auth.user);
      case 'saveSupplier': return saveSupplier_(p,auth.user);
      case 'getLedger': return getLedgerForFrontend_(p);
      case 'getReports': return getReportsForFrontend_(p);
      case 'listUsers': return listUsers_(auth.user);
      case 'saveUser': return saveUser_(p,auth.user);
      case 'disableUser': return disableUser_(p,auth.user);
      case 'changePassword': return changePassword_(p,auth.user);
      case 'refreshSource': case 'sync': syncSourceData(); return {ok:true,message:'Source data refreshed'};
      case 'products': return getProducts();
      case 'stock': return getStock(p);
      case 'stockMovement': return getStockMovement(p);
      case 'customers': return getCustomers();
      case 'suppliers': return getSuppliers();
      default: return {ok:false,error:'Unknown action: '+action};
    }
  } catch(err) { return {ok:false,error:String(err && err.message ? err.message : err)}; }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- DATABASE SETUP ---------- */

function setupDatabase() {
  const ss=SpreadsheetApp.getActive();

  /*
   * SAFE SETUP:
   * Do NOT clear writable sheets.
   * Only create missing sheets and headers.
   */
  Object.keys(HEADERS).forEach(name => {
    ensureSheet(name,HEADERS[name]);
  });

  ensureDefaultCategories_();
  ensureDefaultAdmin_();

  /*
   * Source tabs are refreshed from the published READ-ONLY source.
   * Products are synchronized without destroying user-entered
   * category/brand/image/price/location information.
   */
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

  /*
   * If the sheet exists but is empty, create its header.
   * Never clear an existing sheet.
   */
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

function ensureDefaultAdmin_() {
  const sh=SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  if(!sh) return;

  const values=sh.getDataRange().getValues();

  const hasAdmin=values.slice(1).some(r =>
    String(r[2] || '').trim().toLowerCase()==='admin'
  );

  if(!hasAdmin) {
    sh.appendRow([
      'USR-000001',
      'Administrator',
      'admin',
      'Admin',
      'admin123',
      'Active'
    ]);
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
  const ss=SpreadsheetApp.getActive();

  const stock=fetchSource(SOURCE.stock);
  const imp=fetchSource(SOURCE.imports);
  const ret=fetchSource(SOURCE.returns);

  /*
   * These are local read-only snapshots of the original source.
   * Nothing is ever written back to the original live sheet.
   */
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

  stock.slice(1).forEach((r,i) => {
    if(!r[0]) return;

    const model=String(r[0]).trim();
    const old=byModel[model] || [];

    /*
     * Preserve manually entered fields:
     * Category, Brand, Unit, Cost, Sale Price, Image, Remarks.
     *
     * Source fields continue to refresh from the original read-only source.
     */
    const sourceQty=Number(r[6] || 0);
    const currentStock=sourceQty + movementBalanceForModel_(model,movements);

    rows.push([
      old[0] || ('P-'+String(i+1).padStart(5,'0')),
      r[0] || '',
      r[2] || '',
      old[3] || '',
      old[4] || '',
      old[5] || 'Pcs',
      r[1] || old[6] || '',
      old[7] || '',
      old[8] || '',
      currentStock,
      old[10] || r[4] || '',
      old[11] || '',
      old[12] || 'Active'
    ]);
  });

  if(!rows.length) return;

  /*
   * Replace only the product rows with the synchronized master.
   * User-entered fields are preserved through byModel.
   */
  if(sh.getLastRow()>1) {
    sh.getRange(
      2,
      1,
      sh.getLastRow()-1,
      HEADERS.Products.length
    ).clearContent();
  }

  sh.getRange(
    2,
    1,
    rows.length,
    HEADERS.Products.length
  ).setValues(rows);
}

/* ---------- IDS ---------- */

function nextId(prefix,sheet,col) {
  const sh=SpreadsheetApp.getActive().getSheetByName(sheet);
  const n=Math.max(0,sh.getLastRow()-1)+1;
  return prefix+String(n).padStart(6,'0');
}

/*
 * Safer ID generator: keeps IDs unique even if old rows were deleted.
 */
function nextSafeId_(prefix,sheet,columnIndex) {
  const sh=SpreadsheetApp.getActive().getSheetByName(sheet);
  const values=sh.getRange(
    2,
    columnIndex,
    Math.max(0,sh.getLastRow()-1),
    1
  ).getValues();

  let max=0;

  values.forEach(r => {
    const m=String(r[0] || '').match(new RegExp('^'+prefix+'(\\d+)$'));
    if(m) max=Math.max(max,Number(m[1]));
  });

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

function saveProduct(p) {
  const sh=SpreadsheetApp.getActive().getSheetByName('Products');
  const id=nextSafeId_('P-','Products',1);

  const model=String(p.model || '').trim();

  if(!model) throw Error('Model / Part No. is required.');

  if(findProduct(model)) {
    throw Error('Product already exists: '+model);
  }

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
    p.image || '',
    p.remarks || '',
    'Active'
  ]);

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

    /*
     * Quantity is signed:
     * IN = positive
     * OUT = negative
     */
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

  /*
   * IMPORTANT:
   * Do NOT directly change Products.Current Stock here.
   * Products.Current Stock is derived from:
   * Source Stock + Stock Movement.
   *
   * This prevents the value from drifting away from the source baseline.
   */
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

  if(!sh || sh.getLastRow()<2) return 0;

  const rows=sh.getDataRange().getValues();
  const target=String(model).trim();

  let qty=0;

  rows.slice(1).forEach(r => {
    if(String(r[0]).trim()===target) {
      qty += Number(r[6] || 0);
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

  const qty=Number(p.qty || 0);

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

/* ---------- DELIVERY CHALLAN ---------- */

function saveDC(p) {
  const id=p.no || nextSafeId_('DC-','Delivery Challans',1);
  const sh=SpreadsheetApp.getActive().getSheetByName('Delivery Challans');

  const items=p.items || [];

  if(!items.length) {
    throw Error('Delivery Challan has no items.');
  }

  /*
   * Validate ALL items before changing stock.
   * This prevents a half-saved DC if a later item is invalid.
   */
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

  /*
   * Save DC rows and stock movements only after validation succeeds.
   */
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

/* ---------- INVOICE ---------- */

function saveInvoice(p) {
  const id=p.no || nextSafeId_('INV-','Invoices',1);
  const sh=SpreadsheetApp.getActive().getSheetByName('Invoices');
  const items=p.items || [];

  if(!items.length) {
    throw Error('Invoice has no items.');
  }

  /*
   * Invoice is financial/document record.
   * It DOES NOT create another OUT movement.
   *
   * If stock was delivered through DC, the DC already reduced stock.
   * This prevents double deduction.
   */
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
      p.user || 'Staff'
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

  const rows = sh.getDataRange().getValues();
  const username = String(p.username || '').trim();
  const password = String(p.password || '');

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];

    if (
      String(r[2] || '').trim() === username &&
      String(r[4] || '') === password &&
      String(r[5] || 'Active').toLowerCase() !== 'inactive'
    ) {
      const session = Utilities.getUuid();

      PropertiesService.getScriptProperties().setProperty(
        'SFS_SESSION_' + session,
        JSON.stringify({
          id: r[0],
          name: r[1],
          username: r[2],
          role: r[3],
          status: r[5] || 'Active',
          created: Date.now()
        })
      );

      return {
        ok:true,
        session:session,
        user:{
          id:r[0],
          name:r[1],
          username:r[2],
          role:String(r[3] || 'STAFF').toUpperCase(),
          status:r[5] || 'Active'
        }
      };
    }
  }

  return {ok:false,error:'Invalid username or password'};
}

function requireSession_(p) {
  const token = String(p.session || '').trim();

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

    // Sessions expire after 12 hours.
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

  const products = objectsFromSheet_('Products');
  const customers = objectsFromSheet_('Customers');
  const suppliers = objectsFromSheet_('Suppliers');

  const movements = getMovementObjectsForFrontend_();

  // Recalculate current stock from the read-only source baseline + new movements.
  const source = readSourceObjects_();
  products.forEach(prod => {
    const model = String(prod['Model / Part No.'] || '').trim();
    const base = sourceQtyForFrontend_(model, source);
    prod['Current Stock'] = base + movementBalanceForFrontend_(model, movements);
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
  if (!sh || sh.getLastRow() < 2) return [];

  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);

  return values.slice(1).map(row => {
    const o = {};
    headers.forEach((h,i) => o[h] = row[i]);
    return o;
  });
}

function sourceQtyForFrontend_(model, source) {
  const target = String(model || '').trim();
  let total = 0;

  source.forEach(r => {
    if (String(r[0] || r['Model / Part No.'] || '').trim() !== target) return;
    total += Number(String(
      r[6] ?? r.Qty ?? r.Quantity ?? r.Stock ?? r['Current Stock'] ?? 0
    ).replace(/,/g,'')) || 0;
  });

  return total;
}

function getMovementObjectsForFrontend_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Stock Movement');
  if (!sh || sh.getLastRow() < 2) return [];

  const values = sh.getDataRange().getValues();
  const h = values[0].map(String);

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

function listUsers_(authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return {ok:false,error:'Unauthorized'};
  }

  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  const values = sh.getDataRange().getValues();

  return {
    ok:true,
    users:values.slice(1).map(r => ({
      'User ID':r[0],
      'Name':r[1],
      'Username':r[2],
      'Role':r[3],
      'Status':r[5] || 'Active'
    }))
  };
}

function saveUser_(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return {ok:false,error:'Unauthorized'};
  }

  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  const username = String(p.username || '').trim();

  if (!username) return {ok:false,error:'Username is required'};

  const existing = objectsFromSheet_('Users & Roles')
    .some(u => String(u.Username || '').trim().toLowerCase() === username.toLowerCase());

  if (existing) return {ok:false,error:'Username already exists'};

  sh.appendRow([
    nextSafeId_('USR-','Users & Roles',1),
    String(p.name || '').trim(),
    username,
    String(p.role || 'STAFF').toUpperCase(),
    String(p.password || ''),
    'Active'
  ]);

  return {ok:true};
}

function disableUser_(p, authUser) {
  if (String(authUser.role || '').toUpperCase() !== 'ADMIN') {
    return {ok:false,error:'Unauthorized'};
  }

  const username = String(p.username || '').trim();
  const sh = SpreadsheetApp.getActive().getSheetByName('Users & Roles');
  const values = sh.getDataRange().getValues();

  for (let i=1;i<values.length;i++) {
    if (String(values[i][2] || '').trim() === username) {
      sh.getRange(i+1,6).setValue(String(p.status || 'Inactive'));
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
  const values = sh.getDataRange().getValues();

  for (let i=1;i<values.length;i++) {
    if (String(values[i][2] || '').trim() === String(authUser.username || '').trim()) {
      if (String(values[i][4] || '') !== current) {
        return {ok:false,error:'Current password is incorrect.'};
      }

      sh.getRange(i+1,5).setValue(next);
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
