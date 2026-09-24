/* ============================================================
   SFS BUSINESS MANAGEMENT — FRONTEND v3
   - Captcha (1+1=2) integrated
   - Module permissions (Products / Sales / Accounts / Parties / Reports)
   - Add Staff with per-module access
   - Sidebar collapse
   - Data safety: kuch delete nahi karta
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

/* ---------- MODULE HELPERS ---------- */
function isAdmin(){ return S.user && String(S.user.role||'').toUpperCase() === 'ADMIN'; }
function userModules(){ return Array.isArray(S.user?.modules) ? S.user.modules : []; }
function hasMod(id){
  if (isAdmin()) return true;
  return userModules().indexOf(id) !== -1;
}

/* ---------- NAV ---------- */
function nav(){
  const all = [
    {id:'dashboard', label:'Dashboard',   mod:null,       section:'Main'},
    {id:'products',  label:'Products',    mod:'products', section:'Inventory'},
    {id:'inward',    label:'Inward',      mod:'products', section:'Inventory'},
    {id:'dc',        label:'Delivery Challans', mod:'sales', section:'Sales'},
    {id:'invoices',  label:'Invoices',    mod:'sales',    section:'Sales'},
    {id:'accounts',  label:'Accounts / Payments', mod:'accounts', section:'Accounts'},
    {id:'customers', label:'Customers',   mod:'parties',  section:'Parties'},
    {id:'suppliers', label:'Suppliers',   mod:'parties',  section:'Parties'},
    {id:'reports',   label:'Reports',     mod:'reports',  section:'Reports'},
    {id:'settings',  label:'Settings',    mod:null,       section:'System'}
  ];
  if (isAdmin()) all.push({id:'users', label:'Users / Staff', mod:null, section:'System'});

  const items = all.filter(x => x.mod === null || hasMod(x.mod));

  // Group by section
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
    invoices:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>',
    accounts:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    customers:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    suppliers:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    reports:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    settings:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
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
  const first = items.find(x => x.id === 'dashboard') || items[0];
  if (first) {
    const btn = document.querySelector(`.navbtn[onclick*="'${first.id}'"]`);
    if (btn) showPage(first.id, btn);
  }
}

/* ---------- JSONP + API ---------- */
function jsonpRequest(url, payload){
  return new Promise(function(resolve){
    var cb = 'sfs_cb_' + Date.now() + '_' + Math.floor(Math.random()*100000),
        script = document.createElement('script'),
        done = false;
    window[cb] = function(data){ done = true; cleanup(); resolve(data); };
    function cleanup(){
      try { delete window[cb]; } catch(e){ window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }
    script.onerror = function(){ if(done) return; done = true; cleanup(); resolve({ok:false, error:'Connection error. Please try again.'}); };
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
    setTimeout(function(){ if(!done){ done = true; cleanup(); resolve({ok:false, error:'Connection timeout. Please try again.'}); } }, 15000);
  });
}

async function api(action, data = {}){
  if (!S.api) return {ok:false, error:'Backend URL not configured'};
  var payload = Object.assign({action:action, session:S.session||''}, data||{});
  try {
    var r = await fetch(S.api, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(payload)
    });
    var text = await r.text(), j;
    try { j = JSON.parse(text); } catch(e){ j = null; }
    if (j) return j;
  } catch(e){
    console.warn('POST failed; JSONP fallback.', e);
  }
  return await jsonpRequest(S.api, payload);
}

/* ---------- LOGIN ---------- */
async function login(){
  const user = $('loginUser').value.trim();
  const pass = $('loginPass').value;
  const cap  = ($('loginCaptcha')?.value || '').trim();

  // Captcha check (1 + 1 = 2)
  if (cap !== '2') {
    $('loginError').textContent = 'Security check failed. What is 1 + 1?';
    return;
  }

  S.api = (window.SFS_CONFIG && window.SFS_CONFIG.API_URL) || DEFAULT_API || localStorage.sfsApiUrl || '';
  if (!S.api) { $('loginError').textContent = 'System connection is not configured.'; return; }
  if (!user || !pass) { $('loginError').textContent = 'Username and password are required.'; return; }

  $('loginError').textContent = 'Signing in...';
  const r = await api('login', {username:user, password:pass});
  if (!r.ok) { $('loginError').textContent = r.error || 'Invalid username or password'; return; }

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
}

/* ---------- PAGE ROUTER ---------- */
function showPage(p, btn){
  document.querySelectorAll('.navbtn').forEach(x => x.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const label = btn ? (btn.querySelector('.nav-label')?.textContent || btn.textContent) : p;
  $('pageTitle').textContent = label;

  if (!pages[p]) { $('content').innerHTML = '<div class="wrap"><div class="panel">Page not found.</div></div>'; return; }
  $('content').innerHTML = pages[p]();

  if (p === 'dashboard') renderDashboard();
  if (p === 'products')  renderProducts();
  if (p === 'inward')    renderInward();
  if (p === 'dc')        renderDC();
  if (p === 'invoices')  renderInvoice();
  if (p === 'accounts')  renderAccounts();
  if (p === 'customers') renderCustomers();
  if (p === 'suppliers') renderSuppliers();
  if (p === 'reports')   renderReports();
  if (p === 'settings')  renderSettings();
  if (p === 'users')     renderUsers();
}

/* ---------- PAGES ---------- */
const pages = {
  dashboard:()=>`<div class="wrap" id="dash"></div>`,
  products:()=>`<div class="wrap"><div class="toolbar"><input id="ps" placeholder="Search model / description / location" oninput="renderProducts()"><select id="pc" onchange="renderProducts()"><option value="">All Categories</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select><button class="btn primary" onclick="productForm()">+ Add Product</button></div><div class="panel table-wrap"><table><thead><tr><th>Image</th><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Location</th><th>Stock</th></tr></thead><tbody id="prows"></tbody></table></div></div>`,
  inward:()=>`<div class="wrap"><div class="panel"><h3>Inward / Local Purchase</h3><div class="form-grid"><label>Date<input id="idate" type="date"></label><label>Source Type<select id="itype"><option>Local Purchase</option><option>Import</option><option>Opening</option><option>Customer Return</option></select></label><label>Model / Part No.<input id="imodel" list="mlist"></label><label>Quantity<input id="iqty" type="number" min="0.01"></label><label>Supplier<input id="isupplier"></label><label>Supplier Reference<input id="iref"></label><label>Purchase Cost<input id="icost" type="number" min="0"></label><label>Remarks<input id="irem"></label></div><button class="btn primary" onclick="saveInward()">Save Inward</button></div></div>`,
  dc:()=>`<div class="wrap"><div class="panel"><h3>Delivery Challan</h3><div class="form-grid"><label>Challan #<input id="dcno"></label><label>Date<input id="dcdate" type="date"></label><label>Customer<input id="dccust" list="clist"></label><label>Customer ID<input id="dcid"></label><label>PO #<input id="dcpo"></label><label>PO Date<input id="dcpodate" type="date"></label><label>STN<input id="dcstn"></label><label>NTN<input id="dcntn"></label><label class="wide">Address<textarea id="dcaddr"></textarea></label></div><div class="panel"><button class="btn small" onclick="addDc()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Unit</th><th></th></tr></thead><tbody id="dclines"></tbody></table></div></div><div class="actions"><button class="btn primary" onclick="saveDC(false)">Save DC</button><button class="btn ghost" onclick="saveDC(true)">Save &amp; Print</button></div></div></div>`,
  invoices:()=>`<div class="wrap"><div class="panel"><h3>Invoice</h3><div class="form-grid"><label>Invoice #<input id="ivno"></label><label>Date<input id="ivdate" type="date"></label><label>Customer<input id="ivcust" list="clist"></label><label>PO #<input id="ivpo"></label><label>PO Date<input id="ivpodate"></label><label>DC #<input id="ivdc"></label><label>DC Date<input id="ivdcdate"></label><label>STN<input id="ivstn"></label><label>NTN<input id="ivntn"></label></div><div class="panel"><button class="btn small" onclick="addInv()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead><tbody id="ivlines"></tbody></table></div><h3 class="right">Subtotal: <span id="ivtotal">0.00</span></h3></div><div class="actions"><button class="btn primary" onclick="saveInvoice(false)">Save Invoice</button><button class="btn ghost" onclick="saveInvoice(true)">Save &amp; Print</button></div></div></div>`,
  accounts:()=>`<div class="wrap"><div class="panel-head"><h3>Accounts / Payments</h3></div><div class="panel"><p class="muted">Customer payments, supplier payments, outstanding — Accounts module ke through.</p><div class="actions"><button class="btn" onclick="renderAccounts()">Refresh</button></div></div><div id="accountsBody"></div></div>`,
  customers:()=>`<div class="wrap"><div class="panel-head"><h3>Customers</h3><button class="btn primary" onclick="partyForm('Customer')">+ Add Customer</button></div><div class="panel"><div id="customers"></div></div></div>`,
  suppliers:()=>`<div class="wrap"><div class="panel-head"><h3>Suppliers</h3><button class="btn primary" onclick="partyForm('Supplier')">+ Add Supplier</button></div><div class="panel"><div id="suppliers"></div></div></div>`,
  reports:()=>`<div class="wrap"><div class="toolbar"><select id="ry"><option>2026</option><option>2025</option><option>2024</option></select><button class="btn" onclick="renderReports()">Refresh</button></div><div id="reports"></div></div>`,
  settings:()=>`<div class="wrap"><div class="panel"><h3>System Settings</h3><p class="muted">Original live inventory read-only hai. Ye software sirf apni separate database mein likhta hai.</p><label>Apps Script Web App URL<input id="apiurl" class="input" value="${esc(S.api)}"></label><div class="actions"><button class="btn primary" onclick="saveSettings()">Save Settings</button></div><hr><button class="btn" onclick="changePasswordForm()">Change My Password</button>${isAdmin()?'<button class="btn" onclick="refreshSource()">Refresh Source Snapshot</button>':''}</div></div>`,
  users:()=>`<div class="wrap"><div class="panel-head"><h3>Users / Staff</h3><button class="btn primary" onclick="userForm()">+ Add Staff</button></div><div class="panel"><div id="users"></div></div></div>`
};

/* ---------- DASHBOARD ---------- */
function renderDashboard(){
  $('dash').innerHTML =
    `<div class="cards">
       <div class="card"><span>Products</span><strong>${S.products.length}</strong></div>
       <div class="card"><span>Current Stock</span><strong>${S.products.reduce((a,x)=>a+(+x.currentStock||0),0).toLocaleString()}</strong></div>
       <div class="card"><span>Customers</span><strong>${S.customers.length}</strong></div>
       <div class="card"><span>Suppliers</span><strong>${S.suppliers.length}</strong></div>
     </div>
     <div class="panel"><h3>Categories</h3><div class="catgrid">${CATS.map(c=>`<div class="cat"><span>${c}</span><b>${S.products.filter(p=>p.Category===c).length}</b><small class="muted">Products</small></div>`).join('')}</div></div>`;
}

/* ---------- PRODUCTS ---------- */
function renderProducts(){
  let q = ($('ps')?.value || '').toLowerCase(), c = $('pc')?.value || '';
  let a = S.products.filter(p => [p['Model / Part No.'],p.Description,p.Location].join(' ').toLowerCase().includes(q) && (!c || p.Category === c));
  $('prows').innerHTML = a.slice(0,1000).map(p =>
    `<tr>
       <td>${p['Product Image']?`<img class="thumb" src="${esc(p['Product Image'])}">`:'—'}</td>
       <td><a class="model-link" onclick="productDetail('${encodeURIComponent(p['Model / Part No.'])}')">${esc(p['Model / Part No.'])}</a></td>
       <td>${esc(p.Description)}</td>
       <td>${esc(p.Category)}</td>
       <td>${esc(p.Location)}</td>
       <td>${p.currentStock}</td>
     </tr>`).join('') || '<tr><td colspan="6" class="empty">No products found.</td></tr>';
}

function productDetail(em){
  const m = decodeURIComponent(em), p = S.products.find(x => x['Model / Part No.'] === m);
  if (!p) return;
  modal('Product Details — ' + m,
    `<div class="detail">
       <div>${p['Product Image']?`<img src="${esc(p['Product Image'])}">`:'No image'}</div>
       <div class="detail-grid">
         <div class="kv"><b>Model</b>${esc(p['Model / Part No.'])}</div>
         <div class="kv"><b>Description</b>${esc(p.Description)}</div>
         <div class="kv"><b>Category</b>${esc(p.Category)}</div>
         <div class="kv"><b>Location</b>${esc(p.Location)}</div>
         <div class="kv"><b>Current Stock</b>${p.currentStock}</div>
         <div class="kv"><b>Sale Price</b>${esc(p['Sale Price'])}</div>
       </div>
     </div>`);
}

function productForm(){
  modal('Add / Edit Product',
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
