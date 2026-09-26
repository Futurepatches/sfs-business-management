/* ============================================================
   SFS BUSINESS MANAGEMENT — FRONTEND v3 (COMPLETE)
   - Dynamic Captcha (captchaLabel + captchaAnswer)
   - Donut chart, Low stock, Sales target, Top customers
   - Edit Product / Customer / Supplier, Status toggle
   - Professional Print (DC + Invoice) with logo, GST, words
   - DC History + Invoice History (NEW)
   - Module permissions (Add Staff)
   - Sidebar collapse
   - DATA SAFETY: kuch delete nahi karta
   ============================================================ */

const DEFAULT_API = (window.SFS_CONFIG && window.SFS_CONFIG.API_URL) || localStorage.sfsApiUrl || '';
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

  // Default: Dashboard agar available, warna pehla item
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

async function api(action, data = {}){
  if (!S.api) return {ok:false, error:'Backend URL not configured'};
  var payload = Object.assign({action:action, session:S.session||''}, data||{});
  try {
    var r = await fetch(S.api, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(payload) });
    var text = await r.text(), j;
    try { j = JSON.parse(text); } catch(e){ j = null; }
    if (j) return j;
  } catch(e){ console.warn('POST failed; JSONP fallback.', e); }
  return await jsonpRequest(S.api, payload);
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
async function login(){
  const user = $('loginUser').value.trim();
  const pass = $('loginPass').value;
  const captcha = Number($('captchaAnswer')?.value);

  if (!user || !pass) { $('loginError').textContent = 'Username and password are required.'; return; }
  if (isNaN(captcha)) { $('loginError').textContent = 'Please answer the security check.'; return; }
  if (captcha !== SFS_CAPTCHA_ANSWER) { $('loginError').textContent = 'Security check answer is incorrect.'; generateCaptcha(); return; }

  S.api = (window.SFS_CONFIG && window.SFS_CONFIG.API_URL) || DEFAULT_API || localStorage.sfsApiUrl || '';
  if (!S.api) { $('loginError').textContent = 'System connection is not configured.'; return; }

  $('loginError').textContent = 'Signing in...';
  const r = await api('login', {username:user, password:pass});
  if (!r.ok) { $('loginError').textContent = r.error || 'Invalid username or password'; generateCaptcha(); return; }

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

function logout(){
  if (S.session) api('logout').catch(()=>{});
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
  products:()=>`<div class="wrap"><div class="toolbar"><input id="ps" placeholder="Search model / description / location" oninput="renderProducts()"><select id="pc" onchange="renderProducts()"><option value="">All Categories</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select><button class="btn primary" onclick="productForm()">+ Add Product</button></div><div class="panel table-wrap"><table><thead><tr><th>Image</th><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Location</th><th>Stock</th></tr></thead><tbody id="prows"></tbody></table></div></div>`,
  inward:()=>`<div class="wrap"><div class="panel"><h3>Inward / Local Purchase</h3><div class="form-grid"><label>Date<input id="idate" type="date"></label><label>Source Type<select id="itype"><option>Local Purchase</option><option>Import</option><option>Opening</option><option>Customer Return</option></select></label><label>Model / Part No.<input id="imodel" list="mlist"></label><label>Quantity<input id="iqty" type="number" min="0.01"></label><label>Supplier<input id="isupplier" list="suplist"></label><label>Supplier Reference<input id="iref"></label><label>Purchase Cost<input id="icost" type="number" min="0"></label><label>Remarks<input id="irem"></label></div><button class="btn primary" onclick="saveInward()">Save Inward</button></div></div>`,
  dc:()=>`<div class="wrap"><div class="panel"><h3>Delivery Challan</h3><div class="form-grid"><label>Challan #<input id="dcno"></label><label>Date<input id="dcdate" type="date"></label><label>Customer<input id="dccust" list="clist"></label><label>Customer ID<input id="dcid"></label><label>PO #<input id="dcpo"></label><label>PO Date<input id="dcpodate" type="date"></label><label>STN<input id="dcstn"></label><label>NTN<input id="dcntn"></label><label class="wide">Address<textarea id="dcaddr"></textarea></label></div><div class="panel"><button class="btn small" onclick="addDc()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Unit</th><th></th></tr></thead><tbody id="dclines"></tbody></table></div></div><div class="actions"><button class="btn primary" onclick="saveDC(false)">Save DC</button><button class="btn ghost" onclick="saveDC(true)">Save &amp; Print</button></div></div></div>`,
  dchistory:()=>`<div class="wrap"><div class="toolbar"><input id="dchSearch" placeholder="Search Challan #, Customer, PO #, Model..." oninput="filterDCHistory()" style="flex:1;min-width:280px"><button class="btn" onclick="loadDCHistory()">↻ Refresh</button></div><div class="panel table-wrap"><table><thead><tr><th>Challan #</th><th>Date</th><th>Customer</th><th>PO #</th><th>Items</th><th>Total Qty</th><th>Actions</th></tr></thead><tbody id="dchRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>`,
  invoices:()=>`<div class="wrap"><div class="panel"><h3>Invoice</h3><div class="form-grid"><label>Invoice #<input id="ivno"></label><label>Date<input id="ivdate" type="date"></label><label>Customer<input id="ivcust" list="clist"></label><label>PO #<input id="ivpo"></label><label>PO Date<input id="ivpodate"></label><label>DC #<input id="ivdc"></label><label>DC Date<input id="ivdcdate"></label><label>STN<input id="ivstn"></label><label>NTN<input id="ivntn"></label></div><div class="panel"><button class="btn small" onclick="addInv()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead><tbody id="ivlines"></tbody></table></div><h3 class="right">Subtotal: <span id="ivtotal">0.00</span></h3></div><div class="actions"><button class="btn primary" onclick="saveInvoice(false)">Save Invoice</button><button class="btn ghost" onclick="saveInvoice(true)">Save &amp; Print</button></div></div></div>`,
  ivhistory:()=>`<div class="wrap"><div class="toolbar"><input id="ivhSearch" placeholder="Search Invoice #, Customer, DC #, PO #, Model..." oninput="filterIVHistory()" style="flex:1;min-width:280px"><button class="btn" onclick="loadIVHistory()">↻ Refresh</button></div><div class="panel table-wrap"><table><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>DC #</th><th>PO #</th><th>Total</th><th>Actions</th></tr></thead><tbody id="ivhRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>`,
  accounts:()=>`<div class="wrap">
<div class="panel"><div class="panel-head"><h3>Customer Outstanding</h3><button class="btn" onclick="loadAccounts()">↻ Refresh</button></div><div class="table-wrap"><table><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Outstanding</th><th></th></tr></thead><tbody id="custOutRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>
<div class="panel"><h3>Recent Customer Payments</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Invoice #</th><th>Customer</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody id="custPayRows"><tr><td colspan="6" class="empty">Loading…</td></tr></tbody></table></div></div>
<div class="panel"><div class="panel-head"><h3>Supplier Payable</h3><button class="btn" onclick="loadAccounts()">↻ Refresh</button></div><div class="table-wrap"><table><thead><tr><th>Supplier</th><th>Purchased</th><th>Paid</th><th>Outstanding</th><th></th></tr></thead><tbody id="supOutRows"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table></div></div>
<div class="panel"><h3>Recent Supplier Payments</h3><div class="table-wrap"><table><thead><tr><th>Date</th><th>Supplier</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody id="supPayRows"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table></div></div>
</div>`,
  customers:()=>`<div class="wrap"><div class="panel-head"><h3>Customers</h3><button class="btn primary" onclick="partyForm('Customer')">+ Add Customer</button></div><div class="panel"><div id="customers"></div></div></div>`,
  suppliers:()=>`<div class="wrap"><div class="panel-head"><h3>Suppliers</h3><button class="btn primary" onclick="partyForm('Supplier')">+ Add Supplier</button></div><div class="panel"><div id="suppliers"></div></div></div>`,
  reports:()=>`<div class="wrap"><div class="toolbar"><select id="ry"><option>2026</option><option>2025</option><option>2024</option></select><button class="btn" onclick="renderReports()">Refresh</button></div><div id="reports"></div></div>`,
  settings:()=>`<div class="wrap"><div class="panel"><h3>System Settings</h3><p class="muted">Original live inventory read-only hai. Ye software sirf apni separate database mein likhta hai.</p><label>Apps Script Web App URL<input id="apiurl" class="input" value="${esc(S.api)}"></label><div class="actions"><button class="btn primary" onclick="saveSettings()">Save Settings</button></div><hr><button class="btn" onclick="changePasswordForm()">Change My Password</button>${isAdmin()?'<button class="btn" onclick="refreshSource()">Refresh Source Snapshot</button>':''}</div></div>`,
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

function renderDashboard(){
  const lowStock = S.products.filter(p => Number(p.currentStock) <= Number(p['Reorder Level']||5) && (p.Status||'Active')==='Active');
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
    ${lowStock.length ? `<div class="panel"><h3 class="section-title" style="color:#c0392b">Low Stock Items</h3><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Current Stock</th><th>Reorder Level</th></tr></thead><tbody>${lowStock.slice(0,20).map(p=>`<tr><td><a class="model-link" onclick="productDetail('${encodeURIComponent(p['Model / Part No.'])}')">${esc(p['Model / Part No.'])}</a></td><td>${esc(p.Description)}</td><td style="color:#c0392b"><b>${p.currentStock}</b></td><td>${esc(p['Reorder Level']||5)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
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
  const year = new Date().getFullYear();
  const r = await api('getSalesSummary', {year});
  const host = $('salesSummarySection');
  if (!host) return;
  if (!r.ok) { host.innerHTML = ''; return; }

  const pct = r.target > 0 ? Math.min(100, Math.round(r.totalSales/r.target*100)) : 0;
  const top = r.customerSales.slice(0,8);
  const maxAmt = Math.max(...top.map(c=>c.amount), 1);

  host.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>Yearly Sales Target — ${year}</h3>
        ${isAdmin()?`<button class="btn small" onclick="setTargetForm(${year},${r.target})">${r.target>0?'Edit':'Set'} Target</button>`:''}
      </div>
      ${r.target > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:8px">
          <span><b>${money(r.totalSales)}</b> achieved</span>
          <span class="muted">Target: ${money(r.target)}</span>
        </div>
        <div style="background:#F0F2F5;border-radius:20px;height:14px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#3B5BDB,#10B981);border-radius:20px;transition:width .4s"></div>
        </div>
        <div style="margin-top:6px;font-size:12.5px;color:var(--steel)">${pct}% of target reached • ${money(r.remaining)} remaining</div>
      ` : `<div class="muted">No sales target set for ${year} yet.${isAdmin()?' Click "Set Target" to add one.':''}</div>`}
    </div>
    <div class="panel">
      <h3>Top Customers by Sales (${year})</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${top.map(c=>`<div><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px"><span>${esc(c.customer)}</span><b>${money(c.amount)}</b></div><div style="background:#F0F2F5;border-radius:6px;height:9px;overflow:hidden"><div style="width:${(c.amount/maxAmt*100)}%;height:100%;background:var(--brand);border-radius:6px"></div></div></div>`).join('') || '<div class="muted">No invoices recorded yet this year.</div>'}
      </div>
    </div>`;
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
    const low = Number(p.currentStock) <= Number(p['Reorder Level']||5);
    return `<tr ${low?'style="background:#fbeae8"':''}>
       <td>${p['Product Image']?`<img class="thumb" src="${esc(p['Product Image'])}">`:'—'}</td>
       <td><a class="model-link" onclick="productDetail('${encodeURIComponent(p['Model / Part No.'])}')">${esc(p['Model / Part No.'])}</a></td>
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
  const low = Number(p.currentStock) <= Number(p['Reorder Level']||5);

  modal('Product Details — ' + m,
    `<div class="detail">
       <div>${p['Product Image']?`<img src="${esc(p['Product Image'])}">`:'No image'}</div>
       <div class="detail-grid">
         <div class="kv"><b>Model</b>${esc(p['Model / Part No.'])}</div>
         <div class="kv"><b>Description</b>${esc(p.Description)}</div>
         <div class="kv"><b>Category</b>${esc(p.Category)}</div>
         <div class="kv"><b>Location</b>${esc(p.Location)}</div>
         <div class="kv"><b>Current Stock</b>${p.currentStock}${low?' <span style="color:#c0392b">⚠ Low Stock</span>':''}</div>
         <div class="kv"><b>Reorder Level</b>${esc(p['Reorder Level']||5)}</div>
         <div class="kv"><b>Sale Price</b>${esc(p['Sale Price'])}</div>
         <div class="kv"><b>Status</b>${esc(status)}</div>
       </div>
     </div>
     <div class="actions">
       <button class="btn" onclick="editProductForm('${encodeURIComponent(m)}')">Edit</button>
       <button class="btn" onclick="showProductHistory('${encodeURIComponent(m)}')">Product History</button>
       ${isAdmin()?`<button class="btn danger" onclick="toggleProductStatus('${encodeURIComponent(m)}','${status==='Active'?'Inactive':'Active'}')">${status==='Active'?'Deactivate':'Activate'}</button>`:''}
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
  const fmtRow = x => `<tr><td>${esc(x[1])}</td><td><b>${x[5]}</b></td><td>${esc(x[6])}</td><td>${esc(x[7])}</td><td>${esc(x[8])}</td></tr>`;

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
       <label>Reorder Level<input id="eprlevel" type="number" value="${esc(p['Reorder Level']||5)}"></label>
       <label>Product Image<input id="epimg" type="file" accept="image/*"></label>
       <label class="wide">Remarks<textarea id="eprem">${esc(p.Remarks||'')}</textarea></label>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Cancel</button>
       <button class="btn primary" onclick="saveProductEdit('${encodeURIComponent(m)}')">Save Changes</button>
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
  const f = $('pimg').files[0];
  let b = '';
  if (f) b = await file64(f);
  const r = await api('saveProduct', {
    model:$('pm').value, category:$('pcat').value, description:$('pdesc').value,
    brand:$('pbrand').value, unit:$('punit').value, location:$('ploc').value,
    costPrice:$('pcost').value, salePrice:$('pprice').value,
    openingStock:$('pop').value, reorderLevel:$('prlevel').value,
    remarks:$('prem').value, imageBase64:b, imageName:f?.name
  });
  if (!r.ok) return toast(r.error, true);
  closeModal(); await refresh(); toast('Product saved.');
}

/* ---------- INWARD ---------- */
function renderInward(){
  $('idate').value = new Date().toISOString().slice(0,10);
  if (!$('suplist') && $('isupplier')) {
    $('isupplier').insertAdjacentHTML('afterend',
      `<datalist id="suplist">${S.suppliers.map(s=>`<option value="${esc(s['Supplier Name'])}">`).join('')}</datalist>`);
  }
}

let SFS_SAVING = false;
async function guardedSave(fn){ if (SFS_SAVING) return; SFS_SAVING = true; try { await fn(); } finally { SFS_SAVING = false; } }

async function saveInward(){
  await guardedSave(async () => {
    const r = await api('saveInward', {
      date:$('idate').value, sourceType:$('itype').value, model:$('imodel').value,
      quantity:$('iqty').value, supplier:$('isupplier').value,
      supplierReference:$('iref').value, purchaseCost:$('icost').value, remarks:$('irem').value
    });
    if (!r.ok) return toast(r.error, true);
    toast('Inward saved. Stock increased.');
    await refresh();
  });
}

/* ---------- DC ---------- */
let dcl = [], ivl = [];
function renderDC(){ dcl = []; addDc(); $('dcdate').value = new Date().toISOString().slice(0,10); }
function addDc(){ dcl.push({model:'', qty:'', unit:'Pcs'}); renderDcLines(); }

function renderDcLines(){
  if (!$('dclines')) return;
  $('dclines').innerHTML = dcl.map((x,i) =>
    `<tr>
       <td><input value="${esc(x.model)}" list="ml" onchange="dcl[${i}].model=this.value;renderDcLines()"></td>
       <td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{}).Description||'')}</td>
       <td><input type="number" value="${x.qty}" onchange="dcl[${i}].qty=this.value"></td>
       <td><input value="${x.unit}" onchange="dcl[${i}].unit=this.value"></td>
       <td><button class="btn small" onclick="dcl.splice(${i},1);renderDcLines()">×</button></td>
     </tr>`).join('');
  $('dclines').insertAdjacentHTML('afterend', `<datalist id="ml">${S.products.map(p=>`<option value="${esc(p['Model / Part No.'])}">`).join('')}</datalist>`);
}

async function saveDC(print){
  if (!dcl.length) return;
  await guardedSave(async () => {
    const p = {
      no:$('dcno').value, date:$('dcdate').value, customer:$('dccust').value,
      customerId:$('dcid').value, po:$('dcpo').value, poDate:$('dcpodate').value,
      stn:$('dcstn').value, ntn:$('dcntn').value, address:$('dcaddr').value, items:dcl
    };
    const r = await api('saveDC', p);
    if (!r.ok) return toast(r.error, true);
    if (print) printDC(p);
    toast('Delivery Challan saved and stock reduced.');
    dcl = []; await refresh();
    // Refresh history if on that page
    if ($('dchRows')) loadDCHistory();
  });
}

/* ---------- DC HISTORY ---------- */
let DCH_CACHE = [];
async function loadDCHistory(){
  const tbody = $('dchRows');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading…</td></tr>';
  const r = await api('getReports', {mode:'docs', type:'DC'});
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${esc(r.error||'Could not load history')}</td></tr>`;
    return;
  }
  DCH_CACHE = (r.documents||[]).map(d => {
    const totalQty = d.items.reduce((a,x)=>a+(+x.qty||0), 0);
    return {...d, totalQty, searchText: [d.no, d.customer, d.customerId, d.po, ...d.items.map(x=>x.model), ...d.items.map(x=>x.desc)].join(' ').toLowerCase()};
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
        <button class="btn small" onclick="viewDC('${encodeURIComponent(d.no)}')">View</button>
        <button class="btn small" onclick="viewDC('${encodeURIComponent(d.no)}',true)">Print</button>
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
       <button class="btn primary" onclick="viewDC('${encodeURIComponent(no)}',true)">Print</button>
     </div>`);
}

/* ---------- INVOICE ---------- */
function renderInvoice(){ ivl = []; addInv(); $('ivdate').value = new Date().toISOString().slice(0,10); }
function addInv(){ ivl.push({model:'', qty:'', rate:''}); renderIvLines(); }

function renderIvLines(){
  if (!$('ivlines')) return;
  $('ivlines').innerHTML = ivl.map((x,i) =>
    `<tr>
       <td><input value="${esc(x.model)}" list="ivml" onchange="ivl[${i}].model=this.value;renderIvLines()"></td>
       <td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{}).Description||'')}</td>
       <td><input type="number" value="${x.qty}" onchange="ivl[${i}].qty=this.value;renderIvLines()"></td>
       <td><input type="number" value="${x.rate}" onchange="ivl[${i}].rate=this.value;renderIvLines()"></td>
       <td>${((+x.qty||0)*(+x.rate||0)).toFixed(2)}</td>
       <td><button class="btn small" onclick="ivl.splice(${i},1);renderIvLines()">×</button></td>
     </tr>`).join('');
  $('ivlines').insertAdjacentHTML('afterend', `<datalist id="ivml">${S.products.map(p=>`<option value="${esc(p['Model / Part No.'])}">`).join('')}</datalist>`);
  $('ivtotal').textContent = ivl.reduce((a,x) => a + (+x.qty||0)*(+x.rate||0), 0).toFixed(2);
}

async function saveInvoice(print){
  await guardedSave(async () => {
    const p = {
      no:$('ivno').value, date:$('ivdate').value, customer:$('ivcust').value,
      po:$('ivpo').value, poDate:$('ivpodate').value, dc:$('ivdc').value,
      dcDate:$('ivdcdate').value, stn:$('ivstn').value, ntn:$('ivntn').value, items:ivl
    };
    const r = await api('saveInvoice', p);
    if (!r.ok) return toast(r.error, true);
    if (print) printInvoice({...p, total:r.subtotal});
    toast('Invoice saved.');
    await refresh();
    if ($('ivhRows')) loadIVHistory();
  });
}

/* ---------- INVOICE HISTORY ---------- */
let IVH_CACHE = [];
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
    const total = (d.subtotal||0) * (1 + (Number(d.gstPercent)||18)/100);
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
        <button class="btn small" onclick="viewInvoice('${encodeURIComponent(d.no)}')">View</button>
        <button class="btn small" onclick="viewInvoice('${encodeURIComponent(d.no)}',true)">Print</button>
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
       <div><span>GST ${d.gstPercent||18}%</span><span>${money(d.grandTotal - d.subtotal)}</span></div>
       <div><b>TOTAL</b><b>${money(d.grandTotal)}</b></div>
     </div>
     <div class="actions">
       <button class="btn" onclick="closeModal()">Close</button>
       <button class="btn primary" onclick="viewInvoice('${encodeURIComponent(no)}',true)">Print</button>
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

  const outRows = custOut.ok ? (custOut.rows||[]) : [];
  const outHost = $('custOutRows');
  if (outHost) outHost.innerHTML = outRows.map(r=>`<tr><td>${esc(r.no)}</td><td>${esc(r.date)}</td><td>${esc(r.customer)}</td><td>${money(r.total)}</td><td>${money(r.paid)}</td><td><b>${money(r.outstanding)}</b></td><td><button class="btn small primary" onclick="openCustPayModal('${encodeURIComponent(r.no)}','${encodeURIComponent(r.customer)}',${r.outstanding})">Record Payment</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No outstanding invoices — all settled!</td></tr>';

  const pays = custPay.ok ? (custPay.payments||[]) : [];
  const payHost = $('custPayRows');
  if (payHost) payHost.innerHTML = pays.slice(0,30).map(x=>`<tr><td>${esc(x.Date)}</td><td>${esc(x['Invoice No.'])}</td><td>${esc(x['Customer Name'])}</td><td>${money(x.Amount)}</td><td>${esc(x.Method)}</td><td>${esc(x.Reference)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No payments recorded yet.</td></tr>';

  const supRows = supOut.ok ? (supOut.rows||[]) : [];
  const supOutHost = $('supOutRows');
  if (supOutHost) supOutHost.innerHTML = supRows.map(r=>`<tr><td>${esc(r.supplier)}</td><td>${money(r.purchased)}</td><td>${money(r.paid)}</td><td><b>${money(r.outstanding)}</b></td><td><button class="btn small primary" onclick="openSupPayModal('${encodeURIComponent(r.supplier)}',${r.outstanding})">Record Payment</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No outstanding supplier balances — all settled!</td></tr>';

  const supPays = supPay.ok ? (supPay.payments||[]) : [];
  const supPayHost = $('supPayRows');
  if (supPayHost) supPayHost.innerHTML = supPays.slice(0,30).map(x=>`<tr><td>${esc(x.Date)}</td><td>${esc(x['Supplier Name'])}</td><td>${money(x.Amount)}</td><td>${esc(x.Method)}</td><td>${esc(x.Reference)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No payments recorded yet.</td></tr>';
}
function renderAccounts(){ loadAccounts(); }

function openCustPayModal(invEnc, custEnc, outstanding){
  const inv = decodeURIComponent(invEnc), cust = decodeURIComponent(custEnc);
  modal('Record Payment — '+inv, `<div class="form-grid"><label>Invoice #<input id="payinv" value="${esc(inv)}" readonly></label><label>Customer<input value="${esc(cust)}" readonly></label><label>Outstanding<input value="${money(outstanding)}" readonly></label><label>Amount Received<input id="payamt" type="number" step="0.01" value="${outstanding}" onfocus="this.select()"></label><label>Date<input id="paydate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Method<select id="paymethod"><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Online</option></select></label><label>Reference / Cheque #<input id="payref"></label><label class="wide">Remarks<input id="payrem"></label></div><div class="actions"><button class="btn primary" onclick="submitCustPayment()">Save Payment</button></div>`);
}
async function submitCustPayment(){
  await guardedSave(async () => {
    const amt = Number($('payamt').value);
    if (!(amt>0)) return toast('Enter a valid amount.', true);
    const p = {invoiceNo:$('payinv').value, amount:amt, date:$('paydate').value, method:$('paymethod').value, reference:$('payref').value, remarks:$('payrem').value};
    const r = await api('savePayment', p);
    if (!r.ok) return toast(r.error, true);
    closeModal();
    toast('Payment recorded. Outstanding: '+money(r.outstanding));
    await loadAccounts();
  });
}

function openSupPayModal(supEnc, outstanding){
  const sup = decodeURIComponent(supEnc);
  modal('Pay Supplier — '+sup, `<div class="form-grid"><label>Supplier<input id="spaysup" value="${esc(sup)}" readonly></label><label>Outstanding<input value="${money(outstanding)}" readonly></label><label>Amount Paid<input id="spayamt" type="number" step="0.01" value="${outstanding}" onfocus="this.select()"></label><label>Date<input id="spaydate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Method<select id="spaymethod"><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Online</option></select></label><label>Reference / Cheque #<input id="spayref"></label><label class="wide">Remarks<input id="spayrem"></label></div><div class="actions"><button class="btn primary" onclick="submitSupPayment()">Save Payment</button></div>`);
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
       <button class="btn small" onclick="ledger('Customer','${encodeURIComponent(c['Customer Name'])}')">Ledger</button>
       <button class="btn small" onclick="editPartyForm('Customer','${encodeURIComponent(c['Customer Name'])}')">Edit</button>
       ${isAdmin()?`<button class="btn small danger" onclick="togglePartyStatus('Customer','${encodeURIComponent(c['Customer Name'])}','${status==='Active'?'Inactive':'Active'}')">${status==='Active'?'Deactivate':'Activate'}</button>`:''}
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
       <button class="btn small" onclick="ledger('Supplier','${encodeURIComponent(c['Supplier Name'])}')">Ledger</button>
       <button class="btn small" onclick="editPartyForm('Supplier','${encodeURIComponent(c['Supplier Name'])}')">Edit</button>
       ${isAdmin()?`<button class="btn small danger" onclick="togglePartyStatus('Supplier','${encodeURIComponent(c['Supplier Name'])}','${status==='Active'?'Inactive':'Active'}')">${status==='Active'?'Deactivate':'Activate'}</button>`:''}
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
       <label class="wide">Remarks<textarea id="eprem2">${esc(c.Remarks||'')}</textarea></label>
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
  const r = await api(type==='Customer'?'saveCustomer':'saveSupplier', {
    name:$('pn').value, contact:$('pcontact').value, phone:$('pphone').value,
    email:$('pemail').value, city:$('pcity').value, ntn:$('pntn').value,
    stn:$('pstn').value, address:$('paddr').value, remarks:$('pr').value
  });
  if (!r.ok) return toast(r.error, true);
  closeModal(); await refresh();
  toast(type + ' saved.');
}

async function ledger(type, name){
  const r = await api('getLedger', {type, name:decodeURIComponent(name)});
  if (!r.ok) return toast(r.error, true);
  modal(type + ' Ledger — ' + decodeURIComponent(name),
    `<table>
       <tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Remarks</th></tr>
       ${r.transactions.map(x => `<tr><td>${esc(x.date)}</td><td>${esc(x.type)}</td><td>${esc(x.ref)}</td><td>${x.debit}</td><td>${x.credit}</td><td>${esc(x.remarks)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No transactions.</td></tr>'}
     </table>`);
}

/* ---------- REPORTS ---------- */
async function renderReports(){
  const r = await api('getReports', {year:$('ry')?.value || new Date().getFullYear()});
  if (!r.ok) return toast(r.error, true);
  $('reports').innerHTML =
    `<div class="cards">
       <div class="card"><span>Invoices</span><strong>${r.sales.length}</strong></div>
       <div class="card"><span>Sales</span><strong>${r.sales.reduce((a,x)=>a+(+x.total||0),0).toLocaleString()}</strong></div>
     </div>
     <div class="panel"><h3>Sales by Category</h3><div class="catgrid">${CATS.map(c=>`<div class="cat"><span>${c}</span><b>${(r.categorySales[c]||0).toLocaleString()}</b></div>`).join('')}</div></div>
     <div class="panel table-wrap"><h3>Recent Stock Movement</h3>
       <table>
         <tr><th>Date</th><th>Type</th><th>Model</th><th>IN</th><th>OUT</th><th>Party</th><th>Reference</th><th>By</th></tr>
         ${r.movements.map(x => `<tr><td>${esc(x.Date)}</td><td>${esc(x.Type)}</td><td>${esc(x['Model / Part No.'])}</td><td>${x['Qty IN']}</td><td>${x['Qty OUT']}</td><td>${esc(x.Party)}</td><td>${esc(x.Reference)}</td><td>${esc(x['Created By'])}</td></tr>`).join('')}
       </table>
     </div>`;
}

/* ---------- SETTINGS ---------- */
function renderSettings(){}
function saveSettings(){
  S.api = $('apiurl').value.trim();
  localStorage.sfsApiUrl = S.api;
  toast('Backend URL saved. Login again.');
  logout();
}
async function refreshSource(){
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
        <button class="btn small" onclick="userForm('${encodeURIComponent(u.Username)}','${encodeURIComponent(u.Name||'')}','${encodeURIComponent(u.Role||'')}',${JSON.stringify(mods).replace(/"/g,'&quot;')})">Edit Modules</button>
        <button class="btn small" onclick="toggleUser('${encodeURIComponent(u.Username)}','${encodeURIComponent(u.Status)}')">${u.Status==='Active'?'Disable':'Enable'}</button>
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
       <label>Password ${isEdit?'<span class="muted small">(khaali chhoro agar change nahi karni)</span>':''}<input id="up" type="password"></label>
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
       <button class="btn primary" onclick="saveUser(${isEdit?`'${esc(u)}'`:'null'})">${isEdit?'Save Changes':'Create User'}</button>
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

  const r = await api(isEdit ? 'updateUser' : 'saveUser', payload);
  if (!r.ok) return toast(r.error, true);
  closeModal();
  toast(isEdit ? 'User updated.' : 'Staff created.');
  renderUsers();
}

async function toggleUser(u, st){
  const r = await api('disableUser', {username:decodeURIComponent(u), status:decodeURIComponent(st)==='Active'?'Inactive':'Active'});
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
        <div class="meta-line"><span class="meta-tag">Address:</span><span>${esc(d.address||'')}</span></div>
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
      <div>H.CODE: 84-F<br><b>Description:</b> General Industrial Machinery &amp; Equipment</div>
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
  S.api = (window.SFS_CONFIG && window.SFS_CONFIG.API_URL) || localStorage.sfsApiUrl || '';
  if (S.session && S.api){
    api('bootstrap').then(r => {
      if (r.ok){
        S.user = r.user;
        S.products = r.products || [];
        S.customers = r.customers || [];
        S.suppliers = r.suppliers || [];
        S.tx = r.transactions || [];
        enter();
      } else {
        sessionStorage.clear();
        showLogin();
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
window.saveSettings = saveSettings;
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
window.toggleSidebar = (typeof window.toggleSidebar === 'function') ? window.toggleSidebar : function(){};
