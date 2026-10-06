/* ============================================================
   SFS BUSINESS MANAGEMENT — FRONTEND v3.1 (REVIEWED & FIXED)
   - Dynamic Captcha (captchaLabel + captchaAnswer)
   - Donut chart, Low stock, Sales target, Top customers
   - Edit Product / Customer / Supplier, Status toggle
   - Professional Print (DC + Invoice) with logo, GST, words
   - DC History + Invoice History (NEW)
   - Module permissions (Add Staff)
   - Sidebar collapse
   - DATA SAFETY: does not delete existing data
   ============================================================ */

const DEFAULT_API = (window.SFS_CONFIG && window.SFS_CONFIG.API_URL) || '';
const CATS = ['Airline Equipment','Valves','Cylinder','Fittings/Tubing','Others'];
const ALL_MODULES = [
  {id:'products', label:'Products'},
  {id:'sales',    label:'Sales (DC / Invoice)'},
  {id:'accounts', label:'Accounts (Payments)'},
  {id:'parties',  label:'Parties (Customers / Suppliers)'},
  {id:'reports',  label:'Reports'}
];
const CHART_PALETTE = ['#3B5BDB','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#EF4444','#64748B'];

let S = {
  session: sessionStorage.sfsSession || '',
  user: null,
  products: [],
  customers: [],
  suppliers: [],
  tx: [],
  api: DEFAULT_API
};

const $  = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm = s => String(s||'').toLowerCase().trim();
/* encA: safe encoding inside onclick="fn('...')" (apostrophes are encoded too) */
const encA = s => encodeURIComponent(String(s ?? '')).replace(/'/g, '%27');
function toInputDate(v){
  if (!v) return '';
  const d = (v instanceof Date) ? v : new Date(v);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
/* Local (Karachi) date — toISOString() uses UTC and can shift the date backward around midnight */
function todayStr(){ return toInputDate(new Date()); }
function reorderOf(p){ const v = p ? p['Reorder Level'] : ''; return (v === '' || v == null || isNaN(Number(v))) ? 5 : Number(v); }
function findProd(model){ const t = norm(model); return t ? S.products.find(p => norm(p['Model / Part No.']) === t) : null; }
function findCust(name){ const t = norm(name); return t ? S.customers.find(c => norm(c['Customer Name']) === t) : null; }
function stnOf(party){ const m = String((party && party.Remarks) || '').match(/STN\s*[:#\-]\s*([^\n;|]+)/i); return m ? m[1].trim() : ''; }
function round2(n){ return Math.round((Number(n)||0)*100)/100; }

/* ---------- MODULE HELPERS ---------- */
function isAdmin(){ return S.user && String(S.user.role||'').toUpperCase() === 'ADMIN'; }
function userModules(){ return Array.isArray(S.user?.modules) ? S.user.modules : []; }
function hasMod(id){ return isAdmin() || userModules().indexOf(id) !== -1; }

/* ---------- NAV ---------- */
function nav(){
  const all = [
    {id:'dashboard', label:'Dashboard',   mod:null,       section:'Main'},
    {id:'products',  label:'Products',    mod:'products', section:'Inventory'},
    {id:'inward',    label:'Inward',      mod:'products', section:'Inventory'},
    {id:'dc',        label:'New Delivery Challan', mod:'sales', section:'Sales'},
    {id:'dchistory', label:'DC History',  mod:'sales',    section:'Sales'},
    {id:'invoices',  label:'New Invoice', mod:'sales',    section:'Sales'},
    {id:'ivhistory', label:'Invoice History', mod:'sales', section:'Sales'},
    {id:'quotations', label:'New Quotation', mod:'sales', section:'Sales'},
    {id:'qthistory', label:'Quotation History', mod:'sales', section:'Sales'},
    {id:'accounts',  label:'Accounts / Payments', mod:'accounts', section:'Accounts'},
    {id:'customers', label:'Customers',   mod:'parties',  section:'Parties'},
    {id:'suppliers', label:'Suppliers',   mod:'parties',  section:'Parties'},
    {id:'reports',   label:'Reports',     mod:'reports',  section:'Reports'},
    {id:'settings',  label:'Settings',    mod:null,       section:'System'}
  ];
  if (isAdmin()) all.push({id:'users', label:'Users / Staff', mod:null, section:'System'});

  const items = all.filter(x => x.mod === null || hasMod(x.mod));

  const sections = [];
  items.forEach(it => {
    let sec = sections.find(s => s.name === it.section);
    if (!sec) { sec = {name: it.section, items: []}; sections.push(sec); }
    sec.items.push(it);
  });

  const icons = {
    dashboard:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    products:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
    inward:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 21h14"/></svg>',
    dc:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    dchistory:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    invoices:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>',
    ivhistory:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    quotations:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l3 3v17H6z"/><path d="M14 2v4h4"/><path d="M9 11h6M9 15h6M9 19h4"/></svg>',
    qthistory:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    accounts:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    customers:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    suppliers:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    reports:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    settings:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg>',
    users:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>'
  };

  $('nav').innerHTML = sections.map(sec =>
    `<div class="nav-section">${sec.name}</div>` +
    sec.items.map(it =>
      `<button class="navbtn" onclick="showPage('${it.id}',this)">
         <span class="nav-icon">${icons[it.id]||''}</span>
         <span class="nav-label">${it.label}</span>
       </button>`
    ).join('')
  ).join('');

  // Default: Dashboard if available, otherwise the first item
  if (!document.querySelector('.navbtn.active')) {
    const first = items.find(x => x.id === 'dashboard') || items[0];
    if (first) {
      const btn = document.querySelector(`.navbtn[onclick*="'${first.id}'"]`);
      if (btn) showPage(first.id, btn);
    }
  }
}

/* ---------- JSONP + API ---------- */
function jsonpRequest(url, payload){
  return new Promise(function(resolve){
    var cb = 'sfs_cb_' + Date.now() + '_' + Math.floor(Math.random()*100000),
        script = document.createElement('script'), done = false;
    window[cb] = function(data){ done = true; cleanup(); resolve(data); };
    function cleanup(){
      try { delete window[cb]; } catch(e){ window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    script.onerror = function(){ if(done) return; done = true; cleanup(); resolve({ok:false, error:'Connection error.'}); };
    var params = new URLSearchParams();
    params.set('action', payload.action || '');
    params.set('callback', cb);
    var copy = Object.assign({}, payload);
    delete copy.action;
    if (copy.session) params.set('session', copy.session);
    delete copy.session;
    if (Object.keys(copy).length) params.set('data', encodeURIComponent(JSON.stringify(copy)));
    script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + params.toString();
    document.head.appendChild(script);
    setTimeout(function(){ if(!done){ done = true; cleanup(); resolve({ok:false, error:'Connection timeout.'}); } }, 15000);
  });
}

let SFS_BUSY = 0, SFS_BOOTING = false, SFS_EXPIRED = false;
function setBusy(delta){
  SFS_BUSY = Math.max(0, SFS_BUSY + delta);
  const b = $('busy');
  if (b) b.classList.toggle('hidden', SFS_BUSY === 0);
}
function sessionExpired(){
  if (SFS_EXPIRED) return;
  SFS_EXPIRED = true;
  sessionStorage.clear();
  alert('Your session has expired. Please sign in again.');
  location.reload();
}

async function api(action, data = {}){
  if (!S.api) return {ok:false, error:'Backend URL not configured'};
  var payload = Object.assign({action:action, session:S.session||''}, data||{});
  setBusy(1);
  try {
    var result = null;
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, 60000) : null;
    try {
      var r = await fetch(S.api, {
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      });
      var text = await r.text();
      try { result = JSON.parse(text); } catch(e){ result = null; }
      if (!result) result = {ok:false, error:'The server returned an unexpected response. Please try again.'};
    } catch(e){
      console.warn('POST failed', e);
      /* JSONP fallback is only for read-only bootstrap. Login/write requests are never sent through GET
         (prevents passwords from appearing in URLs). Set ALLOW_JSONP_LOGIN:true in config to enable the login fallback. */
      if (action === 'bootstrap') result = await jsonpRequest(S.api, payload);
      else if (action === 'login' && window.SFS_CONFIG && window.SFS_CONFIG.ALLOW_JSONP_LOGIN === true) result = await jsonpRequest(S.api, payload);
      else result = {ok:false, error:'Connection error. Please check your internet connection and try again.'};
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (result && result.error === 'Unauthorized' && action !== 'login' && action !== 'logout' && S.session && !SFS_BOOTING) sessionExpired();
    return result;
  } finally {
    setBusy(-1);
  }
}

/* Datalists (customer / product / supplier autocomplete) — clist and mlist were previously undefined */
function syncDatalists(){
  let host = $('sfsLists');
  if (!host) {
    host = document.createElement('div');
    host.id = 'sfsLists';
    host.style.display = 'none';
    document.body.appendChild(host);
  }
  const opts = arr => arr.map(v => `<option value="${esc(v)}">`).join('');
  const activeOnly = x => String(x.Status || 'Active').toLowerCase() !== 'inactive';
  const activeProds = S.products.filter(activeOnly).map(p => p['Model / Part No.']);
  host.innerHTML =
    `<datalist id="clist">${opts(S.customers.filter(activeOnly).map(c => c['Customer Name']))}</datalist>` +
    `<datalist id="suplist">${opts(S.suppliers.filter(activeOnly).map(s => s['Supplier Name']))}</datalist>` +
    `<datalist id="mlist">${opts(activeProds)}</datalist>` +
    `<datalist id="ml">${opts(activeProds)}</datalist>` +
    `<datalist id="ivml">${opts(S.products.map(p => p['Model / Part No.']))}</datalist>`;
}

/* ---------- CAPTCHA ---------- */
let SFS_CAPTCHA_ANSWER = 0;
function generateCaptcha(){
  const a = 1 + Math.floor(Math.random()*9);
  const b = 1 + Math.floor(Math.random()*9);
  SFS_CAPTCHA_ANSWER = a + b;
  const lbl = $('captchaLabel');
  if (lbl && lbl.childNodes[0]) lbl.childNodes[0].textContent = `What is ${a} + ${b}? `;
  const ans = $('captchaAnswer');
  if (ans) ans.value = '';
}

/* ---------- LOGIN ---------- */
let SFS_LOGGING_IN = false;
async function login(){
  const user = $('loginUser').value.trim();
  const pass = $('loginPass').value;
  const captcha = Number($('captchaAnswer')?.value);

  if (!user || !pass) { $('loginError').textContent = 'Username and password are required.'; return; }
  if (isNaN(captcha)) { $('loginError').textContent = 'Please answer the security check.'; return; }
  if (captcha !== SFS_CAPTCHA_ANSWER) { $('loginError').textContent = 'Security check answer is incorrect.'; generateCaptcha(); return; }

  S.api = DEFAULT_API;
  if (!S.api) { $('loginError').textContent = 'System connection is not configured.'; return; }
  if (SFS_LOGGING_IN) return;

  $('loginError').textContent = 'Signing in...';
  SFS_LOGGING_IN = true;
  let r;
  try { r = await api('login', {username:user, password:pass}); } finally { SFS_LOGGING_IN = false; }
  if (!r.ok) { $('loginError').textContent = r.error || 'Invalid username or password'; generateCaptcha(); return; }

  SFS_EXPIRED = false;
  $('loginPass').value = '';
  $('loginError').textContent = '';
  S.session = r.session;
  S.user = r.user;
  sessionStorage.sfsSession = S.session;
  sessionStorage.sfsUser = JSON.stringify(S.user || {});
  enter();
}

async function enter(){
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('who').textContent = S.user.name;
  $('role').textContent = S.user.role;
  nav();
  await refresh();
}

async function logout(){
  const tok = S.session;
  S.session = '';
  if (tok && S.api) {
    /* Pehle server par session khatam karo (reload ke saath request cancel na ho) */
    try {
      await Promise.race([
        fetch(S.api, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({action:'logout', session:tok}), keepalive:true}),
        new Promise(res => setTimeout(res, 2500))
      ]);
    } catch(e){}
  }
  sessionStorage.clear();
  localStorage.removeItem('sfsSession');
  localStorage.removeItem('sfsUser');
  location.reload();
}

async function refresh(){
  const r = await api('bootstrap');
  if (!r.ok){
    if (r.error === 'Unauthorized') { logout(); return; }
    toast(r.error || 'Could not load data', true);
    return;
  }
  S.user = r.user;
  S.products = r.products || [];
  S.customers = r.customers || [];
  S.suppliers = r.suppliers || [];
  S.tx = r.transactions || [];
  syncDatalists();
  nav();
  renderCurrent();
}

function renderCurrent(){
  const active = document.querySelector('.navbtn.active');
  if (active) {
    const m = active.getAttribute('onclick')?.match(/'([^']+)'/);
    showPage(m ? m[1] : 'dashboard', active);
  }
}

/* ---------- PAGE ROUTER ---------- */
function showPage(p, btn){
  document.querySelectorAll('.navbtn').forEach(x => x.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const label = btn ? (btn.querySelector('.nav-label')?.textContent || btn.textContent) : p;
  $('pageTitle').textContent = label;

  if (!pages[p]) { $('content').innerHTML = '<div class="wrap"><div class="panel">Page not found.</div></div>'; return; }
  $('content').innerHTML = pages[p]();

  if (p === 'dashboard')  renderDashboard();
  if (p === 'products')   renderProducts();
  if (p === 'inward')     renderInward();
  if (p === 'dc')         renderDC();
  if (p === 'dchistory')  renderDCHistory();
  if (p === 'invoices')   renderInvoice();
  if (p === 'ivhistory')  renderIVHistory();
  if (p === 'accounts')   renderAccounts();
  if (p === 'customers')  renderCustomers();
  if (p === 'suppliers')  renderSuppliers();
  if (p === 'reports')    renderReports();
  if (p === 'settings')   renderSettings();
  if (p === 'users')      renderUsers();
}

/* ---------- PAGES ---------- */
const pages = {
  dashboard:()=>`<div class="wrap" id="dash"></div>`,
  products:()=>`<div class="wrap"><div class="toolbar"><input id="ps" placeholder="Search model / description / location" oninput="renderProducts()"><select id="pc" onchange="renderProducts()"><option value="">All Categories</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select><button class="btn primary" onclick="productForm()">+ Add Product</button><button class="btn" onclick="bulkProductForm()">+ Bulk Add</button></div><div class="panel table-wrap"><table><thead><tr><th>Image</th><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Location</th><th>Stock</th></tr></thead><tbody id="prows"></tbody></table></div></div>`,
  inward:()=>`<div class="wrap"><div class="panel"><h3>Inward / Local Purchase</h3><div class="form-grid"><label>Date<input id="idate" type="date"></label><label>Source Type<select id="itype"><option>Local Purchase</option><option>Import</option><option>Opening</option><option>Customer Return</option></select></label><label>Model / Part No.<input id="imodel" list="mlist"></label><label>Quantity<input id="iqty" type="number" min="0" step="any"></label><label>Supplier<input id="isupplier" list="suplist"></label><label>Supplier Reference<input id="iref"></label><label>Purchase Cost (total Rs.)<input id="icost" type="number" min="0" step="0.01"></label><label>Remarks<input id="irem"></label></div><button class="btn primary" onclick="saveInward()">Save Inward</button><button class="btn" onclick="bulkInwardForm()">+ Bulk Inward / Import</button></div></div>`,
  dc:()=>`<div class="wrap"><div class="panel"><h3 id="dcTitle">Delivery Challan</h3><div id="dcEditBanner"></div><div class="form-grid"><label>Challan #<input id="dcno" placeholder="Auto"></label><label>Date<input id="dcdate" type="date"></label><label>Customer<input id="dccust" list="clist" onchange="pickCustomer('dc')"></label><label>Customer ID<input id="dcid"></label><label>PO #<input id="dcpo"></label><label>PO Date<input id="dcpodate" type="date"></label><label>STN<input id="dcstn"></label><label>NTN<input id="dcntn"></label><label class="wide">Address<textarea id="dcaddr"></textarea></label></div><div class="panel"><button class="btn small" onclick="addDc()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Unit</th><th></th></tr></thead><tbody id="dclines"></tbody></table></div></div><div class="actions"><button class="btn primary" onclick="saveDC(false)">Save DC</button><button class="btn ghost" onclick="saveDC(true)">Save &amp; Print</button></div></div></div>`,
  dchistory:()=>`<div class="wrap"><div class="toolbar"><input id="dchSearch" placeholder="Search Challan #, Customer, PO #, Model..." oninput="filterDCHistory()" style="flex:1;min-width:280px"><button class="btn" onclick="loadDCHistory()">↻ Refresh</button></div><div class="panel table-wrap"><table><thead><tr><th>Challan #</th><th>Date</th><th>Customer</th><th>PO #</th><th>Items</th><th>Total Qty</th><th>Actions</th></tr></thead><tbody id="dchRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>`,
  invoices:()=>`<div class="wrap"><div class="panel"><h3>Invoice</h3><div class="form-grid"><label>Invoice #<input id="ivno" placeholder="Auto"></label><label>Date<input id="ivdate" type="date"></label><label>Customer<input id="ivcust" list="clist" onchange="pickCustomer('iv')"></label><label>Customer ID<input id="ivcid"></label><label>PO #<input id="ivpo"></label><label>PO Date<input id="ivpodate" type="date"></label><label>Delivery Challan #<span style="display:flex;gap:6px"><input id="ivdc" style="flex:1" placeholder="DC-000001, DC-000002"><button type="button" class="btn small" onclick="loadDcIntoInvoice()">Load DC(s)</button></span></label><label>DC Date<input id="ivdcdate" type="date"></label><label>STN<input id="ivstn"></label><label>NTN<input id="ivntn"></label><label>GST %<input id="ivgst" type="number" min="0" max="100" step="0.01" value="18" oninput="updateIvTotals()"></label></div><div class="panel"><button class="btn small" onclick="addInv()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead><tbody id="ivlines"></tbody></table></div><h3 class="right">Subtotal: <span id="ivtotal">0.00</span></h3><h3 class="right">GST: <span id="ivgstamt">0.00</span> &nbsp; Total: <span id="ivgrand">0.00</span></h3></div><div class="actions"><button class="btn primary" onclick="saveInvoice(false)">Save Invoice</button><button class="btn ghost" onclick="saveInvoice(true)">Save &amp; Print</button></div></div></div>`,
  ivhistory:()=>`<div class="wrap"><div class="toolbar"><input id="ivhSearch" placeholder="Search Invoice #, Customer, DC #, PO #, Model..." oninput="filterIVHistory()" style="flex:1;min-width:280px"><button class="btn" onclick="loadIVHistory()">↻ Refresh</button></div><div class="panel table-wrap"><table><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>DC #</th><th>PO #</th><th>Total</th><th>Actions</th></tr></thead><tbody id="ivhRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>`,

  quotations:()=>`<div class="wrap"><div class="panel"><h3>Quotation</h3><div class="form-grid"><label>Quotation #<input id="qtno" placeholder="Auto"></label><label>Date<input id="qtdate" type="date"></label><label>Customer<input id="qtcustomer" list="clist" onchange="pickQuotationCustomer()"></label><label>Customer ID<input id="qtcustomerId" readonly></label><label class="wide">Address<input id="qtaddress"></label><label>Enquiry #<input id="qtenquiry"></label><label>Enquiry Date<input id="qtpoDate" type="date"></label><label>Validity<input id="qtvalidity" value="30 Days"></label><label>STN<input id="qtstn"></label><label>NTN<input id="qtnTN"></label></div><div class="table-wrap"><table><thead><tr><th>Model / Part No.</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th></th></tr></thead><tbody id="qtlines"></tbody></table></div><div style="margin-top:12px"><button class="btn" onclick="addQuotationLine()">+ Add Item</button></div><div id="qttotal" style="text-align:right;font-weight:bold;margin-top:12px">TOTAL: 0.00</div><div style="margin-top:14px"><button class="btn primary" onclick="saveQuotation()">Save Quotation</button><button class="btn" onclick="printQuotationFromForm()">Print</button></div></div></div>`,
  qthistory:()=>`<div class="wrap"><div class="toolbar"><input id="qts" placeholder="Search quotation # / customer / PO" oninput="filterQTHistory()"><button class="btn" onclick="loadQTHistory()">Refresh</button></div><div class="panel table-wrap"><table><thead><tr><th>Quotation #</th><th>Date</th><th>Customer</th><th>PO #</th><th>Total</th><th>Actions</th></tr></thead><tbody id="qtrows"><tr><td colspan="6">Loading...</td></tr></tbody></table></div></div>`,  accounts:()=>`<div class="wrap">
<div class="panel"><div class="panel-head"><h3>Customer Outstanding</h3><button class="btn" onclick="loadAccounts()">↻ Refresh</button></div><div class="toolbar"><input id="custOutSearch" type="search" placeholder="Search invoice #, customer, amount, date…" oninput="filterCustOut()" style="flex:1;min-width:260px"><span id="custOutInfo" class="muted small"></span></div><div class="table-wrap"><table><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Outstanding</th><th></th></tr></thead><tbody id="custOutRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>
<div class="panel"><div class="panel-head"><h3>Customer Payments</h3><span id="custPayInfo" class="muted small"></span></div><div class="toolbar"><input id="custPaySearch" type="search" placeholder="Search invoice #, reference, customer, method, amount, date…" oninput="filterCustPay()" style="flex:1;min-width:260px"><button class="btn small ghost" onclick="clearPaySearch()">Clear</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Invoice #</th><th>Customer</th><th>Amount</th><th>Method</th><th>Reference</th><th>Remarks</th></tr></thead><tbody id="custPayRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>
<div class="panel"><div class="panel-head"><h3>Supplier Payable</h3><button class="btn" onclick="loadAccounts()">↻ Refresh</button></div><div class="table-wrap"><table><thead><tr><th>Supplier</th><th>Purchased</th><th>Paid</th><th>Outstanding</th><th></th></tr></thead><tbody id="supOutRows"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table></div></div>
<div class="panel"><h3>Recent Supplier Payments</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Supplier</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody id="supPayRows"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table></div></div>
</div>`,
  customers:()=>`<div class="wrap"><div class="panel-head"><h3>Customers</h3><button class="btn primary" onclick="partyForm('Customer')">+ Add Customer</button></div><div class="panel"><div id="customers"></div></div></div>`,
  suppliers:()=>`<div class="wrap"><div class="panel-head"><h3>Suppliers</h3><button class="btn primary" onclick="partyForm('Supplier')">+ Add Supplier</button></div><div class="panel"><div id="suppliers"></div></div></div>`,
  reports:()=>`<div class="wrap"><div class="toolbar"><select id="ry" onchange="renderReports()"></select><button class="btn" onclick="renderReports()">Refresh</button></div><div id="reports"></div></div>`,
  settings:()=>`<div class="wrap"><div class="panel"><h3>System Settings</h3><p class="muted">Original live inventory is read-only. This software writes only to its separate database.</p><p class="muted">Backend connection is configured in config.js (it cannot be changed here).</p><div class="actions"><button class="btn" onclick="changePasswordForm()">Change My Password</button>${isAdmin()?'<button class="btn" onclick="refreshSource()">Refresh Source Snapshot</button>':''}</div></div></div>`,
  users:()=>`<div class="wrap"><div class="panel-head"><h3>Users / Staff</h3><button class="btn primary" onclick="userForm()">+ Add Staff</button></div><div class="panel"><div id="users"></div></div></div>`
};

/* ---------- DASHBOARD ---------- */
function donutChart(data, size){
  size = size || 168;
  const total = data.reduce((a,d) => a + d.value, 0) || 1;
  const r = size*0.34, cx = size/2, cy = size/2, circ = 2*Math.PI*r;
  let offset = 0;
  const segs = data.map(d => {
    const frac = d.value/total;
    const len = Math.max(frac*circ - 1.5, 0);
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${size*0.135}" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>`;
    offset += frac*circ;
    return seg;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F0F2F5" stroke-width="${size*0.135}"/>${segs}<text x="${cx}" y="${cy-3}" text-anchor="middle" font-size="${size*0.16}" font-weight="700" fill="#0B1B2B" font-family="Barlow Semi Condensed,Arial">${total.toLocaleString()}</text><text x="${cx}" y="${cy+size*0.11}" text-anchor="middle" font-size="${size*0.065}" fill="#5B6B80" font-family="Inter,Arial">units</text></svg>`;
}

function openLowStock(){
  const low=S.products.filter(p=>Number(p.currentStock)<=reorderOf(p)&&(p.Status||'Active')==='Active').sort((a,b)=>Number(a.currentStock||0)-Number(b.currentStock||0));
  $('dash').innerHTML=`<div class="panel"><div class="panel-head"><div><h3 style="margin:0;color:#c0392b">⚠ Low Stock Items</h3><div class="muted">${low.length} active items need attention</div></div><button class="btn ghost small" onclick="renderDashboard()">← Dashboard</button></div>
  <div class="toolbar" style="margin-top:16px"><input id="lowStockSearch" placeholder="Search model / description / category / location" oninput="filterLowStock()" style="flex:1;min-width:280px"><select id="lowStockCategory" onchange="filterLowStock()"><option value="">All Categories</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select></div>
  <div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Category</th><th>Location</th><th>Current Stock</th><th>Reorder Level</th><th>Status</th></tr></thead><tbody id="lowStockRows">${lowStockRowsHtml(low)}</tbody></table></div></div>`;
}
function lowStockRowsHtml(list){
 return list.map(p=>`<tr><td><a class="model-link" onclick="productDetail('${encA(p['Model / Part No.'])}')">${esc(p['Model / Part No.'])}</a></td><td>${esc(p.Description)}</td><td>${esc(p.Category)}</td><td>${esc(p.Location)}</td><td style="color:#c0392b"><b>${p.currentStock}</b></td><td>${reorderOf(p)}</td><td><b style="color:${Number(p.currentStock)<=0?'#c0392b':'#d97706'}">${Number(p.currentStock)<=0?'Out of Stock':'Low Stock'}</b></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No low stock items found.</td></tr>';
}
function filterLowStock(){
 const q=norm($('lowStockSearch')?.value), cat=$('lowStockCategory')?.value||'';
 const low=S.products.filter(p=>Number(p.currentStock)<=reorderOf(p)&&(p.Status||'Active')==='Active').filter(p=>!cat||p.Category===cat).filter(p=>!q||[p['Model / Part No.'],p.Description,p.Category,p.Location].some(v=>norm(v).includes(q))).sort((a,b)=>Number(a.currentStock||0)-Number(b.currentStock||0));
 $('lowStockRows').innerHTML=lowStockRowsHtml(low);
}
function renderDashboard(){
  const lowStock = S.products.filter(p => Number(p.currentStock) <= reorderOf(p) && (p.Status||'Active')==='Active');
  const catData = CATS.map((c,i) => ({
    label:c,
    value:S.products.filter(p=>p.Category===c).reduce((a,p)=>a+(+p.currentStock||0),0),
    count:S.products.filter(p=>p.Category===c).length,
    color:CHART_PALETTE[i%CHART_PALETTE.length]
  })).filter(d => d.count > 0);
  const catTotal = catData.reduce((a,d)=>a+d.value,0) || 1;

  $('dash').innerHTML = `
    <div class="cards">
      <div class="card"><span>Products</span><strong>${S.products.length}</strong></div>
      <div class="card"><span>Current Stock</span><strong>${S.products.reduce((a,x)=>a+(+x.currentStock||0),0).toLocaleString()}</strong></div>
      <div class="card"><span>Customers</span><strong>${S.customers.length}</strong></div>
      <div class="card"><span>Suppliers</span><strong>${S.suppliers.length}</strong></div>
      <div class="card" style="${lowStock.length?'border-color:#c0392b':''}"><span>⚠ Low Stock</span><strong style="${lowStock.length?'color:#c0392b':''}">${lowStock.length}</strong></div>
    </div>
    ${lowStock.length ? `<div class="panel">
      <div class="panel-head">
        <div><h3 class="section-title" style="color:#c0392b;margin-bottom:3px">⚠ Low Stock Items</h3><div class="muted">${lowStock.length} item${lowStock.length===1?'':'s'} need attention</div></div>
        <button class="btn small" onclick="openLowStock()">View All →</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Current Stock</th><th>Reorder Level</th></tr></thead>
      <tbody>${lowStock.slice(0,8).map(p=>`<tr><td><a class="model-link" onclick="productDetail('${encA(p['Model / Part No.'])}')">${esc(p['Model / Part No.'])}</a></td><td>${esc(p.Description)}</td><td style="color:#c0392b"><b>${p.currentStock}</b></td><td>${reorderOf(p)}</td></tr>`).join('')}</tbody></table></div>
      ${lowStock.length>8 ? `<div style="text-align:center;margin-top:12px"><button class="btn ghost small" onclick="openLowStock()">View all ${lowStock.length} low stock items</button></div>` : ''}
    </div>` : ''}
    <div class="panel"><h3>Stock by Category</h3>
      <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:center">
        <div>${donutChart(catData)}</div>
        <div style="flex:1;min-width:220px;display:flex;flex-direction:column;gap:10px">
          ${catData.map(d=>`<div style="display:flex;align-items:center;gap:10px"><span style="width:11px;height:11px;border-radius:3px;background:${d.color};flex:0 0 auto"></span><span style="flex:1;font-size:13.5px">${esc(d.label)}</span><span style="font-weight:700;font-size:13.5px">${d.value.toLocaleString()}</span><span style="color:var(--steel);font-size:12px;width:42px;text-align:right">${Math.round(d.value/catTotal*100)}%</span></div>`).join('') || '<div class="muted">No stock data yet.</div>'}
        </div>
      </div>
    </div>
    <div id="salesSummarySection"><div class="panel"><div class="muted">Loading sales summary…</div></div></div>`;
  loadSalesSummary();
}

async function loadSalesSummary(){
  if (!hasMod('reports')) { const h = $('salesSummarySection'); if (h) h.innerHTML = ''; return; }
  const currentYear = new Date().getFullYear();
  /* Show previous 2 years + current year + next 3 years so Admin can
     enter a future annual target before that year starts. */
  const years = Array.from({length:6}, (_,i) => currentYear - 2 + i);
  const results = await Promise.all(years.map(year => api('getSalesSummary', {year})));
  const host = $('salesSummarySection');
  if (!host) return;

  const summaries = results.map((r,i) => r.ok ? {...r, year: years[i]} : null).filter(Boolean);
  if (!summaries.length) { host.innerHTML = ''; return; }

  window.SALES_YEAR_SUMMARIES = summaries;
  window.SALES_SELECTED_YEAR = currentYear;

  host.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>Year-wise Sales Target</h3>
        <select id="salesYearSelect" class="input" style="width:auto;min-width:130px" onchange="changeSalesTargetYear(this.value)">
          ${summaries.map(r => `<option value="${r.year}" ${r.year===currentYear?'selected':''}>${r.year}</option>`).join('')}
        </select>
      </div>
      <div id="selectedYearSalesTarget"></div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h3 id="topCustomersYearTitle">Top Customers by Sales (${currentYear})</h3>
      </div>
      <div id="selectedYearTopCustomers"></div>
    </div>`;

  renderSelectedSalesYear(currentYear);
}

function changeSalesTargetYear(year){
  year = Number(year);
  window.SALES_SELECTED_YEAR = year;
  renderSelectedSalesYear(year);
}

function renderSelectedSalesYear(year){
  const summaries = window.SALES_YEAR_SUMMARIES || [];
  let r = summaries.find(x => Number(x.year) === Number(year));
  if (!r) {
    /* Future years may not have been loaded yet. Fetch the selected year
       directly; backend already supports saving targets for any year. */
    api('getSalesSummary', {year:Number(year)}).then(res => {
      if (!res || !res.ok) return toast(res && res.error || 'Could not load sales target.', true);
      const idx = summaries.findIndex(x => Number(x.year) === Number(year));
      if (idx >= 0) summaries[idx] = {...res, year:Number(year)};
      else summaries.push({...res, year:Number(year)});
      window.SALES_YEAR_SUMMARIES = summaries;
      renderSelectedSalesYear(Number(year));
    });
    return;
  }

  const targetHost = $('selectedYearSalesTarget');
  const customerHost = $('selectedYearTopCustomers');
  const title = $('topCustomersYearTitle');
  if (!targetHost || !customerHost) return;

  const pct = r.target > 0 ? Math.round(r.totalSales / r.target * 100) : 0;
  const remaining = r.target > 0 ? Math.max(0, r.target - r.totalSales) : 0;

  targetHost.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:13px;color:var(--steel)">Sales Target — ${r.year}</div>
        <div style="font-size:24px;font-weight:700;margin-top:3px">${money(r.target)}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;color:var(--steel)">Actual Sale</div>
        <div style="font-size:24px;font-weight:700;margin-top:3px">${money(r.totalSales)}</div>
      </div>
    </div>

    ${r.target > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px">
        <span>Achievement</span><b>${pct}%</b>
      </div>
      <div style="background:#F0F2F5;border-radius:20px;height:14px;overflow:hidden">
        <div style="width:${Math.min(100,pct)}%;height:100%;background:linear-gradient(90deg,#3B5BDB,#10B981);border-radius:20px"></div>
      </div>
      <div style="margin-top:7px;font-size:12.5px;color:var(--steel)">
        ${r.totalSales >= r.target ? 'Target reached' : money(remaining) + ' remaining'}
      </div>
    ` : `
      <div class="muted">No sales target set for ${r.year} yet.</div>
    `}

    ${isAdmin() ? `<div style="margin-top:14px">
      <button class="btn small" onclick="setTargetForm(${r.year},${r.target})">${r.target > 0 ? 'Edit Target' : 'Set Target'}</button>
    </div>` : ''}`;

  title.textContent = `Top Customers by Sales (${r.year})`;

  const top = (r.customerSales || []).slice(0,8);
  const maxAmt = Math.max(...top.map(c => Number(c.amount)||0), 1);

  customerHost.innerHTML = top.length ? `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${top.map(c => `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px">
            <span>${esc(c.customer)}</span><b>${money(c.amount)}</b>
          </div>
          <div style="background:#F0F2F5;border-radius:6px;height:9px;overflow:hidden">
            <div style="width:${((Number(c.amount)||0)/maxAmt*100)}%;height:100%;background:var(--brand);border-radius:6px"></div>
          </div>
        </div>`).join('')}
    </div>` : '<div class="muted">No invoice sales recorded for this year.</div>';
}


function setTargetForm(year, current){
  modal('Set Sales Target — ' + year,
    `<div class="form-grid">
       <label>Year<input id="tgyear" value="${year}" readonly></label>
       <label>Target Amount (Rs.)<input id="tgamt" type="number" value="${current||''}"></label>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Cancel</button>
       <button class="btn primary" onclick="saveTargetSubmit()">Save Target</button>
     </div>`);
}

async function saveTargetSubmit(){
  const r = await api('saveTarget', {year:$('tgyear').value, amount:$('tgamt').value});
  if (!r.ok) return toast(r.error, true);
  closeModal();
  toast('Sales target updated.');
  loadSalesSummary();
}

/* ---------- PRODUCTS ---------- */
function renderProducts(){
  let q = ($('ps')?.value||'').toLowerCase(), c = $('pc')?.value||'';
  let a = S.products.filter(p => [p['Model / Part No.'],p.Description,p.Location].join(' ').toLowerCase().includes(q) && (!c || p.Category === c));
  $('prows').innerHTML = a.slice(0,1000).map(p => {
    const low = Number(p.currentStock) <= reorderOf(p);
    return `<tr ${low?'style="background:#fbeae8"':''}>
       <td>${p['Product Image']?`<img class="thumb" src="${esc(p['Product Image'])}">`:'—'}</td>
       <td><a class="model-link" onclick="productDetail('${encA(p['Model / Part No.'])}')">${esc(p['Model / Part No.'])}</a></td>
       <td>${esc(p.Description)}</td>
       <td>${esc(p.Category)}</td>
       <td>${esc(p.Location)}</td>
       <td>${low?'<b style="color:#c0392b">':''}${p.currentStock}${low?' ⚠</b>':''}</td>
     </tr>`;
  }).join('') || '<tr><td colspan="6" class="empty">No products found.</td></tr>';
}

function productDetail(em){
  const m = decodeURIComponent(em), p = S.products.find(x => x['Model / Part No.'] === m);
  if (!p) return;
  const status = p.Status||'Active';
  const low = Number(p.currentStock) <= reorderOf(p);

  modal('Product Details — ' + m,
    `<div class="detail">
       <div>${p['Product Image']?`<img src="${esc(p['Product Image'])}">`:'No image'}</div>
       <div class="detail-grid">
         <div class="kv"><b>Model</b>${esc(p['Model / Part No.'])}</div>
         <div class="kv"><b>Description</b>${esc(p.Description)}</div>
         <div class="kv"><b>Category</b>${esc(p.Category)}</div>
         <div class="kv"><b>Location</b>${esc(p.Location)}</div>
         <div class="kv"><b>Current Stock</b>${p.currentStock}${low?' <span style="color:#c0392b">⚠ Low Stock</span>':''}</div>
         <div class="kv"><b>Reorder Level</b>${reorderOf(p)}</div>
         <div class="kv"><b>Sale Price</b>${esc(p['Sale Price'])}</div>
         <div class="kv"><b>Status</b>${esc(status)}</div>
       </div>
     </div>
     <div class="actions">
       <button class="btn" onclick="editProductForm('${encA(m)}')">Edit</button>
       <button class="btn" onclick="showProductHistory('${encA(m)}')">Product History</button>
       ${isAdmin()?`<button class="btn danger" onclick="toggleProductStatus('${encA(m)}','${status==='Active'?'Inactive':'Active'}')">${status==='Active'?'Deactivate':'Activate'}</button>`:''}
     </div>`);
}

async function showProductHistory(em){
  const m = decodeURIComponent(em);
  modal('Product History — '+m, '<p class="muted">Loading…</p>');
  const r = await api('stockMovement', {model:m});
  if (!r.ok) { $('modalBody').innerHTML = '<p class="muted">'+esc(r.error||'Could not load history.')+'</p>'; return; }

  const rows = (r.movements||[]).slice(1); // row 0 is the header row
  const inRows = rows.filter(x => String(x[2]||'').toUpperCase()==='IN').sort((a,b)=>new Date(b[1])-new Date(a[1]));
  const outRows = rows.filter(x => String(x[2]||'').toUpperCase()==='OUT').sort((a,b)=>new Date(b[1])-new Date(a[1]));
  const totalIn = inRows.reduce((a,x)=>a+(Number(x[5])||0),0);
  const totalOut = outRows.reduce((a,x)=>a+(Number(x[5])||0),0);
  const fmtRow = x => `<tr><td>${fmtDate(x[1])}</td><td><b>${x[5]}</b></td><td>${esc(x[6])}</td><td>${esc(x[7])}</td><td>${esc(x[8])}</td></tr>`;

  $('modalBody').innerHTML = `
    <h4 style="margin:0 0 8px">Purchases / Imports (IN) — Total: ${totalIn}</h4>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Qty</th><th>Supplier</th><th>Ref Type</th><th>Ref #</th></tr></thead><tbody>${inRows.map(fmtRow).join('')||'<tr><td colspan="5" class="empty">No purchase history yet.</td></tr>'}</tbody></table></div>
    <h4 style="margin:16px 0 8px">Sales (OUT) — Total: ${totalOut}</h4>
    <div class="table-wrap"><table><thead><tr><th>Date</th><th>Qty</th><th>Customer</th><th>Ref Type</th><th>Ref #</th></tr></thead><tbody>${outRows.map(fmtRow).join('')||'<tr><td colspan="5" class="empty">No sales history yet.</td></tr>'}</tbody></table></div>
  `;
}

function editProductForm(em){
  const m = decodeURIComponent(em), p = S.products.find(x => x['Model / Part No.'] === m);
  if (!p) return;
  modal('Edit Product — ' + m,
    `<div class="form-grid">
       <label>Model / Part No.<input value="${esc(m)}" readonly></label>
       <label>Category<select id="epcat">${CATS.map(c=>`<option${c===p.Category?' selected':''}>${c}</option>`).join('')}</select></label>
       <label class="wide">Description<input id="epdesc" value="${esc(p.Description||'')}"></label>
       <label>Brand<input id="epbrand" value="${esc(p.Brand||'')}"></label>
       <label>Unit<input id="epunit" value="${esc(p.Unit||'Pcs')}"></label>
       <label>Location<input id="eploc" value="${esc(p.Location||'')}"></label>
       <label>Cost Price<input id="epcost" type="number" value="${esc(p['Cost Price']||'')}"></label>
       <label>Sale Price<input id="epprice" type="number" value="${esc(p['Sale Price']||'')}"></label>
       <label>Reorder Level<input id="eprlevel" type="number" value="${reorderOf(p)}"></label>
       <label>Product Image<input id="epimg" type="file" accept="image/*"></label>
       <label class="wide">Remarks<textarea id="eprem">${esc(p.Remarks||'')}</textarea></label>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Cancel</button>
       <button class="btn primary" onclick="saveProductEdit('${encA(m)}')">Save Changes</button>
     </div>`);
}

async function saveProductEdit(em){
  const m = decodeURIComponent(em);
  const f = $('epimg').files[0];
  let b = '';
  if (f) b = await file64(f);
  const r = await api('updateProduct', {
    model:m, category:$('epcat').value, description:$('epdesc').value,
    brand:$('epbrand').value, unit:$('epunit').value, location:$('eploc').value,
    costPrice:$('epcost').value, salePrice:$('epprice').value,
    reorderLevel:$('eprlevel').value, remarks:$('eprem').value,
    imageBase64:b, imageName:f?.name
  });
  if (!r.ok) return toast(r.error, true);
  closeModal(); await refresh(); toast('Product updated.');
}

async function toggleProductStatus(em, newStatus){
  const m = decodeURIComponent(em);
  if (!confirm((newStatus==='Inactive'?'Deactivate':'Activate') + ' ' + m + '?')) return;
  const r = await api('setProductStatus', {model:m, status:newStatus});
  if (!r.ok) return toast(r.error, true);
  closeModal(); await refresh();
  toast('Product ' + (newStatus==='Inactive'?'deactivated':'activated') + '.');
}

function productForm(){
  modal('Add Product',
    `<div class="form-grid">
       <label>Model / Part No.<input id="pm"></label>
       <label>Category<select id="pcat">${CATS.map(c=>`<option>${c}</option>`).join('')}</select></label>
       <label class="wide">Description<input id="pdesc"></label>
       <label>Brand<input id="pbrand"></label>
       <label>Unit<input id="punit" value="Pcs"></label>
       <label>Location<input id="ploc"></label>
       <label>Cost Price<input id="pcost" type="number"></label>
       <label>Sale Price<input id="pprice" type="number"></label>
       <label>Opening Stock<input id="pop" type="number" value="0"></label>
       <label>Reorder Level<input id="prlevel" type="number" value="5"></label>
       <label>Product Image<input id="pimg" type="file" accept="image/*"></label>
       <label class="wide">Remarks<textarea id="prem"></textarea></label>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Cancel</button>
       <button class="btn primary" onclick="saveProduct()">Save Product</button>
     </div>`);
}

async function saveProduct(){
  const model = $('pm').value.trim();
  if (!model) return toast('Model / Part No. is required.', true);
  if (findProd(model)) return toast('This product already exists: ' + model, true);
  const op = Number($('pop').value || 0), rl = Number($('prlevel').value || 5);
  if (isNaN(op) || op < 0) return toast('Invalid opening stock.', true);
  if (isNaN(rl) || rl < 0) return toast('Invalid reorder level.', true);
  const f = $('pimg').files[0];
  if (f && f.size > 3*1024*1024) return toast('Image must be smaller than 3MB.', true);
  await guardedSave(async () => {
    let b = '';
    if (f) b = await file64(f);
    const r = await api('saveProduct', {
      model, category:$('pcat').value, description:$('pdesc').value,
      brand:$('pbrand').value, unit:$('punit').value, location:$('ploc').value,
      costPrice:$('pcost').value, salePrice:$('pprice').value,
      openingStock:op, reorderLevel:rl,
      remarks:$('prem').value, imageBase64:b, imageName:f?.name
    });
    if (!r.ok) return toast(r.error, true);
    closeModal(); await refresh(); toast('Product saved.');
  });
}

/* ---------- BULK PRODUCT / INWARD ---------- */
function bulkProductForm(){
  modal('Add Products in Bulk',
    `<div class="muted" style="margin-bottom:10px">Paste CSV/Excel-style rows. Header optional: Model, Description, Category, Brand, Unit, Location, Cost Price, Sale Price, Opening Stock, Reorder Level, Remarks.</div>
     <textarea id="bulkProductsText" style="width:100%;min-height:240px;font-family:monospace" placeholder="MODEL\tDESCRIPTION\tCATEGORY\tBRAND\tUNIT\tLOCATION\tCOST PRICE\tSALE PRICE\tOPENING STOCK\tREORDER LEVEL\tREMARKS"></textarea>
     <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveBulkProducts()">Import Products</button></div>`);
}
function parseBulkRows(text){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  let rows=lines.map(line=>line.split(delim).map(x=>x.trim().replace(/^"(.*)"$/,'$1')));
  const first=rows[0].map(x=>x.toLowerCase());
  if(first[0]==='model' || first[0].includes('model / part no')) rows.shift();
  return rows;
}
async function saveBulkProducts(){
  const rows=parseBulkRows($('bulkProductsText').value);
  if(!rows.length) return toast('Please paste the product data here.',true);
  const items=rows.map((r,i)=>({
    model:r[0]||'', description:r[1]||'', category:r[2]||'Others', brand:r[3]||'',
    unit:r[4]||'Pcs', location:r[5]||'', costPrice:r[6]||'', salePrice:r[7]||'',
    openingStock:r[8]||0, reorderLevel:r[9]||5, remarks:r[10]||''
  }));
  await guardedSave(async()=>{
    // Use the existing server action for each validated row. This keeps bulk add
    // compatible even when the deployed Apps Script has not yet received the
    // optional batch action.
    let saved = 0;
    for (const item of items) {
      const r = await api('saveProduct', item);
      if (!r || !r.ok) return toast((r && r.error) || 'Could not save product: ' + item.model, true);
      saved++;
    }
    closeModal(); await refresh(); toast(saved + ' products added successfully.');
  });
}
function bulkInwardForm(){
  modal('Bulk Inward / Import',
    `<div class="muted" style="margin-bottom:10px">Paste Model + Quantity. One row per item. Header optional. Example: MODEL\tQUANTITY</div>
     <textarea id="bulkInwardText" style="width:100%;min-height:240px;font-family:monospace" placeholder="MODEL\tQUANTITY"></textarea>
     <div class="form-grid">
       <label>Date<input id="bidate" type="date" value="${todayStr()}"></label>
       <label>Source Type<select id="bitype"><option>Import</option><option>Local Purchase</option><option>Opening</option><option>Customer Return</option></select></label>
       <label>Supplier<input id="bisupplier" list="suplist"></label>
       <label>Supplier Reference<input id="biref"></label>
       <label class="wide">Remarks<input id="birem"></label>
     </div>
     <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveBulkInward()">Save All Inward</button></div>`);
}
async function saveBulkInward(){
  const rows=parseBulkRows($('bulkInwardText').value);
  if(!rows.length) return toast('Please paste the inward items data.',true);
  const items=rows.map(r=>({model:r[0]||'',quantity:r[1]||0}));
  await guardedSave(async()=>{
    // Use the existing inward action row-by-row so this works with the
    // currently deployed Apps Script as well as the newer batch backend.
    let saved = 0;
    for (const item of items) {
      const r = await api('saveInward',{
        date:$('bidate').value||todayStr(),
        sourceType:$('bitype').value,
        model:item.model,
        quantity:item.quantity,
        supplier:$('bisupplier').value.trim(),
        supplierReference:$('biref').value,
        remarks:$('birem').value
      });
      if (!r || !r.ok) return toast((r && r.error) || 'Could not save inward item: ' + item.model, true);
      saved++;
    }
    closeModal(); await refresh(); toast(saved + ' inward items saved successfully.');
  });
}

/* ---------- INWARD ---------- */
function renderInward(){
  $('idate').value = todayStr();
}

let SFS_SAVING = false;
async function guardedSave(fn){ if (SFS_SAVING) return; SFS_SAVING = true; try { await fn(); } finally { SFS_SAVING = false; } }

async function saveInward(){
  const prod = findProd($('imodel').value);
  const qty = Number($('iqty').value);
  const cost = $('icost').value;
  const supplier = $('isupplier').value.trim();
  if (!prod) return toast('Product is not in the product list. Please add it to Products first.', true);
  if (!(qty > 0)) return toast('Quantity must be greater than zero.', true);
  if (cost !== '' && !(Number(cost) >= 0)) return toast('Invalid purchase cost.', true);
  if (Number(cost) > 0 && !supplier) {
    if (!confirm('Supplier is empty — this purchase amount will not be included in Supplier Payable. Save anyway?')) return;
  }
  await guardedSave(async () => {
    const r = await api('saveInward', {
      date:$('idate').value || todayStr(), sourceType:$('itype').value, model:prod['Model / Part No.'],
      quantity:qty, supplier:supplier,
      supplierReference:$('iref').value, purchaseCost:cost, remarks:$('irem').value
    });
    if (!r.ok) return toast(r.error, true);
    toast('Inward saved. Stock increased.');
    await refresh();
  });
}

/* ---------- DC ---------- */
let dcl = [], ivl = [];
let EDIT_DC = null;   // {no, oldQty:{model:qty}} when an existing DC is being edited

function renderDC(){ EDIT_DC = null; dcl = []; addDc(); $('dcdate').value = todayStr(); }
function addDc(){ dcl.push({model:'', qty:'', unit:'Pcs'}); renderDcLines(); }

function renderDcLines(){
  if (!$('dclines')) return;
  $('dclines').innerHTML = dcl.map((x,i) => {
    const pr = findProd(x.model);
    return `<tr>
       <td><input value="${esc(x.model)}" list="ml" onchange="dcl[${i}].model=this.value;renderDcLines()"></td>
       <td>${esc(pr ? (pr.Description||'') : '')}${pr ? `<div class="muted small">Stock: ${esc(pr.currentStock)}</div>` : (x.model ? '<div class="muted small" style="color:#c0392b">Product not found</div>' : '')}</td>
       <td><input type="number" min="0" step="any" value="${esc(x.qty)}" onchange="dcl[${i}].qty=this.value"></td>
       <td><input value="${esc(x.unit)}" onchange="dcl[${i}].unit=this.value"></td>
       <td><button class="btn small" onclick="dcl.splice(${i},1);renderDcLines()">×</button></td>
     </tr>`;
  }).join('');
}

/* Automatically populate ID / address / NTN / STN when a customer is selected */
function pickCustomer(kind){
  const c = findCust($(kind === 'dc' ? 'dccust' : 'ivcust').value);
  if (!c) return;
  const set = (id, v) => { const el = $(id); if (el) el.value = v || ''; };
  if (kind === 'dc') {
    set('dcid', c['Customer ID']); set('dcaddr', c.Address); set('dcntn', c['NTN/Tax ID']); set('dcstn', stnOf(c));
  } else {
    set('ivcid', c['Customer ID']); set('ivntn', c['NTN/Tax ID']); set('ivstn', stnOf(c));
  }
}

function checkCustomer(name){
  name = String(name || '').trim();
  if (!name) return {error:'Please enter the customer name.'};
  const c = findCust(name);
  if (!c) {
    if (!confirm('"' + name + '" is not in the Customers list. Add the customer first to keep the Ledger / Outstanding accurate.\n\nSave anyway?')) return {error:'cancel', silent:true};
    return {name:name, cust:null};
  }
  if (String(c.Status || 'Active').toLowerCase() === 'inactive') return {error:'Customer inactive hai: ' + c['Customer Name']};
  return {name:c['Customer Name'], cust:c};
}

/* Merge duplicate products and check cumulative stock */
function collectDcItems(){
  const merged = {}, order = [];
  for (const x of dcl) {
    if (!String(x.model || '').trim() && !(Number(x.qty) > 0)) continue;   // skip empty line
    const pr = findProd(x.model);
    if (!pr) return {error:'Product not found: ' + (x.model || '(blank)')};
    if (String(pr.Status || 'Active').toLowerCase() === 'inactive') return {error:'Inactive product cannot be used: ' + pr['Model / Part No.']};
    const qty = Number(x.qty);
    if (!(qty > 0)) return {error:'Invalid quantity: ' + pr['Model / Part No.']};
    const key = pr['Model / Part No.'];
    if (!merged[key]) { merged[key] = {model:key, desc:pr.Description || '', qty:0, unit:x.unit || pr.Unit || 'Pcs'}; order.push(key); }
    merged[key].qty += qty;
  }
  const items = order.map(k => merged[k]);
  if (!items.length) return {error:'Please add at least one item.'};
  for (const it of items) {
    const pr = findProd(it.model);
    const avail = (Number(pr.currentStock) || 0) + ((EDIT_DC && EDIT_DC.oldQty[it.model]) || 0);
    if (it.qty > avail) return {error:'Insufficient stock: ' + it.model + ' — available ' + avail + ', requested ' + it.qty};
  }
  return {items:items};
}

async function saveDC(print){
  const cu = checkCustomer($('dccust').value);
  if (cu.error) { if (!cu.silent) toast(cu.error, true); return; }
  const col = collectDcItems();
  if (col.error) return toast(col.error, true);
  await guardedSave(async () => {
    const editing = !!EDIT_DC;
    const p = {
      no: editing ? EDIT_DC.no : $('dcno').value.trim(),
      date: $('dcdate').value || todayStr(), customer: cu.name,
      customerId: $('dcid').value || (cu.cust ? cu.cust['Customer ID'] : ''),
      po:$('dcpo').value, poDate:$('dcpodate').value,
      stn:$('dcstn').value, ntn:$('dcntn').value, address:$('dcaddr').value, items: col.items
    };
    const r = await api(editing ? 'updateDC' : 'saveDC', p);
    if (!r.ok) return toast(r.error, true);
    p.no = r.id || p.no;                       // auto-number will also appear on print
    if (print) printDC(p);
    toast(editing ? 'Delivery Challan updated.' : 'Delivery Challan saved and stock reduced.');
    EDIT_DC = null; dcl = [];
    await refresh();
    if ($('dchRows')) loadDCHistory();
  });
}

function editDC(noEnc){
  const no = decodeURIComponent(noEnc);
  const d = DCH_CACHE.find(x => x.no === no);
  if (!d) return;
  if (d.invoiced) return toast('An invoice has already been created for this DC — it cannot be edited.', true);
  const btn = document.querySelector(`.navbtn[onclick*="'dc'"]`);
  showPage('dc', btn);
  const oldQty = {};
  d.items.forEach(x => { oldQty[x.model] = (oldQty[x.model] || 0) + (Number(x.qty) || 0); });
  EDIT_DC = {no:d.no, oldQty:oldQty};
  $('dcno').value = d.no; $('dcno').readOnly = true;
  $('dcdate').value = toInputDate(d.date) || todayStr();
  $('dccust').value = d.customer || ''; $('dcid').value = d.customerId || '';
  $('dcpo').value = d.po || ''; $('dcpodate').value = toInputDate(d.poDate);
  $('dcstn').value = d.stn || ''; $('dcntn').value = d.ntn || ''; $('dcaddr').value = d.address || '';
  dcl = d.items.map(x => ({model:x.model, qty:x.qty, unit:x.unit || 'Pcs'}));
  renderDcLines();
  $('dcTitle').textContent = 'Edit Delivery Challan — ' + d.no;
  $('dcEditBanner').innerHTML = '<div class="muted" style="margin:6px 0 12px">Edit mode: the previous stock deduction will be reversed and the new stock deduction will be applied. <button class="btn small" onclick="cancelEditDC()">Cancel Edit</button></div>';
}
function cancelEditDC(){ EDIT_DC = null; showPage('dc', document.querySelector(`.navbtn[onclick*="'dc'"]`)); }

/* ---------- DC HISTORY ---------- */
let DCH_CACHE = [];
async function loadDCHistory(){
  const tbody = $('dchRows');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
  const [r, ir] = await Promise.all([
    api('getReports', {mode:'docs', type:'DC'}),
    api('getReports', {mode:'docs', type:'INVOICE'})
  ]);
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${esc(r.error||'Could not load history')}</td></tr>`;
    return;
  }
  const invoicedDcs = new Set(ir.ok ? (ir.documents||[]).map(x => String(x.dc||'').trim()).filter(Boolean) : []);
  DCH_CACHE = (r.documents||[]).map(d => {
    const totalQty = d.items.reduce((a,x)=>a+(+x.qty||0), 0);
    return {...d, totalQty, invoiced: invoicedDcs.has(String(d.no).trim()), searchText: [d.no, d.customer, d.customerId, d.po, ...d.items.map(x=>x.model), ...d.items.map(x=>x.desc)].join(' ').toLowerCase()};
  });
  filterDCHistory();
}

function filterDCHistory(){
  const tbody = $('dchRows');
  if (!tbody) return;
  const q = norm($('dchSearch')?.value||'');
  const rows = DCH_CACHE.filter(d => !q || d.searchText.includes(q));
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No Delivery Challans found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(d => `
    <tr>
      <td><b>${esc(d.no)}</b></td>
      <td>${fmtDate(d.date)}</td>
      <td>${esc(d.customer)}</td>
      <td>${esc(d.po||'—')}</td>
      <td>${d.items.length}</td>
      <td>${d.totalQty}</td>
      <td>
        <button class="btn small" onclick="viewDC('${encA(d.no)}')">View</button>
        <button class="btn small" onclick="viewDC('${encA(d.no)}',true)">Print</button>
        ${d.invoiced ? '<span class="muted small">Invoiced</span>' : `<button class="btn small" onclick="editDC('${encA(d.no)}')">Edit</button>`}
      </td>
    </tr>`).join('');
}

function viewDC(noEnc, print){
  const no = decodeURIComponent(noEnc);
  const d = DCH_CACHE.find(x => x.no === no);
  if (!d) return;

  if (print) { printDC(d); return; }

  const rows = d.items.map((x,i) =>
    `<tr>
       <td>${i+1}</td>
       <td>${esc(x.desc||'')}<br><span class="muted">Model: ${esc(x.model)}</span></td>
       <td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{})['Product ID']||'')}</td>
       <td class="right">${x.qty}</td>
       <td>${esc(x.unit||'nos')}</td>
     </tr>`).join('');

  modal('Delivery Challan — ' + d.no,
    `<div class="doc-info">
       <div><b>Date:</b> ${fmtDate(d.date)}</div>
       <div><b>Challan #:</b> ${esc(d.no)}</div>
       <div><b>Customer:</b> ${esc(d.customer)}</div>
       <div><b>Customer ID:</b> ${esc(d.customerId||'—')}</div>
       <div><b>PO #:</b> ${esc(d.po||'—')}</div>
       <div><b>PO Date:</b> ${fmtDate(d.poDate)}</div>
       <div><b>STN:</b> ${esc(d.stn||'—')}</div>
       <div><b>NTN:</b> ${esc(d.ntn||'—')}</div>
     </div>
     <div class="table-wrap">
       <table class="doc-table">
         <thead><tr><th>#</th><th>Description</th><th>Item Code</th><th class="right">Qty</th><th>Unit</th></tr></thead>
         <tbody>${rows}</tbody>
       </table>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Close</button>
       <button class="btn primary" onclick="viewDC('${encA(no)}',true)">Print</button>
     </div>`);
}

/* ---------- INVOICE ---------- */
function renderDCHistory(){
  DCH_CACHE = [];
  loadDCHistory();
}

function renderIVHistory(){
  IVH_CACHE = [];
  loadIVHistory();
}

function renderInvoice(){ ivl = []; addInv(); $('ivdate').value = todayStr(); }
function addInv(){ ivl.push({model:'', qty:'', rate:''}); renderIvLines(); }

function updateIvTotals(){
  const sub = ivl.reduce((a,x) => a + (+x.qty||0)*(+x.rate||0), 0);
  const g = Number($('ivgst')?.value);
  const gst = sub * ((isNaN(g) ? 0 : g) / 100);
  if ($('ivtotal'))  $('ivtotal').textContent  = money(sub);
  if ($('ivgstamt')) $('ivgstamt').textContent = money(gst);
  if ($('ivgrand'))  $('ivgrand').textContent  = money(sub + gst);
}

function renderIvLines(){
  if (!$('ivlines')) return;
  $('ivlines').innerHTML = ivl.map((x,i) => {
    const pr = findProd(x.model);
    return `<tr>
       <td><input value="${esc(x.model)}" list="ivml" onchange="ivModelChanged(${i},this.value)"></td>
       <td>${esc(pr ? (pr.Description||'') : '')}${x.model && !pr ? '<div class="muted small" style="color:#c0392b">Product not found</div>' : ''}</td>
       <td><input type="number" min="0" step="any" value="${esc(x.qty)}" onchange="ivl[${i}].qty=this.value;renderIvLines()"></td>
       <td><input type="number" min="0" step="any" value="${esc(x.rate)}" onchange="ivl[${i}].rate=this.value;renderIvLines()"></td>
       <td>${money((+x.qty||0)*(+x.rate||0))}</td>
       <td><button class="btn small" onclick="ivl.splice(${i},1);renderIvLines()">×</button></td>
     </tr>`;
  }).join('');
  updateIvTotals();
}

/* When a model is selected and the rate is blank, the Sale Price is filled automatically */
function ivModelChanged(i, v){
  ivl[i].model = v;
  const pr = findProd(v);
  if (pr && (ivl[i].rate === '' || ivl[i].rate == null) && Number(pr['Sale Price']) > 0) ivl[i].rate = pr['Sale Price'];
  renderIvLines();
}

/* Enter the DC number and select "Load DC" — customer, PO, and items are loaded automatically */
async function loadDcIntoInvoice(){
  const raw=$('ivdc').value.trim();if(!raw)return toast('Please enter at least one Delivery Challan #.',true);
  const nos=raw.split(/[,\n]+/).map(x=>x.trim()).filter(Boolean),docs=[];
  for(const no of nos){const r=await api('getReports',{mode:'document',type:'DC',no:no});if(!r.ok)return toast((r.error||'DC not found.')+' ['+no+']',true);docs.push(r.document);}
  const first=docs[0],ck=norm(first.customer);if(docs.some(d=>norm(d.customer)!==ck))return toast('All selected Delivery Challans must belong to the same customer.',true);
  const merged={},order=[];docs.forEach(d=>(d.items||[]).forEach(x=>{const k=String(x.model||'').trim();if(!k)return;if(!merged[k]){merged[k]={qty:0};order.push(k);}merged[k].qty+=Number(x.qty||0);}));
  $('ivcust').value=first.customer||'';pickCustomer('iv');$('ivcid').value=first.customerId||$('ivcid').value;$('ivpo').value=first.po||'';$('ivpodate').value=toInputDate(first.poDate);$('ivdcdate').value=docs.length===1?toInputDate(first.date):'';if(first.stn)$('ivstn').value=first.stn;if(first.ntn)$('ivntn').value=first.ntn;
  ivl=order.map(k=>{const pr=findProd(k);return{model:k,qty:merged[k].qty,rate:(pr&&Number(pr['Sale Price'])>0)?pr['Sale Price']:''};});if(!ivl.length)ivl=[{model:'',qty:'',rate:''}];renderIvLines();
  toast(nos.length===1?'Delivery Challan loaded — please check the rates.':nos.length+' Delivery Challans loaded and combined — please check the rates.');
}

async function saveInvoice(print){
  const cu = checkCustomer($('ivcust').value);
  if (cu.error) { if (!cu.silent) toast(cu.error, true); return; }
  const gstRaw = $('ivgst').value;
  if (gstRaw === '' || isNaN(Number(gstRaw)) || Number(gstRaw) < 0 || Number(gstRaw) > 100) return toast('Enter GST % between 0 and 100 (0 is allowed).', true);
  const items = [];
  for (const x of ivl) {
    if (!String(x.model || '').trim() && !(Number(x.qty) > 0)) continue;   // skip empty line
    const pr = findProd(x.model);
    if (!pr) return toast('Product not found: ' + (x.model || '(blank)'), true);
    const qty = Number(x.qty), rate = Number(x.rate);
    if (!(qty > 0)) return toast('Invalid quantity: ' + pr['Model / Part No.'], true);
    if (!(rate > 0)) return toast('Enter a rate: ' + pr['Model / Part No.'], true);
    items.push({model:pr['Model / Part No.'], desc:pr.Description || '', qty:qty, rate:rate});
  }
  if (!items.length) return toast('Please add at least one item.', true);
  await guardedSave(async () => {
    const p = {
      no:$('ivno').value.trim(), date:$('ivdate').value || todayStr(), customer:cu.name,
      customerId:$('ivcid').value || (cu.cust ? cu.cust['Customer ID'] : ''),
      po:$('ivpo').value, poDate:$('ivpodate').value, dc:$('ivdc').value.trim(),
      dcDate:$('ivdcdate').value, stn:$('ivstn').value, ntn:$('ivntn').value,
      gstPercent:Number(gstRaw), items:items,
      edit: !!EDIT_INVOICE
    };
    const r = await api(EDIT_INVOICE ? 'updateInvoice' : 'saveInvoice', p);
    if (!r.ok) return toast(r.error, true);
    p.no = r.id || p.no;                       // auto-number will also appear on print
    if (print) printInvoice(p);
    toast(EDIT_INVOICE ? 'Invoice updated successfully.' : 'Invoice saved.');
    EDIT_INVOICE = null;
    await refresh();
    if ($('ivhRows')) loadIVHistory();
  });
}

/* ---------- INVOICE HISTORY ---------- */
let IVH_CACHE=[];
let EDIT_INVOICE=null;
function editInvoice(noEnc){
 if(!isAdmin())return toast('Only an Admin can edit a saved invoice.',true);
 const no=decodeURIComponent(noEnc),d=IVH_CACHE.find(x=>x.no===no);if(!d)return;
 showPage('invoices',document.querySelector(".navbtn[onclick*=\"'invoices'\"]"));EDIT_INVOICE={no:d.no};
 $('ivno').value=d.no;$('ivno').readOnly=true;$('ivdate').value=toInputDate(d.date)||todayStr();$('ivcust').value=d.customer||'';pickCustomer('iv');$('ivcid').value=d.customerId||$('ivcid').value;$('ivpo').value=d.po||'';$('ivpodate').value=toInputDate(d.poDate);$('ivdc').value=d.dc||'';$('ivdcdate').value=toInputDate(d.dcDate);$('ivstn').value=d.stn||'';$('ivntn').value=d.ntn||'';$('ivgst').value=(d.gstPercent==null||d.gstPercent==='')?18:d.gstPercent;
 ivl=(d.items||[]).map(x=>({model:x.model,qty:x.qty,rate:x.rate}));if(!ivl.length)ivl=[{model:'',qty:'',rate:''}];renderIvLines();
 const b=$('ivEditBanner');if(b)b.innerHTML='<div class="muted">Admin edit mode: editing the invoice does not change stock. <button class="btn small" onclick="cancelEditInvoice()">Cancel Edit</button></div>';
}
function cancelEditInvoice(){EDIT_INVOICE=null;showPage('invoices',document.querySelector(".navbtn[onclick*=\"'invoices'\"]"));}

async function loadIVHistory(){
  const tbody = $('ivhRows');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
  const r = await api('getReports', {mode:'docs', type:'INVOICE'});
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${esc(r.error||'Could not load history')}</td></tr>`;
    return;
  }
  IVH_CACHE = (r.documents||[]).map(d => {
    const gstN = (d.gstPercent === '' || d.gstPercent == null || isNaN(Number(d.gstPercent))) ? 18 : Number(d.gstPercent);
    const total = (d.subtotal||0) * (1 + gstN/100);
    return {...d, grandTotal: total, searchText: [d.no, d.customer, d.customerId, d.dc, d.po, ...d.items.map(x=>x.model), ...d.items.map(x=>x.desc)].join(' ').toLowerCase()};
  });
  filterIVHistory();
}

function filterIVHistory(){
  const tbody = $('ivhRows');
  if (!tbody) return;
  const q = norm($('ivhSearch')?.value||'');
  const rows = IVH_CACHE.filter(d => !q || d.searchText.includes(q));
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No Invoices found.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(d => `
    <tr>
      <td><b>${esc(d.no)}</b></td>
      <td>${fmtDate(d.date)}</td>
      <td>${esc(d.customer)}</td>
      <td>${esc(d.dc||'—')}</td>
      <td>${esc(d.po||'—')}</td>
      <td class="right">${money(d.grandTotal)}</td>
      <td>
        <button class="btn small" onclick="viewInvoice('${encA(d.no)}')">View</button>
        <button class="btn small" onclick="viewInvoice('${encA(d.no)}',true)">Print</button>
      </td>
    </tr>`).join('');
}

function viewInvoice(noEnc, print){
  const no = decodeURIComponent(noEnc);
  const d = IVH_CACHE.find(x => x.no === no);
  if (!d) return;

  if (print) { printInvoice({...d, total:d.grandTotal}); return; }

  const rows = d.items.map((x,i) =>
    `<tr>
       <td>${i+1}</td>
       <td>${esc(x.desc||'')}<br><span class="muted">Model: ${esc(x.model)}</span></td>
       <td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{})['Product ID']||'')}</td>
       <td class="right">${x.qty}</td>
       <td class="right">${money(x.rate)}</td>
       <td class="right">${money((+x.qty||0)*(+x.rate||0))}</td>
     </tr>`).join('');

  modal('Invoice — ' + d.no,
    `<div class="doc-info">
       <div><b>Date:</b> ${fmtDate(d.date)}</div>
       <div><b>Invoice #:</b> ${esc(d.no)}</div>
       <div><b>Customer:</b> ${esc(d.customer)}</div>
       <div><b>Customer ID:</b> ${esc(d.customerId||'—')}</div>
       <div><b>DC #:</b> ${esc(d.dc||'—')}</div>
       <div><b>DC Date:</b> ${fmtDate(d.dcDate)}</div>
       <div><b>PO #:</b> ${esc(d.po||'—')}</div>
       <div><b>PO Date:</b> ${fmtDate(d.poDate)}</div>
     </div>
     <div class="table-wrap">
       <table class="doc-table">
         <thead><tr><th>#</th><th>Description</th><th>Item Code</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
         <tbody>${rows}</tbody>
       </table>
     </div>
     <div class="doc-totals">
       <div><span>Sub Total</span><span>${money(d.subtotal)}</span></div>
       <div><span>GST ${(d.gstPercent === '' || d.gstPercent == null || isNaN(Number(d.gstPercent))) ? 18 : Number(d.gstPercent)}%</span><span>${money(d.grandTotal - d.subtotal)}</span></div>
       <div><b>TOTAL</b><b>${money(d.grandTotal)}</b></div>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Close</button>
       <button class="btn primary" onclick="viewInvoice('${encA(no)}',true)">Print</button>
       ${isAdmin() ? '<button class="btn" onclick="editInvoice(\'' + encA(no) + '\')">Edit Invoice</button>' : ''}
     </div>`);
}

/* ---------- ACCOUNTS (placeholder) ---------- */
async function loadAccounts(){
  const [custOut, custPay, supOut, supPay] = await Promise.all([
    api('getOutstanding', {}),
    api('getPaymentHistory', {}),
    api('getSupplierOutstanding', {}),
    api('getSupplierPaymentHistory', {})
  ]);

  ACC.outErr = custOut.ok ? '' : (custOut.error || 'Could not load outstanding');
  ACC.payErr = custPay.ok ? '' : (custPay.error || 'Could not load payments');
  ACC.out = (custOut.ok ? (custOut.rows||[]) : []).map(r => Object.assign({}, r, {_hay: accHay([r.no, r.customer, ...accDateParts(r.date), ...accAmountParts(r.total), ...accAmountParts(r.paid), ...accAmountParts(r.outstanding)])}));
  ACC.pays = (custPay.ok ? (custPay.payments||[]) : []).map(x => Object.assign({}, x, {_hay: accHay([x['Invoice No.'], x['Customer Name'], x.Reference, x.Method, x.Remarks, ...accDateParts(x.Date), ...accAmountParts(x.Amount)])}));
  filterCustOut();
  filterCustPay();

  const supRows = supOut.ok ? (supOut.rows||[]) : [];
  const supOutHost = $('supOutRows');
  if (supOutHost) supOutHost.innerHTML = supRows.map(r=>`<tr><td>${esc(r.supplier)}</td><td>${money(r.purchased)}</td><td>${money(r.paid)}</td><td><b>${money(r.outstanding)}</b></td><td><button class="btn small primary" onclick="openSupPayModal('${encA(r.supplier)}',${r.outstanding})">Record Payment</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No outstanding supplier balances — all settled!</td></tr>';

  const supPays = supPay.ok ? (supPay.payments||[]) : [];
  const supPayHost = $('supPayRows');
  if (supPayHost) supPayHost.innerHTML = supPays.slice(0,30).map(x=>`<tr><td>${fmtDate(x.Date)}</td><td>${esc(x['Supplier Name'])}</td><td>${money(x.Amount)}</td><td>${esc(x.Method)}</td><td>${esc(x.Reference)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No payments recorded yet.</td></tr>';
}
function renderAccounts(){ loadAccounts(); }

/* ---------- ACCOUNTS SEARCH (Customer Outstanding + Customer Payments) ---------- */
let ACC = {out:[], pays:[], outErr:'', payErr:''};
const ACC_PAY_DEFAULT_LIMIT = 100;   // when search is blank, show the latest payments; when searching, search all records

function accHay(parts){ return parts.map(v => String(v == null ? '' : v)).join(' | ').toLowerCase(); }
function accMatch(hay, q){
  const toks = String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return toks.every(tk => hay.includes(tk));      // saare words milne chahiyen (e.g. "INV-000012 cash")
}
function accDateParts(v){
  const d = new Date(v);
  if (!v || isNaN(d)) return [String(v || '')];
  const dd = String(d.getDate()).padStart(2,'0'), mm = String(d.getMonth()+1).padStart(2,'0'), yy = d.getFullYear();
  return [fmtDate(v), toInputDate(v), dd+'/'+mm+'/'+yy, dd+'-'+mm+'-'+yy];
}
function accAmountParts(n){ const a = Number(n) || 0; return [String(a), money(a), money(a).replace(/,/g,'')]; }

function custOutRowHtml(r){
  return `<tr><td>${esc(r.no)}</td><td>${fmtDate(r.date)}</td><td>${esc(r.customer)}</td><td>${money(r.total)}</td><td>${money(r.paid)}</td><td><b>${money(r.outstanding)}</b></td><td><button class="btn small primary" onclick="openCustPayModal('${encA(r.no)}','${encA(r.customer)}',${r.outstanding})">Record Payment</button></td></tr>`;
}
function filterCustOut(){
  const host = $('custOutRows');
  if (!host) return;
  const q = (($('custOutSearch') || {}).value || '').trim();
  const hits = q ? ACC.out.filter(r => accMatch(r._hay, q)) : ACC.out;
  host.innerHTML = ACC.outErr
    ? `<tr><td colspan="7" class="empty">${esc(ACC.outErr)}</td></tr>`
    : (hits.map(custOutRowHtml).join('') || `<tr><td colspan="7" class="empty">${q ? 'No invoice found.' : 'No outstanding invoices — all settled!'}</td></tr>`);
  const info = $('custOutInfo');
  if (info) {
    const tot = hits.reduce((a, r) => a + (Number(r.outstanding) || 0), 0);
    info.textContent = ACC.outErr ? '' : (q ? `${hits.length} of ${ACC.out.length} invoice(s) • Outstanding ${money(tot)}` : `${ACC.out.length} invoice(s) • Outstanding ${money(tot)}`);
  }
}

function custPayRowHtml(x){
  const tax = (Number(x['Income Tax Deducted'])||0) + (Number(x['WHT Deducted'])||0);
  const taxNote = tax > 0 ? ` <span class="muted small">(tax ${money(tax)})</span>` : '';
  return `<tr><td>${fmtDate(x.Date)}</td><td>${esc(x['Invoice No.'])}</td><td>${esc(x['Customer Name'])}</td><td>${money(x.Amount)}${taxNote}</td><td>${esc(x.Method)}</td><td>${esc(x.Reference)}</td><td class="muted">${esc(x.Remarks || '')}</td></tr>`;
}
function filterCustPay(){
  const host = $('custPayRows');
  if (!host) return;
  const q = (($('custPaySearch') || {}).value || '').trim();
  const all = ACC.pays;
  const hits = q ? all.filter(x => accMatch(x._hay, q)) : all;
  const shown = q ? hits : hits.slice(0, ACC_PAY_DEFAULT_LIMIT);
  host.innerHTML = ACC.payErr
    ? `<tr><td colspan="7" class="empty">${esc(ACC.payErr)}</td></tr>`
    : (shown.map(custPayRowHtml).join('') || `<tr><td colspan="7" class="empty">${q ? 'No payment found.' : 'No payments recorded yet.'}</td></tr>`);
  const info = $('custPayInfo');
  if (info) {
    const tot = hits.reduce((a, x) => a + (Number(x.Amount) || 0), 0);
    info.textContent = ACC.payErr ? '' : (q
      ? `${hits.length} payment(s) mili • Total ${money(tot)}`
      : (all.length > shown.length ? `Latest ${shown.length} of ${all.length} • search for older payments` : `${all.length} payment(s) • Total ${money(tot)}`));
  }
}
function clearPaySearch(){ const el = $('custPaySearch'); if (el) { el.value = ''; filterCustPay(); el.focus(); } }

function openCustPayModal(invEnc, custEnc, outstanding){
  const inv = decodeURIComponent(invEnc), cust = decodeURIComponent(custEnc);
  modal('Record Payment — '+inv, `<div class="form-grid">
    <label>Invoice #<input id="payinv" value="${esc(inv)}" readonly></label>
    <label>Customer<input value="${esc(cust)}" readonly></label>
    <label>Outstanding<input id="payout" value="${money(outstanding)}" readonly></label>
    <label>Amount Received (Cash/Bank)<input id="payamt" type="number" step="0.01" min="0" value="${round2(outstanding)}" onfocus="this.select()" oninput="updatePaySettlement()"></label>
    <label>Income Tax Deducted<input id="payinctax" type="number" step="0.01" min="0" value="0" oninput="updatePaySettlement()"></label>
    <label>WHT Deducted<input id="paywht" type="number" step="0.01" min="0" value="0" oninput="updatePaySettlement()"></label>
    <label>Total Settlement<input id="paysettle" value="${money(outstanding)}" readonly></label>
    <label>Date<input id="paydate" type="date" value="${todayStr()}"></label>
    <label>Method<select id="paymethod"><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Online</option></select></label>
    <label>Reference / Cheque #<input id="payref"></label>
    <label class="wide">Remarks<input id="payrem" placeholder="e.g. 5.5% income tax deducted by client"></label>
  </div>
  <p class="muted small" style="margin:8px 0 0">Cash + Income Tax + WHT = invoice settlement (outstanding is se kam hoga).</p>
  <div class="actions"><button class="btn primary" onclick="submitCustPayment()">Save Payment</button></div>`);
}
function updatePaySettlement(){
  const a = Number(($('payamt')||{}).value)||0;
  const t = Number(($('payinctax')||{}).value)||0;
  const w = Number(($('paywht')||{}).value)||0;
  const el = $('paysettle');
  if (el) el.value = money(a + t + w);
}
async function submitCustPayment(){
  await guardedSave(async () => {
    const amt = Number($('payamt').value)||0;
    const incomeTax = Number($('payinctax').value)||0;
    const wht = Number($('paywht').value)||0;
    if (amt < 0 || incomeTax < 0 || wht < 0) return toast('Amounts negative nahi ho sakte.', true);
    if (amt <= 0 && incomeTax <= 0 && wht <= 0) return toast('Kam az kam cash ya tax amount enter karein.', true);
    const p = {
      invoiceNo: $('payinv').value,
      amount: amt,
      incomeTax: incomeTax,
      wht: wht,
      date: $('paydate').value,
      method: $('paymethod').value,
      reference: $('payref').value,
      remarks: $('payrem').value
    };
    const r = await api('savePayment', p);
    if (!r.ok) return toast(r.error, true);
    closeModal();
    toast('Payment recorded. Settlement: '+money(r.settlement != null ? r.settlement : (amt+incomeTax+wht))+' · Outstanding: '+money(r.outstanding));
    await loadAccounts();
  });
}

function openSupPayModal(supEnc, outstanding){
  const sup = decodeURIComponent(supEnc);
  modal('Pay Supplier — '+sup, `<div class="form-grid"><label>Supplier<input id="spaysup" value="${esc(sup)}" readonly></label><label>Outstanding<input value="${money(outstanding)}" readonly></label><label>Amount Paid<input id="spayamt" type="number" step="0.01" value="${round2(outstanding)}" onfocus="this.select()"></label><label>Date<input id="spaydate" type="date" value="${todayStr()}"></label><label>Method<select id="spaymethod"><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Online</option></select></label><label>Reference / Cheque #<input id="spayref"></label><label class="wide">Remarks<input id="spayrem"></label></div><div class="actions"><button class="btn primary" onclick="submitSupPayment()">Save Payment</button></div>`);
}
async function submitSupPayment(){
  await guardedSave(async () => {
    const amt = Number($('spayamt').value);
    if (!(amt>0)) return toast('Enter a valid amount.', true);
    const p = {supplier:$('spaysup').value, amount:amt, date:$('spaydate').value, method:$('spaymethod').value, reference:$('spayref').value, remarks:$('spayrem').value};
    const r = await api('saveSupplierPayment', p);
    if (!r.ok) return toast(r.error, true);
    closeModal();
    toast('Supplier payment recorded.');
    await loadAccounts();
  });
}

/* ---------- CUSTOMERS / SUPPLIERS ---------- */
function renderCustomers(){
  $('customers').innerHTML = S.customers.map(c => {
    const status = c.Status||'Active';
    return `<div class="kv">
       <b>${esc(c['Customer Name'])}</b>${status==='Inactive'?' <span class="muted">(Inactive)</span>':''} — <span class="muted">${esc(c['Customer ID'])}</span><br>
       ${esc(c['Contact Person'])} • ${esc(c.Phone)} • ${esc(c.Email)}<br>
       ${esc(c.Address)}<br>
       <button class="btn small" onclick="ledger('Customer','${encA(c['Customer Name'])}')">Ledger</button>
       <button class="btn small" onclick="editPartyForm('Customer','${encA(c['Customer Name'])}')">Edit</button>
       ${isAdmin()?`<button class="btn small danger" onclick="togglePartyStatus('Customer','${encA(c['Customer Name'])}','${status==='Active'?'Inactive':'Active'}')">${status==='Active'?'Deactivate':'Activate'}</button>`:''}
     </div>`;
  }).join('') || '<div class="muted">No customers yet.</div>';
}

function renderSuppliers(){
  $('suppliers').innerHTML = S.suppliers.map(c => {
    const status = c.Status||'Active';
    return `<div class="kv">
       <b>${esc(c['Supplier Name'])}</b>${status==='Inactive'?' <span class="muted">(Inactive)</span>':''} — <span class="muted">${esc(c['Supplier ID'])}</span><br>
       ${esc(c['Contact Person'])} • ${esc(c.Phone)} • ${esc(c.Email)}<br>
       ${esc(c.Address)}<br>
       <button class="btn small" onclick="ledger('Supplier','${encA(c['Supplier Name'])}')">Ledger</button>
       <button class="btn small" onclick="editPartyForm('Supplier','${encA(c['Supplier Name'])}')">Edit</button>
       ${isAdmin()?`<button class="btn small danger" onclick="togglePartyStatus('Supplier','${encA(c['Supplier Name'])}','${status==='Active'?'Inactive':'Active'}')">${status==='Active'?'Deactivate':'Activate'}</button>`:''}
     </div>`;
  }).join('') || '<div class="muted">No suppliers yet.</div>';
}

function editPartyForm(type, nameEnc){
  const name = decodeURIComponent(nameEnc);
  const list = type==='Customer' ? S.customers : S.suppliers;
  const nameKey = type==='Customer' ? 'Customer Name' : 'Supplier Name';
  const c = list.find(x => x[nameKey] === name);
  if (!c) return;

  modal('Edit ' + type + ' — ' + name,
    `<div class="form-grid">
       <label>Name<input value="${esc(name)}" readonly></label>
       <label>Contact Person<input id="epcontact" value="${esc(c['Contact Person']||'')}"></label>
       <label>Phone<input id="epphone" value="${esc(c.Phone||'')}"></label>
       <label>Email<input id="epemail" value="${esc(c.Email||'')}"></label>
       <label>NTN/Tax ID<input id="epntn" value="${esc(c['NTN/Tax ID']||'')}"></label>
       <label class="wide">Address<textarea id="epaddr">${esc(c.Address||'')}</textarea></label>
       <label class="wide">Remarks (Enter STN as: STN: 1234)<textarea id="eprem2">${esc(c.Remarks||'')}</textarea></label>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Cancel</button>
       <button class="btn primary" onclick="savePartyEdit('${type}','${nameEnc}')">Save Changes</button>
     </div>`);
}

async function savePartyEdit(type, nameEnc){
  const name = decodeURIComponent(nameEnc);
  const r = await api(type==='Customer'?'updateCustomer':'updateSupplier', {
    name, contact:$('epcontact').value, phone:$('epphone').value, email:$('epemail').value,
    ntn:$('epntn').value, address:$('epaddr').value, remarks:$('eprem2').value
  });
  if (!r.ok) return toast(r.error, true);
  closeModal(); await refresh(); toast(type + ' updated.');
}

async function togglePartyStatus(type, nameEnc, newStatus){
  const name = decodeURIComponent(nameEnc);
  if (!confirm((newStatus==='Inactive'?'Deactivate':'Activate') + ' ' + name + '?')) return;
  const r = await api(type==='Customer'?'setCustomerStatus':'setSupplierStatus', {name, status:newStatus});
  if (!r.ok) return toast(r.error, true);
  await refresh();
  toast(type + ' ' + (newStatus==='Inactive'?'deactivated':'activated') + '.');
}

function partyForm(type){
  modal('Add ' + type,
    `<div class="form-grid">
       <label>Name<input id="pn"></label>
       <label>Contact Person<input id="pcontact"></label>
       <label>Phone<input id="pphone"></label>
       <label>Email<input id="pemail"></label>
       <label>City<input id="pcity"></label>
       <label>NTN<input id="pntn"></label>
       <label>STN<input id="pstn"></label>
       <label class="wide">Address<textarea id="paddr"></textarea></label>
       <label class="wide">Remarks<textarea id="pr"></textarea></label>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Cancel</button>
       <button class="btn primary" onclick="saveParty('${type}')">Save</button>
     </div>`);
}

async function saveParty(type){
  const name = $('pn').value.trim();
  if (!name) return toast('Name is required.', true);
  const list = type === 'Customer' ? S.customers : S.suppliers;
  const key = type === 'Customer' ? 'Customer Name' : 'Supplier Name';
  if (list.some(x => norm(x[key]) === norm(name))) return toast(type + ' already exists.', true);
  /* Backend does not have separate City / STN columns, so City is saved in Address and STN is saved in Remarks */
  const city = $('pcity').value.trim(), stn = $('pstn').value.trim();
  const address = [$('paddr').value.trim(), city].filter(Boolean).join(', ');
  const remarks = [stn ? 'STN: ' + stn : '', $('pr').value.trim()].filter(Boolean).join('\n');
  await guardedSave(async () => {
    const r = await api(type === 'Customer' ? 'saveCustomer' : 'saveSupplier', {
      name, contact:$('pcontact').value, phone:$('pphone').value,
      email:$('pemail').value, ntn:$('pntn').value, address, remarks
    });
    if (!r.ok) return toast(r.error, true);
    closeModal(); await refresh();
    toast(type + ' saved.');
  });
}

async function ledger(type, nameEnc){
  const name = decodeURIComponent(nameEnc);
  const isCust = type === 'Customer';
  modal(type + ' Ledger — ' + name, '<p class="muted">Loading…</p>');
  const calls = isCust
    ? [api('getOutstanding', {customer:name, includeSettled:true}), api('getPaymentHistory', {customer:name}), api('getLedger', {type:type, name:name})]
    : [api('getSupplierOutstanding', {supplier:name, includeSettled:true}), api('getSupplierPaymentHistory', {supplier:name}), api('getLedger', {type:type, name:name})];
  const [inv, pay, mv] = await Promise.all(calls);
  let html = '';

  if (inv.ok && pay.ok) {
    if (isCust) {
      const entries = [];
      (inv.rows||[]).forEach(r => entries.push({t:new Date(r.date).getTime()||0, ord:0, date:r.date, kind:'Invoice', ref:r.no, debit:Number(r.total)||0, credit:0}));
      (pay.payments||[]).forEach(x => entries.push({t:new Date(x.Date).getTime()||0, ord:1, date:x.Date, kind:'Payment', ref:[x['Invoice No.'], x.Method, x.Reference].filter(Boolean).join(' • '), debit:0, credit:Number(x.Amount)||0}));
      entries.sort((a,b) => (a.t - b.t) || (a.ord - b.ord));
      let bal = 0, dr = 0, cr = 0;
      const rows = entries.map(e => {
        bal += e.debit - e.credit; dr += e.debit; cr += e.credit;
        return `<tr><td>${fmtDate(e.date)}</td><td>${e.kind}</td><td>${esc(e.ref)}</td><td class="right">${e.debit ? money(e.debit) : ''}</td><td class="right">${e.credit ? money(e.credit) : ''}</td><td class="right"><b>${money(bal)}</b></td></tr>`;
      }).join('');
      html += `<h4 style="margin:0 0 8px">Account Statement</h4>
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th class="right">Debit</th><th class="right">Credit</th><th class="right">Balance</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No invoices or payments.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="3"><b>Total</b></td><td class="right"><b>${money(dr)}</b></td><td class="right"><b>${money(cr)}</b></td><td class="right"><b>${money(dr - cr)}</b></td></tr></tfoot>
        </table></div>
        <div class="muted small">Debit = invoices (GST ke saath), Credit = payments. Balance positive = customer ne dena hai.</div>`;
    } else {
      const row = (inv.rows||[])[0] || {purchased:0, paid:0, outstanding:0};
      const prow = (pay.payments||[]).map(x => `<tr><td>${fmtDate(x.Date)}</td><td class="right">${money(x.Amount)}</td><td>${esc(x.Method)}</td><td>${esc(x.Reference)}</td></tr>`).join('');
      html += `<h4 style="margin:0 0 8px">Supplier Account</h4>
        <div class="table-wrap"><table>
          <thead><tr><th class="right">Purchased</th><th class="right">Paid</th><th class="right">Outstanding</th></tr></thead>
          <tbody><tr><td class="right">${money(row.purchased)}</td><td class="right">${money(row.paid)}</td><td class="right"><b>${money(row.outstanding)}</b></td></tr></tbody>
        </table></div>
        <h4 style="margin:16px 0 8px">Payments</h4>
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th class="right">Amount</th><th>Method</th><th>Reference</th></tr></thead>
          <tbody>${prow || '<tr><td colspan="4" class="empty">No payments yet.</td></tr>'}</tbody>
        </table></div>`;
    }
  } else {
    html += '<p class="muted">Accounts module access is required to view the statement.</p>';
  }

  if (mv.ok) {
    const mrows = (mv.transactions||[]).map(x => `<tr><td>${fmtDate(x.date)}</td><td>${esc(x.type)}</td><td>${esc(x.ref)}</td><td class="right">${x.debit||''}</td><td class="right">${x.credit||''}</td></tr>`).join('');
    html += `<h4 style="margin:18px 0 8px">Goods Movement (Qty)</h4>
      <div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th class="right">Qty Out</th><th class="right">Qty In</th></tr></thead>
        <tbody>${mrows || '<tr><td colspan="5" class="empty">No movements.</td></tr>'}</tbody>
      </table></div>`;
  }
  $('modalBody').innerHTML = html;
}

/* ---------- REPORTS ---------- */
async function renderReports(){
  const sel = $('ry');
  if (sel && !sel.options.length) {
    const cy = new Date().getFullYear();
    for (let y = cy; y >= cy - 5; y--) { const o = document.createElement('option'); o.value = y; o.textContent = y; sel.appendChild(o); }
  }
  const year = sel ? sel.value : new Date().getFullYear();
  const host = $('reports');
  if (host) host.innerHTML = '<div class="muted">Loading…</div>';
  const r = await api('getReports', {year});
  if (!r.ok) { if (host) host.innerHTML = ''; return toast(r.error, true); }
  const mv = (r.movements || []).slice().sort((a,b) => new Date(b.Date) - new Date(a.Date)).slice(0, 200);
  if (!$('reports')) return;
  $('reports').innerHTML =
    `<div class="cards">
       <div class="card"><span>Invoice Lines</span><strong>${(r.sales||[]).length}</strong></div>
       <div class="card"><span>Sales (excl. GST)</span><strong>${money((r.sales||[]).reduce((a,x)=>a+(+x.total||0),0))}</strong></div>
     </div>
     <div class="panel"><h3>Units Delivered by Category</h3><div class="catgrid">${CATS.map(c=>`<div class="cat"><span>${esc(c)}</span><b>${((r.categorySales||{})[c]||0).toLocaleString()}</b></div>`).join('')}</div></div>
     <div class="panel table-wrap"><h3>Recent Stock Movement (latest 200)</h3>
       <table>
         <thead><tr><th>Date</th><th>Type</th><th>Model</th><th>IN</th><th>OUT</th><th>Party</th><th>Reference</th><th>By</th></tr></thead>
         <tbody>${mv.map(x => `<tr><td>${fmtDate(x.Date)}</td><td>${esc(x.Type)}</td><td>${esc(x['Model / Part No.'])}</td><td>${x['Qty IN']}</td><td>${x['Qty OUT']}</td><td>${esc(x.Party)}</td><td>${esc(x.Reference)}</td><td>${esc(x['Created By'])}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No movements.</td></tr>'}</tbody>
       </table>
     </div>`;
}

/* ---------- SETTINGS ---------- */
function renderSettings(){}
async function refreshSource(){
  if (!confirm('Source snapshot refresh karne se Products list source sheet se dobara banti hai.\n\nWarning: jo products sirf is app se add kiye gaye hain (source sheet mein nahi) wo list se hat sakte hain.\n\nKya aap ne backup le liya hai? Continue?')) return;
  const r = await api('refreshSource');
  toast(r.ok ? 'Source snapshot refreshed.' : r.error, !r.ok);
  await refresh();
}
function changePasswordForm(){
  modal('Change Password',
    `<div class="form-grid">
       <label class="wide">Current Password<input id="cp1" type="password"></label>
       <label class="wide">New Password<input id="cp2" type="password"></label>
       <label class="wide">Confirm Password<input id="cp3" type="password"></label>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Cancel</button>
       <button class="btn primary" onclick="changePassword()">Change Password</button>
     </div>`);
}
async function changePassword(){
  if ($('cp2').value !== $('cp3').value) return toast('Passwords do not match', true);
  if ($('cp2').value.length < 6) return toast('New password must be at least 6 characters.', true);
  const r = await api('changePassword', {currentPassword:$('cp1').value, newPassword:$('cp2').value});
  if (!r.ok) return toast(r.error, true);
  closeModal(); toast('Password changed. Login again.'); logout();
}

/* ---------- USERS ---------- */
async function renderUsers(){
  const r = await api('listUsers');
  if (!r.ok) return toast(r.error, true);

  $('users').innerHTML = r.users.map(u => {
    const mods = Array.isArray(u.Modules) ? u.Modules : [];
    const isAdminRow = String(u.Role || '').toUpperCase() === 'ADMIN';
    const modBadges = isAdminRow
      ? '<span class="badge badge-admin">All Modules</span>'
      : (mods.length
          ? mods.map(m => `<span class="badge">${esc((ALL_MODULES.find(x=>x.id===m)||{}).label||m)}</span>`).join('')
          : '<span class="badge badge-none">No modules</span>');

    return `<div class="kv user-row">
      <div class="user-info">
        <b>${esc(u.Name)}</b> — ${esc(u.Username)} <span class="role">${esc(u.Role)}</span> <span class="${u.Status==='Active'?'ok':'off'}">${esc(u.Status)}</span>
        <div class="modules-row">${modBadges}</div>
      </div>
      <div class="user-actions">
        <button class="btn small" onclick="userForm('${encA(u.Username)}','${encA(u.Name||'')}','${encA(u.Role||'')}',${JSON.stringify(mods).replace(/"/g,'&quot;')})">Edit Modules</button>
        <button class="btn small" onclick="toggleUser('${encA(u.Username)}','${encA(u.Status)}')">${u.Status==='Active'?'Disable':'Enable'}</button>
      </div>
    </div>`;
  }).join('') || '<div class="muted">No users.</div>';
}

function userForm(editUsername, editName, editRole, editModules){
  const isEdit = !!editUsername;
  const u = editUsername ? decodeURIComponent(editUsername) : '';
  const n = editName ? decodeURIComponent(editName) : '';
  const ro = editRole ? decodeURIComponent(editRole) : 'STAFF';
  const mods = Array.isArray(editModules) ? editModules : [];

  modal(isEdit ? 'Edit Staff — ' + u : 'Add Staff',
    `<div class="form-grid">
       <label>Name<input id="un" value="${esc(n)}"></label>
       <label>Username<input id="uu" value="${esc(u)}" ${isEdit?'readonly':''}></label>
       <label>Password ${isEdit?'<span class="muted small">(leave blank if you do not want to change it)</span>':''}<input id="up" type="password"></label>
       <label>Role<select id="ur">
         <option value="STAFF" ${ro==='STAFF'?'selected':''}>STAFF</option>
         <option value="ADMIN" ${ro==='ADMIN'?'selected':''}>ADMIN</option>
       </select></label>
     </div>
     <div class="modules-block">
       <div class="modules-title">Module Access</div>
       ${ALL_MODULES.map(m=>`<label class="chk"><input type="checkbox" value="${m.id}" ${mods.indexOf(m.id)!==-1?'checked':''}> ${m.label}</label>`).join('')}
       <div class="muted small">Note: ADMIN role ko hamesha full access milta hai — modules ki zaroorat nahi.</div>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Cancel</button>
       <button class="btn primary" onclick="saveUser(${isEdit?'true':'null'})">${isEdit?'Save Changes':'Create User'}</button>
     </div>`);
}

async function saveUser(editUsername){
  const isEdit = !!editUsername;
  const modules = Array.from(document.querySelectorAll('.modules-block input[type=checkbox]:checked')).map(x=>x.value);
  const payload = {
    name: $('un').value,
    username: $('uu').value.trim(),
    password: $('up').value,
    role: $('ur').value,
    modules
  };
  if (!payload.username) return toast('Username is required', true);
  if (!isEdit && !payload.password) return toast('Password is required', true);
  if (payload.password && payload.password.length < 6) return toast('Password must be at least 6 characters.', true);
  if (isEdit && S.user && norm(payload.username) === norm(S.user.username) && payload.role !== 'ADMIN') return toast('You cannot change your own ADMIN role.', true);

  const r = await api(isEdit ? 'updateUser' : 'saveUser', payload);
  if (!r.ok) return toast(r.error, true);
  closeModal();
  toast(isEdit ? 'User updated.' : 'Staff created.');
  renderUsers();
}

async function toggleUser(u, st){
  const username = decodeURIComponent(u);
  const next = decodeURIComponent(st) === 'Active' ? 'Inactive' : 'Active';
  if (next === 'Inactive') {
    if (S.user && norm(S.user.username) === norm(username)) return toast('You cannot disable your own account.', true);
    if (!confirm(username + '? Disable this account')) return;
  }
  const r = await api('disableUser', {username, status:next});
  if (!r.ok) return toast(r.error, true);
  renderUsers();
}

/* ---------- HELPERS ---------- */
function money(n){ return (Number(n)||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }

function numberToWords(num){
  num = Math.round((Number(num)||0)*100)/100;
  const rupees = Math.floor(num);
  const paisa = Math.round((num - rupees)*100);
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function threeDigits(n){
    let s = '';
    if (n >= 100) { s += ones[Math.floor(n/100)] + ' Hundred '; n %= 100; }
    if (n >= 20) { s += tens[Math.floor(n/10)] + ' '; n %= 10; }
    if (n > 0) s += ones[n] + ' ';
    return s.trim();
  }
  function convert(n){
    if (n === 0) return 'Zero';
    let parts = [];
    const million = Math.floor(n/1000000); n %= 1000000;
    const thousand = Math.floor(n/1000); n %= 1000;
    const rest = n;
    if (million) parts.push(threeDigits(million) + ' Million');
    if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
    if (rest) parts.push(threeDigits(rest));
    return parts.join(' ');
  }
  let words = convert(rupees) + ' Rupees';
  if (paisa > 0) words += ' & ' + convert(paisa) + ' Paisa';
  return words;
}

function fmtDate(v){
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return esc(v);
  return d.toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'});
}

/* ---------- TOAST / MODAL / FILE ---------- */
function toast(msg, isError){
  const host = $('toastHost');
  if (!host) { alert(msg); return; }
  if (!host.dataset.sfsPositioned){
    host.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;';
    host.dataset.sfsPositioned = '1';
  }
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'margin-top:8px;padding:11px 18px;border-radius:8px;color:#fff;font-size:13.5px;font-weight:500;box-shadow:0 6px 18px rgba(11,27,43,.18);' + (isError?'background:#DC2626;':'background:#059669;');
  host.appendChild(el);
  setTimeout(() => { el.remove(); }, 4000);
}

function modal(t, b){
  $('modalTitle').textContent = t;
  $('modalBody').innerHTML = b;
  $('modal').classList.remove('hidden');
}
function closeModal(){ $('modal').classList.add('hidden'); }

function file64(f){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

/* ---------- PRINT (PROFESSIONAL) ---------- */
function fillerRows(count, minRows, cols){
  const n = Math.max(0, minRows - count);
  let out = '';
  for (let i = 0; i < n; i++){
    out += `<tr class="filler">${'<td>&nbsp;</td>'.repeat(cols)}</tr>`;
  }
  return out;
}


let QTL=[];
let QT_CACHE=[];
function renderQuotation(){ $('qtdate').value=todayStr(); QTL=[{model:'',qty:'',unit:'Pcs',rate:''}]; renderQuotationLines(); updateQuotationTotal(); }
function pickQuotationCustomer(){ const c=findCust($('qtcustomer').value); if(!c)return; $('qtcustomerId').value=c['Customer ID']||''; $('qtaddress').value=c['Address']||''; $('qtstn').value=stnOf(c); $('qtnTN').value=c['NTN/Tax ID']||''; }
function addQuotationLine(){ QTL.push({model:'',qty:'',unit:'Pcs',rate:''}); renderQuotationLines(); }
function removeQuotationLine(i){ QTL.splice(i,1); if(!QTL.length)QTL.push({model:'',qty:'',unit:'Pcs',rate:''}); renderQuotationLines(); updateQuotationTotal(); }
function quotationModelChanged(i){ const p=findProd(QTL[i].model); if(p){QTL[i].unit=p.Unit||'Pcs'; const rate=Number(p['Sale Price']||0); if(rate>0)QTL[i].rate=rate;} renderQuotationLines(); updateQuotationTotal(); }
function renderQuotationLines(){ const h=$('qtlines'); if(!h)return; h.innerHTML=QTL.map((x,i)=>`<tr><td><input value="${esc(x.model)}" list="mlist" onchange="QTL[${i}].model=this.value;quotationModelChanged(${i})"></td><td>${esc((findProd(x.model)||{}).Description||'')}</td><td><input type="number" min="0" step="any" value="${esc(x.qty)}" oninput="QTL[${i}].qty=this.value;updateQuotationTotal()"></td><td><input value="${esc(x.unit||'Pcs')}" oninput="QTL[${i}].unit=this.value"></td><td><input type="number" min="0" step="0.01" value="${esc(x.rate)}" oninput="QTL[${i}].rate=this.value;updateQuotationTotal()"></td><td>${money((+x.qty||0)*(+x.rate||0))}</td><td><button class="btn danger" type="button" onclick="removeQuotationLine(${i})">×</button></td></tr>`).join(''); }
function updateQuotationTotal(){ const total=QTL.reduce((a,x)=>a+(+x.qty||0)*(+x.rate||0),0); if($('qttotal'))$('qttotal').textContent='TOTAL: '+money(total); }
async function saveQuotation(){ const customer=$('qtcustomer').value.trim(); if(!customer)return alert('Customer is required.'); const items=QTL.filter(x=>String(x.model||'').trim()&&Number(x.qty)>0); if(!items.length)return alert('Add at least one item with quantity.'); if(items.some(x=>Number(x.rate)<0))return alert('Rate cannot be negative.'); const r=await api('saveQuotation',{no:$('qtno').value.trim(),date:$('qtdate').value,customerId:$('qtcustomerId').value,customer:customer,address:$('qtaddress').value,po:$('qtpo').value,poDate:$('qtpoDate').value,validity:$('qtvalidity').value,stn:$('qtstn').value,ntn:$('qtnTN').value,items:items}); if(!r.ok)return alert(r.error); $('qtno').value=r.id||''; alert('Quotation saved successfully.'); }
function printQuotationFromForm(){ const customer=$('qtcustomer').value.trim(); const items=QTL.filter(x=>String(x.model||'').trim()&&Number(x.qty)>0); if(!customer||!items.length)return alert('Enter customer and at least one item first.'); printQuotation({no:$('qtno').value||'DRAFT',date:$('qtdate').value,customer:customer,address:$('qtaddress').value,po:$('qtpo').value,poDate:$('qtpoDate').value,validity:$('qtvalidity').value,stn:$('qtstn').value,ntn:$('qtnTN').value,items:items}); }
async function loadQTHistory(){ const r=await api('quotationHistory'); if(!r.ok){if($('qtrows'))$('qtrows').innerHTML='<tr><td colspan="6">'+esc(r.error)+'</td></tr>';return;} QT_CACHE=r.documents||[]; filterQTHistory(); }
function filterQTHistory(){ const h=$('qtrows'); if(!h)return; const q=norm($('qts')?.value||''); const rows=QT_CACHE.filter(d=>!q||norm(d.no).includes(q)||norm(d.customer).includes(q)||norm(d.po).includes(q)); h.innerHTML=rows.map(d=>`<tr><td><b>${esc(d.no)}</b></td><td>${fmtDate(d.date)}</td><td>${esc(d.customer)}</td><td>${esc(d.po)}</td><td>${money(d.subtotal)}</td><td><button class="btn" onclick="viewQuotation('${encA(d.no)}')">View / Print</button></td></tr>`).join('')||'<tr><td colspan="6">No quotations found.</td></tr>'; }
function viewQuotation(en){ const no=decodeURIComponent(en); const d=QT_CACHE.find(x=>x.no===no); if(d)printQuotation(d); }
function printQuotation(d){ const rows=(d.items||[]).map((x,i)=>{const p=findProd(x.model)||{};const amt=(+x.qty||0)*(+x.rate||0);return `<tr><td class="c">${i+1}</td><td>${esc(x.desc||p.Description||'')}${x.model?'<br><span class="muted">Model: '+esc(x.model)+'</span>':''}</td><td class="c">${esc(p['Product ID']||'')}</td><td class="c">${x.qty}<br><span class="muted">${esc(x.unit||'nos')}</span></td><td class="c">${money(x.rate)}</td><td class="r">${money(amt)}</td></tr>`;}).join(''); const total=(d.items||[]).reduce((a,x)=>a+(+x.qty||0)*(+x.rate||0),0); const body=`<div class="doc-head"><div class="doc-head-left"><img src="logo.png" class="doc-logo"></div><div class="doc-head-right"><div class="doc-title">QUOTATION</div></div></div><div class="doc-meta"><div class="meta-left"><div class="meta-line"><span class="meta-tag">M/S:</span><span class="cust-name">${esc(d.customer)}</span></div><div class="meta-line"><span class="meta-tag">Address:</span><span>${esc(d.address||((findCust(d.customer)||{}).Address)||'')}</span></div><div class="meta-line" style="margin-top:10px"><span class="meta-tag">P.O#:</span><span>${esc(d.po)}</span><span class="meta-tag" style="margin-left:14px">Date:</span><span>${fmtDate(d.poDate)}</span></div><div class="meta-line"><span class="meta-tag">Validity:</span><span>${esc(d.validity||'30 Days')}</span></div></div><div class="meta-right"><div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">${fmtDate(d.date)}</span></div><div class="meta-row"><span class="meta-label">Quotation#:</span><span class="meta-value"><b>${esc(d.no)}</b></span></div><div class="meta-row"><span class="meta-label">S.T.N#:</span><span class="meta-value">${esc(d.stn)}</span></div><div class="meta-row"><span class="meta-label">N.T.N#:</span><span class="meta-value">${esc(d.ntn)}</span></div></div></div><table class="doc-items"><thead><tr><th class="c">Item</th><th>Description</th><th class="c">Item Code</th><th class="c">Qty.</th><th class="c">Rate/Unit</th><th class="c">Amount</th></tr></thead><tbody>${rows}</tbody></table><table class="doc-totals"><tr><td class="words"><i>RUPEES: ${numberToWords(total)} Only /-</i></td><td class="tot-label">TOTAL</td><td class="r"><b>${money(total)}</b></td></tr></table><div class="doc-endblock doc-footer-note"><div><i>FOR STANDARD FLUID SYSTEMS</i></div></div>`; printDoc(body); }
function printDC(d){
  const rows = d.items.map((x,i) => {
    const prod = S.products.find(p => p['Model / Part No.'] === x.model) || {};
    return `<tr>
       <td class="c">${i+1}</td>
       <td>${esc(prod.Description || x.desc || '')}${x.model?`<br><span class="muted">Model: ${esc(x.model)}</span>`:''}</td>
       <td class="c">${esc(prod['Product ID']||'')}</td>
       <td class="c"><b>${x.qty}</b><br><span class="muted">${esc(x.unit||'nos')}</span></td>
       <td class="c">-<br><span class="muted">each</span></td>
       <td></td>
     </tr>`;
  }).join('') + fillerRows(d.items.length, 6, 6);

  const cust = S.customers.find(c => String(c['Customer Name']||'').toLowerCase() === String(d.customer||'').toLowerCase()) || {};
  const attn = d.attn || cust['Contact Person'] || '';

  const body = `
    <div class="doc-head">
      <div class="doc-head-left"><img src="logo.png" class="doc-logo"></div>
      <div class="doc-head-right"><div class="doc-title">CHALLAN</div></div>
    </div>
    <div class="doc-meta">
      <div class="meta-left">
        <div class="meta-line"><span class="meta-tag">M/S:</span><span class="cust-name">${esc(d.customer)}</span></div>
        <div class="meta-line"><span class="meta-tag"></span><span>${esc(d.address||'')}</span></div>
        ${attn?`<div class="meta-line" style="margin-top:6px"><span class="meta-tag">To:</span><span><b>${esc(attn)}</b></span></div>`:''}
      </div>
      <div class="meta-right">
        <div class="meta-row"><span class="meta-label">DATE:</span><span class="meta-value">${fmtDate(d.date)}</span></div>
        <div class="meta-row"><span class="meta-label">Challan #:</span><span class="meta-value"><b>${esc(d.no)}</b></span></div>
        <div class="meta-row"><span class="meta-label">Customer ID:</span><span class="meta-value">${esc(d.customerId)}</span></div>
        <div class="meta-row"><span class="meta-label">PO #:</span><span class="meta-value"><b>${esc(d.po)}</b></span></div>
        <div class="meta-row"><span class="meta-label">PO Date:</span><span class="meta-value">${fmtDate(d.poDate)}</span></div>
        <div class="meta-row"><span class="meta-label">STN:</span><span class="meta-value">${esc(d.stn)}</span></div>
        <div class="meta-row"><span class="meta-label">NTN:</span><span class="meta-value">${esc(d.ntn)}</span></div>
      </div>
    </div>
    <table class="doc-items">
      <thead><tr><th class="c">Item</th><th>Description</th><th class="c">Item Code</th><th class="c">Qty.</th><th class="c">Rate/Unit</th><th class="c">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4"></td><td class="tot-label">TOTAL</td><td></td></tr></tfoot>
    </table>
    <div class="doc-endblock">
      <div class="doc-thanks">Thank you for Your Business!</div>
      <div class="doc-sign">Receiver's Name &amp; Sign</div>
    </div>`;

  printDoc(body);
}

function printInvoice(d){
  const items = d.items || [];
  const rows = items.map((x,i) => {
    const prod = S.products.find(p => p['Model / Part No.'] === x.model) || {};
    const amt = (+x.qty||0)*(+x.rate||0);
    return `<tr>
       <td class="c">${i+1}</td>
       <td>${esc(x.desc||prod.Description||'')}${x.model?`<br><span class="muted">Model: ${esc(x.model)}</span>`:''}</td>
       <td class="c">${esc(prod['Product ID']||'')}</td>
       <td class="c"><b>${x.qty}</b><br><span class="muted">nos</span></td>
       <td class="c">${money(x.rate)}<br><span class="muted">each</span></td>
       <td class="r">${money(amt)}</td>
     </tr>`;
  }).join('') + fillerRows(items.length, 6, 6);

  const subtotal = items.reduce((a,x) => a + (+x.qty||0)*(+x.rate||0), 0);
  const gstPct = d.gstPercent !== undefined && d.gstPercent !== null ? Number(d.gstPercent) : 18;
  const gst = subtotal * gstPct / 100;
  const total = d.grandTotal != null ? Number(d.grandTotal) : (d.total != null ? Number(d.total) : subtotal + gst);

  const body = `
    <div class="doc-head">
      <div class="doc-head-left"><img src="logo.png" class="doc-logo"></div>
      <div class="doc-head-right"><div class="doc-title">INVOICE</div></div>
    </div>
    <div class="doc-meta">
      <div class="meta-left">
        <div class="meta-line"><span class="meta-tag">M/S:</span><span>${esc(d.customer)}</span></div>
        <div class="meta-line"><span class="meta-tag">Address:</span><span>${esc(d.address || ((findCust(d.customer)||{}).Address) || '')}</span></div>
        <div class="meta-line" style="margin-top:10px">
          <span class="meta-tag">P.O#:</span><span>${esc(d.po)}</span>
          <span class="meta-tag" style="margin-left:14px">Date:</span><span>${fmtDate(d.poDate)}</span>
        </div>
        <div class="meta-line">
          <span class="meta-tag">Delivery Challan #:</span><span>${esc(d.dc)}</span>
          <span class="meta-tag" style="margin-left:14px">Date:</span><span>${fmtDate(d.dcDate)}</span>
        </div>
      </div>
      <div class="meta-right">
        <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">${fmtDate(d.date)}</span></div>
        <div class="meta-row"><span class="meta-label">Invoice#:</span><span class="meta-value"><b>${esc(d.no)}</b></span></div>
        <div class="meta-row"><span class="meta-label">S.T.N#:</span><span class="meta-value">${esc(d.stn)}</span></div>
        <div class="meta-row"><span class="meta-label">N.T.N#:</span><span class="meta-value">${esc(d.ntn)}</span></div>
      </div>
    </div>
    <table class="doc-items">
      <thead><tr><th class="c">Item</th><th>Description</th><th class="c">Item Code</th><th class="c">Qty.</th><th class="c">Rate/Unit</th><th class="c">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="doc-totals">
      <tr>
        <td class="words" rowspan="3"><i>RUPEES: ${numberToWords(total)} Only /-</i></td>
        <td class="tot-label">SUB TOTAL</td>
        <td class="r">${money(subtotal)}</td>
      </tr>
      <tr><td class="tot-label">ADD GST ${gstPct}%</td><td class="r">${money(gst)}</td></tr>
      <tr><td class="tot-label"><b>TOTAL</b></td><td class="r"><b>${money(total)}</b></td></tr>
    </table>
    <div class="doc-endblock doc-footer-note">

      <div class="doc-sign-block"><i>FOR STANDARD FLUID SYSTEMS</i></div>
    </div>`;

  printDoc(body);
}

function printDoc(body){
  $('printArea').innerHTML = `<style>
    #printArea{display:block}
    .print-doc{font-family:Arial,Helvetica,sans-serif;color:#111;width:100%;max-width:100%;margin:0 auto;font-size:15px;box-sizing:border-box;padding:6mm 10mm 10mm;display:flex;flex-direction:column;min-height:277mm}
    .doc-body{flex:1 0 auto;display:flex;flex-direction:column}
    .doc-endblock{margin-top:auto;padding-top:20px}
    .filler td{border-color:#333;height:30px}
    .doc-head{display:flex!important;justify-content:space-between;align-items:center;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:20px}
    .doc-head-left{display:flex!important;align-items:center;gap:8px}
    .doc-logo{height:56px}
    .doc-title{font-size:32px;font-weight:bold;color:#333}
    .doc-meta{display:flex!important;justify-content:space-between;gap:20px;margin-bottom:26px}
    .meta-left{width:58%;font-size:12.5px}
    .meta-right{width:38%;font-size:12.5px}
    .meta-line{display:flex!important;flex-wrap:wrap;gap:6px;margin-bottom:3px}
    .meta-tag{font-weight:bold;white-space:nowrap}
    .cust-name{font-style:italic;font-weight:bold;font-size:14.5px}
    .meta-row{display:flex!important;justify-content:space-between;gap:10px;margin-bottom:3px;white-space:nowrap}
    .meta-label{font-weight:bold}
    .meta-value{text-align:right}
    .doc-items{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:14.5px}
    .doc-items th,.doc-items td{border:1px solid #333;padding:9px 10px;vertical-align:top}
    .doc-items th{background:#f0f0f0;text-align:left}
    .doc-items .c{text-align:center}
    .doc-items .r{text-align:right}
    .muted{color:#555;font-size:12.5px;font-style:italic}
    .tot-label{text-align:right;font-weight:bold;background:#f7f7f7}
    .doc-totals{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:14.5px}
    .doc-totals td{border:1px solid #333;padding:9px 10px}
    .doc-totals .words{width:55%;vertical-align:middle}
    .doc-totals .r{text-align:right;width:15%}
    .doc-thanks{text-align:center;font-weight:bold;margin:18px 0 34px;font-size:15px}
    .doc-sign{text-align:right;margin-bottom:24px;font-size:15px}
    .doc-footer-note{display:flex!important;justify-content:space-between;align-items:flex-end;margin-bottom:16px;font-size:14px}
    .doc-sign-block{font-style:italic}
    .print-company{flex:0 0 auto;text-align:center;font-size:12.5px;color:#333;border-top:1px solid #ccc;padding-top:14px;margin-top:auto;padding-bottom:4px}
    .print-company b{font-size:15px}
    @media print{
      @page{size:A4;margin:0}
      html,body{margin:0!important;padding:0!important;width:210mm;height:297mm}
      body *{visibility:hidden!important}
      #printArea,#printArea *{visibility:visible!important}
      #printArea{position:absolute!important;left:0;top:0;width:210mm!important}
      .print-doc{padding:8mm 14mm 14mm;min-height:275mm}
    }
  </style>
  <div class="print-doc">
    <div class="doc-body">${body}</div>
    <div class="print-company">
      <b>STANDARD FLUID SYSTEMS</b>
      <div>General Industrial Machinery &amp; Equipment</div>
      <div>1410, 14th Floor, K.S Trade Tower, New Challi, Karachi, Ph:021 32464447, cell: 0301 8212041</div>
      <div>e-mail: sales@standardfluid.com, standardfluidsystems@live.com, www.standardfluid.com</div>
    </div>
  </div>`;
  setTimeout(() => window.print(), 100);
}

/* ---------- INIT ---------- */
function showLogin(){
  $('app').classList.add('hidden');
  $('login').classList.remove('hidden');
  generateCaptcha();
  $('loginUser')?.focus();
}

function init(){
  S.api = DEFAULT_API;
  if (S.session && S.api){
    SFS_BOOTING = true;
    api('bootstrap').then(r => {
      SFS_BOOTING = false;
      if (r.ok){
        S.user = r.user;
        S.products = r.products || [];
        S.customers = r.customers || [];
        S.suppliers = r.suppliers || [];
        S.tx = r.transactions || [];
        syncDatalists();
        enter();
      } else {
        if (r.error === 'Unauthorized') sessionStorage.clear();   // network error par session mat mitao
        showLogin();
        if (r.error && r.error !== 'Unauthorized' && $('loginError')) $('loginError').textContent = r.error;
      }
    });
  } else {
    showLogin();
  }
}
init();

/* ---------- GLOBAL EXPORTS ---------- */
window.login = login;
window.logout = logout;
window.refresh = refresh;
window.showPage = showPage;
window.productForm = productForm;
window.bulkProductForm = bulkProductForm;
window.saveBulkProducts = saveBulkProducts;
window.bulkInwardForm = bulkInwardForm;
window.saveBulkInward = saveBulkInward;
window.saveProduct = saveProduct;
window.productDetail = productDetail;
window.editProductForm = editProductForm;
window.saveProductEdit = saveProductEdit;
window.toggleProductStatus = toggleProductStatus;
window.renderProducts = renderProducts;
window.addDc = addDc;
window.addInv = addInv;
window.saveDC = saveDC;
window.saveInvoice = saveInvoice;
window.renderQuotation=renderQuotation;window.pickQuotationCustomer=pickQuotationCustomer;window.addQuotationLine=addQuotationLine;window.removeQuotationLine=removeQuotationLine;window.quotationModelChanged=quotationModelChanged;window.updateQuotationTotal=updateQuotationTotal;window.saveQuotation=saveQuotation;window.printQuotationFromForm=printQuotationFromForm;window.loadQTHistory=loadQTHistory;window.filterQTHistory=filterQTHistory;window.viewQuotation=viewQuotation;
window.saveInward = saveInward;
window.renderInward = renderInward;
window.renderCustomers = renderCustomers;
window.renderSuppliers = renderSuppliers;
window.partyForm = partyForm;
window.saveParty = saveParty;
window.editPartyForm = editPartyForm;
window.savePartyEdit = savePartyEdit;
window.togglePartyStatus = togglePartyStatus;
window.ledger = ledger;
window.renderReports = renderReports;
window.renderSettings = renderSettings;
window.refreshSource = refreshSource;
window.changePasswordForm = changePasswordForm;
window.changePassword = changePassword;
window.renderUsers = renderUsers;
window.userForm = userForm;
window.saveUser = saveUser;
window.toggleUser = toggleUser;
window.closeModal = closeModal;
window.setTargetForm = setTargetForm;
window.saveTargetSubmit = saveTargetSubmit;
window.loadDCHistory = loadDCHistory;
window.filterDCHistory = filterDCHistory;
window.viewDC = viewDC;
window.loadIVHistory = loadIVHistory;
window.filterIVHistory = filterIVHistory;
window.viewInvoice = viewInvoice;
window.renderAccounts = renderAccounts;
window.filterCustOut = filterCustOut;
window.filterCustPay = filterCustPay;
window.clearPaySearch = clearPaySearch;
window.pickCustomer = pickCustomer;
window.editDC = editDC;
window.cancelEditDC = cancelEditDC;
window.loadDcIntoInvoice = loadDcIntoInvoice;
window.editInvoice = editInvoice;
window.cancelEditInvoice = cancelEditInvoice;
window.ivModelChanged = ivModelChanged;
window.updateIvTotals = updateIvTotals;
window.toggleSidebar = (typeof window.toggleSidebar === 'function') ? window.toggleSidebar : function(){};

/* ============================================================
   [ADDED] TOP LOADING BAR — see the block below. Nothing above
   this line has been changed.
   ============================================================ */
/* ============================================================
   SFS BUSINESS MANAGEMENT — TOP LOADING BAR  (v1.0)
   ------------------------------------------------------------
   This block was added at the END of app.js (it does not change any
   purana function / data / variable is se change nahi hota).
   Kaam:
     - Top loading bar on every button / link / navigation click
     - Loading bar on page changes through showPage()
     - Backend API (fetch / XHR) ke doran bar
     - Loading bar on initial load, reload, and back/forward navigation
   Manual: SFSLoader.start() | SFSLoader.finish() | SFSLoader.pulse()
   To disable it: add class="no-loader" to a button.
   ============================================================ */
(function () {
  'use strict';
  if (window.SFSLoader && window.SFSLoader.__v) return;   // double-load guard

  var MIN_SHOW = 420, TRICKLE_MS = 250, MAX_TRICKLE = 92;

  /* ---------- CSS (agar index.html mein pehle se hai to inject nahi karega) ---------- */
  if (!document.getElementById('sfsProgressStyles')) {
    var CSS = [
      '#sfsProgress{position:fixed;left:0;right:0;top:0;height:3px;z-index:2147483000;',
        'pointer-events:none;opacity:0;transition:opacity .25s ease}',
      '#sfsProgress.sfs-active{opacity:1}',
      '#sfsProgressBar{position:relative;height:100%;width:0;border-radius:0 3px 3px 0;',
        'background:linear-gradient(90deg,#3B5BDB 0%,#5B7CFA 45%,#10B981 100%);',
        'box-shadow:0 0 8px rgba(59,91,219,.55),0 0 14px rgba(16,185,129,.35);',
        'transition:width .25s ease}',
      '#sfsProgressBar::after{content:"";position:absolute;right:0;top:0;bottom:0;width:90px;',
        'background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.8));',
        'border-radius:0 3px 3px 0;opacity:.9}',
      '@media print{#sfsProgress{display:none!important}}',
      '@media (prefers-reduced-motion:reduce){#sfsProgressBar{transition:none!important}}'
    ].join('');
    var styleEl = document.createElement('style');
    styleEl.id = 'sfsProgressStyles';
    styleEl.textContent = CSS;
    (document.head || document.documentElement).appendChild(styleEl);
  }

  /* ---------- Bar element (agar index.html mein pehle se hai to dobara nahi banayega) ---------- */
  function mount() {
    var el = document.getElementById('sfsProgress');
    if (!el) {
      el = document.createElement('div');
      el.id = 'sfsProgress';
      el.setAttribute('role', 'progressbar');
      el.setAttribute('aria-label', 'Loading');
      var b = document.createElement('div');
      b.id = 'sfsProgressBar';
      el.appendChild(b);
      (document.body || document.documentElement).appendChild(el);
    }
    if (!document.getElementById('sfsProgressBar')) {
      var b2 = document.createElement('div');
      b2.id = 'sfsProgressBar';
      el.appendChild(b2);
    }
    return el;
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  function rootEl() { return document.getElementById('sfsProgress'); }
  function barEl()  { return document.getElementById('sfsProgressBar'); }
  function setWidth(p) { var b = barEl(); if (b) b.style.width = p + '%'; }

  /* ---------- engine ---------- */
  var count = 0, running = false, startedAt = 0, progress = 0, gen = 0;
  var trickleTimer = null, completeTimer = null, hideTimer = null;

  function trickle() {
    clearTimeout(trickleTimer);
    trickleTimer = setTimeout(function () {
      if (!running || count === 0) return;
      progress += Math.max(0.7, (MAX_TRICKLE - progress) * 0.11);
      if (progress > MAX_TRICKLE) progress = MAX_TRICKLE;
      setWidth(progress);
      trickle();
    }, TRICKLE_MS);
  }

  function start() {
    var r = rootEl(), b = barEl();
    if (!r || !b) return gen;
    count++; gen++;
    if (completeTimer) { clearTimeout(completeTimer); completeTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (!running) {
      running = true; startedAt = Date.now(); progress = 8;
      r.style.display = 'block';
      void r.offsetWidth;
      r.classList.add('sfs-active');
      b.style.transition = 'width .25s ease';
      setWidth(progress);
      trickle();
    }
    return gen;
  }

  function complete() {
    if (!running) return;
    var myGen = gen;
    var wait = Math.max(0, MIN_SHOW - (Date.now() - startedAt));
    clearTimeout(completeTimer);
    completeTimer = setTimeout(function () {
      if (gen !== myGen || count > 0) return;
      var r = rootEl(), b = barEl();
      if (!r || !b) { running = false; return; }
      running = false;
      clearTimeout(trickleTimer); trickleTimer = null;
      b.style.transition = 'width .18s ease';
      setWidth(100);
      hideTimer = setTimeout(function () {
        r.classList.remove('sfs-active');
        hideTimer = setTimeout(function () {
          r.style.display = 'none';
          b.style.transition = 'none';
          setWidth(0);
          void r.offsetWidth;
          b.style.transition = 'width .25s ease';
          progress = 0;
        }, 250);
      }, 200);
    }, wait);
  }

  function finish() { count = Math.max(0, count - 1); if (count > 0) return; complete(); }
  function pulse()  { start(); finish(); }

  window.SFSLoader = { __v: '1.0', start: start, finish: finish, done: finish, pulse: pulse };

  /* ============================================================
     HOOKS  (sab try/catch mein — app par koi asar nahi)
     ============================================================ */
  var safe = function (fn) { try { fn(); } catch (e) { /* app kabhi na toote */ } };

  /* 1) Pehli page load */
  safe(function () {
    start();
    var end = function () { finish(); };
    if (document.readyState === 'complete') setTimeout(end, 150);
    else { window.addEventListener('load', end, { once: true }); setTimeout(end, 6000); }
  });

  /* 2) Reload / navigate / back-forward */
  safe(function () {
    window.addEventListener('beforeunload', function () { start(); });
    window.addEventListener('pageshow', function () { pulse(); });
    window.addEventListener('popstate', function () { pulse(); });
    window.addEventListener('hashchange', function () { pulse(); });
  });

  /* 3) Har button / link click (event delegation) */
  safe(function () {
    document.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var el = e.target && e.target.closest
        ? e.target.closest('button, a, [role="button"], .navbtn, input[type="submit"], input[type="button"]')
        : null;
      if (!el || el.disabled) return;
      if (el.closest('.no-loader') || el.hasAttribute('data-no-loader')) return;
      if (el.closest('#sfsProgress')) return;
      pulse();
    }, true);
  });

  /* 4) fetch() — backend data aane tak bar chalti rahegi */
  safe(function () {
    if (typeof window.fetch !== 'function' || window.fetch.__sfsWrapped) return;
    var orig = window.fetch;
    var wrapped = function () {
      start();
      var p;
      try { p = orig.apply(this, arguments); }
      catch (err) { finish(); throw err; }
      if (p && typeof p.then === 'function') {
        return p.then(function (r) { finish(); return r; },
                      function (err) { finish(); throw err; });
      }
      finish();
      return p;
    };
    wrapped.__sfsWrapped = true;
    window.fetch = wrapped;
  });

  /* 5) XMLHttpRequest (agar kahin use ho) */
  safe(function () {
    var XP = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (!XP || XP.__sfsPatched) return;
    var origOpen = XP.open, origSend = XP.send;
    XP.open = function () { try { this.__sfsTrack = true; } catch (e) {} return origOpen.apply(this, arguments); };
    XP.send = function () {
      var self = this;
      if (self.__sfsTrack) {
        start();
        var end = function () { if (self.__sfsDone) return; self.__sfsDone = true; finish(); };
        try { self.addEventListener('loadend', end); } catch (e) { setTimeout(end, 3000); }
      }
      return origSend.apply(this, arguments);
    };
    XP.__sfsPatched = true;
  });

  /* 6) SPA router — showPage() wrap (app.js ke baad chalne ki wajah se ye available hai) */
  safe(function () {
    var patch = function () {
      if (typeof window.showPage !== 'function' || window.showPage.__sfsWrapped) return false;
      var orig = window.showPage;
      var wrapped = function () {
        start();
        var out;
        try { out = orig.apply(this, arguments); }
        catch (err) { finish(); throw err; }
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { setTimeout(finish, 120); });
        });
        return out;
      };
      wrapped.__sfsWrapped = true;
      window.showPage = wrapped;
      return true;
    };
    if (!patch()) document.addEventListener('DOMContentLoaded', patch);
  });
})();
