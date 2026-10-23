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
const CATS = ['Airline Equipment','Valves','Cylinder','Fittings/Tubing','Fittings/Tubing China','Others'];
/* Any other category found in the product data is added automatically (before "Others") */
function mergeProductCategories(){
  try {
    (S.products || []).forEach(p => {
      const c = String(p.Category || '').trim();
      if (!c || CATS.some(x => x.toLowerCase() === c.toLowerCase())) return;
      const at = CATS.indexOf('Others'); CATS.splice(at >= 0 ? at : CATS.length, 0, c);
    });
  } catch (e) {}
}
const ALL_MODULES = [
  {id:'products', label:'Products'},
  {id:'sales',    label:'Sales (DC / Invoice)'},
  {id:'accounts', label:'Accounts (Payments)'},
  {id:'parties',  label:'Parties (Customers / Suppliers)'},
  {id:'reports',  label:'Reports'},
  {id:'enquiries',label:'Enquiries'},
  {id:'imports', label:'Imports (confidential costing)'},
  {id:'stockvalue', label:'Stock Value (special permission — dashboard)'}
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
const cleanName = s => String(s == null ? '' : s).replace(/[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
const norm = s => cleanName(s).toLowerCase();
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
    {id:'imports',   label:'Imports',     mod:'imports',  section:'Inventory'},
    {id:'dc',        label:'New Delivery Challan', mod:'sales', section:'Sales'},
    {id:'dchistory', label:'DC History',  mod:'sales',    section:'Sales'},
    {id:'invoices',  label:'New Invoice', mod:'sales',    section:'Sales'},
    {id:'ivhistory', label:'Invoice History', mod:'sales', section:'Sales'},
    {id:'quotations', label:'New Quotation', mod:'sales', section:'Sales'},
    {id:'qthistory', label:'Quotation History', mod:'sales', section:'Sales'},
    {id:'enquiries', label:'Enquiries', mod:'enquiries', section:'Sales'},
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
    imports:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h13V7H3z"/><path d="M16 10h3l2 3v4h-5"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
    inward:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 21h14"/></svg>',
    dc:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    dchistory:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    invoices:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/></svg>',
    ivhistory:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    quotations:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l3 3v17H6z"/><path d="M14 2v4h4"/><path d="M9 11h6M9 15h6M9 19h4"/></svg>',
    enquiries:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>',
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
  const keepBtn = !document.querySelector('.navbtn.active') && window.SFS_NAV_KEEP ? document.querySelector(`.navbtn[onclick*="'${window.SFS_NAV_KEEP}'"]`) : null;
  if (keepBtn) keepBtn.classList.add('active');
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
  window.SFS_ALLOW_UNLOAD = true;
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
  mergeProductCategories();
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
    `<datalist id="ivml">${opts(S.products.map(p => p['Model / Part No.']))}</datalist>` +
    `<datalist id="grouplist">${opts(allCustomerGroups())}</datalist>`;
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
    /* End the session on the server first (so the request is not cancelled by the reload) */
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
  window.SFS_ALLOW_UNLOAD = true;
  location.reload();
}

/* Refresh / close protection: while signed in, the browser asks before the ERP page is reloaded or closed.
   (Browsers show their own fixed message; logout and session-expiry reloads are allowed without a popup.) */
window.SFS_ALLOW_UNLOAD = false;
window.addEventListener('beforeunload', function (e) {
  if (window.SFS_ALLOW_UNLOAD || !S.session) return;
  e.preventDefault();
  e.returnValue = '';
  return '';
});

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
  /* stay on the same page after a save / refresh (keep its search & filters and scroll position) */
  const keep = sfsCurrentPage(), filters = sfsSaveFilters(), y = window.scrollY;
  syncDatalists();
  window.SFS_NAV_KEEP = keep; nav(); window.SFS_NAV_KEEP = null;
  renderCurrent();
  sfsRestoreFilters(filters);
  setTimeout(() => window.scrollTo(0, y), 60);
}

/* A search box or filter list whose only job is to filter the list on screen (not part of a form) */
function sfsIsFilterControl(el){
  const h = [el.getAttribute('oninput'), el.getAttribute('onchange')].filter(Boolean).join(';').split(';').map(x => x.trim()).filter(Boolean);
  return h.length > 0 && h.every(x => /^(?:[A-Za-z]*(?:render|filter|Render|Filter)[A-Za-z]*|periodChanged)\((?:'[^']*'|"[^"]*")?\)$/.test(x));
}
function sfsCurrentPage(){ const a = document.querySelector('.navbtn.active'); const m = a && a.getAttribute('onclick') && a.getAttribute('onclick').match(/'([^']+)'/); return m ? m[1] : ''; }
function sfsSaveFilters(){
  const out = [], root = $('content'); if (!root) return out;
  root.querySelectorAll('input[id],select[id]').forEach(el => { if (sfsIsFilterControl(el) && el.value !== '') out.push({id:el.id, value:el.value, tag:el.tagName}); });
  return out;
}
function sfsRestoreFilters(list){
  (list || []).forEach(f => { const el = $(f.id); if (!el || el.value === f.value) return; el.value = f.value; el.dispatchEvent(new Event(f.tag === 'SELECT' ? 'change' : 'input', {bubbles:true})); });
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
  if (p === 'quotations' && btn) { QT_EDIT_MODE = false; REVISION_QUOTATION = null; }   /* menu click = a new quotation, never a half-finished edit */

  const label = btn ? (btn.querySelector('.nav-label')?.textContent || btn.textContent) : p;
  $('pageTitle').textContent = label;

  if (!pages[p]) { $('content').innerHTML = '<div class="wrap"><div class="panel">Page not found.</div></div>'; return; }
  if (p === 'imports' && !hasMod('imports')) { $('content').innerHTML = '<div class="wrap"><div class="panel">You do not have access to this page.</div></div>'; return; }
  $('content').innerHTML = pages[p]();

  if (p === 'dashboard')  renderDashboard();
  if (p === 'products')   renderProducts();
  if (p === 'inward')     renderInward();
  if (p === 'dc')         renderDC();
  if (p === 'dchistory')  renderDCHistory();
  if (p === 'invoices')   renderInvoice();
  if (p === 'quotations') renderQuotation();
  if (p === 'qthistory')  loadQTHistory();
  if (p === 'enquiries')  renderEnquiries();
  if (p === 'imports')    renderImports();
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
  products:()=>`<div class="wrap"><div class="toolbar"><input id="ps" placeholder="Search model / description / location" oninput="renderProducts()"><select id="pc" onchange="renderProducts()"><option value="">All Categories</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select><button class="btn primary" onclick="productForm()">+ Add Product</button><button class="btn" onclick="bulkProductForm()">+ Bulk Add</button></div><div class="toolbar" style="flex-wrap:wrap"><select id="pb" onchange="renderProducts()"><option value="">All Brands</option></select><select id="pst" onchange="renderProducts()"><option value="">All stock levels</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select><select id="pact" onchange="renderProducts()"><option value="">Active &amp; Inactive</option><option value="Active">Active only</option><option value="Inactive">Inactive only</option></select><button class="btn ghost small" onclick="clearFilters(['ps','pc','pb','pst','pact'],renderProducts)">Clear</button><span id="pcount" class="muted small"></span></div><div class="panel table-wrap"><table><thead><tr><th>Image</th><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Location</th><th>Stock</th></tr></thead><tbody id="prows"></tbody></table></div></div>`,
  imports:()=>impPageHtml(),
  inward:()=>`<div class="wrap"><div class="panel"><h3>Inward / Local Purchase</h3><div class="form-grid"><label>Date<input id="idate" type="date"></label><label>Source Type<select id="itype"><option>Local Purchase</option><option>Import</option><option>Opening</option><option>Customer Return</option></select></label><label>Model / Part No.<input id="imodel" list="mlist"></label><label>Quantity<input id="iqty" type="number" min="0" step="any"></label><label>Supplier<input id="isupplier" list="suplist"></label><label>Supplier Reference<input id="iref"></label><label>Purchase Cost (total Rs.)<input id="icost" type="number" min="0" step="0.01"></label><label>Remarks<input id="irem"></label></div><button class="btn primary" onclick="saveInward()">Save Inward</button><button class="btn" onclick="bulkInwardForm()">+ Bulk Inward / Import</button></div></div>`,
  dc:()=>`<div class="wrap"><div class="panel"><h3 id="dcTitle">Delivery Challan</h3><div id="dcEditBanner"></div><div class="form-grid"><label>Challan #<input id="dcno" placeholder="Auto"></label><label>Date<input id="dcdate" type="date"></label><label>Customer<input id="dccust" list="clist" onchange="pickCustomer('dc')"></label><label>Customer ID<input id="dcid"></label><label>PO #<input id="dcpo"></label><label>PO Date<input id="dcpodate" type="date"></label><label>STN<input id="dcstn"></label><label>NTN<input id="dcntn"></label><label class="wide">Address<textarea id="dcaddr"></textarea></label></div><div class="panel"><button class="btn small" onclick="addDc()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Make</th><th>Qty</th><th>Unit</th><th></th></tr></thead><tbody id="dclines"></tbody></table></div></div><div class="actions"><button class="btn primary" onclick="saveDC(false)">Save DC</button><button class="btn ghost" onclick="saveDC(true)">Save &amp; Print</button></div></div></div>`,
  dchistory:()=>`<div class="wrap"><div class="toolbar"><input id="dchSearch" placeholder="Search Challan #, Customer, PO #, Model..." oninput="filterDCHistory()" style="flex:1;min-width:280px"><button class="btn" onclick="loadDCHistory()">↻ Refresh</button></div><div class="toolbar" style="flex-wrap:wrap">${periodSelectHtml('dchPer','filterDCHistory()')}<select id="dchCust" onchange="filterDCHistory()"><option value="">All Customers</option></select><select id="dchInv" onchange="filterDCHistory()"><option value="">All challans</option><option value="no">Not invoiced yet</option><option value="yes">Invoiced</option></select><button class="btn ghost small" onclick="clearFilters(['dchSearch','dchPer','dchCust','dchInv'],filterDCHistory)">Clear</button><span id="dchInfo" class="muted small"></span></div><div class="panel table-wrap"><table><thead><tr><th>Challan #</th><th>Date</th><th>Customer</th><th>PO #</th><th>Items</th><th>Total Qty</th><th>Actions</th></tr></thead><tbody id="dchRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>`,
  invoices:()=>`<div class="wrap"><div class="panel"><h3>Invoice</h3><div class="form-grid"><label>Invoice #<input id="ivno" placeholder="Auto"></label><label>Date<input id="ivdate" type="date"></label><label>Customer<input id="ivcust" list="clist" onchange="pickCustomer('iv')"></label><label>Customer ID<input id="ivcid"></label><label>PO #<input id="ivpo"></label><label>PO Date<input id="ivpodate" type="date"></label><label>Delivery Challan #<span style="display:flex;gap:6px"><input id="ivdc" style="flex:1" placeholder="DC-000001, DC-000002"><button type="button" class="btn small" onclick="loadDcIntoInvoice()">Load DC(s)</button></span></label><label>DC Date<input id="ivdcdate" type="date"></label><label>STN<input id="ivstn"></label><label>NTN<input id="ivntn"></label><label>GST %<input id="ivgst" type="number" min="0" max="100" step="0.01" value="18" oninput="updateIvTotals()"></label></div><div class="panel"><button class="btn small" onclick="addInv()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Make</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead><tbody id="ivlines"></tbody></table></div><h3 class="right">Subtotal: <span id="ivtotal">0.00</span></h3><h3 class="right">GST: <span id="ivgstamt">0.00</span> &nbsp; Total: <span id="ivgrand">0.00</span></h3></div><div class="actions"><button class="btn primary" onclick="saveInvoice(false)">Save Invoice</button><button class="btn ghost" onclick="saveInvoice(true)">Save &amp; Print</button></div></div></div>`,
  ivhistory:()=>`<div class="wrap"><div class="toolbar"><input id="ivhSearch" placeholder="Search Invoice #, Customer, DC #, PO #, Model..." oninput="filterIVHistory()" style="flex:1;min-width:280px"><button class="btn" onclick="loadIVHistory()">↻ Refresh</button></div><div class="toolbar" style="flex-wrap:wrap">${periodSelectHtml('ivhPer','filterIVHistory()')}<select id="ivhCust" onchange="filterIVHistory()"><option value="">All Customers</option></select><button class="btn ghost small" onclick="clearFilters(['ivhSearch','ivhPer','ivhCust'],filterIVHistory)">Clear</button><span id="ivhInfo" class="muted small"></span></div><div class="panel table-wrap"><table><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>DC #</th><th>PO #</th><th>Total</th><th>Actions</th></tr></thead><tbody id="ivhRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>`,

  quotations:()=>`<div class="wrap"><div class="panel"><h3>Quotation</h3><div id="qtEnqRef"></div><datalist id="qtdl"><option value="Ready Stock"><option value="In Stock"><option value="On Order"><option value="Partial"><option value="1-2 Weeks"><option value="2-3 Weeks"><option value="4-6 Weeks"><option value="6-8 Weeks"><option value="8-10 Weeks"><option value="Pending"></datalist><div class="form-grid"><label>Quotation #<input id="qtno" placeholder="Auto"></label><label>Date<input id="qtdate" type="date"></label><label>Customer<input id="qtcustomer" list="clist" autocomplete="off" onchange="pickQuotationCustomer()" onblur="quotationCustomerBlur()"></label><label>Customer ID<input id="qtcustomerId" readonly></label><label class="wide">Address<input id="qtaddress"></label><label>Enquiry #<input id="qtenquiry" readonly></label><label>Enquiry Date<input id="qtenquiryDate" type="date"></label><label>Contact<input id="qtcontact"></label><label>Ref #<input id="qtref"></label><label>Ref Date<input id="qtrefDate" type="date"></label><label>Validity<input id="qtvalidity" value="7 Days"></label><label>Payment Terms<input id="qtpaymentTerms" value="20 Days"></label><label>STN<input id="qtstn"></label><label>NTN<input id="qtnTN"></label><label>GST %<input id="qtgst" type="number" min="0" max="100" step="0.01" value="18"></label><label>Discount %<input id="qtdiscount" type="number" min="0" max="100" step="0.01" placeholder="0" oninput="updateQuotationTotal()"></label></div><div class="table-wrap"><table><thead><tr><th>Model / Part No.</th><th>Description / Item Remarks</th><th>Make</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th>Delivery / Remarks</th><th></th></tr></thead><tbody id="qtlines"></tbody></table></div><div style="margin-top:12px"><button class="btn" onclick="addQuotationLine()">+ Add Item</button></div><div id="qttotal" style="text-align:right;font-weight:bold;margin-top:12px">TOTAL: 0.00</div><div style="margin-top:14px"><button id="qtsavebtn" class="btn primary" onclick="saveQuotation()">Save Quotation</button><button class="btn" onclick="printQuotationFromForm()">Print</button></div></div></div>`,
  qthistory:()=>`<div class="wrap"><div class="toolbar"><input id="qts" placeholder="Search quotation # / customer / Ref #" oninput="filterQTHistory()"><button class="btn" onclick="loadQTHistory()">Refresh</button></div><div class="toolbar" style="flex-wrap:wrap">${periodSelectHtml('qtPer','filterQTHistory()')}<select id="qtCust" onchange="filterQTHistory()"><option value="">All Customers</option></select><select id="qtSt" onchange="filterQTHistory()"><option value="">All statuses</option><option>Pending</option><option>Won</option><option>Lost</option></select><button class="btn ghost small" onclick="clearFilters(['qts','qtPer','qtCust','qtSt'],filterQTHistory)">Clear</button><span id="qtInfo" class="muted small"></span></div><div class="panel table-wrap"><table><thead><tr><th>Quotation #</th><th>Date</th><th>Customer</th><th>Ref #</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody id="qtrows"><tr><td colspan="7">Loading...</td></tr></tbody></table></div></div>`,  enquiries:()=>`<div class="wrap"><div class="toolbar"><button class="btn primary" onclick="enquiryForm()">+ New Enquiry</button><button class="btn" onclick="renderEnquiries()">↻ Refresh</button><input id="enqSearch" placeholder="Search enquiry, customer, contact, phone, requirement..." oninput="filterEnquiries()" style="flex:1;min-width:280px"></div><div class="toolbar" style="flex-wrap:wrap">${periodSelectHtml('enqPer','filterEnquiries()')}<select id="enqStatus" onchange="filterEnquiries()"><option value="">All statuses</option><option>New</option><option>Quoted</option><option>Lost</option></select><button class="btn ghost small" onclick="clearFilters(['enqSearch','enqPer','enqStatus'],filterEnquiries)">Clear</button><span id="enqInfo" class="muted small"></span></div><div class="panel table-wrap"><table><thead><tr><th>Enquiry #</th><th>Date</th><th>Customer</th><th>Contact</th><th>Phone</th><th>Requirement</th><th>Status</th><th>Quotation</th><th>Action</th></tr></thead><tbody id="enqRows"><tr><td colspan="9">Loading...</td></tr></tbody></table></div></div>`,
  accounts:()=>`<div class="wrap">
<div class="panel"><div class="panel-head"><h3>Customer Outstanding</h3><button class="btn" onclick="loadAccounts()">↻ Refresh</button></div><div class="toolbar"><input id="custOutSearch" type="search" placeholder="Search invoice #, customer, amount, date…" oninput="filterCustOut()" style="flex:1;min-width:260px"><span id="custOutInfo" class="muted small"></span></div><div class="toolbar" style="flex-wrap:wrap"><select id="custOutCust" onchange="filterCustOut()"><option value="">All Customers</option></select><select id="custOutSt" onchange="filterCustOut()"><option value="">All due statuses</option><option value="over">Overdue</option><option value="soon">Due in next 7 days</option><option value="later">Not yet due</option></select>${periodSelectHtml('custOutPer','filterCustOut()')}<button class="btn ghost small" onclick="clearFilters(['custOutSearch','custOutCust','custOutSt','custOutPer'],filterCustOut)">Clear</button></div><div class="table-wrap"><table><thead><tr><th>Invoice #</th><th>Date</th><th>Customer</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Due Date</th><th>Status</th><th></th></tr></thead><tbody id="custOutRows"><tr><td colspan="9" class="empty">Loading…</td></tr></tbody></table></div></div>
<div class="panel"><div class="panel-head"><h3>Customer Payments</h3><span id="custPayInfo" class="muted small"></span></div><div class="toolbar"><input id="custPaySearch" type="search" placeholder="Search invoice #, reference, customer, method, amount, date…" oninput="filterCustPay()" style="flex:1;min-width:260px"><button class="btn small ghost" onclick="clearPaySearch()">Clear</button></div><div class="toolbar" style="flex-wrap:wrap">${periodSelectHtml('custPayPer','filterCustPay()')}<select id="custPayCust" onchange="filterCustPay()"><option value="">All Customers</option></select><select id="custPayMeth" onchange="filterCustPay()"><option value="">All methods</option></select><button class="btn ghost small" onclick="clearFilters(['custPaySearch','custPayPer','custPayCust','custPayMeth'],filterCustPay)">Clear all filters</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Invoice #</th><th>Customer</th><th>Amount</th><th>Method</th><th>Reference</th><th>Remarks</th></tr></thead><tbody id="custPayRows"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody></table></div></div>
<div class="panel"><div class="panel-head"><h3>Supplier Payable</h3><button class="btn" onclick="loadAccounts()">↻ Refresh</button></div><div class="toolbar" style="flex-wrap:wrap"><input id="supOutSearch" type="search" placeholder="Search supplier…" oninput="filterSupOut()" style="flex:1;min-width:200px"><select id="supOutSt" onchange="filterSupOut()"><option value="">All suppliers</option><option value="due">Outstanding only</option></select><button class="btn ghost small" onclick="clearFilters(['supOutSearch','supOutSt'],filterSupOut)">Clear</button></div><div class="table-wrap"><table><thead><tr><th>Supplier</th><th>Purchased</th><th>Paid</th><th>Outstanding</th><th></th></tr></thead><tbody id="supOutRows"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table></div></div>
<div class="panel"><h3>Recent Supplier Payments</h3><div class="toolbar" style="flex-wrap:wrap"><input id="supPaySearch" type="search" placeholder="Search supplier / reference…" oninput="filterSupPay()" style="flex:1;min-width:200px">${periodSelectHtml('supPayPer','filterSupPay()')}<select id="supPayMeth" onchange="filterSupPay()"><option value="">All methods</option></select><button class="btn ghost small" onclick="clearFilters(['supPaySearch','supPayPer','supPayMeth'],filterSupPay)">Clear</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Supplier</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody id="supPayRows"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody></table></div></div>
</div>`,
  customers:()=>'<div class="wrap parties-page"><div class="party-hero party-hero-customer"><div><div class="eyebrow">PARTY DIRECTORY</div><h2>Customers</h2><p>Manage customer contacts, tax details and account ledgers.</p></div><button class="btn" onclick="customerGroupsManager()">👥 Customer Groups</button><button class="btn primary" onclick="partyForm(\'Customer\')">+ Add Customer</button></div><div class="party-toolbar"><div class="party-search"><span>⌕</span><input id="customerSearch" placeholder="Search customer, contact, phone, email..." oninput="renderCustomers()"></div><select id="customerStatus" onchange="renderCustomers()"><option value="">All Status</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select><span id="customerStats" class="party-stats"></span><span id="customerCount" class="party-count"></span></div><div id="customers" class="party-grid"></div></div>',
  suppliers:()=>'<div class="wrap parties-page"><div class="party-hero party-hero-supplier"><div><div class="eyebrow">PARTY DIRECTORY</div><h2>Suppliers</h2><p>Manage supplier contacts, tax details and account ledgers.</p></div><button class="btn primary" onclick="partyForm(\'Supplier\')">+ Add Supplier</button></div><div class="party-toolbar"><div class="party-search"><span>⌕</span><input id="supplierSearch" placeholder="Search supplier, contact, phone, email..." oninput="renderSuppliers()"></div><select id="supplierStatus" onchange="renderSuppliers()"><option value="">All Status</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select><span id="supplierStats" class="party-stats"></span><span id="supplierCount" class="party-count"></span></div><div id="suppliers" class="party-grid"></div></div>',
  reports:()=>`<div class="wrap"><div class="toolbar"><select id="ry" onchange="renderReports()"></select><select id="rm" onchange="renderReports()" title="Month"><option value="">All months</option>${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i)=>`<option value="${i}">${m}</option>`).join('')}</select><button class="btn" onclick="renderReports()">Refresh</button></div><div id="reports"></div></div>`,
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
/* ---------- COMMON FILTER TOOLKIT (same look and behaviour on every page) ---------- */
const PERIOD_OPTS = [['','All time'],['today','Today'],['week','This week'],['month','This month'],['lastmonth','Last month'],['quarter','This quarter'],['year','This year'],['custom','Custom range…']];
function periodSelectHtml(id, fn){
  return '<select id="' + id + '" onchange="periodChanged(\'' + id + '\');' + fn + '" title="Date period">' + PERIOD_OPTS.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select>'
    + '<span id="' + id + 'Rng" style="display:none;gap:6px;align-items:center"><input type="date" id="' + id + 'From" onchange="' + fn + '" title="From"><span class="muted">to</span><input type="date" id="' + id + 'To" onchange="' + fn + '" title="To"></span>';
}
function periodChanged(id){ const k = ($(id) || {}).value, r = $(id + 'Rng'); if (r) r.style.display = k === 'custom' ? 'inline-flex' : 'none'; }
function periodRangeOf(k, fromV, toV){
  if (!k) return null;
  const t = new Date(), y = t.getFullYear(), m = t.getMonth(), d = t.getDate();
  if (k === 'today') return {from:new Date(y, m, d), to:new Date(y, m, d)};
  if (k === 'week') { const dow = (new Date(y, m, d).getDay() + 6) % 7; return {from:new Date(y, m, d - dow), to:new Date(y, m, d - dow + 6)}; }
  if (k === 'month') return {from:new Date(y, m, 1), to:new Date(y, m + 1, 0)};
  if (k === 'lastmonth') return {from:new Date(y, m - 1, 1), to:new Date(y, m, 0)};
  if (k === 'quarter') { const q = Math.floor(m / 3) * 3; return {from:new Date(y, q, 1), to:new Date(y, q + 3, 0)}; }
  if (k === 'year') return {from:new Date(y, 0, 1), to:new Date(y, 11, 31)};
  if (k === 'custom') { const f = payDay(fromV), to = payDay(toV); return (f || to) ? {from:f, to:to} : null; }
  return null;
}
function periodRange(id){ return periodRangeOf(($(id) || {}).value, ($(id + 'From') || {}).value, ($(id + 'To') || {}).value); }
function inPeriod(v, rng){ if (!rng) return true; const d = payDay(v); if (!d) return false; if (rng.from && d < rng.from) return false; if (rng.to && d > rng.to) return false; return true; }
function fillSelect(id, values, allLabel){
  const el = $(id); if (!el) return;
  const cur = el.value, vs = Array.from(new Set(values.map(v => String(v == null ? '' : v).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  el.innerHTML = '<option value="">' + esc(allLabel) + '</option>' + vs.map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  if (cur && vs.indexOf(cur) !== -1) el.value = cur;
}
function clearFilters(ids, fn){
  ids.forEach(id => { const el = $(id); if (el) el.value = ''; ['From', 'To'].forEach(x => { const e2 = $(id + x); if (e2) e2.value = ''; }); periodChanged(id); });
  if (fn) fn();
}

/* ---------- CLIENT PAYMENT TERMS + DUE / OVERDUE ----------
   A client's payment terms (in days) are stored in the customer's Remarks as a line "Payment Terms: 30"
   (the same way the STN is stored), so no backend change is needed. Due date = invoice date + terms. */
const DEFAULT_PAYMENT_TERMS_DAYS = 30;     // used for clients whose terms are not set yet
function paymentTermsOf(customerName){
  const c = (S.customers || []).find(x => norm(x['Customer Name']) === norm(customerName));
  const m = String((c && c.Remarks) || '').match(/payment\s*terms?\s*[:#\-]\s*(\d+)/i);
  return m ? {days:Number(m[1]), isDefault:false, known:!!c} : {days:DEFAULT_PAYMENT_TERMS_DAYS, isDefault:true, known:!!c};
}
function stripPaymentTerms(remarks){
  return String(remarks || '').split('\n').filter(l => !/^\s*payment\s*terms?\s*[:#\-]/i.test(l)).join('\n').trim();
}
function remarksWithTerms(remarks, days){
  const clean = stripPaymentTerms(remarks);
  const d = String(days === undefined || days === null ? '' : days).trim();
  const line = d !== '' && !isNaN(Number(d)) && Number(d) >= 0 ? 'Payment Terms: ' + Math.round(Number(d)) : '';
  return [line, clean].filter(Boolean).join('\n');
}
/* ---------- CUSTOMER GROUP (stored as a line "Group: NAME" in the customer's Remarks — no backend change) ---------- */
function groupOfRemarks(r){ const m = String(r || '').match(/^\s*group\s*:\s*(.+?)\s*$/im); return m ? m[1].trim() : ''; }
function customerGroupOf(name){ const c = findCust(name); return c ? groupOfRemarks(c.Remarks) : ''; }
function stripGroup(r){ return String(r || '').split('\n').filter(l => !/^\s*group\s*:/i.test(l)).join('\n').trim(); }
function remarksWithGroup(r, g){ const clean = stripGroup(r), name = String(g || '').trim().replace(/\s+/g, ' '); return [name ? 'Group: ' + name : '', clean].filter(Boolean).join('\n'); }
function allCustomerGroups(){ const seen = {}; (S.customers || []).forEach(c => { const g = groupOfRemarks(c.Remarks); if (g && !seen[g.toUpperCase()]) seen[g.toUpperCase()] = g; }); return Object.values(seen).sort((a, b) => a.localeCompare(b)); }
function payDay(v){ const d = new Date(v); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function dueInfo(invDate, termsDays){
  const base = payDay(invDate); if (!base) return null;
  const due = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Number(termsDays || 0));
  const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const daysOver = Math.round((today - due) / 86400000);       // > 0 = overdue by N days, <= 0 = due in -N days
  return {due:due, daysOver:daysOver};
}
function dueBadge(daysOver){
  const sty = (bg, fg) => 'display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;background:' + bg + ';color:' + fg;
  if (daysOver > 0) return '<span style="' + sty('#fdecea', '#c0392b') + '">Overdue ' + daysOver + ' day' + (daysOver === 1 ? '' : 's') + '</span>';
  if (daysOver === 0) return '<span style="' + sty('#fff4e0', '#b86e00') + '">Due today</span>';
  if (daysOver >= -7) return '<span style="' + sty('#fff4e0', '#b86e00') + '">Due in ' + (-daysOver) + ' day' + (daysOver === -1 ? '' : 's') + '</span>';
  return '<span style="' + sty('#e8f6ee', '#1a7f3c') + '">Due in ' + (-daysOver) + ' days</span>';
}

/* One display name per client: the Customers-sheet name if the client exists there, otherwise the first spelling seen.
   Names that differ only by case / extra or odd spaces become the same client. */
function pdCanonName(){
  const canon = {};
  return n => { const k = norm(n); if (!(k in canon)) { const c = findCust(n); canon[k] = cleanName(c ? c['Customer Name'] : n); } return canon[k]; };
}
const PDF = {st:'', q:''};
async function loadPaymentDue(){
  const host = $('paymentDueSection'); if (!host) return;
  if (!hasMod('accounts')) { host.innerHTML = ''; return; }
  const r = await api('getOutstanding', {});
  const host2 = $('paymentDueSection'); if (!host2) return;
  if (!r.ok) { host2.innerHTML = ''; return; }
  const canonName = pdCanonName();
  window.PAYDUE_INVS = (r.rows || []).filter(x => Number(x.outstanding) > 0.5).map(x => {
    const cust = canonName(x.customer), t = paymentTermsOf(cust), di = dueInfo(x.date, t.days);
    return Object.assign({}, x, {customer:cust, terms:t.days, termsDefault:t.isDefault, due:di ? di.due : null, daysOver:di ? di.daysOver : null});
  });
  host2.innerHTML = '<div class="panel"><div class="panel-head"><div><h3 class="section-title" style="margin-bottom:3px">Payments Due &amp; Overdue</h3><div class="muted">Based on each client\'s payment terms (default ' + DEFAULT_PAYMENT_TERMS_DAYS + ' days where not set)</div></div><button class="btn small" onclick="showPage(\'accounts\')">Open Accounts →</button></div>'
    + '<div class="toolbar" style="flex-wrap:wrap"><input id="pdQ" type="search" placeholder="Search client…" oninput="pdFilter()" style="flex:1;min-width:200px"><select id="pdSt" onchange="pdFilter()"><option value="">All due statuses</option><option value="over">Overdue</option><option value="soon">Due in next 7 days</option><option value="later">Not yet due</option></select><button class="btn ghost small" onclick="clearFilters([\'pdQ\',\'pdSt\'],pdFilter)">Clear</button></div>'
    + '<div id="pdBody"></div></div>';
  if ($('pdQ')) $('pdQ').value = PDF.q; if ($('pdSt')) $('pdSt').value = PDF.st;
  drawPaymentDue();
}
function pdFilter(){ PDF.q = ($('pdQ') || {}).value || ''; PDF.st = ($('pdSt') || {}).value || ''; drawPaymentDue(); }
function drawPaymentDue(){
  const body = $('pdBody'); if (!body) return;
  const q = norm(PDF.q);
  const invs = (window.PAYDUE_INVS || []).filter(x => (!q || norm(x.customer).includes(q)) && (!PDF.st
    || (PDF.st === 'over' && x.daysOver > 0)
    || (PDF.st === 'soon' && x.daysOver !== null && x.daysOver <= 0 && x.daysOver >= -7)
    || (PDF.st === 'later' && x.daysOver !== null && x.daysOver < -7)));
  const by = {};
  invs.forEach(x => {
    const g = by[x.customer] || (by[x.customer] = {customer:x.customer, terms:x.terms, termsDefault:x.termsDefault, out:0, overdue:0, overdueN:0, maxOver:0, nextIn:null, invs:[]});
    g.out += Number(x.outstanding) || 0; g.invs.push(x);
    if (x.daysOver === null) return;
    if (x.daysOver > 0) { g.overdue += Number(x.outstanding) || 0; g.overdueN++; g.maxOver = Math.max(g.maxOver, x.daysOver); }
    else { const left = -x.daysOver; g.nextIn = g.nextIn === null ? left : Math.min(g.nextIn, left); }
  });
  const groups = Object.values(by).sort((a, b) => (b.maxOver - a.maxOver) || ((a.nextIn === null ? 9999 : a.nextIn) - (b.nextIn === null ? 9999 : b.nextIn)) || (b.out - a.out));
  window.PAYDUE_GROUPS = groups;
  window.PAYDUE_FILTERED = invs;
  const sum = f => invs.filter(f).reduce((a, x) => a + (Number(x.outstanding) || 0), 0);
  const total = sum(() => true), over = sum(x => x.daysOver > 0), soon = sum(x => x.daysOver !== null && x.daysOver <= 0 && x.daysOver >= -7), later = total - over - soon;
  const age = (lo, hi) => sum(x => x.daysOver !== null && x.daysOver >= lo && x.daysOver <= hi);
  const kpi = (key, label, val, sub, color) => '<button type="button" class="card card-btn" title="Click to see invoices" onclick="pdKpiDetails(\'' + key + '\')"><span>' + label + '</span><strong style="' + (color ? 'color:' + color : '') + '">' + money(val) + '</strong><small>' + sub + '</small><em class="card-go">View details →</em></button>';
  const canEdit = hasMod('parties');
  body.innerHTML = '<div class="cards">' + kpi('all', 'Total Outstanding', total, invs.length + ' invoice(s) • ' + groups.length + ' client(s)')
    + kpi('over', 'Overdue', over, groups.filter(g => g.overdueN).length + ' client(s) past due', over > 0 ? '#c0392b' : '')
    + kpi('soon', 'Due in next 7 days', soon, 'Collect soon', soon > 0 ? '#b86e00' : '')
    + kpi('later', 'Not yet due', later, 'Beyond 7 days') + '</div>'
    + (over > 0 ? '<div class="muted" style="margin:6px 0 10px">Overdue age: <b>1–30 days</b> ' + money(age(1, 30)) + ' &nbsp;•&nbsp; <b>31–60</b> ' + money(age(31, 60)) + ' &nbsp;•&nbsp; <b>61–90</b> ' + money(age(61, 90)) + ' &nbsp;•&nbsp; <b>90+</b> ' + money(age(91, 99999)) + '</div>' : '')
    + (groups.length ? '<div class="table-wrap"><table><thead><tr><th>Client</th><th>Terms</th><th>Outstanding</th><th>Overdue</th><th>Status</th><th></th></tr></thead><tbody>'
      + groups.slice(0, 15).map(g => '<tr><td><b>' + esc(g.customer) + '</b></td><td>' + g.terms + ' days' + (g.termsDefault ? ' <span class="muted small">(default)</span>' : '') + '</td><td><b>' + money(g.out) + '</b></td><td>' + (g.overdue > 0 ? '<span style="color:#c0392b"><b>' + money(g.overdue) + '</b></span>' : '—') + '</td><td>'
        + (g.maxOver > 0 ? dueBadge(g.maxOver) + (g.overdueN > 1 ? ' <span class="muted small">oldest of ' + g.overdueN + ' invoices</span>' : '') : (g.nextIn !== null ? dueBadge(-g.nextIn) : '<span class="muted">—</span>'))
        + '</td><td style="white-space:nowrap"><button class="btn small" onclick="paymentDueDetails(\'' + encA(g.customer) + '\')">Details</button> <button class="btn small" title="Download outstanding statement (PDF)" onclick="pdClientPdf(\'' + encA(g.customer) + '\')">⬇ PDF</button>' + (canEdit ? ' <button class="btn small ghost" onclick="editPaymentTerms(\'' + encA(g.customer) + '\')">Set Terms</button>' : '') + '</td></tr>').join('')
      + '</tbody></table></div>' + (groups.length > 15 ? '<div class="muted small" style="margin-top:8px">Showing 15 of ' + groups.length + ' clients. Use the filters above or open Accounts for the full list.</div>' : '')
      : '<div class="empty">' + ((PDF.q || PDF.st) ? 'No clients match this filter.' : 'No outstanding invoices — all settled!') + '</div>');
}

/* Click on a KPI card (Total / Overdue / Due in 7 days / Not yet due) -> list of invoices in that bucket */
function pdKpiDetails(key){
  const all = window.PAYDUE_FILTERED || [];
  const isOver = x => x.daysOver !== null && x.daysOver > 0;
  const isSoon = x => x.daysOver !== null && x.daysOver <= 0 && x.daysOver >= -7;
  const pick = {all:() => true, over:isOver, soon:isSoon, later:x => !isOver(x) && !isSoon(x)}[key] || (() => true);
  const titles = {all:'Total Outstanding', over:'Overdue Invoices', soon:'Due in next 7 days', later:'Not yet due'};
  const rows = all.filter(pick).sort((a, b) => (b.daysOver === null ? -99999 : b.daysOver) - (a.daysOver === null ? -99999 : a.daysOver));
  const total = rows.reduce((a, x) => a + (Number(x.outstanding) || 0), 0);
  const clients = new Set(rows.map(x => x.customer)).size;
  const body = rows.length
    ? '<div class="muted" style="margin-bottom:10px"><b>' + rows.length + '</b> invoice(s) • <b>' + clients + '</b> client(s) • Total <b>' + money(total) + '</b></div>'
      + '<div class="table-wrap"><table class="pd-detail"><thead><tr><th>Invoice #</th><th>Client</th><th>Invoice Date</th><th>Due Date</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>'
      + rows.map(x => '<tr><td>' + esc(x.no) + '</td><td><b>' + esc(x.customer) + '</b></td><td>' + fmtDate(x.date) + '</td><td>' + (x.due ? fmtDate(x.due) : '—') + '</td><td><b>' + money(x.outstanding) + '</b></td><td>' + (x.daysOver === null ? '—' : dueBadge(x.daysOver)) + '</td></tr>').join('')
      + '</tbody><tfoot><tr><td colspan="4">Total</td><td>' + money(total) + '</td><td></td></tr></tfoot></table></div>'
    : '<div class="empty" style="padding:30px;text-align:center">No invoices in this category.</div>';
  modal(titles[key] || 'Outstanding', body + '<div class="actions"><button class="btn" onclick="closeModal()">Close</button></div>');
}

/* Dashboard: download the client's Outstanding statement (same PDF as Customer Ledger > Outstanding PDF).
   Always uses ALL of the client's outstanding invoices, not just the ones left after the dashboard filters. */
function pdClientPdf(nameEnc){
  const name = decodeURIComponent(nameEnc);
  const invs = (window.PAYDUE_INVS || []).filter(x => x.customer === name);
  if (!invs.length) return toast('No outstanding invoices for this client.', true);
  const dr = invs.reduce((a, x) => a + (Number(x.total) || 0), 0), cr = invs.reduce((a, x) => a + (Number(x.paid) || 0), 0);
  window.LEDGER_CTX = {name:name, entries:[], dr:dr, cr:cr, invoices:invs};
  ledgerPdf('outstanding');
}
window.pdClientPdf = pdClientPdf;

function paymentDueDetails(nameEnc){
  const name = decodeURIComponent(nameEnc);
  const g = (window.PAYDUE_GROUPS || []).find(x => x.customer === name); if (!g) return;
  const rows = g.invs.slice().sort((a, b) => (b.daysOver === null ? -99999 : b.daysOver) - (a.daysOver === null ? -99999 : a.daysOver));
  modal('Payment Due — ' + name,
    '<div class="muted" style="margin-bottom:10px">Payment terms: <b>' + g.terms + ' days</b>' + (g.termsDefault ? ' (default — not set for this client)' : '') + ' • Outstanding: <b>' + money(g.out) + '</b></div>'
    + '<div class="table-wrap"><table><thead><tr><th>Invoice #</th><th>Invoice Date</th><th>Due Date</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>'
    + rows.map(x => '<tr><td>' + esc(x.no) + '</td><td>' + fmtDate(x.date) + '</td><td>' + (x.due ? fmtDate(x.due) : '—') + '</td><td><b>' + money(x.outstanding) + '</b></td><td>' + (x.daysOver === null ? '—' : dueBadge(x.daysOver)) + '</td></tr>').join('')
    + '</tbody></table></div><div class="actions"><button class="btn" onclick="closeModal()">Close</button><button class="btn" onclick="pdClientPdf(\'' + encA(name) + '\')">⬇ Outstanding PDF</button>' + (hasMod('parties') ? '<button class="btn primary" onclick="editPaymentTerms(\'' + encA(name) + '\')">Set Payment Terms</button>' : '') + '</div>');
}

function editPaymentTerms(nameEnc){
  const name = decodeURIComponent(nameEnc);
  const c = (S.customers || []).find(x => norm(x['Customer Name']) === norm(name));
  if (!c) return toast('This client is not in the Customers list.', true);
  const t = paymentTermsOf(name);
  modal('Payment Terms — ' + name,
    '<div class="form-grid"><label class="wide">Payment terms (days after invoice date)<input id="ptdays" type="number" min="0" max="365" step="1" value="' + (t.isDefault ? '' : t.days) + '" placeholder="' + DEFAULT_PAYMENT_TERMS_DAYS + ' (default)"></label></div>'
    + '<div class="muted small" style="margin-top:6px">Leave blank to use the default of ' + DEFAULT_PAYMENT_TERMS_DAYS + ' days. Due date = invoice date + terms.</div>'
    + '<div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="savePaymentTerms(\'' + encA(name) + '\')">Save</button></div>');
  setTimeout(() => { const i = $('ptdays'); if (i) i.focus(); }, 50);
}

async function savePaymentTerms(nameEnc){
  const name = decodeURIComponent(nameEnc);
  const c = (S.customers || []).find(x => norm(x['Customer Name']) === norm(name)); if (!c) return;
  const raw = ($('ptdays') || {}).value;
  if (String(raw || '').trim() !== '' && (isNaN(Number(raw)) || Number(raw) < 0 || Number(raw) > 365)) return toast('Enter a number of days between 0 and 365.', true);
  const r = await api('updateCustomer', {name:name, contact:c['Contact Person'] || '', phone:c.Phone || '', email:c.Email || '', ntn:c['NTN/Tax ID'] || '', address:c.Address || '', remarks:remarksWithTerms(c.Remarks, raw)});
  if (!r.ok) return toast(r.error, true);
  closeModal(); await refresh(); toast('Payment terms updated.');
}

const DF = {cat:'', brand:''};
function dashProducts(){ return S.products.filter(p => (!DF.cat || p.Category === DF.cat) && (!DF.brand || String(p.Brand || '').trim() === DF.brand)); }
function dashFilter(){ DF.cat = ($('dfCat') || {}).value || ''; DF.brand = ($('dfBrand') || {}).value || ''; renderDashInventory(); }
function renderDashInventory(){
  const P = dashProducts();
  const lowStock = P.filter(p => Number(p.currentStock) <= reorderOf(p) && (p.Status||'Active')==='Active');
  const catData = CATS.map((c,i) => ({
    label:c,
    value:P.filter(p=>p.Category===c).reduce((a,p)=>a+(+p.currentStock||0),0),
    count:P.filter(p=>p.Category===c).length,
    color:CHART_PALETTE[i%CHART_PALETTE.length]
  })).filter(d => d.count > 0);
  const catTotal = catData.reduce((a,d)=>a+d.value,0) || 1;
  const put = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  put('dashCards', `
    <div class="cards">
      <div class="card dash-kpi dash-kpi-products" role="button" tabindex="0" onclick="showPage('products')" title="Open Products"><span>Products</span><strong>${P.length}</strong><small>View products →</small></div>
      <div class="card dash-kpi dash-kpi-stock" role="button" tabindex="0" onclick="showPage('products')" title="Open Current Stock"><span>Current Stock</span><strong>${P.reduce((a,x)=>a+(+x.currentStock||0),0).toLocaleString()}</strong><small>View stock →</small></div>
      <div class="card dash-kpi dash-kpi-customers" role="button" tabindex="0" onclick="showPage('customers')" title="Open Customers"><span>Customers</span><strong>${S.customers.length}</strong><small>View customers →</small></div>
      <div class="card dash-kpi dash-kpi-suppliers" role="button" tabindex="0" onclick="showPage('suppliers')" title="Open Suppliers"><span>Suppliers</span><strong>${S.suppliers.length}</strong><small>View suppliers →</small></div>
      <div class="card dash-kpi dash-kpi-low" role="button" tabindex="0" onclick="openLowStock()" title="Open Low Stock"><span>⚠ Low Stock</span><strong>${lowStock.length}</strong><small>View low stock →</small></div>
    </div>
`);
  put('dashLow', `
    ${lowStock.length ? `<div class="panel">
      <div class="panel-head">
        <div><h3 class="section-title" style="color:#c0392b;margin-bottom:3px">⚠ Low Stock Items</h3><div class="muted">${lowStock.length} item${lowStock.length===1?'':'s'} need attention</div></div>
        <button class="btn small" onclick="openLowStock()">View All →</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Current Stock</th><th>Reorder Level</th></tr></thead>
      <tbody>${lowStock.slice(0,8).map(p=>`<tr><td><a class="model-link" onclick="productDetail('${encA(p['Model / Part No.'])}')">${esc(p['Model / Part No.'])}</a></td><td>${esc(p.Description)}</td><td style="color:#c0392b"><b>${p.currentStock}</b></td><td>${reorderOf(p)}</td></tr>`).join('')}</tbody></table></div>
      ${lowStock.length>8 ? `<div style="text-align:center;margin-top:12px"><button class="btn ghost small" onclick="openLowStock()">View all ${lowStock.length} low stock items</button></div>` : ''}
    </div>` : ''}
`);
  put('dashCat', `
    <div class="panel">
      <div class="panel-head"><h3>Stock by Category</h3><span class="muted" style="font-size:12px">Current stock quantities</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:26px;align-items:center">
        <div style="display:flex;justify-content:center;align-items:center;min-width:0">
          ${donutChart(catData)}
        </div>
        <div style="min-width:0;display:flex;flex-direction:column;gap:15px">
          ${catData.map(d=>`<div style="display:grid;grid-template-columns:minmax(95px,1fr) minmax(90px,2fr) auto;gap:10px;align-items:center">
            <span style="font-size:12.5px;color:var(--ink-mid);overflow-wrap:anywhere">${esc(d.label)}</span>
            <div style="height:12px;background:#edf1f7;border-radius:99px;overflow:hidden">
              <div title="${esc(d.label)}: ${d.value.toLocaleString()}" style="height:100%;width:${catTotal>0?Math.max(0,Math.min(100,d.value/catTotal*100)):0}%;background:${d.color};border-radius:99px;min-width:${d.value>0?4:0}px"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:var(--ink);white-space:nowrap">${d.value.toLocaleString()} <span style="font-weight:500;color:var(--steel)">(${catTotal>0?Math.round(d.value/catTotal*100):0}%)</span></span>
          </div>`).join('') || '<div class="muted">No stock data yet.</div>'}
        </div>
      </div>
    </div>
`);
}
/* The previous dashboard — now shown inside "Detailed views" on the new dashboard (nothing removed) */
function renderDashboardClassic(){
  ($('dashClassic') || $('dash')).innerHTML = `<div class="toolbar" style="flex-wrap:wrap"><b class="muted">Filter inventory cards:</b><select id="dfCat" onchange="dashFilter()"></select><select id="dfBrand" onchange="dashFilter()"></select><button class="btn ghost small" onclick="clearFilters(['dfCat','dfBrand'],dashFilter)">Clear</button></div>
    <div id="dashCards"></div>
    <div id="paymentDueSection"></div>
    <div id="dashLow"></div>
    <div id="dashCat"></div>
    <div id="salesSummarySection"><div class="panel"><div class="muted">Loading sales summary…</div></div></div><div id="quotationPipelineSection"><div class="panel"><div class="muted">Loading quotation pipeline…</div></div></div>`;
  fillSelect('dfCat', S.products.map(p => p.Category), 'All Categories'); if ($('dfCat')) $('dfCat').value = DF.cat;
  fillSelect('dfBrand', S.products.map(p => p.Brand), 'All Brands'); if ($('dfBrand')) $('dfBrand').value = DF.brand;
  renderDashInventory();
  loadPaymentDue();
  loadSalesSummary();
  loadQuotationPipeline();
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

  const monthly = Array.isArray(r.monthlySales) ? r.monthlySales : [];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const maxMonthly = Math.max(...monthly.map(x => Number(x.amount)||0), 1);
  const monthlyBars = monthly.map((x,i) => {
    const amount = Number(x.amount)||0;
    const h = Math.max(3, Math.round(amount/maxMonthly*100));
    return '<div title="'+monthNames[i]+': Rs. '+money(amount)+'" style="flex:1;min-width:28px;height:170px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px">' +
      '<div style="font-size:9px;color:var(--steel);white-space:nowrap">'+(amount ? money(amount) : '')+'</div>' +
      '<div style="width:100%;max-width:42px;height:'+h+'%;min-height:4px;background:linear-gradient(180deg,#2F80ED,#78B5FF);border-radius:7px 7px 2px 2px;box-shadow:0 3px 8px rgba(47,128,237,.14)"></div>' +
      '<span style="font-size:10px;color:var(--steel)">'+monthNames[i]+'</span></div>';
  }).join('');

  targetHost.innerHTML =
    '<div style="display:grid;grid-template-columns:minmax(250px,1fr) minmax(220px,360px);gap:16px;align-items:stretch">' +
      '<div class="panel" style="margin:0;padding:18px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<div><h4 style="margin:0;color:#17345F;font-size:15px">Monthly Sales Overview</h4><div class="muted" style="font-size:11px;margin-top:3px">Net sales · GST excluded · '+r.year+'</div></div>' +
          '<div style="font-size:11px;color:var(--brand);font-weight:700">Rs. '+money(r.totalSales)+'</div>' +
        '</div>' +
        '<div style="display:flex;align-items:flex-end;gap:7px;height:205px;padding:5px 2px 0">'+monthlyBars+'</div>' +
      '</div>' +
      '<div class="panel" style="margin:0;padding:18px;display:flex;flex-direction:column;justify-content:center">' +
        '<div style="font-size:12px;color:var(--steel);font-weight:600">ANNUAL SALES TARGET</div>' +
        '<div style="display:flex;align-items:center;gap:18px;margin-top:12px">' +
          '<div style="width:104px;height:104px;border-radius:50%;background:conic-gradient(#2F80ED '+Math.min(100,pct)+'%,#E7EEF7 0);display:grid;place-items:center;flex:0 0 auto">' +
            '<div style="width:78px;height:78px;border-radius:50%;background:#fff;display:grid;place-items:center"><b style="font-size:19px;color:#17345F">'+pct+'%</b></div>' +
          '</div>' +
          '<div style="min-width:0"><div style="font-size:11px;color:var(--steel)">Target</div><b style="font-size:18px;color:#17345F">'+money(r.target)+'</b>' +
          '<div style="font-size:11px;color:var(--steel);margin-top:7px">Actual · GST excl.</div><b style="font-size:16px;color:#2F80ED">'+money(r.totalSales)+'</b></div>' +
        '</div>' +
        '<div style="margin-top:14px;font-size:12px;color:var(--steel)">'+
          (r.target > 0 ? (r.totalSales >= r.target ? '✓ Target reached' : money(remaining)+' remaining') : 'No target set for this year.')+
        '</div>' +
        (isAdmin() ? '<div style="margin-top:12px"><button class="btn small" onclick="setTargetForm('+r.year+','+r.target+')">'+(r.target > 0 ? 'Edit Target' : 'Set Target')+'</button></div>' : '') +
      '</div>' +
    '</div>';

  title.textContent = 'Top 10 Customers by Sales (' + r.year + ')';

  const top = (r.customerSales || []).slice(0,10);
  const totalCustomerSales = (r.customerSales || []).reduce((sum,c) => sum + (Number(c.amount)||0), 0) || 1;
  const topTotal = top.reduce((sum,c) => sum + (Number(c.amount)||0), 0);
  const maxAmt = Math.max(...top.map(c => Number(c.amount)||0), 1);

  customerHost.innerHTML = top.length ? 
    '<div class="panel" style="margin:0;padding:18px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
        '<div><h4 style="margin:0;color:#17345F;font-size:15px">Top 10 Customers</h4><div class="muted" style="font-size:11px;margin-top:3px">Share of total net sales · '+r.year+'</div></div>' +
        '<div style="font-size:11px;color:var(--steel)">Top 10 = '+Math.round(topTotal/totalCustomerSales*100)+'%</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:11px">' +
      top.map((c,i) => {
        const amount = Number(c.amount)||0;
        const share = amount/totalCustomerSales*100;
        const bar = amount/maxAmt*100;
        return '<div style="display:grid;grid-template-columns:24px minmax(110px,1.25fr) minmax(130px,2fr) 82px;gap:9px;align-items:center">' +
          '<span style="width:24px;height:24px;border-radius:7px;background:#EEF5FF;color:#2F80ED;display:grid;place-items:center;font-size:11px;font-weight:700">'+(i+1)+'</span>' +
          '<span style="font-size:12px;color:#284A78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(c.customer)+'">'+esc(c.customer)+'</span>' +
          '<div style="background:#EEF3F9;border-radius:8px;height:10px;overflow:hidden"><div style="width:'+bar+'%;height:100%;background:linear-gradient(90deg,#2F80ED,#69A8F7);border-radius:8px"></div></div>' +
          '<div style="text-align:right;white-space:nowrap"><b style="font-size:12px;color:#17345F">'+money(amount)+'</b><span style="display:block;font-size:10px;color:#7087A6">'+share.toFixed(1)+'%</span></div>' +
        '</div>';
      }).join('') +
      '</div>' +
    '</div>' : '<div class="panel"><div class="muted">No invoice sales recorded for this year.</div></div>';
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
  fillSelect('pb', S.products.map(p => p.Brand), 'All Brands');
  const pbv = ($('pb')||{}).value || '', pstv = ($('pst')||{}).value || '', pactv = ($('pact')||{}).value || '';
  let a = S.products.filter(p => {
    if (!([p['Model / Part No.'],p.Description,p.Location].join(' ').toLowerCase().includes(q) && (!c || p.Category === c))) return false;
    if (pbv && String(p.Brand || '').trim() !== pbv) return false;
    if (pactv && (p.Status || 'Active') !== pactv) return false;
    const stock = Number(p.currentStock) || 0;
    if (pstv === 'in' && !(stock > 0)) return false;
    if (pstv === 'out' && !(stock <= 0)) return false;
    if (pstv === 'low' && !(stock <= reorderOf(p))) return false;
    return true;
  });
  const pc2 = $('pcount'); if (pc2) pc2.textContent = 'Showing ' + Math.min(a.length, 1000) + ' of ' + S.products.length + ' product(s)' + (a.length > 1000 ? ' (first 1000 shown — narrow the filters)' : '');
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
  setTimeout(() => loadSourceRecords(m, 'pdSrc', false), 0);
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
     <div id="pdSrc" class="pd-src muted small">Checking where this stock comes from…</div>
     <div class="actions">
       <button class="btn" onclick="editProductForm('${encA(m)}')">Edit</button>
       <button class="btn" onclick="showProductHistory('${encA(m)}')">Product History</button>
       ${isAdmin()?`<button class="btn" onclick="setStockForm('${encA(m)}')">⚖ Set Stock</button>`:''}
       ${isAdmin()?`<button class="btn danger" onclick="toggleProductStatus('${encA(m)}','${status==='Active'?'Inactive':'Active'}')">${status==='Active'?'Deactivate':'Activate'}</button>`:''}
     </div>`);
}

async function showProductHistory(em){
  const m = decodeURIComponent(em);
  modal('Product History — '+m, '<p class="muted">Loading…</p>');
  const r = await api('stockMovement', {model:m});
  if (!r.ok) { $('modalBody').innerHTML = '<p class="muted">'+esc(r.error||'Could not load history.')+'</p>'; return; }

  const allRows = (r.movements||[]).slice(1); // row 0 is the header row
  const adjRows = allRows.filter(x => String(x[7]||'') === 'Stock Adjustment').sort((a,b)=>new Date(b[1])-new Date(a[1]));
  const rows = allRows.filter(x => String(x[7]||'') !== 'Stock Adjustment');
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
    ${adjRows.length ? `<h4 style="margin:16px 0 8px">Stock Adjustments (set by Admin)</h4><div class="table-wrap"><table><thead><tr><th>Date</th><th>Change</th><th>Reason</th><th>Ref #</th><th>By</th></tr></thead><tbody>${adjRows.map(x => `<tr><td>${fmtDate(x[1])}</td><td><b style="color:${Number(x[5])<0?'#c0392b':'#15803d'}">${Number(x[5])>0?'+':''}${x[5]}</b></td><td>${esc(x[6])}</td><td>${esc(x[8])}</td><td>${esc(x[9])}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div id="srcRecs" style="margin-top:16px"><div class="muted">Loading the old inventory sheet record…</div></div>
  `;
  loadSourceRecords(m, 'srcRecs', true);
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
       ${hasMod('imports') ? `<label>Cost Price<input id="epcost" type="number" value="${esc(p['Cost Price']||'')}"></label>` : `<input id="epcost" type="hidden" value="${esc(p['Cost Price']||'')}">`}
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
       ${hasMod('imports') ? '<label>Cost Price<input id="pcost" type="number"></label>' : '<input id="pcost" type="hidden" value="">'}
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
    if (x.make == null || x.make === '') x.make = pr ? (pr.Brand || '') : '';
    return `<tr>
       <td><input value="${esc(x.model)}" list="ml" onchange="dcl[${i}].model=this.value;dcl[${i}].make=(findProd(this.value)||{}).Brand||dcl[${i}].make||'';renderDcLines()"></td>
       <td>${esc(pr ? (pr.Description||'') : '')}${pr ? `<div class="muted small">Stock: ${esc(pr.currentStock)}</div>` : (x.model ? '<div class="muted small" style="color:#c0392b">Product not found</div>' : '')}</td>
       <td><input value="${esc(x.make||'')}" placeholder="Make" onchange="dcl[${i}].make=this.value"></td>
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
  if (String(c.Status || 'Active').toLowerCase() === 'inactive') return {error:'Customer is inactive: ' + c['Customer Name']};
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
    if (!merged[key]) { merged[key] = {model:key, desc:pr.Description || '', qty:0, unit:x.unit || pr.Unit || 'Pcs', make:x.make || pr.Brand || ''}; order.push(key); }
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
  dcl = d.items.map(x => ({model:x.model, qty:x.qty, unit:x.unit || 'Pcs', make:x.make || ''}));
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
  fillSelect('dchCust', DCH_CACHE.map(d => d.customer), 'All Customers');
  const rng = periodRange('dchPer'), cust = ($('dchCust') || {}).value || '', inv = ($('dchInv') || {}).value || '';
  const rows = DCH_CACHE.filter(d => (!q || d.searchText.includes(q)) && inPeriod(d.date, rng) && (!cust || d.customer === cust) && (!inv || (inv === 'yes') === !!d.invoiced));
  const dInfo = $('dchInfo'); if (dInfo) dInfo.textContent = 'Showing ' + rows.length + ' of ' + DCH_CACHE.length + ' challan(s) • Total qty ' + rows.reduce((a, d) => a + (+d.totalQty || 0), 0).toLocaleString();
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
    if (x.make == null || x.make === '') x.make = pr ? (pr.Brand || '') : '';
    return `<tr>
       <td><input value="${esc(x.model)}" list="ivml" onchange="ivModelChanged(${i},this.value)"></td>
       <td>${esc(pr ? (pr.Description||'') : '')}${x.model && !pr ? '<div class="muted small" style="color:#c0392b">Product not found</div>' : ''}</td>
       <td><input value="${esc(x.make||'')}" placeholder="Make" onchange="ivl[${i}].make=this.value"></td>
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
  if (pr) {
    if (ivl[i].make === '' || ivl[i].make == null) ivl[i].make = pr.Brand || '';
    if ((ivl[i].rate === '' || ivl[i].rate == null) && Number(pr['Sale Price']) > 0) ivl[i].rate = pr['Sale Price'];
  }
  renderIvLines();
}

/* Enter the DC number and select "Load DC" — customer, PO, and items are loaded automatically */
async function loadDcIntoInvoice(){
  const raw=$('ivdc').value.trim();if(!raw)return toast('Please enter at least one Delivery Challan #.',true);
  const nos=raw.split(/[,\n]+/).map(x=>x.trim()).filter(Boolean),docs=[];
  for(const no of nos){const r=await api('getReports',{mode:'document',type:'DC',no:no});if(!r.ok)return toast((r.error||'DC not found.')+' ['+no+']',true);docs.push(r.document);}
  const first=docs[0],ck=norm(first.customer);if(docs.some(d=>norm(d.customer)!==ck))return toast('All selected Delivery Challans must belong to the same customer.',true);
  const merged={},order=[];docs.forEach(d=>(d.items||[]).forEach(x=>{const k=String(x.model||'').trim();if(!k)return;if(!merged[k]){merged[k]={qty:0,make:x.make||''};order.push(k);}merged[k].qty+=Number(x.qty||0);if(!merged[k].make)merged[k].make=x.make||'';}));
  $('ivcust').value=first.customer||'';pickCustomer('iv');$('ivcid').value=first.customerId||$('ivcid').value;$('ivpo').value=first.po||'';$('ivpodate').value=toInputDate(first.poDate);$('ivdcdate').value=docs.length===1?toInputDate(first.date):'';if(first.stn)$('ivstn').value=first.stn;if(first.ntn)$('ivntn').value=first.ntn;
  ivl=order.map(k=>{const pr=findProd(k);return{model:k,qty:merged[k].qty,make:merged[k].make||(pr&&pr.Brand)||'',rate:(pr&&Number(pr['Sale Price'])>0)?pr['Sale Price']:''};});if(!ivl.length)ivl=[{model:'',qty:'',rate:''}];renderIvLines();
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
    items.push({model:pr['Model / Part No.'], desc:pr.Description || '', make:x.make || pr.Brand || '', qty:qty, rate:rate});
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
 ivl=(d.items||[]).map(x=>({model:x.model,qty:x.qty,make:x.make||'',rate:x.rate}));if(!ivl.length)ivl=[{model:'',qty:'',rate:''}];renderIvLines();
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
  fillSelect('ivhCust', IVH_CACHE.map(d => d.customer), 'All Customers');
  const rng = periodRange('ivhPer'), cust = ($('ivhCust') || {}).value || '';
  const rows = IVH_CACHE.filter(d => (!q || d.searchText.includes(q)) && inPeriod(d.date, rng) && (!cust || d.customer === cust));
  const iInfo = $('ivhInfo'); if (iInfo) iInfo.textContent = 'Showing ' + rows.length + ' of ' + IVH_CACHE.length + ' invoice(s) • Total (incl. GST) ' + money(rows.reduce((a, d) => a + (+d.grandTotal || 0), 0));
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

  ACC.sup = supOut.ok ? (supOut.rows||[]) : [];
  ACC.supPays = supPay.ok ? (supPay.payments||[]) : [];
  filterSupOut();
  filterSupPay();
}
function renderAccounts(){ loadAccounts(); }

/* ---------- ACCOUNTS SEARCH (Customer Outstanding + Customer Payments) ---------- */
let ACC = {out:[], pays:[], outErr:'', payErr:''};
const ACC_PAY_DEFAULT_LIMIT = 100;   // when search is blank, show the latest payments; when searching, search all records

function accHay(parts){ return parts.map(v => String(v == null ? '' : v)).join(' | ').toLowerCase(); }
function accMatch(hay, q){
  const toks = String(q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return toks.every(tk => hay.includes(tk));      // all words must match (e.g. "INV-000012 cash")
}
function accDateParts(v){
  const d = new Date(v);
  if (!v || isNaN(d)) return [String(v || '')];
  const dd = String(d.getDate()).padStart(2,'0'), mm = String(d.getMonth()+1).padStart(2,'0'), yy = d.getFullYear();
  return [fmtDate(v), toInputDate(v), dd+'/'+mm+'/'+yy, dd+'-'+mm+'-'+yy];
}
function accAmountParts(n){ const a = Number(n) || 0; return [String(a), money(a), money(a).replace(/,/g,'')]; }

function custOutRowHtml(r){
  const di = dueInfo(r.date, paymentTermsOf(r.customer).days);
  return `<tr><td>${esc(r.no)}</td><td>${fmtDate(r.date)}</td><td>${esc(r.customer)}</td><td>${money(r.total)}</td><td>${money(r.paid)}</td><td><b>${money(r.outstanding)}</b></td><td>${di?fmtDate(di.due):'—'}</td><td>${di&&Number(r.outstanding)>0.5?dueBadge(di.daysOver):'—'}</td><td><button class="btn small primary" onclick="openCustPayModal('${encA(r.no)}','${encA(r.customer)}',${r.outstanding})">Record Payment</button></td></tr>`;
}
function filterCustOut(){
  const host = $('custOutRows');
  if (!host) return;
  fillSelect('custOutCust', ACC.out.map(r => r.customer), 'All Customers');
  const q = (($('custOutSearch') || {}).value || '').trim();
  const cust = ($('custOutCust') || {}).value || '', st = ($('custOutSt') || {}).value || '', rng = periodRange('custOutPer');
  const hits = ACC.out.filter(r => {
    if (q && !accMatch(r._hay, q)) return false;
    if (cust && r.customer !== cust) return false;
    if (!inPeriod(r.date, rng)) return false;
    if (st) {
      const di = dueInfo(r.date, paymentTermsOf(r.customer).days); if (!di) return false;
      const o = di.daysOver;
      if (st === 'over' && !(o > 0)) return false;
      if (st === 'soon' && !(o <= 0 && o >= -7)) return false;
      if (st === 'later' && !(o < -7)) return false;
    }
    return true;
  });
  const filtered = !!(q || cust || st || rng);
  host.innerHTML = ACC.outErr
    ? `<tr><td colspan="9" class="empty">${esc(ACC.outErr)}</td></tr>`
    : (hits.map(custOutRowHtml).join('') || `<tr><td colspan="9" class="empty">${filtered ? 'No invoice found.' : 'No outstanding invoices — all settled!'}</td></tr>`);
  const info = $('custOutInfo');
  if (info) {
    const tot = hits.reduce((a, r) => a + (Number(r.outstanding) || 0), 0);
    info.textContent = ACC.outErr ? '' : (filtered ? `${hits.length} of ${ACC.out.length} invoice(s) • Outstanding ${money(tot)}` : `${ACC.out.length} invoice(s) • Outstanding ${money(tot)}`);
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
  fillSelect('custPayCust', ACC.pays.map(x => x['Customer Name']), 'All Customers');
  fillSelect('custPayMeth', ACC.pays.map(x => x.Method), 'All methods');
  const q = (($('custPaySearch') || {}).value || '').trim();
  const cust = ($('custPayCust') || {}).value || '', meth = ($('custPayMeth') || {}).value || '', rng = periodRange('custPayPer');
  const all = ACC.pays;
  const hits = all.filter(x => (!q || accMatch(x._hay, q)) && (!cust || String(x['Customer Name'] || '').trim() === cust) && (!meth || String(x.Method || '').trim() === meth) && inPeriod(x.Date, rng));
  const filtered = !!(q || cust || meth || rng);
  const shown = filtered ? hits : hits.slice(0, ACC_PAY_DEFAULT_LIMIT);
  host.innerHTML = ACC.payErr
    ? `<tr><td colspan="7" class="empty">${esc(ACC.payErr)}</td></tr>`
    : (shown.map(custPayRowHtml).join('') || `<tr><td colspan="7" class="empty">${filtered ? 'No payment found.' : 'No payments recorded yet.'}</td></tr>`);
  const info = $('custPayInfo');
  if (info) {
    const tot = hits.reduce((a, x) => a + (Number(x.Amount) || 0), 0);
    info.textContent = ACC.payErr ? '' : (filtered
      ? `${hits.length} payment(s) found • Total ${money(tot)}`
      : (all.length > shown.length ? `Latest ${shown.length} of ${all.length} • use filters to see older payments` : `${all.length} payment(s) • Total ${money(tot)}`));
  }
}
function filterSupOut(){
  const host = $('supOutRows'); if (!host) return;
  const q = norm(($('supOutSearch') || {}).value || ''), st = ($('supOutSt') || {}).value || '';
  const rows = (ACC.sup || []).filter(r => (!q || norm(r.supplier).includes(q)) && (!st || Number(r.outstanding) > 0.5));
  host.innerHTML = rows.map(r => `<tr><td>${esc(r.supplier)}</td><td>${money(r.purchased)}</td><td>${money(r.paid)}</td><td><b>${money(r.outstanding)}</b></td><td><button class="btn small primary" onclick="openSupPayModal('${encA(r.supplier)}',${r.outstanding})">Record Payment</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No supplier found.</td></tr>';
}
function filterSupPay(){
  const host = $('supPayRows'); if (!host) return;
  const all = ACC.supPays || [];
  fillSelect('supPayMeth', all.map(x => x.Method), 'All methods');
  const q = norm(($('supPaySearch') || {}).value || ''), meth = ($('supPayMeth') || {}).value || '', rng = periodRange('supPayPer');
  const hits = all.filter(x => (!q || [x['Supplier Name'], x.Reference, x.Method, x.Remarks].some(v => norm(v).includes(q))) && (!meth || String(x.Method || '').trim() === meth) && inPeriod(x.Date, rng));
  const filtered = !!(q || meth || rng), shown = filtered ? hits : hits.slice(0, 30);
  host.innerHTML = shown.map(x => `<tr><td>${fmtDate(x.Date)}</td><td>${esc(x['Supplier Name'])}</td><td>${money(x.Amount)}</td><td>${esc(x.Method)}</td><td>${esc(x.Reference)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No payments found.</td></tr>';
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
  <p class="muted small" style="margin:8px 0 0">Cash + Income Tax + WHT = invoice settlement (must not exceed the outstanding amount).</p>
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
    if (amt < 0 || incomeTax < 0 || wht < 0) return toast('Amounts cannot be negative.', true);
    if (amt <= 0 && incomeTax <= 0 && wht <= 0) return toast('Enter at least a cash or tax amount.', true);
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
function partyCardHtml(type,c){
  const isCustomer=type==='Customer'; const nameKey=isCustomer?'Customer Name':'Supplier Name'; const idKey=isCustomer?'Customer ID':'Supplier ID';
  const name=String(c[nameKey]||'Unnamed'); const id=String(c[idKey]||''); const status=c.Status||'Active';
  const initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';
  const contact=String(c['Contact Person']||'').trim(), phone=String(c.Phone||'').trim(), email=String(c.Email||'').trim();
  const address=String(c.Address||'').trim(), ntn=String(c['NTN/Tax ID']||'').trim(), stn=stnOf(c);
  return '<article class="party-card '+(isCustomer?'party-customer':'party-supplier')+' '+(status==='Inactive'?'is-inactive':'')+'">'+
    '<div class="party-card-head"><div class="party-avatar">'+esc(initials)+'</div><div class="party-title"><h3>'+esc(name)+'</h3><div class="party-id">'+esc(id||(isCustomer?'Customer':'Supplier'))+'</div></div><span class="party-status '+(status==='Active'?'active':'inactive')+'">'+esc(status)+'</span></div>'+
    '<div class="party-contact-grid">'+
      '<div class="party-info"><span>Contact Person</span><b>'+esc(contact||'—')+'</b></div>'+
      '<div class="party-info"><span>Phone</span><b>'+esc(phone||'—')+'</b></div>'+
      '<div class="party-info"><span>Email</span><b class="party-email">'+esc(email||'—')+'</b></div>'+
      '<div class="party-info"><span>NTN / Tax ID</span><b>'+esc(ntn||'—')+'</b></div>'+
      '<div class="party-info"><span>STN</span><b>'+esc(stn||'—')+'</b></div>'+
      (isCustomer?'<div class="party-info"><span>Payment Terms</span><b>'+(paymentTermsOf(name).isDefault?'<span class="muted">Not set</span>':paymentTermsOf(name).days+' days')+'</b></div>':'')+
      '<div class="party-info party-address"><span>Address</span><b>'+esc(address||'—')+'</b></div>'+
    '</div><div class="party-actions">'+
      '<button class="btn small" onclick="ledger(\''+type+'\',\''+encA(name)+'\')">View Ledger</button>'+
      '<button class="btn small" onclick="editPartyForm(\''+type+'\',\''+encA(name)+'\')">Edit</button>'+
      (isAdmin()?'<button class="btn small '+(status==='Active'?'danger':'')+'" onclick="togglePartyStatus(\''+type+'\',\''+encA(name)+'\',\''+(status==='Active'?'Inactive':'Active')+'\')">'+(status==='Active'?'Deactivate':'Activate')+'</button>':'')+
    '</div></article>';
}

function renderPartyDirectory(type){
  const isCustomer=type==='Customer'; const list=isCustomer?S.customers:S.suppliers; const host=$(isCustomer?'customers':'suppliers');
  const search=$(isCustomer?'customerSearch':'supplierSearch'); const q=norm(search?.value||''); const statusFilter=$(isCustomer?'customerStatus':'supplierStatus')?.value||'';
  const key=isCustomer?'Customer Name':'Supplier Name';
  const filtered=list.filter(c=>{const status=c.Status||'Active'; if(statusFilter&&status!==statusFilter)return false; if(!q)return true; return [c[key],c[isCustomer?'Customer ID':'Supplier ID'],c['Contact Person'],c.Phone,c.Email,c.Address,c['NTN/Tax ID'],c.Remarks].some(v=>norm(v).includes(q));});
  const active=list.filter(x=>(x.Status||'Active')==='Active').length; const inactive=list.length-active;
  const count=$(isCustomer?'customerCount':'supplierCount'); if(count) count.textContent='Showing '+filtered.length+' of '+list.length;
  const stat=$(isCustomer?'customerStats':'supplierStats'); if(stat) stat.innerHTML='<span class="party-stat active"><b>'+active+'</b> Active</span><span class="party-stat"><b>'+inactive+'</b> Inactive</span>';
  host.innerHTML=filtered.map(c=>partyCardHtml(type,c)).join('')||'<div class="party-empty"><div class="party-empty-icon">◎</div><h3>No '+(isCustomer?'customers':'suppliers')+' found</h3><p>Try another search or add a new '+(isCustomer?'customer':'supplier')+'.</p></div>';
}
function renderCustomers(){ renderPartyDirectory('Customer'); }
function renderSuppliers(){ renderPartyDirectory('Supplier'); }
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
       ${type==='Customer'?`<label>Payment Terms (days)<input id="epterms" type="number" min="0" max="365" step="1" value="${esc(paymentTermsOf(name).isDefault?'':paymentTermsOf(name).days)}" placeholder="${DEFAULT_PAYMENT_TERMS_DAYS} (default)"></label><label>Price Adjustment (%)<input id="eppriceadjust" type="number" step="0.01" min="-100" max="1000" value="${esc(c['Price Adjustment (%)']===undefined?'0':c['Price Adjustment (%)'])}" placeholder="e.g. 15 or -5"><small>Positive adds to price; negative reduces it.</small></label>`:''}
       <label class="wide">Remarks (Enter STN as: STN: 1234)<textarea id="eprem2">${esc(type==='Customer'?stripGroup(stripPaymentTerms(c.Remarks||'')):(c.Remarks||''))}</textarea></label>${type==='Customer'?`<label>Group <small>(optional — companies of one group are added together on the dashboard)</small><input id="epgroup" list="grouplist" value="${esc(groupOfRemarks(c.Remarks||''))}" placeholder="e.g. NOVATEX GROUP"></label>`:''}
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
    ntn:$('epntn').value, address:$('epaddr').value, priceAdjustmentPct:type==='Customer'?Number(($('eppriceadjust')||{}).value||0):undefined, remarks:type==='Customer' ? remarksWithGroup(remarksWithTerms($('eprem2').value, ($('epterms')||{}).value), ($('epgroup')||{}).value) : $('eprem2').value
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
       ${type==='Customer'?`<label>Payment Terms (days)<input id="pterms" type="number" min="0" max="365" step="1" placeholder="${DEFAULT_PAYMENT_TERMS_DAYS} (default)"></label><label>Price Adjustment (%)<input id="ppriceadjust" type="number" step="0.01" min="-100" max="1000" value="0" placeholder="e.g. 15 or -5"><small>Positive adds to price; negative reduces it.</small></label>`:''}
       ${type==='Customer'?`<label>Group <small>(optional)</small><input id="pgroup" list="grouplist" placeholder="e.g. NOVATEX GROUP"></label>`:''}
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
  let remarks = [stn ? 'STN: ' + stn : '', $('pr').value.trim()].filter(Boolean).join('\n');
  if (type === 'Customer') remarks = remarksWithGroup(remarksWithTerms(remarks, ($('pterms')||{}).value), ($('pgroup')||{}).value);
  await guardedSave(async () => {
    const r = await api(type === 'Customer' ? 'saveCustomer' : 'saveSupplier', {
      name, contact:$('pcontact').value, phone:$('pphone').value,
      email:$('pemail').value, ntn:$('pntn').value, address, priceAdjustmentPct:type==='Customer'?Number(($('ppriceadjust')||{}).value||0):undefined, remarks
    });
    if (!r.ok) return toast(r.error, true);
    closeModal(); await refresh();
    toast(type + ' saved.');
  });
}

/* Date -> sortable number. Missing / invalid dates go to the END of the statement (not the top). */
function ledgerTime(v){ const t = new Date(v).getTime(); return isNaN(t) ? 8.64e15 : t; }

/* Sales Tax Invoice # is always 200 less than the Invoice #  (2000 -> 1800, 1200 -> 1000).
   Worked out automatically for every invoice, old and new. If the gap ever changes, edit ST_INV_OFFSET only. */
const ST_INV_OFFSET = 200;
function salesTaxInvNo(invNo){
  const s = String(invNo == null ? '' : invNo).trim();
  const m = s.match(/^(.*?)(\d+)$/);            /* keeps any prefix, e.g. SFS-347 -> SFS-147 */
  if (!m) return s;
  const n = Number(m[2]) - ST_INV_OFFSET;
  return n < 1 ? '—' : m[1] + String(n).padStart(m[2].length, '0');
}

/* Customer statement as PDF (print dialog -> Save as PDF), to send the outstanding to the customer.
   mode 'outstanding' = summary + unpaid invoices only,  mode 'full' = also the complete ledger. */
function ledgerPdf(mode){
  const c = window.LEDGER_CTX; if (!c) return toast('Open the ledger first.', true);
  const cust = findCust(c.name) || {};
  const outstanding = c.dr - c.cr;
  const terms = paymentTermsOf(c.name);
  const open = (c.invoices || []).filter(r => Number(r.outstanding) > 0.5)
    .map(r => { const di = dueInfo(r.date, terms.days); return Object.assign({}, r, {due:di ? di.due : null, daysOver:di ? di.daysOver : null}); })
    .sort((a, b) => ledgerTime(a.date) - ledgerTime(b.date));
  const openTotal = open.reduce((a, r) => a + (Number(r.outstanding) || 0), 0);
  const overdueTotal = open.filter(r => r.daysOver !== null && r.daysOver > 0).reduce((a, r) => a + (Number(r.outstanding) || 0), 0);
  const statusTxt = r => r.daysOver === null ? '' : (r.daysOver > 0 ? '<span style="color:#b00020;font-weight:bold">Overdue ' + r.daysOver + ' day' + (r.daysOver === 1 ? '' : 's') + '</span>' : (r.daysOver === 0 ? 'Due today' : 'Due in ' + (-r.daysOver) + ' day' + (r.daysOver === -1 ? '' : 's')));
  const th = (t, cls) => '<th' + (cls ? ' class="' + cls + '"' : '') + '>' + t + '</th>';

  /* Outstanding invoices table: Inv #, Sales Tax Inv #, Inv Date, PO #, PO Date, Amount excl. GST, GST, Net Amount.
     A part-paid invoice is shown for its BALANCE only (amounts scaled), so the column total always equals the outstanding. */
  const shortDate = v => { if (!v) return '—'; const d = new Date(v); if (isNaN(d)) return esc(v); return String(d.getDate()).padStart(2, '0') + '-' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + '-' + d.getFullYear(); };
  let anyPartial = false, anyMissing = false, sumEx = 0, sumGst = 0, sumNet = 0;
  const openRows = open.map(r => {
    const total = Number(r.total) || 0, out = Number(r.outstanding) || 0;
    const f = total > 0 ? Math.min(1, out / total) : 1, partial = f < 0.9999;
    const hasSub = r.subtotal !== undefined && r.subtotal !== null && r.subtotal !== '';
    let exTxt = '—', gstTxt = '—';
    if (hasSub) { const ex = (Number(r.subtotal) || 0) * f, gst = out - ex; exTxt = money(ex); gstTxt = money(gst); sumEx += ex; sumGst += gst; } else anyMissing = true;
    sumNet += out; if (partial) anyPartial = true;
    return '<tr><td>' + esc(r.no) + (partial ? ' *' : '') + '</td><td>' + esc(r.stInv || salesTaxInvNo(r.no)) + '</td><td>' + shortDate(r.date) + '</td><td>' + esc(r.po || '') + '</td><td>' + shortDate(r.poDate) + '</td><td class="r">' + exTxt + '</td><td class="r">' + gstTxt + '</td><td class="r"><b>' + money(out) + '</b></td><td>' + statusTxt(r) + '</td></tr>';
  }).join('');
  const openTable = open.length
    ? '<table class="doc-items stmt"><colgroup><col style="width:7%"><col style="width:9%"><col style="width:11%"><col style="width:12%"><col style="width:11%"><col style="width:13%"><col style="width:11%"><col style="width:14%"><col style="width:12%"></colgroup><thead><tr>' + th('Inv #') + th('Sales Tax Inv #') + th('Inv Date') + th('PO #') + th('PO Date') + th('Amount excl. GST', 'r') + th('GST', 'r') + th('Net Amount', 'r') + th('Status') + '</tr></thead><tbody>' + openRows
      + '<tr><td colspan="5" class="tot-label">TOTAL OUTSTANDING</td><td class="r"><b>' + (anyMissing ? '—' : money(sumEx)) + '</b></td><td class="r"><b>' + (anyMissing ? '—' : money(sumGst)) + '</b></td><td class="r"><b>' + money(openTotal) + '</b></td><td></td></tr></tbody></table>'
      + (anyPartial ? '<div class="muted" style="margin-top:6px">* Part payment already received — amounts shown are for the balance due.</div>' : '')
    : '<p style="margin:10px 0"><b>No outstanding invoices — account is settled.</b></p>';

  const fullRows = c.entries.map(e => '<tr><td>' + (fmtDate(e.date) || '—') + '</td><td>' + e.kind + '</td><td>' + esc(e.ref) + '</td><td class="r">' + (e.debit ? money(e.debit) : '') + '</td><td class="r">' + (e.credit ? money(e.credit) : '') + '</td><td class="r"><b>' + money(e.bal) + '</b></td></tr>').join('');
  const fullTable = mode === 'full'
    ? '<div style="font-weight:bold;margin:20px 0 6px;font-size:13px">ACCOUNT STATEMENT (LEDGER)</div><table class="doc-items stmt"><colgroup><col style="width:15%"><col style="width:9%"><col style="width:34%"><col style="width:14%"><col style="width:14%"><col style="width:14%"></colgroup><thead><tr>' + th('Date') + th('Type') + th('Reference') + th('Debit', 'r') + th('Credit', 'r') + th('Balance', 'r') + '</tr></thead><tbody>' + (fullRows || '<tr><td colspan="6">No invoices or payments.</td></tr>')
      + '<tr><td colspan="3" class="tot-label">TOTAL</td><td class="r"><b>' + money(c.dr) + '</b></td><td class="r"><b>' + money(c.cr) + '</b></td><td class="r"><b>' + money(outstanding) + '</b></td></tr></tbody></table>'
      + '<div class="muted" style="margin-top:6px">Debit = Invoices (including GST), Credit = Payments received. Positive balance = amount due from you.</div>'
    : '';

  const box = (label, val, red) => '<td style="border:1px solid #333;padding:9px 10px;width:33%"><div style="font-size:10.5px;color:#555;font-weight:bold;text-transform:uppercase">' + label + '</div><div style="font-size:16px;font-weight:bold' + (red ? ';color:#b00020' : '') + '">Rs. ' + money(val) + '</div></td>';
  const body = `
    <div class="doc-head">
      <div class="doc-head-left"><img src="${printLogoSrc()}" class="doc-logo"></div>
      <div class="doc-head-right"><div class="doc-title">ACCOUNT STATEMENT</div></div>
    </div>
    <div class="doc-meta">
      <div class="meta-left">
        <div class="meta-line"><span class="meta-tag">M/S:</span><span class="cust-name">${esc(c.name)}</span></div>
        <div class="meta-line"><span class="meta-tag">Address:</span><span>${esc(cust.Address || '')}</span></div>
      </div>
      <div class="meta-right">
        <div class="meta-row"><span class="meta-label">Statement Date:</span><span class="meta-value">${fmtDate(todayStr())}</span></div>
        <div class="meta-row"><span class="meta-label">Payment Terms:</span><span class="meta-value">${terms.days} days</span></div>
      </div>
    </div>
    ${mode === 'full' ? '<table style="width:100%;border-collapse:collapse;margin-bottom:18px"><tr>' + box('Total Invoiced', c.dr) + box('Total Received', c.cr) + box('Outstanding', outstanding, outstanding > 0.5) + '</tr></table>' : ''}
    ${mode === 'full' && overdueTotal > 0.5 ? '<div style="margin:-4px 0 14px;font-size:12px;color:#b00020"><b>Overdue amount: Rs. ' + money(overdueTotal) + '</b> — kindly arrange payment at the earliest.</div>' : ''}
    <div style="font-weight:bold;margin:0 0 6px;font-size:13px">OUTSTANDING INVOICES</div>
    ${openTable}
    ${fullTable}
    <div class="doc-endblock doc-footer-note"><div class="muted">This is a computer-generated statement. Please report any difference within 7 days.</div><div class="doc-sign-block"><i>FOR STANDARD FLUID SYSTEMS</i></div></div>`;
  printDoc(body, null, docFileName('Statement ' + todayStr(), c.name, 'Statement'));
}
window.ledgerPdf = ledgerPdf;

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
      (inv.rows||[]).forEach(r => entries.push({t:ledgerTime(r.date), ord:0, date:r.date, kind:'Invoice', ref:r.no, debit:Number(r.total)||0, credit:0}));
      (pay.payments||[]).forEach(x => entries.push({t:ledgerTime(x.Date), ord:1, date:x.Date, kind:'Payment', ref:[x['Invoice No.'], x.Method, x.Reference].filter(Boolean).join(' • '), debit:0, credit:Number(x.Amount)||0}));
      entries.sort((a,b) => (a.t - b.t) || (a.ord - b.ord));
      let bal = 0, dr = 0, cr = 0;
      const rows = entries.map(e => {
        bal += e.debit - e.credit; dr += e.debit; cr += e.credit; e.bal = bal;
        return `<tr><td>${fmtDate(e.date)}</td><td>${e.kind}</td><td>${esc(e.ref)}</td><td class="right">${e.debit ? money(e.debit) : ''}</td><td class="right">${e.credit ? money(e.credit) : ''}</td><td class="right"><b>${money(bal)}</b></td></tr>`;
      }).join('');
      window.LEDGER_CTX = {name:name, entries:entries, dr:dr, cr:cr, invoices:(inv.rows||[])};
      html += `<div class="ledger-actions">
          <button class="btn small primary" onclick="ledgerPdf('outstanding')">⬇ Outstanding PDF</button>
          <button class="btn small" onclick="ledgerPdf('full')">⬇ Full Statement PDF</button>
          <span class="muted small">Opens print dialog → choose “Save as PDF”</span>
        </div>
        <h4 style="margin:0 0 8px">Account Statement</h4>
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Type</th><th>Reference</th><th class="right">Debit</th><th class="right">Credit</th><th class="right">Balance</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6" class="empty">No invoices or payments.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="3"><b>Total</b></td><td class="right"><b>${money(dr)}</b></td><td class="right"><b>${money(cr)}</b></td><td class="right"><b>${money(dr - cr)}</b></td></tr></tfoot>
        </table></div>
        <div class="muted small">Debit = Invoices (including GST), Credit = Payments. Positive balance = Amount due from the customer.</div>`;
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
  const rmv = ($('rm') || {}).value || '';
  const host = $('reports');
  if (host) host.innerHTML = '<div class="muted">Loading…</div>';
  const r = await api('getReports', {year});
  if (!r.ok) { if (host) host.innerHTML = ''; return toast(r.error, true); }
  const inMonth = v => { if (rmv === '') return true; const d = new Date(v); return !isNaN(d) && d.getMonth() === Number(rmv); };
  const sales = (r.sales || []).filter(x => inMonth(x.date));
  window.RPT_MV = (r.movements || []).slice().sort((a,b) => new Date(b.Date) - new Date(a.Date));
  if (!$('reports')) return;
  const period = rmv === '' ? 'Year ' + year : PS_MONTHS[Number(rmv)] + ' ' + year;
  $('reports').innerHTML =
    `${isAdmin() ? '<div id="uaSection"></div>' : ''}<div class="cards">
       <div class="card"><span>Invoice Lines — ${esc(period)}</span><strong>${sales.length}</strong></div>
       <div class="card"><span>Sales (excl. GST) — ${esc(period)}</span><strong>${money(sales.reduce((a,x)=>a+(+x.total||0),0))}</strong></div>
     </div>
     <div id="psales"></div>
     <div class="panel"><h3>Units Delivered by Category (whole year ${esc(year)})</h3><div class="catgrid">${CATS.map(c=>`<div class="cat"><span>${esc(c)}</span><b>${((r.categorySales||{})[c]||0).toLocaleString()}</b></div>`).join('')}</div></div>
     <div class="panel table-wrap"><h3>Stock Movement</h3>
       <div class="toolbar" style="flex-wrap:wrap"><input id="mvq" type="search" placeholder="Search model / party / reference…" oninput="filterMovements()" style="flex:1;min-width:220px"><select id="mvt" onchange="filterMovements()"><option value="">IN &amp; OUT</option><option value="IN">IN only</option><option value="OUT">OUT only</option></select><button class="btn ghost small" onclick="clearFilters(['mvq','mvt'],filterMovements)">Clear</button><span id="mvInfo" class="muted small"></span></div>
       <table>
         <thead><tr><th>Date</th><th>Type</th><th>Model</th><th>IN</th><th>OUT</th><th>Party</th><th>Reference</th><th>By</th></tr></thead>
         <tbody id="mvRows"></tbody>
       </table>
     </div>`;
  filterMovements();
  if (rmv !== '') { PS.mode = 'month'; PS.month = Number(rmv); }
  renderProductSales(true);
  if (isAdmin() && typeof loadUserActivity === 'function') loadUserActivity(year, rmv);
}
function filterMovements(){
  const h = $('mvRows'); if (!h) return;
  const rmv = ($('rm') || {}).value || '', q = norm(($('mvq') || {}).value || ''), t = ($('mvt') || {}).value || '';
  const rows = (window.RPT_MV || []).filter(x => {
    if (rmv !== '') { const d = new Date(x.Date); if (isNaN(d) || d.getMonth() !== Number(rmv)) return false; }
    if (t && String(x.Type || '').toUpperCase() !== t) return false;
    return !q || [x.Type, x['Model / Part No.'], x.Party, x.Reference, x['Created By']].some(v => norm(v).includes(q));
  });
  h.innerHTML = rows.slice(0, 200).map(x => `<tr><td>${fmtDate(x.Date)}</td><td>${esc(x.Type)}</td><td>${esc(x['Model / Part No.'])}</td><td>${x['Qty IN']}</td><td>${x['Qty OUT']}</td><td>${esc(x.Party)}</td><td>${esc(x.Reference)}</td><td>${esc(x['Created By'])}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No movements.</td></tr>';
  const info = $('mvInfo'); if (info) info.textContent = 'Showing ' + Math.min(rows.length, 200) + ' of ' + rows.length + ' movement(s)' + (rows.length > 200 ? ' (latest 200)' : '');
}


/* ---------- PRODUCT-WISE SALES (Reports page) ---------- */
let PS_DOCS = null, PS_LAST = null;
const PS_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PS = {mode:'month', month:new Date().getMonth(), group:'cat', metric:'amt', cat:'', q:''};
function psSet(k, v){ PS[k] = (k === 'month') ? Number(v) : v; renderProductSales(false); }
function psLines(){
  const out = [];
  (PS_DOCS || []).forEach(d => {
    if (/cancel|void/i.test(String(d.status || ''))) return;
    const dt = new Date(d.date); if (isNaN(dt)) return;
    (d.items || []).forEach(i => {
      const qty = +i.qty || 0, rate = +i.rate || 0; if (!qty) return;
      const p = findProd(i.model) || {};
      out.push({y:dt.getFullYear(), m:dt.getMonth(), inv:d.no, model:String(i.model || '').trim(), desc:p.Description || i.desc || '',
        cat:p.Category || 'Others', brand:p.Brand || '-', qty:qty, amt:qty * rate});
    });
  });
  return out;
}
async function renderProductSales(force){
  const host = $('psales'); if (!host) return;
  if (!$('psout')) {
    const opt = (v, t, cur) => '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + t + '</option>';
    host.innerHTML = '<div class="panel"><h3>Product-wise Sales</h3>'
      + '<div class="toolbar" style="flex-wrap:wrap;gap:8px">'
      + '<select id="psmode" onchange="psSet(\'mode\',this.value)">' + opt('month','Monthly',PS.mode) + opt('year','Yearly (month by month)',PS.mode) + '</select>'
      + '<select id="psmonth" onchange="psSet(\'month\',this.value)">' + PS_MONTHS.map((m,i) => opt(i, m, PS.month)).join('') + '</select>'
      + '<select id="psgroup" onchange="psSet(\'group\',this.value)">' + opt('cat','By Category',PS.group) + opt('brand','By Brand',PS.group) + opt('model','By Product / Model',PS.group) + '</select>'
      + '<select id="pscat" onchange="psSet(\'cat\',this.value)">' + opt('','All Categories',PS.cat) + (CATS.indexOf('Others') >= 0 ? CATS : CATS.concat(['Others'])).map(c => opt(c, c, PS.cat)).join('') + '</select>'
      + '<input id="psq" placeholder="Search model / description" value="' + esc(PS.q) + '" oninput="psSet(\'q\',this.value)">'
      + '<select id="psmetric" onchange="psSet(\'metric\',this.value)">' + opt('amt','Sales Amount',PS.metric) + opt('qty','Quantity',PS.metric) + '</select>'
      + '<button class="btn" onclick="psCsv()">Download CSV</button></div>'
      + '<div id="psout"><div class="muted">Loading…</div></div></div>';
  }
  const out = $('psout');
  try {
    if (force || !PS_DOCS) { out.innerHTML = '<div class="muted">Loading…</div>'; const r = await api('getReports', {mode:'docs', type:'INVOICE'}); if (!r.ok) throw new Error(r.error || 'Could not load invoices.'); PS_DOCS = r.documents || []; }
  } catch (e) { out.innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; return; }
  if ($('psmonth')) $('psmonth').style.display = PS.mode === 'month' ? '' : 'none';
  if ($('psmetric')) $('psmetric').style.display = PS.mode === 'year' ? '' : 'none';
  const year = Number(($('ry') || {}).value) || new Date().getFullYear();
  const q = String(PS.q || '').trim().toLowerCase();
  const lines = psLines().filter(l => l.y === year
    && (PS.mode === 'year' || l.m === PS.month)
    && (!PS.cat || l.cat === PS.cat)
    && (!q || (l.model + ' ' + l.desc).toLowerCase().indexOf(q) >= 0));
  const map = {};
  lines.forEach(l => {
    const key = PS.group === 'cat' ? l.cat : PS.group === 'brand' ? l.brand : (l.model || '(no model)');
    const g = map[key] || (map[key] = {name:key, sub:PS.group === 'model' ? (l.desc ? l.desc + ' | ' : '') + l.cat : '', qty:0, amt:0, inv:{}, mq:new Array(12).fill(0), ma:new Array(12).fill(0)});
    g.qty += l.qty; g.amt += l.amt; g.inv[l.inv] = 1; g.mq[l.m] += l.qty; g.ma[l.m] += l.amt;
  });
  const groups = Object.values(map).sort((a,b) => b.amt - a.amt);
  const totAmt = groups.reduce((a,g) => a + g.amt, 0), totQty = groups.reduce((a,g) => a + g.qty, 0);
  const invCount = Object.keys(lines.reduce((a,l) => (a[l.inv] = 1, a), {})).length;
  const label = PS.mode === 'month' ? PS_MONTHS[PS.month] + ' ' + year : 'Year ' + year;
  const cards = '<div class="cards"><div class="card"><span>Sales (excl. GST) - ' + label + '</span><strong>' + money(totAmt) + '</strong></div>'
    + '<div class="card"><span>Quantity Sold</span><strong>' + totQty.toLocaleString() + '</strong></div>'
    + '<div class="card"><span>Invoices</span><strong>' + invCount + '</strong></div>'
    + '<div class="card"><span>Top ' + (PS.group === 'cat' ? 'Category' : PS.group === 'brand' ? 'Brand' : 'Product') + '</span><strong style="font-size:15px">' + (groups[0] ? esc(groups[0].name) : '-') + '</strong></div></div>';
  if (!groups.length) { PS_LAST = {head:[], rows:[], name:''}; out.innerHTML = cards + '<div class="empty">No sales found for this selection.</div>'; return; }
  let table, head, rows;
  const nameCol = PS.group === 'cat' ? 'Category' : PS.group === 'brand' ? 'Brand' : 'Product / Model';
  const nameCell = g => '<b>' + esc(g.name) + '</b>' + (g.sub ? '<div class="muted" style="font-size:11px">' + esc(g.sub) + '</div>' : '');
  if (PS.mode === 'month') {
    head = [nameCol, 'Qty Sold', 'Sales (excl. GST)', 'Share %', 'Invoices'];
    rows = groups.map(g => [g.name, g.qty, Math.round(g.amt * 100) / 100, totAmt ? Math.round(g.amt / totAmt * 1000) / 10 : 0, Object.keys(g.inv).length]);
    table = '<div class="table-wrap"><table><thead><tr><th>#</th><th>' + nameCol + '</th><th>Qty Sold</th><th>Sales (excl. GST)</th><th style="min-width:160px">Share</th><th>Invoices</th></tr></thead><tbody>'
      + groups.map((g,i) => { const pc = totAmt ? g.amt / totAmt * 100 : 0; return '<tr><td>' + (i+1) + '</td><td>' + nameCell(g) + '</td><td>' + g.qty.toLocaleString() + '</td><td><b>' + money(g.amt) + '</b></td><td><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;background:#eef1f5;border-radius:3px;height:8px"><div style="width:' + pc.toFixed(1) + '%;background:#1f3b63;height:8px;border-radius:3px"></div></div><span style="min-width:42px;text-align:right">' + pc.toFixed(1) + '%</span></div></td><td>' + Object.keys(g.inv).length + '</td></tr>'; }).join('')
      + '<tr><td></td><td><b>TOTAL</b></td><td><b>' + totQty.toLocaleString() + '</b></td><td><b>' + money(totAmt) + '</b></td><td></td><td>' + invCount + '</td></tr></tbody></table></div>';
  } else {
    const useQty = PS.metric === 'qty', f = v => v ? (useQty ? v.toLocaleString() : money(v)) : '-';
    const arr = g => useQty ? g.mq : g.ma;
    head = [nameCol].concat(PS_MONTHS, ['Total']);
    rows = groups.map(g => [g.name].concat(arr(g).map(v => Math.round(v * 100) / 100), [useQty ? g.qty : Math.round(g.amt * 100) / 100]));
    const colTot = new Array(12).fill(0); groups.forEach(g => arr(g).forEach((v,i) => colTot[i] += v));
    table = '<div class="table-wrap"><table><thead><tr><th>' + nameCol + '</th>' + PS_MONTHS.map(m => '<th>' + m + '</th>').join('') + '<th>Total</th></tr></thead><tbody>'
      + groups.map(g => '<tr><td>' + nameCell(g) + '</td>' + arr(g).map(v => '<td>' + f(v) + '</td>').join('') + '<td><b>' + (useQty ? g.qty.toLocaleString() : money(g.amt)) + '</b></td></tr>').join('')
      + '<tr><td><b>TOTAL</b></td>' + colTot.map(v => '<td><b>' + f(v) + '</b></td>').join('') + '<td><b>' + (useQty ? totQty.toLocaleString() : money(totAmt)) + '</b></td></tr></tbody></table></div>';
  }
  PS_LAST = {head:head, rows:rows, name:'product-sales-' + year + (PS.mode === 'month' ? '-' + PS_MONTHS[PS.month] : '')};
  out.innerHTML = cards + table;
}
function psCsv(){
  if (!PS_LAST || !PS_LAST.rows.length) return toast('Nothing to download.', true);
  const cell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = [PS_LAST.head].concat(PS_LAST.rows).map(r => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'}));
  a.download = PS_LAST.name + '.csv'; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- SETTINGS ---------- */
function renderSettings(){}
async function refreshSource(){
  if (!confirm('Refreshing the source snapshot rebuilds the Products list from the source sheet.\n\nWarning: products that were added only in this app (and are not in the source sheet) may be removed from the list.\n\nHave you taken a backup? Continue?')) return;
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
       <div class="muted small">Note: the ADMIN role always has full access — modules are not required.</div>
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

let ENQ_CACHE=[];
async function renderEnquiries(){const r=await api('getEnquiries');if(!r.ok)return toast(r.error,true);ENQ_CACHE=r.documents||[];filterEnquiries();}
/* enquiryForm() and saveEnquiry() now live in the ENQUIRY BOX section at the end of this file */
/* (saveEnquiry moved) */
function filterEnquiries(){const h=$('enqRows');if(!h)return;const q=norm($('enqSearch')?.value||'');const rng=periodRange('enqPer'),est=($('enqStatus')||{}).value||'';const rows=ENQ_CACHE.filter(d=>(!q||[d.id,d.customerName,d.contactPerson,d.phone,d.requirement,d.status,d.quotationNo,d.email,d.subject].some(v=>norm(v).includes(q)))&&inPeriod(d.date,rng)&&(!est||d.status===est));const eInfo=$('enqInfo');if(eInfo)eInfo.textContent='Showing '+rows.length+' of '+ENQ_CACHE.length+' enquiries';h.innerHTML=rows.map(d=>'<tr><td><b>'+esc(d.id)+'</b></td><td>'+fmtDate(d.date)+'</td><td>'+enqCustHtml(d)+enqSrcHtml(d)+'</td><td>'+esc(d.contactPerson)+'</td><td>'+esc(d.phone)+'</td><td>'+enqReqHtml(d)+'</td><td>'+statusBadge(d.status)+'</td><td>'+(d.quotationNo?'<a class="model-link" onclick="viewEnquiryQuotation(\''+encA(d.quotationNo)+'\')">'+esc(d.quotationNo)+'</a>':'—')+'</td><td>'+(d.status==='New'?'<button class="btn small primary" onclick="makeQuotationFromEnquiry(\''+encA(d.id)+'\')">Make Quotation</button>':d.status==='Quoted'?'<button class="btn small" onclick="viewEnquiryQuotation(\''+encA(d.quotationNo)+'\')">View Quotation</button>':d.status==='Lost'?'<span class="muted">'+esc(d.lossReason||'')+'</span>':'—')+enqEditBtn(d)+enqReplyHtml(d)+'</td></tr>').join('')||'<tr><td colspan="9">No enquiries found.</td></tr>';}

/* ---------- Email enquiries: tag, long text, reply ---------- */
function enqSrcHtml(d){
  if (d.source !== 'Email') { const n = (d.attachments || []).length, src = d.source && d.source !== 'Manual' ? d.source : ''; return (src || n) ? '<div class="enq-src">' + (src ? '<span class="imp-tag">' + esc(src) + '</span>' : '') + (n ? ' <span class="muted small" title="Files attached">📎 ' + n + '</span>' : '') + '</div>' : ''; }
  return '<div class="enq-src"><span class="imp-tag new">✉ Email</span>' + (d.email ? ' <span class="muted small">' + esc(d.email) + '</span>' : '')
    + (d.attachments && d.attachments.length ? ' <span class="muted small" title="Original files attached">📎 ' + d.attachments.length + '</span>' : '')
    + (d.needsReview ? ' <span class="imp-tag enq-check" title="' + esc(d.aiNote || 'Please check this enquiry against the original mail') + '">⚠ Check</span>' : '') + '</div>';
}
function enqReqHtml(d){
  const t = String(d.requirement || ''), sub = d.source === 'Email' && d.subject ? '<div><b>' + esc(d.subject) + '</b></div>' : '';
  if (d.items && d.items.length) {
    const first = String(d.items[0].desc || '');
    return sub + '<div><span class="imp-tag old">' + d.items.length + ' item' + (d.items.length === 1 ? '' : 's') + '</span>' + (d.customerRef ? ' <span class="muted small">Ref ' + esc(d.customerRef) + '</span>' : '') + '</div>'
      + '<div class="muted small" style="margin-top:3px">' + esc(first.length > 70 ? first.slice(0, 70) + '…' : first) + (d.items.length > 1 ? ' +' + (d.items.length - 1) + ' more' : '') + '</div>'
      + '<a class="model-link" onclick="enqViewFull(\'' + encA(d.id) + '\')">view items</a>';
  }
  if (t.length <= 160) return sub + esc(t);
  return sub + '<span class="enq-text">' + esc(t.slice(0, 160)) + '…</span> <a class="model-link" onclick="enqViewFull(\'' + encA(d.id) + '\')">read full mail</a>';
}
function enqReplyHtml(d){
  const openBtn = d.source === 'Email' && d.mailId ? ' <button class="btn small" style="margin-top:4px" title="Open the complete e-mail" onclick="openMailDrawer(\'' + encA(d.id) + '\')">📧 Open email</button>' : '';
  if (!d.email) return openBtn;
  const subj = 'Re: ' + (d.subject || 'Your enquiry') + ' [' + d.id + ']';
  return openBtn + ' <a class="btn small" style="text-decoration:none;margin-top:4px" href="mailto:' + esc(d.email) + '?subject=' + encodeURIComponent(subj) + '">✉ Reply</a>';
}
function enqViewFull(en){
  const d = ENQ_CACHE.find(x => x.id === decodeURIComponent(en)); if (!d) return;
  modal('Enquiry ' + d.id + (d.subject ? ' — ' + d.subject : ''),
    '<div class="muted" style="margin-bottom:10px">' + esc(d.customerName) + (d.email ? ' • ' + esc(d.email) : '') + (d.phone ? ' • ' + esc(d.phone) : '') + ' • ' + fmtDate(d.date) + (d.parsedBy ? ' • read by ' + esc(d.parsedBy === 'AI' ? 'AI' : 'basic rules') : '') + '</div>'
    + (d.needsReview || d.aiNote ? '<div class="imp-warn" style="margin:0 0 12px">' + (d.needsReview ? '<b>⚠ Please check against the original mail / files.</b> ' : '') + esc(d.aiNote || '') + '</div>' : '')
    + (d.attachments && d.attachments.length ? '<div style="margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap">' + d.attachments.map(a => '<a class="btn small" style="text-decoration:none" target="_blank" rel="noopener" href="' + esc(a.url) + '">📎 ' + esc(a.name) + '</a>').join('') + '</div>' : '')
    + (d.items && d.items.length ? '<h4 style="margin:6px 0 8px">Requested items' + (d.customerRef ? ' — Ref ' + esc(d.customerRef) : '') + '</h4><div class="table-wrap"><table><thead><tr><th>#</th><th>Description</th><th class="right">Qty</th><th>Unit</th><th>Remarks</th></tr></thead><tbody>'
        + d.items.map((it, i) => '<tr><td>' + esc(it.sn || i + 1) + '</td><td>' + esc(it.desc) + '</td><td class="right"><b>' + esc(it.qty) + '</b></td><td>' + esc(it.unit) + '</td><td class="muted small">' + esc(it.note) + '</td></tr>').join('') + '</tbody></table></div>' : '')
    + '<details style="margin-top:12px"' + (d.items && d.items.length ? '' : ' open') + '><summary style="cursor:pointer;font-weight:600">Original mail text</summary><div style="white-space:pre-wrap;max-height:40vh;overflow:auto;margin-top:8px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#fafbff">' + esc(d.requirement) + '</div></details>'
    + '<div class="actions"><button class="btn" onclick="closeModal()">Close</button><button class="btn" onclick="enquiryForm(\'' + encA(d.id) + '\')">✎ Edit</button>' + (d.status === 'New' ? '<button class="btn primary" onclick="closeModal();makeQuotationFromEnquiry(\'' + encA(d.id) + '\')">Make Quotation</button>' : '') + '</div>');
}
window.enqViewFull = enqViewFull;

/* =====================================================================
   COMPLETE E-MAIL INSIDE THE ERP  +  pick items from it for the quotation
   ===================================================================== */
let MAIL_CUR = null;      /* {enquiry, mail} currently shown in the side window */

function mailSanitize_(html){
  return String(html || '')
    .replace(/<(script|iframe|object|embed|link|base|meta|form|frame|frameset)\b[\s\S]*?(<\/\1>|$)/gi, '')
    .replace(/<(script|iframe|object|embed|link|base|meta|form|input|button)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(src|srcset|background|poster)\s*=\s*(["'])\s*(?:https?:)?\/\/[\s\S]*?\2/gi, ' data-blocked=""')   /* no remote images / trackers */
    .replace(/url\(\s*["']?\s*(?:https?:)?\/\/[^)]*\)/gi, 'none')
    .replace(/javascript:/gi, 'blocked:');
}
function mailFrameDoc_(m, plain){
  const css = 'body{font:14px/1.5 Arial,Helvetica,sans-serif;color:#111;margin:14px;word-break:break-word}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #cfd6e4;padding:5px 8px;vertical-align:top}img{max-width:100%;height:auto}a{color:#344fe0}tr:hover td{background:#f3f6ff}pre{white-space:pre-wrap;font:inherit}';
  const body = (!plain && m.html) ? mailSanitize_(m.html) : '<pre>' + esc(m.text || '(empty mail)') + '</pre>';
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:"><style>' + css + '</style></head><body>' + body + '</body></html>';
}

async function openMailDrawer(encId){
  const en = (typeof ENQ_CACHE !== 'undefined' ? ENQ_CACHE : []).find(x => x.id === decodeURIComponent(encId));
  if (!en) return toast('Enquiry not found. Press Refresh and try again.', true);
  const r = await api('getEnquiryMail', {mailId:en.mailId});
  if (!r || !r.ok) return toast((r && r.error) || 'Could not load the mail.', true);
  if (!r.found) return toast('The complete mail was not stored for this enquiry (it came before this feature). Use “Original mail text” instead.', true);
  MAIL_CUR = {enquiry:en, mail:r.mail, plain:false};
  closeMailDrawer(true);
  const d = document.createElement('div'); d.id = 'mailDrawer'; d.className = 'mail-drawer';
  const atts = en.attachments || [];
  d.innerHTML = '<div class="mail-head"><div style="min-width:0"><b class="mail-subj">' + esc(r.mail.subject || '(no subject)') + '</b>'
      + '<div class="muted small">' + esc((r.mail.fromName ? r.mail.fromName + ' ' : '') + '<' + r.mail.fromEmail + '>') + ' • ' + esc(fmtDate(r.mail.date)) + ' • ' + esc(en.id) + '</div></div>'
      + '<button class="btn small" onclick="closeMailDrawer()" title="Close">✕</button></div>'
    + '<div class="mail-tools">'
    + '<div class="mail-hint">Select text in the mail, then use the buttons:</div>'
    + '<div class="mail-btns">'
    + '<button class="btn small primary" onmousedown="event.preventDefault()" onclick="mailNewItem()">➕ New item from selection</button>'
    + '<span class="muted small">or put selection in last item →</span>'
    + '<button class="btn small" onmousedown="event.preventDefault()" onclick="mailSetField(\'model\')">Part No.</button>'
    + '<button class="btn small" onmousedown="event.preventDefault()" onclick="mailSetField(\'desc\')">Description</button>'
    + '<button class="btn small" onmousedown="event.preventDefault()" onclick="mailSetField(\'qty\')">Qty</button>'
    + '<button class="btn small" onmousedown="event.preventDefault()" onclick="mailSetField(\'itemRemarks\')">Remarks</button></div>'
    + '<div class="mail-btns"><label class="chk"><input type="checkbox" id="mailRowMode"> Click a table row to add it as an item</label>'
    + '<button class="btn small" onclick="mailTogglePlain()">Plain text / original</button>'
    + (atts.length ? atts.map(a => '<a class="btn small" style="text-decoration:none" target="_blank" rel="noopener" href="' + esc(a.url) + '">📎 ' + esc(a.name) + '</a>').join('') : '')
    + '<button class="btn small primary" onclick="mailOpenQuotation()">📝 Make Quotation</button></div></div>'
    + '<iframe id="mailFrame" sandbox="allow-same-origin" title="E-mail"></iframe>';
  document.body.appendChild(d); document.body.classList.add('mail-open');
  mailRenderFrame_();
}
function mailRenderFrame_(){
  const f = $('mailFrame'); if (!f || !MAIL_CUR) return;
  f.onload = () => {
    try {
      const doc = f.contentDocument;
      doc.addEventListener('click', ev => {
        const cb = $('mailRowMode'); if (!cb || !cb.checked) return;
        const tr = ev.target && ev.target.closest ? ev.target.closest('tr') : null; if (!tr) return;
        const cells = Array.from(tr.children).map(c => String(c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim());
        const it = qtItemFromCells(cells);
        if (!it) return toast('No quantity found in that row — select the text instead and use “New item from selection”.', true);
        mailPushItem(it); tr.style.outline = '2px solid #1f9d6b'; tr.style.background = '#e4f8ee';
      });
    } catch (e) {}
  };
  f.srcdoc = mailFrameDoc_(MAIL_CUR.mail, MAIL_CUR.plain);
}
function mailTogglePlain(){ if (!MAIL_CUR) return; MAIL_CUR.plain = !MAIL_CUR.plain; mailRenderFrame_(); }
function closeMailDrawer(keepState){
  const d = $('mailDrawer'); if (d) d.remove();
  document.body.classList.remove('mail-open');
  if (!keepState) MAIL_CUR = null;
}
function mailSelection_(){
  const f = $('mailFrame'); if (!f) return '';
  try { const sel = f.contentDocument.getSelection(); return String(sel ? sel.toString() : '').replace(/\r/g, '').trim(); } catch (e) { return ''; }
}

/* A table row (cells) -> one quotation item: last number = Qty, the short word next to it = Unit, the longest cell = Description */
function qtItemFromCells(cells){
  const num = v => { const t = String(v).replace(/,/g, '').trim(); return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : 0; };
  const c = (cells || []).map(x => String(x).replace(/\s+/g, ' ').trim()).filter(x => x !== '');
  let qi = -1;
  for (let i = c.length - 1; i >= 0; i--) if (num(c[i]) > 0) { qi = i; break; }
  if (qi < 1) return null;
  let ui = -1;
  if (/^[A-Za-z.]{1,8}$/.test(c[qi - 1])) ui = qi - 1; else if (qi < c.length - 1 && /^[A-Za-z.]{1,8}$/.test(c[qi + 1])) ui = qi + 1;
  const rest = c.filter((x, i) => i !== qi && i !== ui);
  if (rest.length > 1 && /^\d{1,3}$/.test(rest[0])) rest.shift();
  if (!rest.length) return null;
  let li = 0; rest.forEach((x, i) => { if (x.length > rest[li].length) li = i; });
  const unit = ui >= 0 ? c[ui] : '';
  return {desc:rest[li], qty:num(c[qi]), unit:unit ? unit.charAt(0).toUpperCase() + unit.slice(1).toLowerCase() : 'Pcs', note:rest.filter((x, i) => i !== li).join(' | ')};
}

/* make sure the quotation form is open (without re-copying the enquiry's own item list), then run fn */
function mailWithQuotation_(fn){
  if ($('qtcustomer') && typeof QTL !== 'undefined') return fn();
  if (!MAIL_CUR) return;
  startQuotationFromEnquiry(MAIL_CUR.enquiry, {noItems:true});
  setTimeout(fn, 60);
}
function mailPushItem(it){
  mailWithQuotation_(() => {
    const line = {model:'', desc:it.desc || '', itemRemarks:it.note || '', make:'', qty:it.qty || '', unit:it.unit || 'Pcs', rate:'', deliveryStatus:'Pending'};
    const first = QTL[0];
    if (QTL.length === 1 && first && !first.model && !first.desc && !first.qty) QTL[0] = line; else QTL.push(line);
    renderQuotationLines(); updateQuotationTotal();
    toast('Item added: ' + String(line.desc).slice(0, 50));
  });
}
function mailNewItem(){
  const text = mailSelection_();
  if (!text) return toast('First select (highlight) the text in the mail, then press this button.', true);
  const rows = text.split('\n').map(l => l.split(/\t+/).map(x => x.trim()).filter(Boolean)).filter(r => r.length);
  const parsed = rows.filter(r => r.length >= 3).map(qtItemFromCells).filter(Boolean);
  if (parsed.length) parsed.forEach(mailPushItem);
  else mailPushItem({desc:text.replace(/\s+/g, ' ').slice(0, 600), qty:'', unit:'Pcs', note:''});
}
function mailSetField(field){
  const text = mailSelection_();
  if (!text) return toast('First select (highlight) the text in the mail, then press this button.', true);
  mailWithQuotation_(() => {
    if (!QTL.length) QTL.push({model:'', desc:'', itemRemarks:'', make:'', qty:'', unit:'Pcs', rate:'', deliveryStatus:'Pending'});
    const line = QTL[QTL.length - 1], one = text.replace(/\s+/g, ' ');
    if (field === 'qty') { const m = one.replace(/,/g, '').match(/\d+(?:\.\d+)?/); if (!m) return toast('No number found in the selection.', true); line.qty = Number(m[0]); }
    else if (field === 'model') { const p = findProd(one); line.model = p ? p['Model / Part No.'] : one; if (p) { if (!line.desc) line.desc = p.Description || ''; if (!line.rate && Number(p['Sale Price'])) { line.rate = quotationAdjustedRate(p['Sale Price']); line.rateAuto = true; } if (p.Unit) line.unit = p.Unit; } line.history = null; }
    else line[field] = line[field] ? line[field] + ' ' + one : one;
    renderQuotationLines(); updateQuotationTotal();
    if (field === 'model') loadQuotationItemHistory(QTL.length - 1);
    toast('Added to the last item (' + (field === 'model' ? 'Part No.' : field === 'itemRemarks' ? 'Remarks' : field === 'desc' ? 'Description' : 'Qty') + ').');
  });
}
function mailOpenQuotation(){ if (MAIL_CUR) startQuotationFromEnquiry(MAIL_CUR.enquiry, {noItems:true}); }
Object.assign(window, {openMailDrawer, closeMailDrawer, mailNewItem, mailSetField, mailTogglePlain, mailOpenQuotation, mailPushItem});

function makeQuotationFromEnquiry(en){const d=ENQ_CACHE.find(x=>x.id===decodeURIComponent(en));if(d)startQuotationFromEnquiry(d);}
function viewEnquiryQuotation(q){const no=decodeURIComponent(q);showPage('qthistory');setTimeout(()=>loadQTHistory().then(()=>{const d=QT_CACHE.find(x=>x.no===no);if(d)printQuotation(d);}),0);}
function quotationStatusForm(no,status,reason){const n=decodeURIComponent(no),s=decodeURIComponent(status),r=decodeURIComponent(reason||'');modal('Update Quotation Status','<div class="form-grid"><label>Status<select id="qstatus"><option '+(s==='Pending'?'selected':'')+'>Pending</option><option '+(s==='Won'?'selected':'')+'>Won</option><option '+(s==='Lost'?'selected':'')+'>Lost</option></select></label><label class="wide">Loss Reason<input id="qlossReason" value="'+esc(r)+'" placeholder="Required when status is Lost"></label></div><div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="saveQuotationStatus(\''+encA(n)+'\')">Save Status</button></div>');}
async function saveQuotationStatus(no){const status=$('qstatus').value,lossReason=$('qlossReason').value.trim();if(status==='Lost'&&!lossReason)return toast('Loss reason is required.',true);const r=await api('updateQuotationStatus',{no:decodeURIComponent(no),status:status,lossReason:lossReason});if(!r.ok)return toast(r.error,true);closeModal();toast('Quotation status updated.');loadQTHistory();}
const QPF = {per:'', from:'', to:''};
let QP_DATA = null;
async function loadQuotationPipeline(){
  const q = await api('quotationHistory'), e = await api('getEnquiries'), host = $('quotationPipelineSection');
  if (!host || !q.ok || !e.ok) { if (host) host.innerHTML = ''; return; }
  QP_DATA = {docs:q.documents || [], enqs:e.documents || []};
  drawPipeline();
}
function pipelineFilterChanged(){ QPF.per = ($('qpPer') || {}).value || ''; QPF.from = ($('qpPerFrom') || {}).value || ''; QPF.to = ($('qpPerTo') || {}).value || ''; drawPipeline(); }
function drawPipeline(){
  const host = $('quotationPipelineSection'); if (!host || !QP_DATA) return;
  const rng = periodRangeOf(QPF.per, QPF.from, QPF.to);
  const docs = QP_DATA.docs.filter(x => inPeriod(x.date, rng)), enqs = QP_DATA.enqs.filter(x => inPeriod(x.date, rng));
  const won = docs.filter(x => x.status === 'Won').length, lost = docs.filter(x => x.status === 'Lost').length, pending = docs.filter(x => (x.status || 'Pending') === 'Pending').length;
  const data = [{label:'Won', value:won, color:CHART_PALETTE[1]}, {label:'Pending', value:pending, color:CHART_PALETTE[2]}, {label:'Lost', value:lost, color:CHART_PALETTE[6]}].filter(x => x.value > 0);
  const lr = docs.filter(x => x.status === 'Lost').slice(0, 8);
  host.innerHTML = '<div class="panel"><div class="panel-head"><h3>Enquiry & Quotation Pipeline</h3><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' + periodSelectHtml('qpPer', 'pipelineFilterChanged()') + '</span></div>'
    + '<div class="cards" style="margin:0 0 16px"><div class="card"><span>Total Enquiries</span><strong>' + enqs.length + '</strong></div><div class="card"><span>Total Quotations</span><strong>' + docs.length + '</strong></div><div class="card"><span>Won</span><strong>' + won + '</strong></div><div class="card"><span>Pending</span><strong>' + pending + '</strong></div><div class="card"><span>Lost</span><strong>' + lost + '</strong></div></div>'
    + '<div style="display:flex;gap:32px;align-items:center;flex-wrap:wrap"><div>' + donutChart(data, 180) + '</div><div style="flex:1;min-width:260px">'
    + (lr.length ? '<h4>Lost Quotations</h4><div class="table-wrap"><table><thead><tr><th>Quotation</th><th>Customer</th><th>Loss Reason</th></tr></thead><tbody>' + lr.map(x => '<tr><td>' + esc(x.no) + '</td><td>' + esc(x.customer) + '</td><td>' + esc(x.lossReason || '') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="muted">No lost quotations.</div>') + '</div></div></div>';
  if ($('qpPer')) { $('qpPer').value = QPF.per; if ($('qpPerFrom')) $('qpPerFrom').value = QPF.from; if ($('qpPerTo')) $('qpPerTo').value = QPF.to; periodChanged('qpPer'); }
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
function renderQuotation(){ $('qtno').value=''; $('qtno').readOnly=false; if($('qtsavebtn'))$('qtsavebtn').textContent=QT_EDIT_MODE?'Update Quotation':'Save Quotation'; $('qtdate').value=todayStr(); if($('qtdiscount'))$('qtdiscount').value=''; if($('qtenquiryDate'))$('qtenquiryDate').value=todayStr(); if($('qtvalidity')&&!$('qtvalidity').value)$('qtvalidity').value='7 Days'; if($('qtpaymentTerms')&&!$('qtpaymentTerms').value)$('qtpaymentTerms').value='20 Days'; QTL=[{model:'',desc:'',make:'',qty:'',unit:'Pcs',rate:'',deliveryStatus:'Pending'}]; renderQuotationLines(); updateQuotationTotal(); }
/* Customer's original request, shown at the top of the quotation form while it is being made */
function renderQtEnqRef(en){
  const host = $('qtEnqRef'); if (!host) return;
  window.QT_ENQ = en || null;
  if (!en) { host.innerHTML = ''; return; }
  const items = en.items || [], atts = en.attachments || [];
  host.innerHTML = '<div class="qt-enq">'
    + '<div class="qt-enq-head"><b>📨 Customer\'s enquiry ' + esc(en.id) + '</b> <span class="muted small">' + esc(fmtDate(en.date)) + (en.email ? ' • ' + esc(en.email) : '') + (en.phone ? ' • ' + esc(en.phone) : '') + '</span>'
    + (en.source === 'Email' && en.mailId ? ' <button class="btn small primary" onclick="openMailDrawer(\'' + encA(en.id) + '\')">📧 Open complete email</button>' : '') + '</div>'
    + (en.subject ? '<div style="margin-top:4px"><b>' + esc(en.subject) + '</b></div>' : '')
    + (en.customerRef ? '<div class="muted small">Customer ref: <b>' + esc(en.customerRef) + '</b></div>' : '')
    + (en.needsReview || en.aiNote ? '<div class="imp-warn" style="margin:8px 0">' + (en.needsReview ? '<b>⚠ Please check against the original mail / files.</b> ' : '') + esc(en.aiNote || '') + '</div>' : '')
    + (atts.length ? '<div style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' + atts.map(a => enqAttHtml(a)).join('') + '</div>' : '')
    + (items.length ? '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>#</th><th>Customer asked for</th><th class="right">Qty</th><th>Unit</th><th>Remarks</th></tr></thead><tbody>'
        + items.map((it, i) => '<tr><td>' + esc(it.sn || i + 1) + '</td><td>' + esc(it.desc) + '</td><td class="right"><b>' + esc(it.qty) + '</b></td><td>' + esc(it.unit) + '</td><td class="muted small">' + esc(it.note) + '</td></tr>').join('') + '</tbody></table></div>' : '')
    + '<details style="margin-top:8px"' + (items.length ? '' : ' open') + '><summary style="cursor:pointer;font-weight:600">' + (items.length ? 'Original mail text' : 'What the customer wrote') + '</summary><div class="qt-enq-text">' + esc(en.requirement || '(no text)') + '</div></details>'
    + (!items.length && en.requirement ? '<div style="margin-top:8px"><button class="btn small" onclick="qtEnqToLine()">Copy this text into the first item</button></div>' : '')
    + '</div>';
}
function qtEnqToLine(){
  const en = window.QT_ENQ; if (!en) return;
  if (!QTL.length) QTL.push({model:'', desc:'', itemRemarks:'', make:'', qty:'', unit:'Pcs', rate:'', deliveryStatus:'Pending'});
  QTL[0].desc = String(en.requirement || '').slice(0, 1500); renderQuotationLines(); toast('Text copied. Split it into proper items, pick Part No. and enter rates.');
}
window.qtEnqToLine = qtEnqToLine;

function startQuotationFromEnquiry(en, opts){ opts = opts || {}; if (showPage('quotations', document.querySelector(".navbtn[onclick*=\"'quotations'\"]") || undefined) === false) return;   /* user is asked about unsaved work first */
  QT_EDIT_MODE = false; REVISION_QUOTATION = null; if($('qtsavebtn'))$('qtsavebtn').textContent='Save Quotation'; if($('qtno'))$('qtno').readOnly=false; setTimeout(()=>{
    const cn = /^\(/.test(String(en.customerName || '')) ? '' : (en.customerName || '');   /* "(customer not identified)" -> leave blank */
    $('qtenquiry').value=en.id||''; $('qtcustomer').value=cn; $('qtcontact').value=en.contactPerson||''; $('qtenquiryDate').value=en.date?toInputDate(en.date):todayStr();
    if (cn) pickQuotationCustomer();
    $('qtcustomer').value=cn; $('qtcontact').value=en.contactPerson||''; $('qtenquiry').value=en.id||'';
    renderQtEnqRef(en);
    if(!opts.noItems && en.items&&en.items.length){ QTL.splice(0,QTL.length,...en.items.map(it=>({model:'',desc:it.desc||'',itemRemarks:it.note||'',make:'',qty:it.qty||'',unit:it.unit||'Pcs',rate:'',deliveryStatus:'Pending'}))); renderQuotationLines(); updateQuotationTotal(); toast(en.items.length+' item(s) copied from the enquiry. Now pick the Part No. and enter rates.'); }
    else if (!cn && !opts.noItems) toast('Customer could not be identified from the mail — please choose the customer.', true);
    if(en.customerRef&&$('qtref'))$('qtref').value=en.customerRef; },0); }
function quotationCustomerBlur(){const name=$('qtcustomer').value.trim();if(!name)return;const c=findCust(name);if(c){pickQuotationCustomer();return;}quotationNewCustomerPrompt(name);}
async function quotationNewCustomerPrompt(name){const clean=name.trim();if(!clean)return;if(!confirm('Customer '+clean+' is not in the customer list. Create this customer?'))return;const r=await api('saveCustomer',{name:clean,customerName:clean});if(!r.ok)return toast(r.error||'Could not create customer.',true);toast('New customer created.');const boot=await api('bootstrap');if(boot&&boot.ok){S.customers=boot.customers||S.customers;syncDatalists();}$('qtcustomer').value=clean;pickQuotationCustomer();}
function quotationAdjustedRate(base, customer){const c=customer||findCust($('qtcustomer')?.value);const pct=Number(c&&c['Price Adjustment (%)']!==undefined?c['Price Adjustment (%)']:0)||0;return Math.round((Number(base)||0)*(1+pct/100)*100)/100;}
function pickQuotationCustomer(){const c=findCust($('qtcustomer').value);if(!c){$('qtcustomerId').value='';return;}$('qtcustomerId').value=c['Customer ID']||'';$('qtaddress').value=c['Address']||'';$('qtstn').value=stnOf(c);$('qtnTN').value=c['NTN/Tax ID']||'';if(!$('qtcontact').value)$('qtcontact').value=c['Contact Person']||'';if(!QT_EDIT_MODE){QTL.forEach(x=>{const p=findProd(x.model);if(p&&x.rateAuto!==false){const base=Number(p['Sale Price']||0);if(base>0)x.rate=quotationAdjustedRate(base,c);}});renderQuotationLines();updateQuotationTotal();}QTL.forEach((x,i)=>{if(x.model)loadQuotationItemHistory(i);});}

function addQuotationLine(){ QTL.push({model:'',desc:'',itemRemarks:'',make:'',qty:'',unit:'Pcs',rate:'',rateAuto:true,deliveryStatus:'Pending',history:null}); renderQuotationLines(); }
function removeQuotationLine(i){ QTL.splice(i,1); if(!QTL.length)QTL.push({model:'',make:'',qty:'',unit:'Pcs',rate:'',rateAuto:true,deliveryStatus:'Pending',history:null}); renderQuotationLines(); updateQuotationTotal(); }
function quotationModelChanged(i){ const x=QTL[i],p=findProd(x.model); if(p){x.unit=p.Unit||'Pcs'; if(!x.make)x.make=p.Brand||''; const base=Number(p['Sale Price']||0); if(base>0){x.rate=quotationAdjustedRate(base);x.rateAuto=true;} } x.history=null; renderQuotationLines(); updateQuotationTotal(); loadQuotationItemHistory(i); }
async function loadQuotationItemHistory(i){const x=QTL[i];if(!x||!x.model)return;const model=String(x.model||'').trim(),customer=String($('qtcustomer')?.value||'').trim(),c=findCust(customer);if(!customer||!c){x.history=null;renderQuotationLines();return;}const r=await api('quotationItemHistory',{customerId:c['Customer ID']||'',customer:customer,model:model});if(QTL[i]!==x||String(x.model||'').trim()!==model||String($('qtcustomer')?.value||'').trim()!==customer)return;x.history=r&&r.ok?r.history:null;renderQuotationLines();}
function renderQuotationLines(){ const h=$('qtlines'); if(!h)return; h.innerHTML=QTL.map((x,i)=>{const p=findProd(x.model)||{}; if(x.make==null||x.make==='')x.make=p.Brand||''; if(x.desc==null||x.desc==='')x.desc=p.Description||''; if(x.itemRemarks==null)x.itemRemarks=''; if(!x.deliveryStatus)x.deliveryStatus='Pending'; const stock=x.model&&p['Model / Part No.']?'<div class="muted small" style="margin-top:4px">Current stock: <b>'+esc(p.currentStock===undefined?p['Current Stock']||0:p.currentStock)+'</b></div>':''; const hist=x.history?'<div class="muted small" style="margin-top:4px;color:#315b86">Previous sale: '+(x.history.po?'PO '+esc(x.history.po)+' · ':'')+'Invoice '+esc(x.history.invoiceNo||'—')+' · Rate '+money(x.history.rate)+'</div>':''; return '<tr><td><input value="'+esc(x.model)+'" list="mlist" placeholder="Part No. / custom item" onchange="QTL['+i+'].model=this.value;quotationModelChanged('+i+')">'+stock+hist+'</td><td><textarea rows="2" placeholder="Customer enquiry description / specification" onchange="QTL['+i+'].desc=this.value">'+esc(x.desc||'')+'</textarea><div style="font-size:11px;font-weight:600;color:#667085;margin:5px 0 3px">Remarks</div><textarea rows="2" placeholder="Remarks for this item (optional)" onchange="QTL['+i+'].itemRemarks=this.value">'+esc(x.itemRemarks||'')+'</textarea>'+qtPhotoCell(x,i)+'</td><td><input value="'+esc(x.make||'')+'" placeholder="Make" onchange="QTL['+i+'].make=this.value"></td><td><input type="number" min="0" step="any" value="'+esc(x.qty)+'" oninput="QTL['+i+'].qty=this.value;updateQuotationTotal()"></td><td><input value="'+esc(x.unit||'Pcs')+'" oninput="QTL['+i+'].unit=this.value"></td><td><input type="number" min="0" step="0.01" value="'+esc(x.rate)+'" oninput="QTL['+i+'].rate=this.value;QTL['+i+'].rateAuto=false;updateQuotationTotal()"></td><td>'+money((+x.qty||0)*(+x.rate||0))+'</td><td><input list="qtdl" value="'+esc(x.deliveryStatus||'')+'" placeholder="Ready Stock / 8-10 Weeks" oninput="QTL['+i+'].deliveryStatus=this.value"></td><td><button class="btn danger" type="button" onclick="removeQuotationLine('+i+')">×</button></td></tr>';}).join(''); }
function updateQuotationTotal(){ const gross=QTL.reduce((a,x)=>a+(+x.qty||0)*(+x.rate||0),0); const pct=Math.min(100,Math.max(0,Number($('qtdiscount')?.value||0))); const disc=gross*pct/100; if($('qttotal'))$('qttotal').textContent=pct>0?('SUB TOTAL: '+money(gross)+'   |   LESS '+pct+'% DISCOUNT: '+money(disc)+'   |   TOTAL: '+money(gross-disc)):('TOTAL: '+money(gross)); }
async function saveQuotation(){
  if(window.SFS_QT_SAVING)return;
  const customer=$('qtcustomer').value.trim(); if(!customer)return toast('Customer is required.',true);
  /* items without a Part No. get a '-' placeholder so the backend does not silently drop them */
  const items=QTL.filter(x=>(String(x.model||'').trim()||String(x.desc||'').trim())&&Number(x.qty)>0).map(x=>({...x,model:String(x.model||'').trim()||'-',desc:String(x.desc||'').trim()}));
  if(!items.length)return toast('Add at least one item with quantity.',true);
  const payload={no:(QT_EDIT_MODE&&REVISION_QUOTATION)?REVISION_QUOTATION.no:'',_editing:QT_EDIT_MODE,revisionOf:(!QT_EDIT_MODE&&REVISION_QUOTATION)?REVISION_QUOTATION.no:'',date:$('qtdate').value,customerId:$('qtcustomerId').value,customer:customer,address:$('qtaddress').value,ref:$('qtref')?.value||'',po:$('qtref')?.value||'',poDate:$('qtrefDate')?.value||'',validity:$('qtvalidity').value||'7 Days',paymentTerms:$('qtpaymentTerms')?.value||'20 Days',stn:$('qtstn').value,ntn:$('qtnTN').value,enquiryId:$('qtenquiry').value,contact:$('qtcontact').value,gst:$('qtgst').value,discount:$('qtdiscount')?.value||0,items:items};
  const sig=JSON.stringify({...payload,revisionOf:''});
  if(!QT_EDIT_MODE&&window.SFS_QT_LAST&&window.SFS_QT_LAST.sig===sig&&!confirm('This quotation ('+window.SFS_QT_LAST.id+') is already saved. Saving again will create a duplicate copy. Continue?'))return;
  window.SFS_QT_SAVING=true;
  try{
    const r=await api(QT_EDIT_MODE?'updateQuotation':'saveQuotation',payload);
    if(!r.ok)return toast(r.error,true);
    $('qtno').value=r.id||'';
    window.SFS_QT_LAST={sig:sig,id:r.id};
    REVISION_QUOTATION=null;
    const gross=items.reduce((a,x)=>a+(+x.qty||0)*(+x.rate||0),0),pct=Math.min(100,Math.max(0,Number(payload.discount||0))),net=gross-gross*pct/100;
    const sub=Number(r.subtotal);
    if(!isNaN(sub)&&Math.abs(sub-gross)>0.01&&Math.abs(sub-net)>0.01)toast('Saved '+(r.id||'')+', but the saved total ('+money(sub)+') differs from the form total ('+money(net)+'). Please open it in Quotation History and verify all items.',true);
    else toast(QT_EDIT_MODE?'Quotation updated successfully: '+(r.id||''):'Quotation saved successfully: '+(r.id||''));
    if(window.SFSUnsavedChanges&&window.SFSUnsavedChanges.markClean)window.SFSUnsavedChanges.markClean();
    const wasEditing=QT_EDIT_MODE;
    if(wasEditing){ QT_EDIT_MODE=false; REVISION_QUOTATION=null; if($('qtsavebtn'))$('qtsavebtn').textContent='Save Quotation'; $('qtno').readOnly=false; setTimeout(()=>showPage('qthistory'),250); }
    else if($('qtenquiry').value)setTimeout(()=>showPage('enquiries'),250);
  }finally{window.SFS_QT_SAVING=false;}
}
function printQuotationFromForm(){ const customer=$('qtcustomer').value.trim(); const items=QTL.filter(x=>(String(x.model||'').trim()||String(x.desc||'').trim())&&Number(x.qty)>0).map(x=>({...x,model:String(x.model||'').trim(),desc:String(x.desc||'').trim()})); if(!customer||!items.length)return toast('Enter customer and at least one item first.',true); printQuotation({no:$('qtno').value||'DRAFT',date:$('qtdate').value,customer:customer,address:$('qtaddress').value,ref:$('qtref')?.value||'',po:$('qtref')?.value||'',poDate:$('qtrefDate')?.value||'',validity:$('qtvalidity').value||'7 Days',paymentTerms:$('qtpaymentTerms')?.value||'20 Days',stn:$('qtstn').value,ntn:$('qtnTN').value,items:items,gst:Number($('qtgst')?.value||0),discount:Number($('qtdiscount')?.value||0),contact:$('qtcontact')?.value||'',customerId:$('qtcustomerId')?.value||'',createdBy:(typeof S!=='undefined'&&S.user&&(S.user.name||S.user.username))||''}); }
async function loadQTHistory(){ const r=await api('quotationHistory'); if(!r.ok){if($('qtrows'))$('qtrows').innerHTML='<tr><td colspan="7">'+esc(r.error)+'</td></tr>';return;} QT_CACHE=r.documents||[]; filterQTHistory(); }
function statusBadge(s){ return '<span class="badge" style="font-size:11px">'+esc(s||'Pending')+'</span>'; }
function filterQTHistory(){ const h=$('qtrows'); if(!h)return; const q=norm($('qts')?.value||''); fillSelect('qtCust',QT_CACHE.map(d=>d.customer),'All Customers'); const rng=periodRange('qtPer'),cust=($('qtCust')||{}).value||'',st=($('qtSt')||{}).value||''; const rows=QT_CACHE.filter(d=>(!q||norm(d.no).includes(q)||norm(d.customer).includes(q)||norm(d.ref||d.po).includes(q)||norm(d.enquiryId).includes(q))&&inPeriod(d.date,rng)&&(!cust||d.customer===cust)&&(!st||(d.status||'Pending')===st)); const qInfo=$('qtInfo'); if(qInfo)qInfo.textContent='Showing '+rows.length+' of '+QT_CACHE.length+' quotation(s) • Total '+money(rows.reduce((a,d)=>a+(+d.subtotal||0),0)); h.innerHTML=rows.map(d=>'<tr><td><b>'+esc(d.no)+'</b></td><td>'+fmtDate(d.date)+'</td><td>'+esc(d.customer)+'</td><td>'+esc(d.po)+'</td><td>'+money(d.subtotal)+'</td><td>'+statusBadge(d.status)+'</td><td><button class="btn" onclick="viewQuotation(\''+encA(d.no)+'\')">View / Print</button><button class="btn small" onclick="editQuotation(\''+encA(d.no)+'\')">Edit</button><button class="btn small" onclick="quotationStatusForm(\''+encA(d.no)+'\',\''+encA(d.status||'Pending')+'\',\''+encA(d.lossReason||'')+'\')">Status</button></td></tr>').join('')||'<tr><td colspan="7">No quotations found.</td></tr>'; }
function viewQuotation(en){ const no=decodeURIComponent(en); const d=QT_CACHE.find(x=>x.no===no); if(d)printQuotation(d); }

let REVISION_QUOTATION=null;
let QT_EDIT_MODE=false;
function editQuotation(en){
  const no=decodeURIComponent(en), d=QT_CACHE.find(x=>x.no===no);
  if(!d)return;
  if(showPage('quotations')===false)return;   /* user is asked about unsaved work first */
  REVISION_QUOTATION=d; QT_EDIT_MODE=true;
  setTimeout(()=>{
    renderQuotation();
    $('qtno').value=d.no||'';
    $('qtno').readOnly=true;
    $('qtdate').value=toInputDate(d.date)||todayStr();
    $('qtcustomer').value=d.customer||'';
    pickQuotationCustomer();
    $('qtcustomerId').value=d.customerId||$('qtcustomerId').value||'';
    $('qtaddress').value=d.address||$('qtaddress').value||'';
    if($('qtenquiry'))$('qtenquiry').value=d.enquiryId||'';
    if($('qtcontact'))$('qtcontact').value=d.contact||'';
    if($('qtstn'))$('qtstn').value=d.stn||'';
    if($('qtnTN'))$('qtnTN').value=d.ntn||'';
    if($('qtgst'))$('qtgst').value=(d.gst===undefined||d.gst===null||d.gst==='')?18:d.gst;
    if($('qtdiscount'))$('qtdiscount').value=d.discount||'';
    if($('qtvalidity'))$('qtvalidity').value=d.validity||'7 Days';
    if($('qtref'))$('qtref').value=d.ref||d.po||'';
    if($('qtrefDate'))$('qtrefDate').value=toInputDate(d.poDate);
    if($('qtpaymentTerms'))$('qtpaymentTerms').value=d.paymentTerms||'20 Days';
    QTL=(d.items||[]).map(x=>({model:(x.model==='-'?'':(x.model||'')),desc:x.desc||'',itemRemarks:x.itemRemarks||'',make:x.make||'',qty:x.qty||'',unit:x.unit||'Pcs',rate:x.rate||'',rateAuto:false,deliveryStatus:x.deliveryStatus||'Pending',history:null,image:x.image||''}));
    renderQuotationLines(); updateQuotationTotal();
    QTL.forEach((x,i)=>{ if(x.model) loadQuotationItemHistory(i); });
    if($('qtsavebtn'))$('qtsavebtn').textContent='Update Quotation';
    const h=$('pageTitle'); if(h)h.textContent='Edit Quotation '+d.no;
    toast('Quotation loaded for editing. Save will update the same quotation number.');
  },0);
}
function reviseQuotation(en){ return editQuotation(en); }

function printLogoSrc(){ try { return new URL('logo.png', document.baseURI).href; } catch(e){ return 'logo.png'; } }

/* Brand logos for the quotation print (embedded so printing never waits for a download) */
const QT_BRAND_LOGOS = {"univer": "data:image/png;base64,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", "aignep": "data:image/png;base64,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", "smc": "data:image/png;base64,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", "asco": "data:image/png;base64,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", "hydac": "data:image/png;base64,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", "festo": "data:image/png;base64,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", "ckd": "data:image/png;base64,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", "emerson": "data:image/png;base64,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", "aventics": "data:image/png;base64,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"};
function printQuotation(d){
  d = d || {};
  const items = d.items || [];
  const lineAmt = x => (+x.qty||0)*(+x.rate||0);
  const gross = items.reduce((a,x)=>a+lineAmt(x),0);
  const discPct = Math.min(100, Math.max(0, Number(d.discount||0)));
  const discAmt = gross*discPct/100;
  const total = gross - discAmt;
  const cust = findCust(d.customer) || {};
  const custId = d.customerId || cust['Customer ID'] || '';
  const ref = d.ref || d.po || '';
  const firstLead = items.find(x=>x.leadTime||x.deliveryStatus) || {};
  const delivery = d.delivery || firstLead.leadTime || firstLead.deliveryStatus || '';
  const prepared = d.preparedBy || d.createdBy || '';
  const rows = items.map((x,i)=>{
    const p = findProd(x.model) || {};
    const make = x.make || p.Brand || '';
    const desc = x.desc || '';
    const lead = x.leadTime || x.deliveryStatus || '';
    const pic = qtImgSrc(x);
    return `<tr class="qt-item"><td class="c">${i+1}</td><td>${pic?'<div class="qt-pic"><img src="'+esc(pic)+'" alt=""></div>':''}${(x.model&&x.model!=='-')?'<div class="qt-model">'+esc(x.model)+'</div>':''}${desc?'<div class="qt-desc">'+esc(desc)+'</div>':''}${x.itemRemarks?'<div class="qt-item-remarks"><b>Remarks:</b> '+esc(x.itemRemarks)+'</div>':''}${make?'<div class="qt-make">Make : <b>'+esc(make)+'</b></div>':''}</td><td class="c"><b>${esc(x.qty)}</b><div class="qt-sm">${esc(x.unit||'nos')}</div></td><td class="c"><b>${money(x.rate)}</b><div class="qt-sm">each</div></td><td class="c"><b>${money(lineAmt(x))}</b></td><td class="c qt-lead">${esc(String(lead).toUpperCase())}</td></tr>`;
  }).join('');
  const spacerH = Math.max(20, 62 - items.length*11);
  const row = (k,v,cls)=>`<tr><td class="k">${k}</td><td class="v ${cls||''}">${v||'&nbsp;'}</td></tr>`;
  const css = `<style>
    .qt{--navy:#1f3b63;--red:#c8102e;--ink:#1d2433;--mut:#5b6573;--line:#d5dbe3;--soft:#f4f6f9;color:var(--ink)}
    .qt-top{display:flex;justify-content:space-between;align-items:center;padding-bottom:6px}
    .qt-logo{height:52px}
    .qt-word{font-size:26px;font-weight:bold;letter-spacing:6px;color:var(--navy);text-align:right;line-height:1}
    .qt-tag{font-size:9px;letter-spacing:1px;color:var(--mut);text-align:right;margin-top:7px;font-weight:bold;white-space:nowrap}
    .qt-dist{padding:2px 12px;margin:0 10px;border-left:1px solid var(--line);border-right:1px solid var(--line)}
    .qt-dist .r{display:flex;align-items:center;white-space:nowrap;margin:3px 0}
    .qt-dist .r>*{margin-right:7px}.qt-dist .r>*:last-child{margin-right:0}
    .qt-dist .s{font-size:8.5px;font-style:italic;color:var(--mut);width:68px;text-align:right}
    .qt-dist .n{height:22px;width:auto;display:block}
    .qt-dist .it{font-size:8.5px;font-style:italic;color:var(--mut)}
    .qt-flag{display:inline-flex;width:15px;height:10px;border:1px solid #ccc}.qt-flag i{flex:1}
    .qt-rule{height:3px;background:linear-gradient(90deg,var(--red) 0,var(--red) 70px,var(--navy) 70px);margin-bottom:10px}
    .qt-info{display:flex;gap:10px;align-items:stretch;margin-bottom:10px}
    .qt-card{border:1px solid var(--line);border-radius:4px;overflow:hidden}
    .qt-to{width:42%;display:flex;flex-direction:column}
    .qt-det{width:58%}
    .qt-cap{background:var(--soft);color:var(--mut);font-size:8px;letter-spacing:1.2px;font-weight:bold;padding:3px 10px;border-bottom:1px solid var(--line)}
    .qt-tobody{padding:6px 10px;flex:1;display:flex;flex-direction:column;justify-content:center;gap:3px}
    .qt-attn{font-size:10.5px;font-weight:bold;color:var(--ink)}
    .qt-cust{font-size:13.5px;font-weight:bold;color:var(--navy);line-height:1.2}
    .qt-mini{font-size:9.5px;color:var(--mut);line-height:1.5}
    .qt-mini b{color:var(--ink)}
    .qt-det table{width:100%;border-collapse:collapse;font-size:10.5px}
    .qt-det td{padding:3px 8px;border-bottom:1px solid #eef1f5;vertical-align:middle}
    .qt-det tr:last-child td{border-bottom:none}
    .qt-det .k{color:var(--mut);font-weight:bold;white-space:nowrap;width:19%}
    .qt-det .v{font-weight:bold;width:31%;text-align:right;border-right:1px solid #eef1f5}
    .qt-det .v.last{border-right:none}
    .qt-green{color:#1a7f1a;font-style:italic}
    .qt-red{color:#d11a1a}
    .qt-items{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11.5px;border:1px solid var(--line)}
    .qt-items th{background:var(--navy);color:#fff;font-size:9.5px;letter-spacing:.2px;padding:7px 4px;white-space:nowrap;overflow:hidden;text-overflow:clip;text-align:left;border:1px solid var(--navy)}
    .qt-items th.c,.qt-items td.c{text-align:center}
    .qt-items td{border-left:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid #e6eaf0;padding:8px;vertical-align:top;line-height:1.4}
    .qt-model{font-weight:bold;font-size:12px}
    .qt-pic{float:right;margin:0 0 4px 10px;width:34mm;height:26mm;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:4px;background:#fff;overflow:hidden}
    .qt-pic img{max-width:100%;max-height:100%;object-fit:contain}
    .qt-item td:nth-child(2)::after{content:"";display:block;clear:both}
    .qt-desc{color:#333;margin-top:2px}.qt-item-remarks{font-size:10.5px;color:#5b6573;margin-top:4px;white-space:pre-wrap}.qt-item-remarks b{color:#1d2433}
    .qt-make{margin-top:5px;color:var(--mut)}.qt-make b{color:#0b7bbd}
    .qt-sm{font-size:9.5px;color:var(--mut);font-style:italic;margin-top:1px}
    .qt-lead{font-weight:bold;font-style:italic;color:#1a7f1a}
    .qt-fill td{border-bottom:none;padding:0}
    .qt-bottom{display:flex;justify-content:space-between;gap:16px;margin-top:12px;align-items:flex-start}
    .qt-notes{flex:1;border:1px solid var(--line);border-radius:4px;overflow:hidden}
    .qt-notes div.b{padding:8px 10px;font-size:10px;line-height:1.5}
    .qt-tot{width:44%;border-collapse:collapse;font-size:11.5px}
    .qt-tot td{padding:6px 10px;border:1px solid var(--line)}
    .qt-tot .l{color:var(--mut);font-weight:bold;background:var(--soft)}
    .qt-tot .r{text-align:right;font-weight:bold}
    .qt-tot .dis td{color:#a15c00;background:#fff8e1}
    .qt-tot .gt td{background:var(--navy);color:#fff;border-color:var(--navy);font-size:13px;font-weight:bold}
    .qt-q{font-size:9.5px;color:var(--mut);margin-top:16px}
    .qt-thanks{text-align:center;font-weight:bold;font-size:12px;color:var(--navy);margin-top:14px}
    .qt-sign{width:36%;margin-left:auto;margin-top:30px;text-align:center;font-size:10px}
    .qt-sign .ln{border-top:1px solid var(--ink);padding-top:5px;margin-top:40px}
    .qt-foot{text-align:center;font-size:9px;line-height:1.55;color:var(--mut)}
    .qt-foot b{display:block;color:var(--navy);font-size:14px;letter-spacing:1px;margin-bottom:2px}
    .qt-brands{display:flex;align-items:center;margin-top:8px;padding:8px 4px 0;border-top:1px solid var(--line)}
    .qt-brands span{flex:1 1 0;min-width:0;display:flex;align-items:flex-end;justify-content:center;height:22px;padding-bottom:2px;border-left:1px solid var(--line)}
    .qt-brands span:first-child{border-left:none}
    .qt-brands img{height:14px;max-width:70%;width:auto;display:block;object-fit:contain}
    .qt-brands img.b-smc{height:15px}.qt-brands img.b-emerson{height:21px}.qt-brands img.b-aventics{height:15px}
    .print-company{border-top:none!important;padding-top:6px!important}
  </style>`;
  const totals = `<table class="qt-tot">${discPct>0?`<tr><td class="l">SUB TOTAL</td><td class="r">${money(gross)}</td></tr><tr class="dis"><td class="l" style="background:#fff8e1;color:#a15c00">LESS ${discPct}% DISCOUNT</td><td class="r">- ${money(discAmt)}</td></tr>`:''}<tr class="gt"><td>TOTAL</td><td class="r">${total>0?money(total):'-'}</td></tr></table>`;
  const body = css + `<div class="qt">`
    + `<div class="qt-top"><img src="${printLogoSrc()}" class="qt-logo"><div class="qt-dist"><div class="r"><span class="s">Sole Distributor</span><img class="n" src="${QT_BRAND_LOGOS.univer}" alt="UNIVER"><span class="it">Italy</span></div><div class="r"><span class="s">Distributor</span><img class="n" src="${QT_BRAND_LOGOS.aignep}" alt="AIGNEP"><span class="qt-flag"><i style="background:#009246"></i><i style="background:#fff"></i><i style="background:#ce2b37"></i></span></div></div><div><div class="qt-word">QUOTATION</div><div class="qt-tag">PNEUMATIC AUTOMATION &nbsp;|&nbsp; AUTOMOTIVE</div></div></div><div class="qt-rule"></div>`
    + `<div class="qt-info"><div class="qt-card qt-to"><div class="qt-cap">TO</div><div class="qt-tobody">${d.contact?'<div class="qt-attn">'+esc(d.contact)+'</div>':''}<div class="qt-cust">${esc(d.customer)}</div><div class="qt-mini">${custId?'Customer ID: <b>'+esc(custId)+'</b>':''}${d.stn?' &nbsp;|&nbsp; STN: <b>'+esc(d.stn)+'</b>':''}${d.ntn?' &nbsp;|&nbsp; NTN: <b>'+esc(d.ntn)+'</b>':''}</div><div class="qt-mini">Ref # Your Requested: <b>${esc(ref)}</b></div></div></div>`
    + `<div class="qt-card qt-det"><div class="qt-cap">QUOTATION DETAILS</div><table><tr><td class="k">Date</td><td class="v">${fmtDate(d.date)}</td><td class="k">Quotation #</td><td class="v last">${esc(d.no)}</td></tr><tr><td class="k">Payment</td><td class="v">${esc(d.paymentTerms||'20 Days')}</td><td class="k">Delivery</td><td class="v last qt-green">${esc(delivery)}</td></tr><tr><td class="k">Valid until</td><td class="v qt-red">${esc(d.validity||'7 Days')}</td><td class="k">Prepared by</td><td class="v last">${esc(prepared)}</td></tr></table></div></div>`
    + `<table class="qt-items"><colgroup><col style="width:6%"><col style="width:39%"><col style="width:7%"><col style="width:14%"><col style="width:15%"><col style="width:19%"></colgroup><thead><tr><th class="c">Ser#</th><th>Description</th><th class="c">Qty</th><th class="c">Rate / Unit</th><th class="c">Amount</th><th class="c">Delivery / Remarks</th></tr></thead><tbody>${rows}<tr class="qt-fill" style="height:${spacerH}mm"><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>`
    + `<div class="qt-bottom"><div class="qt-notes"><div class="qt-cap">NOTES</div><div class="b"><b>All Above Quoted Prices are Exclusive of GST. Please add GST while making your Order.</b></div></div>${totals}</div>`
    + `<div class="qt-q">If you have any questions concerning this quotation, please feel free to contact : <b>021-32464447</b></div>`
    + `<div class="qt-thanks">Thank you for Your Business!</div>`
    + `<div class="qt-sign"><div class="ln"><i>Authorised by</i> &nbsp;<b>M. Adeel Khan</b></div></div></div>`;
  const footer = `<div class="qt-foot"><b>STANDARD FLUID SYSTEMS</b>e-mail: sales@standardfluid.com, standardfluidsystems@live.com, www.standardfluid.com<br>1410, 14th Floor, K.S Trade Tower, New Challi, Karachi, Ph: 021 32464447, cell: 0301 8212041.</div><div class="qt-brands">${['smc','asco','hydac','festo','ckd','emerson','aventics'].map(k=>`<span><img class="b-${k}" src="${QT_BRAND_LOGOS[k]}" alt="${k.toUpperCase()}"></span>`).join('')}</div>`;
  printDoc(body, footer, docFileName(d.no, d.customer, 'Quotation'));
}
function printDC(d){
  const rows = d.items.map((x,i) => {
    const prod = S.products.find(p => p['Model / Part No.'] === x.model) || {};
    return `<tr>
       <td class="c">${i+1}</td>
       <td>${esc(prod.Description || x.desc || '')}${x.model?`<br><span class="muted">Model: ${esc(x.model)}</span>`:''}</td>
       <td class="c">${esc(x.make || prod.Brand || '')}</td>
       <td class="c"><b>${x.qty}</b><br><span class="muted">${esc(x.unit||'nos')}</span></td>
       <td class="c">-<br><span class="muted">each</span></td>
       <td></td>
     </tr>`;
  }).join('') + fillerRows(d.items.length, 6, 6);

  const cust = S.customers.find(c => String(c['Customer Name']||'').toLowerCase() === String(d.customer||'').toLowerCase()) || {};
  const attn = d.attn || cust['Contact Person'] || '';

  const body = `
    <div class="doc-head">
      <div class="doc-head-left"><img src="${printLogoSrc()}" class="doc-logo"></div>
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
      <thead><tr><th class="c">Item</th><th>Description</th><th class="c">Make</th><th class="c">Qty.</th><th class="c">Rate/Unit</th><th class="c">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4"></td><td class="tot-label">TOTAL</td><td></td></tr></tfoot>
    </table>
    <div class="doc-endblock">
      <div class="doc-thanks">Thank you for Your Business!</div>
      <div class="doc-sign">Receiver's Name &amp; Sign</div>
    </div>`;

  printDoc(body, null, docFileName(d.no, d.customer, 'Delivery Challan'));
}

function printInvoice(d){
  const items = d.items || [];
  const rows = items.map((x,i) => {
    const prod = S.products.find(p => p['Model / Part No.'] === x.model) || {};
    const amt = (+x.qty||0)*(+x.rate||0);
    return `<tr>
       <td class="c">${i+1}</td>
       <td>${esc(x.desc||prod.Description||'')}${x.model?`<br><span class="muted">Model: ${esc(x.model)}</span>`:''}</td>
       <td class="c">${esc(x.make || prod.Brand || '')}</td>
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
      <div class="doc-head-left"><img src="${printLogoSrc()}" class="doc-logo"></div>
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
      <thead><tr><th class="c">Item</th><th>Description</th><th class="c">Make</th><th class="c">Qty.</th><th class="c">Rate/Unit</th><th class="c">Amount</th></tr></thead>
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

  printDoc(body, null, docFileName(d.no, d.customer, 'Invoice'));
}

/* PDF file name = "<number> - <customer>" (customer part is shortened if very long) */
function docFileName(no, customer, fallback){
  const n = String(no || '').trim() || fallback;
  const c = String(customer || '').replace(/\s+/g, ' ').trim().slice(0, 40).trim();
  return c ? n + ' - ' + c : n;
}

/* fileName = name suggested by the browser when the user chooses "Save as PDF" (it is taken from the page title) */
function printDoc(body, footerHtml, fileName){
  $('printArea').innerHTML = `<style>
    #printArea{display:block}
    .print-doc{font-family:Arial,Helvetica,sans-serif;color:#111;width:100%;max-width:100%;margin:0 auto;font-size:12.5px;box-sizing:border-box;padding:6mm 10mm 10mm;display:flex;flex-direction:column;min-height:277mm}
    .doc-body{flex:1 0 auto;display:flex;flex-direction:column}
    .doc-endblock{margin-top:auto;padding-top:20px}
    .filler td{border-color:#333;height:30px}
    .doc-head{display:flex!important;justify-content:space-between;align-items:center;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:20px}
    .doc-head-left{display:flex!important;align-items:center;gap:8px}
    .doc-logo{height:56px}
    .doc-title{font-size:28px;font-weight:bold;color:#333}
    .doc-meta{display:flex!important;justify-content:space-between;gap:20px;margin-bottom:26px}
    .meta-left{width:58%;font-size:11.5px}
    .meta-right{width:38%;font-size:11.5px}
    .meta-line{display:flex!important;flex-wrap:wrap;gap:6px;margin-bottom:3px}
    .meta-tag{font-weight:bold;white-space:nowrap}
    .cust-name{font-style:italic;font-weight:bold;font-size:13px}
    .meta-row{display:flex!important;justify-content:space-between;gap:10px;margin-bottom:3px;white-space:nowrap}
    .meta-label{font-weight:bold}
    .meta-value{text-align:right}
    .doc-items{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:12px;table-layout:fixed}
    .doc-items th,.doc-items td{border:1px solid #333;padding:7px 8px;vertical-align:top;line-height:1.35;min-height:30px}
    .doc-items th{background:#f0f0f0;text-align:left}
    .doc-items .c{text-align:center}
    .doc-items .r{text-align:right}
    .muted{color:#555;font-size:10.5px;font-style:italic}
    .tot-label{text-align:right;font-weight:bold;background:#f7f7f7}
    .doc-totals{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px}
    .doc-totals td{border:1px solid #333;padding:7px 8px;min-height:30px}
    .doc-totals .words{width:55%;vertical-align:middle}
    .doc-totals .r{text-align:right;width:15%}
    .doc-thanks{text-align:center;font-weight:bold;margin:14px 0 28px;font-size:12.5px}
    .doc-sign{text-align:right;margin-bottom:22px;font-size:12.5px}
    .doc-footer-note{display:flex!important;justify-content:space-between;align-items:flex-end;margin-bottom:16px;font-size:12px}
    .doc-sign-block{font-style:italic}
    .print-company{flex:0 0 auto;text-align:center;font-size:10.5px;color:#333;border-top:1px solid #ccc;padding-top:14px;margin-top:auto;padding-bottom:4px}
    .print-company b{font-size:12px}
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
    <div class="print-company">${footerHtml||`
      <b>STANDARD FLUID SYSTEMS</b>
      <div>General Industrial Machinery &amp; Equipment</div>
      <div>1410, 14th Floor, K.S Trade Tower, New Challi, Karachi, Ph:021 32464447, cell: 0301 8212041</div>
      <div>e-mail: sales@standardfluid.com, standardfluidsystems@live.com, www.standardfluid.com</div>
    `}</div>
  </div>`;
  if (fileName) {
    const prevTitle = document.title;
    document.title = String(fileName).replace(/[\\/:*?"<>|]+/g, '-').trim() || prevTitle;
    const restoreTitle = () => { document.title = prevTitle; window.removeEventListener('afterprint', restoreTitle); };
    window.addEventListener('afterprint', restoreTitle);
  }
  /* wait (max 6 s) until pictures and logos have loaded, so they appear on the printout / PDF */
  const imgs = Array.from(document.querySelectorAll('#printArea img')).filter(im => !im.complete);
  const ready = imgs.map(im => new Promise(r => { im.addEventListener('load', r, {once:true}); im.addEventListener('error', r, {once:true}); }));
  Promise.race([Promise.all(ready), new Promise(r => setTimeout(r, 6000))]).then(() => setTimeout(() => window.print(), 100));
}


/* =====================================================================
   IMPORTS — landed-cost costing + bulk Product / Inward entry
   Visible only to ADMIN and users who have the "imports" module.
   Per item:  value (foreign currency x rate) + share of freight / duty / charges
              = landed cost  ->  landed cost per unit -> product Cost Price.
   Saving uses the EXISTING backend actions (saveProduct / updateProduct / saveInward).
   ===================================================================== */
const IMP_CURRENCIES = ['USD','EUR','GBP','CNY','AED','JPY','INR','PKR'];
let IMP = {h:null, rows:[], charges:[]};
let IMP_DONE = {};   /* progress of a batch, so a retry after an error never creates duplicates */

function impBlankRow(){ return {model:'', desc:'', cat:'Others', brand:'', unit:'Pcs', qty:'', price:'', sale:''}; }
function impDefaultCharges(){
  return [
    {name:'Freight', amt:'', cur:'inv', inc:true},
    {name:'Insurance', amt:'', cur:'inv', inc:true},
    {name:'Customs Duty', amt:'', cur:'PKR', inc:true},
    {name:'Clearing / Port / DO charges', amt:'', cur:'PKR', inc:true},
    {name:'Local transport', amt:'', cur:'PKR', inc:true},
    {name:'Sales Tax / Income Tax (adjustable)', amt:'', cur:'PKR', inc:false}
  ];
}
function impNum(v){ const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function impR2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
let IMP_HIST = [];
function impHistory(){ return IMP_HIST; }
async function impLoadHistory(){
  const r = await api('getImportCostings', {});
  if (r && r.ok) IMP_HIST = r.imports || [];
  else if (r && r.error && !/unknown action/i.test(r.error)) toast(r.error, true);
  impRenderHistory();
}

function impPageHtml(){
  return `<div class="wrap" id="impPage">
    <div class="imp-banner"><b>🔒 Confidential.</b> Rates, duty and costing on this page are visible only to Admin and users given “Imports” access.</div>

    <div class="panel"><h3>1. Shipment Details</h3>
      <div class="form-grid">
        <label>Date<input id="impDate" type="date" oninput="impHdr()"></label>
        <label>Supplier<input id="impSupplier" list="suplist" oninput="impHdr()"></label>
        <label>Supplier Invoice / BL No.<input id="impRef" oninput="impHdr()"></label>
        <label>Invoice Currency<select id="impCur" onchange="impHdr()">${IMP_CURRENCIES.map(c => '<option>' + c + '</option>').join('')}</select></label>
        <label>Exchange Rate (Rs. per 1 unit)<input id="impRate" type="number" min="0" step="any" oninput="impHdr()" placeholder="e.g. 281.50"></label>
        <label>Spread charges by<select id="impAlloc" onchange="impHdr()"><option value="value">Item value (recommended)</option><option value="qty">Quantity</option></select></label>
        <label>Cost price of existing products<select id="impMode" onchange="impHdr()"><option value="avg">Weighted average (old stock + new)</option><option value="replace">Replace with new landed cost</option><option value="keep">Do not change</option></select></label>
        <label class="chk" style="align-self:end"><input id="impPayable" type="checkbox" checked onchange="impHdr()"> Add supplier invoice value to Supplier Payable</label>
      </div>
    </div>

    <div class="panel"><div class="panel-head"><h3>2. Freight, Duty &amp; Other Charges</h3><button class="btn small" onclick="impAddCharge()">+ Add Charge</button></div>
      <div class="table-wrap" id="impCharges"></div>
      <div class="muted small" style="margin-top:8px">Un-tick “Add to cost?” for adjustable taxes (Sales Tax / Income Tax) that you claim back — they will not be added to the landed cost.</div>
    </div>

    <div class="panel"><div class="panel-head"><h3>3. Items</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" onclick="impPasteForm()">Paste from Excel</button><button class="btn small" onclick="impAddRow()">+ Add Row</button></div></div>
      <div class="table-wrap" id="impGrid"></div>
      <div id="impSummary"></div>
    </div>

    <div class="imp-actions">
      <span id="impProgress" class="muted"></span>
      <button class="btn" onclick="impClear()">Clear</button>
      <button class="btn" onclick="impPreview()">Preview Costing</button>
      <button class="btn primary" onclick="impSave()">Save Import → Products + Inward Stock</button>
    </div>

    <div class="panel" id="impProfit"></div>
    <div class="panel" id="impInvProfit"></div>
    <div class="panel" id="impHistory"></div>
  </div>`;
}

function renderImports(){
  if (!hasMod('imports')) return;
  if (!IMP.charges.length) IMP.charges = impDefaultCharges();
  if (!IMP.rows.length) IMP.rows = [impBlankRow()];
  const h = IMP.h || {date:todayStr(), supplier:'', ref:'', cur:'USD', rate:'', alloc:'value', mode:'avg', payable:true};
  $('impDate').value = h.date || todayStr(); $('impSupplier').value = h.supplier; $('impRef').value = h.ref;
  $('impCur').value = h.cur; $('impRate').value = h.rate; $('impAlloc').value = h.alloc; $('impMode').value = h.mode; $('impPayable').checked = !!h.payable;
  IMP.h = h; impSyncRateBox();
  impRenderCharges(); impRenderGrid(); impRecalc(); impRenderHistory(); impRenderProfit(); impRenderInvProfit(); impLoadHistory();
}
function impSyncRateBox(){ const pk = $('impCur').value === 'PKR'; $('impRate').disabled = pk; if (pk) $('impRate').value = 1; }
function impHdr(){
  const prevCur = IMP.h ? IMP.h.cur : null;
  IMP.h = {date:$('impDate').value, supplier:$('impSupplier').value.trim(), ref:$('impRef').value.trim(), cur:$('impCur').value, rate:$('impRate').value, alloc:$('impAlloc').value, mode:$('impMode').value, payable:$('impPayable').checked};
  impSyncRateBox();
  if (prevCur !== IMP.h.cur) { impRenderCharges(); impRenderGrid(); }
  impRecalc();
}

/* ---------- charges ---------- */
function impRenderCharges(){
  const cur = IMP.h ? IMP.h.cur : 'USD';
  $('impCharges').innerHTML = '<table class="imp-table"><thead><tr><th>Charge</th><th class="right">Amount</th><th>Currency</th><th style="text-align:center">Add to cost?</th><th class="right">In Rs.</th><th></th></tr></thead><tbody>'
    + IMP.charges.map((c, i) => `<tr>
        <td><input class="imp-in wide" value="${esc(c.name)}" oninput="IMP.charges[${i}].name=this.value"></td>
        <td><input class="imp-in num" type="number" min="0" step="any" value="${esc(c.amt)}" oninput="impChg(${i},'amt',this.value)"></td>
        <td><select class="imp-in" onchange="impChg(${i},'cur',this.value)"><option value="inv"${c.cur === 'inv' ? ' selected' : ''}>${esc(cur)} (invoice currency)</option><option value="PKR"${c.cur === 'PKR' ? ' selected' : ''}>PKR</option></select></td>
        <td style="text-align:center"><input type="checkbox"${c.inc ? ' checked' : ''} onchange="impChg(${i},'inc',this.checked)"></td>
        <td class="right" id="imp-cpkr-${i}"></td>
        <td><button class="btn small danger" onclick="impDelCharge(${i})">×</button></td></tr>`).join('')
    + '</tbody></table>';
}
function impChg(i, k, v){ IMP.charges[i][k] = v; impRecalc(); }
function impAddCharge(){ IMP.charges.push({name:'Other charge', amt:'', cur:'PKR', inc:true}); impRenderCharges(); impRecalc(); }
function impDelCharge(i){ IMP.charges.splice(i, 1); impRenderCharges(); impRecalc(); }

/* ---------- items grid ---------- */
function impRenderGrid(){
  const cur = IMP.h ? IMP.h.cur : 'USD';
  $('impGrid').innerHTML = '<table class="imp-table"><thead><tr><th>#</th><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Brand</th><th>Unit</th><th class="right">Qty</th><th class="right">Unit Price (' + esc(cur) + ')</th><th class="right">Sale Price (Rs.)</th><th class="right">Value (Rs.)</th><th class="right">Charges (Rs.)</th><th class="right">Landed / Unit</th><th class="right">Margin</th><th>Status</th><th></th></tr></thead><tbody>'
    + IMP.rows.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td><input class="imp-in" id="imp-model-${i}" list="mlist" value="${esc(r.model)}" onchange="impModel(${i},this.value)"></td>
        <td><input class="imp-in wide" id="imp-desc-${i}" value="${esc(r.desc)}" oninput="IMP.rows[${i}].desc=this.value"></td>
        <td><select class="imp-in" id="imp-cat-${i}" onchange="IMP.rows[${i}].cat=this.value">${CATS.map(c => `<option${c === r.cat ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
        <td><input class="imp-in sm" id="imp-brand-${i}" value="${esc(r.brand)}" oninput="IMP.rows[${i}].brand=this.value"></td>
        <td><input class="imp-in xs" id="imp-unit-${i}" value="${esc(r.unit)}" oninput="IMP.rows[${i}].unit=this.value"></td>
        <td><input class="imp-in num" type="number" min="0" step="any" value="${esc(r.qty)}" oninput="impSet(${i},'qty',this.value)"></td>
        <td><input class="imp-in num" type="number" min="0" step="any" value="${esc(r.price)}" oninput="impSet(${i},'price',this.value)"></td>
        <td><input class="imp-in num" type="number" min="0" step="any" value="${esc(r.sale)}" oninput="impSet(${i},'sale',this.value)"></td>
        <td class="right" id="imp-val-${i}"></td><td class="right" id="imp-chg-${i}"></td>
        <td class="right" id="imp-unitc-${i}"></td><td class="right" id="imp-mrg-${i}"></td>
        <td id="imp-st-${i}"></td>
        <td><button class="btn small danger" onclick="impDelRow(${i})">×</button></td></tr>`).join('')
    + '</tbody></table>';
}
function impSet(i, k, v){ IMP.rows[i][k] = v; impRecalc(); }
function impAddRow(){ IMP.rows.push(impBlankRow()); impRenderGrid(); impRecalc(); }
function impDelRow(i){ IMP.rows.splice(i, 1); if (!IMP.rows.length) IMP.rows.push(impBlankRow()); impRenderGrid(); impRecalc(); }
function impModel(i, val){
  const r = IMP.rows[i], p = findProd(val);
  r.model = String(val || '').trim();
  if (p) {
    r.model = p['Model / Part No.']; r.desc = p.Description || ''; r.cat = p.Category || 'Others'; r.brand = p.Brand || ''; r.unit = p.Unit || 'Pcs';
    if (!r.sale) r.sale = p['Sale Price'] || '';
    $('imp-model-' + i).value = r.model; $('imp-desc-' + i).value = r.desc; $('imp-cat-' + i).value = r.cat;
    $('imp-brand-' + i).value = r.brand; $('imp-unit-' + i).value = r.unit;
    impRenderGrid();
  }
  impRecalc();
}
function impPasteForm(){
  modal('Paste Items from Excel',
    `<div class="muted" style="margin-bottom:10px">One item per row, columns in this order (header row optional):<br><b>Model, Description, Category, Brand, Unit, Qty, Unit Price, Sale Price</b><br>Sale Price is optional. Unit Price is in the invoice currency.</div>
     <textarea id="impPasteText" style="width:100%;min-height:220px;font-family:monospace"></textarea>
     <div class="actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="impPasteApply()">Add Rows</button></div>`);
}
function impPasteApply(){
  const rows = parseBulkRows($('impPasteText').value);
  if (!rows.length) return toast('Please paste the item rows.', true);
  const added = rows.filter(r => (r[0] || '').trim()).map(r => ({model:(r[0] || '').trim(), desc:r[1] || '', cat:CATS.indexOf(r[2]) >= 0 ? r[2] : 'Others', brand:r[3] || '', unit:r[4] || 'Pcs', qty:impNum(r[5]) || '', price:impNum(r[6]) || '', sale:impNum(r[7]) || ''}));
  added.forEach(a => { const p = findProd(a.model); if (p) { a.model = p['Model / Part No.']; a.desc = p.Description || a.desc; a.cat = p.Category || a.cat; a.brand = p.Brand || a.brand; a.unit = p.Unit || a.unit; if (!a.sale) a.sale = p['Sale Price'] || ''; } });
  if (IMP.rows.length === 1 && !IMP.rows[0].model && !IMP.rows[0].qty) IMP.rows = [];
  IMP.rows = IMP.rows.concat(added);
  closeModal(); impRenderGrid(); impRecalc(); toast(added.length + ' row(s) added.');
}

/* ---------- the costing maths ---------- */
function impCalc(){
  const h = IMP.h || {cur:'USD', rate:'', alloc:'value', mode:'avg'};
  const rate = h.cur === 'PKR' ? 1 : impNum(h.rate);
  const rows = IMP.rows.map(r => {
    const qty = impNum(r.qty), price = impNum(r.price), p = r.model ? findProd(r.model) : null;
    return {model:p ? p['Model / Part No.'] : String(r.model || '').trim(), desc:r.desc, cat:r.cat, brand:r.brand, unit:r.unit, qty:qty, price:price, sale:impNum(r.sale),
            valCur:qty * price, valPkr:qty * price * rate, exists:!!p, p:p, share:0, landed:0, unitCost:0, newCost:0, margin:null};
  });
  const charges = IMP.charges.map(c => { const a = impNum(c.amt); return {name:c.name, amt:a, cur:c.cur, pkr:c.cur === 'inv' ? a * rate : a, inc:!!c.inc}; });
  const inc = charges.filter(c => c.inc).reduce((a, c) => a + c.pkr, 0);
  const exc = charges.filter(c => !c.inc).reduce((a, c) => a + c.pkr, 0);
  const totVal = rows.reduce((a, r) => a + r.valPkr, 0), totQty = rows.reduce((a, r) => a + r.qty, 0);
  rows.forEach(r => {
    const w = h.alloc === 'qty' ? (totQty ? r.qty / totQty : 0) : (totVal ? r.valPkr / totVal : (totQty ? r.qty / totQty : 0));
    r.share = inc * w; r.landed = r.valPkr + r.share; r.unitCost = r.qty > 0 ? r.landed / r.qty : 0;
    const oldStock = r.p ? impNum(r.p.currentStock) : 0, oldCost = r.p ? impNum(r.p['Cost Price']) : 0;
    if (!r.p || h.mode === 'replace') r.newCost = r.unitCost;
    else if (h.mode === 'keep') r.newCost = oldCost;
    else r.newCost = (oldStock > 0 && oldCost > 0) ? (oldStock * oldCost + r.qty * r.unitCost) / (oldStock + r.qty) : r.unitCost;
    r.newCost = impR2(r.newCost);
    r.margin = (r.sale > 0 && r.unitCost > 0) ? (r.sale - r.unitCost) / r.sale * 100 : null;
  });
  return {rate:rate, rows:rows, charges:charges, inc:inc, exc:exc, totVal:totVal, totQty:totQty, totLanded:totVal + inc,
          valCur:rows.reduce((a, r) => a + r.valCur, 0), cur:h.cur, method:h.alloc, mode:h.mode};
}
function impRecalc(){
  if (!$('impGrid')) return null;
  const c = impCalc(), set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  c.rows.forEach((r, i) => {
    set('imp-val-' + i, r.valPkr ? money(r.valPkr) : '');
    set('imp-chg-' + i, r.share ? money(r.share) : '');
    set('imp-unitc-' + i, r.unitCost ? money(r.unitCost) : '');
    const m = $('imp-mrg-' + i); if (m) { m.textContent = r.margin === null ? '' : r.margin.toFixed(1) + '%'; m.style.color = r.margin !== null && r.margin < 0 ? '#c0392b' : ''; }
    const st = $('imp-st-' + i);
    if (st) st.innerHTML = !r.model ? '' : (r.exists ? '<span class="imp-tag old">Existing · stock ' + esc(r.p.currentStock) + '</span>' : '<span class="imp-tag new">New product</span>');
    ['desc', 'brand', 'unit'].forEach(k => { const e = $('imp-' + k + '-' + i); if (e) e.readOnly = r.exists; });
    const ct = $('imp-cat-' + i); if (ct) ct.disabled = r.exists;
  });
  c.charges.forEach((x, i) => set('imp-cpkr-' + i, x.pkr ? money(x.pkr) : ''));
  const nNew = c.rows.filter(r => r.model && !r.exists).length, nOld = c.rows.filter(r => r.model && r.exists).length;
  $('impSummary').innerHTML = `<div class="imp-sum">
      <div><span>Goods value (${esc(c.cur)})</span><b>${money(c.valCur)}</b></div>
      <div><span>Goods value (Rs.)</span><b>${money(c.totVal)}</b></div>
      <div><span>Charges added to cost</span><b>${money(c.inc)}</b></div>
      <div class="hi"><span>Total landed cost (Rs.)</span><b>${money(c.totLanded)}</b></div>
      <div><span>Cost uplift over goods value</span><b>${c.totVal ? (c.inc / c.totVal * 100).toFixed(1) + '%' : '—'}</b></div>
      ${c.exc ? '<div><span>Not added to cost (taxes)</span><b>' + money(c.exc) + '</b></div>' : ''}
      <div><span>Items</span><b>${nNew} new · ${nOld} existing</b></div>
    </div>`;
  return c;
}

/* ---------- validate + save ---------- */
function impValidate(){
  const h = IMP.h, c = impCalc(), bad = m => ({ok:false, error:m});
  if (!h.date) return bad('Date is required.');
  if (c.cur !== 'PKR' && !(c.rate > 0)) return bad('Enter the exchange rate (Rs. per 1 ' + c.cur + ').');
  const rows = c.rows.filter(r => r.model || r.qty || r.price);
  if (!rows.length) return bad('Add at least one item.');
  const seen = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], k = norm(r.model);
    if (!r.model) return bad('Row ' + (i + 1) + ': Model / Part No. is required.');
    if (!(r.qty > 0)) return bad(r.model + ': quantity must be greater than zero.');
    if (!(r.price >= 0)) return bad(r.model + ': invalid unit price.');
    if (seen[k]) return bad(r.model + ' is entered twice. Please combine it into one row.');
    seen[k] = 1;
  }
  return {ok:true, calc:Object.assign({}, c, {rows:rows})};
}
function impPreview(){
  const v = impValidate(); if (!v.ok) return toast(v.error, true);
  const e = impEntry(v.calc); window.IMP_PREVIEW_ENTRY = e;
  modal('Costing Preview — ' + (e.ref || 'Import'), impSheetModalHtml(e, false));
}
function impEntry(c){
  const h = IMP.h;
  return {id:'imp' + Date.now(), ts:Date.now(), date:h.date, supplier:h.supplier, ref:h.ref, cur:c.cur, rate:c.rate, method:c.method, mode:c.mode,
    charges:c.charges, totVal:c.totVal, inc:c.inc, exc:c.exc, totLanded:c.totLanded, valCur:c.valCur, user:(S.user && S.user.name) || '',
    rows:c.rows.map(r => ({model:r.model, desc:r.desc, qty:r.qty, price:r.price, valCur:r.valCur, valPkr:r.valPkr, share:r.share, landed:r.landed, unitCost:r.unitCost, sale:r.sale, margin:r.margin, newCost:r.newCost, exists:r.exists}))};
}
async function impSave(){
  if (!hasMod('imports')) return toast('You do not have access to Imports.', true);
  const v = impValidate(); if (!v.ok) return toast(v.error, true);
  const c = v.calc, h = IMP.h, entry = impEntry(c);
  if (h.ref && impHistory().some(x => norm(x.ref) === norm(h.ref) && norm(x.supplier) === norm(h.supplier)) && !confirm('An import with this supplier and reference was already saved on this device. Save again?')) return;
  if (h.payable && !h.supplier && !confirm('Supplier is empty — the supplier invoice value will not appear in Supplier Payable. Continue?')) return;
  const nNew = c.rows.filter(r => !r.exists).length;
  if (!confirm('Save this import?\n\n• ' + nNew + ' new product(s) will be created\n• ' + c.rows.length + ' inward stock entr' + (c.rows.length === 1 ? 'y' : 'ies') + ' will be added\n• Total landed cost: Rs. ' + money(c.totLanded))) return;

  const key = [h.date, norm(h.supplier), norm(h.ref), c.rows.map(r => norm(r.model) + ':' + r.qty).join('|')].join('#');
  IMP_DONE[key] = IMP_DONE[key] || {};
  await guardedSave(async () => {
    const prog = $('impProgress');
    for (let i = 0; i < c.rows.length; i++) {
      const r = c.rows[i], st = IMP_DONE[key][r.model] = IMP_DONE[key][r.model] || {};
      if (prog) prog.textContent = 'Saving ' + (i + 1) + ' / ' + c.rows.length + ': ' + r.model + ' …';
      if (!st.prod) {
        let res;
        if (!r.exists) {
          res = await api('saveProduct', {model:r.model, category:r.cat || 'Others', description:r.desc, brand:r.brand, unit:r.unit || 'Pcs', location:'',
            costPrice:r.newCost, salePrice:r.sale || '', openingStock:0, reorderLevel:5, remarks:'', imageBase64:''});
        } else {
          const p = r.p, newSale = r.sale > 0 ? r.sale : (p['Sale Price'] || '');
          if (c.mode === 'keep' && !(r.sale > 0)) res = {ok:true};
          else res = await api('updateProduct', {model:r.model, category:p.Category, description:p.Description, brand:p.Brand, unit:p.Unit, location:p.Location,
            costPrice:c.mode === 'keep' ? (p['Cost Price'] || '') : r.newCost, salePrice:newSale, reorderLevel:reorderOf(p), remarks:p.Remarks || '', imageBase64:''});
        }
        if (!res || !res.ok) { if (prog) prog.textContent = ''; return toast('Stopped at ' + r.model + ': ' + ((res && res.error) || 'could not save') + '. Fix it and press Save again — items already saved will not be repeated.', true); }
        st.prod = true;
      }
      if (!st.inw) {
        const res = await api('saveInward', {date:h.date, sourceType:'Import', model:r.model, quantity:r.qty, supplier:h.supplier, supplierReference:h.ref,
          purchaseCost:h.payable ? impR2(r.valPkr) : '', remarks:'Import' + (h.ref ? ' ' + h.ref : '')});
        if (!res || !res.ok) { if (prog) prog.textContent = ''; return toast('Stopped at ' + r.model + ' (stock entry): ' + ((res && res.error) || 'could not save') + '. Press Save again — items already saved will not be repeated.', true); }
        st.inw = true;
      }
    }
    delete IMP_DONE[key];
    const cs = await api('saveImportCosting', {date:h.date, supplier:h.supplier, ref:h.ref, cur:c.cur, rate:c.rate, method:c.method,
      charges:c.charges, rows:c.rows.map(r => ({model:r.model, desc:r.desc, qty:r.qty, price:r.price, valCur:r.valCur, valPkr:r.valPkr, share:r.share, landed:r.landed, unitCost:r.unitCost, sale:r.sale, newCost:r.newCost}))});
    window.IMP_PREVIEW_ENTRY = entry;
    const costingSaved = !!(cs && cs.ok);
    if (costingSaved) { entry.id = cs.id; IMP_HIST.unshift(entry); }
    IMP.rows = [impBlankRow()]; IMP.charges = impDefaultCharges(); IMP.h = Object.assign({}, h, {ref:''});
    if (prog) prog.textContent = '';
    await refresh();
    modal('Import Saved ✓', `<p><b>${c.rows.length}</b> item(s) saved — ${nNew} new product(s) created and stock increased.<br>Landed cost per unit has been saved as the product Cost Price.</p>`
      + (costingSaved ? '<p class="muted small">Costing sheet saved securely on the server (Imports access only).</p>'
                      : '<p style="color:#c0392b"><b>Warning:</b> products and stock were saved, but the costing sheet could not be stored on the server (' + esc((cs && cs.error) || 'unknown error') + '). Please download the PDF / CSV below now and keep it.</p>')
      + impSheetModalHtml(entry, true) );
  });
}
function impClear(){
  if (!confirm('Clear everything on this page?')) return;
  IMP = {h:Object.assign({}, IMP.h, {ref:'', rate:IMP.h ? IMP.h.rate : ''}), rows:[impBlankRow()], charges:impDefaultCharges()}; renderImports();
}

/* ---------- costing sheet (screen / PDF / CSV) ---------- */
function impSheetTable(e, cls){
  const t = cls ? ' class="' + cls + '"' : '';
  const rows = e.rows.map(r => '<tr><td><b>' + esc(r.model) + '</b></td><td class="r">' + r.qty + '</td><td class="r">' + money(r.price) + '</td><td class="r">' + money(r.valPkr) + '</td><td class="r">' + money(r.share) + '</td><td class="r">' + money(r.landed) + '</td><td class="r"><b>' + money(r.unitCost) + '</b></td><td class="r">' + (r.sale ? money(r.sale) : '') + '</td><td class="r">' + (r.margin === null || r.margin === undefined ? '' : r.margin.toFixed(1) + '%') + '</td></tr>').join('');
  const cgI = cls ? '<colgroup><col style="width:19%"><col style="width:6%"><col style="width:10%"><col style="width:12%"><col style="width:11%"><col style="width:12%"><col style="width:11%"><col style="width:10%"><col style="width:9%"></colgroup>' : '';
  const cgC = cls ? '<colgroup><col style="width:38%"><col style="width:18%"><col style="width:14%"><col style="width:18%"><col style="width:12%"></colgroup>' : '';
  const items = '<table' + t + '>' + cgI + '<thead><tr><th>Model</th><th class="r">Qty</th><th class="r">Price (' + esc(e.cur) + ')</th><th class="r">Value Rs.</th><th class="r">Charges Rs.</th><th class="r">Landed Rs.</th><th class="r">Landed / Unit</th><th class="r">Sale Price</th><th class="r">Margin</th></tr></thead><tbody>' + rows
    + '<tr><td colspan="3"><b>TOTAL</b></td><td class="r"><b>' + money(e.totVal) + '</b></td><td class="r"><b>' + money(e.inc) + '</b></td><td class="r"><b>' + money(e.totLanded) + '</b></td><td colspan="3"></td></tr></tbody></table>';
  const ch = '<table' + t + '>' + cgC + '<thead><tr><th>Charge</th><th class="r">Amount</th><th>Currency</th><th class="r">In Rs.</th><th>In cost?</th></tr></thead><tbody>'
    + e.charges.filter(c => c.amt).map(c => '<tr><td>' + esc(c.name) + '</td><td class="r">' + money(c.amt) + '</td><td>' + (c.cur === 'inv' ? esc(e.cur) : 'PKR') + '</td><td class="r">' + money(c.pkr) + '</td><td>' + (c.inc ? 'Yes' : 'No') + '</td></tr>').join('') + '</tbody></table>';
  return {items:items, charges:e.charges.some(c => c.amt) ? ch : ''};
}
function impSheetModalHtml(e, saved){
  const t = impSheetTable(e, '');
  return `<div class="muted" style="margin-bottom:8px">${esc(e.supplier || '—')} • Ref: <b>${esc(e.ref || '—')}</b> • ${fmtDate(e.date)} • ${esc(e.cur)} @ ${e.rate} • Spread by ${e.method === 'qty' ? 'quantity' : 'value'}</div>
    ${t.charges ? '<h4 style="margin:10px 0 6px">Charges</h4><div class="table-wrap imp-sheet">' + t.charges + '</div>' : ''}
    <h4 style="margin:14px 0 6px">Items</h4><div class="table-wrap imp-sheet">${t.items}</div>
    <div class="actions"><button class="btn" onclick="impCsv('${e.id}')">⬇ Excel / CSV</button><button class="btn" onclick="impPrintSheet('${e.id}')">⬇ PDF / Print</button><button class="btn primary" onclick="closeModal()">${saved ? 'Done' : 'Close'}</button></div>`;
}
function impFindEntry(id){
  const h = impHistory().find(x => x.id === id); if (h) return h;
  return (window.IMP_PREVIEW_ENTRY && window.IMP_PREVIEW_ENTRY.id === id) ? window.IMP_PREVIEW_ENTRY : null;
}
function impPrintSheet(id){
  const e = impFindEntry(id) || (IMP.h && impValidate().ok ? impEntry(impValidate().calc) : null);
  if (!e) return toast('Costing sheet not found.', true);
  const t = impSheetTable(e, 'doc-items stmt');
  const body = `<div class="doc-head"><div class="doc-head-left"><img src="${printLogoSrc()}" class="doc-logo"></div><div class="doc-head-right"><div class="doc-title" style="font-size:22px">IMPORT COSTING SHEET</div></div></div>
    <div style="color:#b00020;font-weight:bold;font-size:11px;margin:-10px 0 12px">CONFIDENTIAL — INTERNAL USE ONLY</div>
    <div class="doc-meta"><div class="meta-left"><div class="meta-line"><span class="meta-tag">Supplier:</span><span>${esc(e.supplier || '—')}</span></div><div class="meta-line"><span class="meta-tag">Invoice / BL:</span><span>${esc(e.ref || '—')}</span></div></div>
      <div class="meta-right"><div class="meta-row"><span class="meta-label">Date:</span><span class="meta-value">${fmtDate(e.date)}</span></div><div class="meta-row"><span class="meta-label">Currency:</span><span class="meta-value">${esc(e.cur)} @ Rs. ${e.rate}</span></div><div class="meta-row"><span class="meta-label">Goods value:</span><span class="meta-value">${esc(e.cur)} ${money(e.valCur)}</span></div></div></div>
    ${t.charges ? '<div style="font-weight:bold;margin:0 0 6px">CHARGES</div>' + t.charges + '<div style="height:14px"></div>' : ''}
    <div style="font-weight:bold;margin:0 0 6px">ITEMS &amp; LANDED COST</div>${t.items}
    <div style="margin-top:12px;font-size:13px"><b>Total landed cost: Rs. ${money(e.totLanded)}</b> &nbsp;(goods Rs. ${money(e.totVal)} + charges Rs. ${money(e.inc)})</div>`;
  closeModal();
  printDoc(body, '<div>Confidential — Standard Fluid Systems</div>', docFileName('Import Costing ' + (e.ref || e.date), e.supplier, 'Import Costing'));
}
function impCsv(id){
  const e = impFindEntry(id) || (IMP.h && impValidate().ok ? impEntry(impValidate().calc) : null);
  if (!e) return toast('Costing sheet not found.', true);
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', L = [];
  L.push(['IMPORT COSTING SHEET (CONFIDENTIAL)'].map(q).join(','));
  L.push(['Supplier', e.supplier, 'Invoice/BL', e.ref, 'Date', e.date, 'Currency', e.cur, 'Rate', e.rate].map(q).join(','));
  L.push('');
  L.push(['Charge', 'Amount', 'Currency', 'In Rs.', 'Added to cost'].map(q).join(','));
  e.charges.filter(c => c.amt).forEach(c => L.push([c.name, c.amt, c.cur === 'inv' ? e.cur : 'PKR', impR2(c.pkr), c.inc ? 'Yes' : 'No'].map(q).join(',')));
  L.push('');
  L.push(['Model', 'Description', 'Qty', 'Unit Price (' + e.cur + ')', 'Value (' + e.cur + ')', 'Value Rs.', 'Charges Rs.', 'Landed Rs.', 'Landed / Unit Rs.', 'Sale Price', 'Margin %'].map(q).join(','));
  e.rows.forEach(r => L.push([r.model, r.desc, r.qty, r.price, impR2(r.valCur), impR2(r.valPkr), impR2(r.share), impR2(r.landed), impR2(r.unitCost), r.sale || '', r.margin == null ? '' : r.margin.toFixed(1)].map(q).join(',')));
  L.push(['TOTAL', '', '', '', impR2(e.valCur), impR2(e.totVal), impR2(e.inc), impR2(e.totLanded)].map(q).join(','));
  const blob = new Blob(['\ufeff' + L.join('\r\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = (docFileName('Import Costing ' + (e.ref || e.date), e.supplier, 'Import Costing')).replace(/[\\/:*?"<>|]+/g, '-') + '.csv';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}


/* ---------- PROFIT REPORT (server calculates; Admin / Imports access only) ---------- */
const IMP_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function impRenderProfit(){
  const host = $('impProfit'); if (!host) return;
  const y = new Date().getFullYear();
  const prev = host.dataset.year || String(y), prevM = host.dataset.month || '0';
  host.innerHTML = `<div class="panel-head"><h3>Profit Report</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select id="impPYear" class="imp-in">${[y, y - 1, y - 2, y - 3].map(v => '<option' + (String(v) === prev ? ' selected' : '') + '>' + v + '</option>').join('')}</select>
        <select id="impPMonth" class="imp-in"><option value="0">Whole year</option>${IMP_MONTHS.map((m, i) => '<option value="' + (i + 1) + '"' + (String(i + 1) === prevM ? ' selected' : '') + '>' + m + '</option>').join('')}</select>
        <button class="btn small primary" onclick="impLoadProfit()">Show Profit</button>
      </div></div>
    <div id="impProfitBody" class="muted">Choose a year (and month) and press “Show Profit”. Sales are taken without GST; cost = quantity sold × the product’s current Cost Price.</div>`;
}
async function impLoadProfit(){
  const year = Number($('impPYear').value), month = Number($('impPMonth').value);
  $('impProfit').dataset.year = year; $('impProfit').dataset.month = month;
  const r = await api('getProfit', {year:year, month:month});
  const body = $('impProfitBody');
  if (!r || !r.ok) { body.innerHTML = '<span style="color:#c0392b">' + esc((r && r.error) || 'Could not load profit.') + (r && /unknown action/i.test(r.error || '') ? ' (update the Apps Script backend first)' : '') + '</span>'; return; }
  const t = r.totals, cls = v => v < 0 ? 'amt-due' : 'amt-ok';
  const label = month ? IMP_MONTHS[month - 1] + ' ' + year : String(year);
  body.innerHTML = `<div class="imp-sum">
      <div><span>Sales ${label} (excl. GST)</span><b>${money(t.sales)}</b></div>
      <div><span>Cost of goods sold</span><b>${money(t.cost)}</b></div>
      <div class="hi"><span>Profit</span><b class="${cls(t.profit)}">${money(t.profit)}</b></div>
      <div><span>Profit margin</span><b>${t.marginPct === null ? '—' : t.marginPct.toFixed(1) + '%'}</b></div>
    </div>
    ${t.noCostLines ? '<div class="imp-warn">⚠ ' + t.noCostLines + ' invoice line(s) worth Rs. ' + money(t.noCostSales) + ' have <b>no Cost Price</b> on the product, so their profit is not counted. Import them (or enter a cost) to complete the report.</div>' : ''}
    <h4 style="margin:18px 0 8px">Month by month — ${year}</h4>
    <div class="table-wrap"><table class="imp-table"><thead><tr><th>Month</th><th class="right">Sales</th><th class="right">Cost</th><th class="right">Profit</th></tr></thead><tbody>
      ${r.monthly.map(m => '<tr' + (month === m.month ? ' style="background:#eef0ff"' : '') + '><td>' + IMP_MONTHS[m.month - 1] + '</td><td class="right">' + money(m.sales) + '</td><td class="right">' + money(m.cost) + '</td><td class="right ' + cls(m.profit) + '"><b>' + money(m.profit) + '</b></td></tr>').join('')}
    </tbody></table></div>
    <h4 style="margin:18px 0 8px">By category — ${label}</h4>
    <div class="table-wrap"><table class="imp-table"><thead><tr><th>Category</th><th class="right">Sales</th><th class="right">Cost</th><th class="right">Profit</th></tr></thead><tbody>
      ${r.byCategory.length ? r.byCategory.map(c => '<tr><td>' + esc(c.category) + '</td><td class="right">' + money(c.sales) + '</td><td class="right">' + money(c.cost) + '</td><td class="right ' + cls(c.profit) + '"><b>' + money(c.profit) + '</b></td></tr>').join('') : '<tr><td colspan="4" class="muted">No sales in this period.</td></tr>'}
    </tbody></table></div>
    <h4 style="margin:18px 0 8px">Top products by profit — ${label}</h4>
    <div class="table-wrap"><table class="imp-table"><thead><tr><th>Model</th><th class="right">Qty sold</th><th class="right">Sales</th><th class="right">Cost</th><th class="right">Profit</th></tr></thead><tbody>
      ${r.topProducts.length ? r.topProducts.map(p => '<tr><td><b>' + esc(p.model) + '</b>' + (p.noCost ? ' <span class="imp-tag old">no cost</span>' : '') + '</td><td class="right">' + p.qty + '</td><td class="right">' + money(p.sales) + '</td><td class="right">' + money(p.cost) + '</td><td class="right ' + cls(p.profit) + '"><b>' + money(p.profit) + '</b></td></tr>').join('') : '<tr><td colspan="5" class="muted">No sales in this period.</td></tr>'}
    </tbody></table></div>`;
}
window.impLoadProfit = impLoadProfit;

/* ---------- INVOICE PROFIT REPORT CARDS (Admin / Imports access only) ---------- */
let IMP_INVP = [];
function impRenderInvProfit(){
  const host = $('impInvProfit'); if (!host) return;
  const y = new Date().getFullYear();
  const prev = host.dataset.year || String(y), prevM = host.dataset.month || '0';
  host.innerHTML = `<div class="panel-head"><h3>Invoice Profit Report</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select id="impIPYear" class="imp-in">${[y, y - 1, y - 2, y - 3].map(v => '<option' + (String(v) === prev ? ' selected' : '') + '>' + v + '</option>').join('')}</select>
        <select id="impIPMonth" class="imp-in"><option value="0">Whole year</option>${IMP_MONTHS.map((m, i) => '<option value="' + (i + 1) + '"' + (String(i + 1) === prevM ? ' selected' : '') + '>' + m + '</option>').join('')}</select>
        <input id="impIPSearch" class="imp-in" placeholder="Search invoice / customer" oninput="impDrawInvProfit()">
        <button class="btn small primary" onclick="impLoadInvProfit()">Show Invoices</button>
      </div></div>
    <div id="impInvProfitBody" class="muted">Press “Show Invoices” to see the profit of every invoice made by staff (only invoices whose products have a Cost Price are counted in profit). Click an invoice to open its report card.</div>`;
}
async function impLoadInvProfit(){
  const year = Number($('impIPYear').value), month = Number($('impIPMonth').value);
  $('impInvProfit').dataset.year = year; $('impInvProfit').dataset.month = month;
  const r = await api('getInvoiceProfit', {year:year, month:month});
  const body = $('impInvProfitBody');
  if (!r || !r.ok) { body.innerHTML = '<span style="color:#c0392b">' + esc((r && r.error) || 'Could not load.') + (r && /unknown action/i.test(r.error || '') ? ' (update the Apps Script backend first)' : '') + '</span>'; return; }
  IMP_INVP = r.invoices || []; body.className = ''; body.dataset.tot = JSON.stringify(r.totals || {});
  impDrawInvProfit();
}
function impDrawInvProfit(){
  const body = $('impInvProfitBody'); if (!body || body.className === 'muted') return;
  const q = ($('impIPSearch').value || '').trim().toLowerCase();
  const list = IMP_INVP.filter(i => !q || (i.no + ' ' + i.customer).toLowerCase().indexOf(q) !== -1);
  const cls = v => v < 0 ? 'amt-due' : 'amt-ok';
  const tag = s => s === 'Complete' ? '<span class="imp-tag">Complete</span>' : '<span class="imp-tag old">' + esc(s) + '</span>';
  const t = list.reduce((a, i) => ({sales:a.sales + i.sales, cost:a.cost + i.cost, profit:a.profit + i.profit}), {sales:0, cost:0, profit:0});
  body.innerHTML = `<div class="imp-sum">
      <div><span>Invoices</span><b>${list.length}</b></div>
      <div><span>Sales (excl. GST)</span><b>${money(t.sales)}</b></div>
      <div><span>Cost</span><b>${money(t.cost)}</b></div>
      <div class="hi"><span>Profit</span><b class="${cls(t.profit)}">${money(t.profit)}</b></div></div>
    <div class="table-wrap"><table class="imp-table"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th class="right">Sales</th><th class="right">Cost</th><th class="right">Profit</th><th class="right">Margin</th><th>Costing</th><th></th></tr></thead><tbody>
    ${list.length ? list.map(i => `<tr style="cursor:pointer" onclick="impInvCard('${esc(i.no).replace(/'/g, "\\'")}')">
        <td><b>${esc(i.no)}</b></td><td>${esc(i.date)}</td><td>${esc(i.customer)}</td>
        <td class="right">${money(i.sales)}</td><td class="right">${money(i.cost)}</td>
        <td class="right ${cls(i.profit)}"><b>${money(i.profit)}</b></td>
        <td class="right">${i.marginPct === null ? '—' : i.marginPct.toFixed(1) + '%'}</td>
        <td>${tag(i.status)}</td><td><button class="btn small">Report</button></td></tr>`).join('') : '<tr><td colspan="9" class="muted">No invoices found.</td></tr>'}
    </tbody></table></div>`;
}
function impInvCard(no){
  const i = IMP_INVP.find(x => x.no === no); if (!i) return;
  const cls = v => v < 0 ? 'amt-due' : 'amt-ok';
  const html = `<div id="impInvCard">
    <div class="imp-sum">
      <div><span>Sales (excl. GST)</span><b>${money(i.sales)}</b></div>
      <div><span>Cost</span><b>${money(i.cost)}</b></div>
      <div class="hi"><span>Profit</span><b class="${cls(i.profit)}">${money(i.profit)}</b></div>
      <div><span>Margin</span><b>${i.marginPct === null ? '—' : i.marginPct.toFixed(1) + '%'}</b></div></div>
    ${i.status !== 'Complete' ? '<div class="imp-warn">⚠ Rs. ' + money(i.noCostSales) + ' of this invoice has <b>no Cost Price</b> on the product, so that part is not counted in the profit.</div>' : ''}
    <div class="table-wrap"><table class="imp-table"><thead><tr><th>Model</th><th>Description</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th><th class="right">Unit cost</th><th class="right">Cost</th><th class="right">Profit</th></tr></thead><tbody>
    ${i.lines.map(l => `<tr><td>${esc(l.model)}</td><td>${esc(l.desc)}</td><td class="right">${l.qty}</td><td class="right">${money(l.rate)}</td><td class="right">${money(l.amount)}</td>
      <td class="right">${l.unitCost === null ? '<span class="imp-tag old">no cost</span>' : money(l.unitCost)}</td><td class="right">${l.unitCost === null ? '—' : money(l.cost)}</td>
      <td class="right ${l.profit === null ? '' : cls(l.profit)}">${l.profit === null ? '—' : '<b>' + money(l.profit) + '</b>'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="muted small" style="margin-top:8px">Cost = quantity × the product’s current Cost Price. Confidential — visible only to Admin and Imports users.</div>
    <div style="margin-top:12px"><button class="btn primary" onclick="impInvCardPrint('${esc(i.no).replace(/'/g, "\\'")}')">Print / PDF</button></div></div>`;
  modal('Profit Report — Invoice ' + i.no + ' • ' + i.customer, html);
}
function impInvCardPrint(no){
  const i = IMP_INVP.find(x => x.no === no); if (!i) return;
  const h = `<h2 style="margin:0 0 4px">Invoice Profit Report (CONFIDENTIAL)</h2>
    <div style="margin-bottom:10px">Invoice <b>${esc(i.no)}</b> • ${esc(i.date)} • ${esc(i.customer)}</div>
    <table class="doc-items"><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Amount</th><th>Unit cost</th><th>Cost</th><th>Profit</th></tr></thead><tbody>
    ${i.lines.map(l => `<tr><td>${esc(l.model)}</td><td>${esc(l.desc)}</td><td>${l.qty}</td><td>${money(l.amount)}</td><td>${l.unitCost === null ? 'no cost' : money(l.unitCost)}</td><td>${l.unitCost === null ? '—' : money(l.cost)}</td><td>${l.profit === null ? '—' : money(l.profit)}</td></tr>`).join('')}
    </tbody></table>
    <p style="margin-top:12px"><b>Sales (excl. GST):</b> ${money(i.sales)} &nbsp; <b>Cost:</b> ${money(i.cost)} &nbsp; <b>Profit:</b> ${money(i.profit)} &nbsp; <b>Margin:</b> ${i.marginPct === null ? '—' : i.marginPct.toFixed(1) + '%'}</p>`;
  printDoc(h, '', docFileName('Profit ' + i.no, i.customer, 'Invoice Profit'));
}
window.impLoadInvProfit = impLoadInvProfit; window.impDrawInvProfit = impDrawInvProfit; window.impInvCard = impInvCard; window.impInvCardPrint = impInvCardPrint;

/* ---------- past imports (stored on the server) ---------- */
function impRenderHistory(){
  const host = $('impHistory'); if (!host) return;
  const list = impHistory();
  host.innerHTML = '<div class="panel-head"><h3>Past Imports</h3><span class="muted small">Stored on the server — visible only to Admin and users with Imports access.</span></div>'
    + (list.length ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Supplier</th><th>Ref</th><th class="right">Items</th><th class="right">Landed Cost (Rs.)</th><th></th></tr></thead><tbody>'
      + list.slice(0, 20).map(e => `<tr><td>${fmtDate(e.date)}</td><td>${esc(e.supplier)}</td><td>${esc(e.ref)}</td><td class="right">${e.rows.length}</td><td class="right"><b>${money(e.totLanded)}</b></td>
          <td style="white-space:nowrap"><button class="btn small" onclick="impViewEntry('${e.id}')">View</button></td></tr>`).join('')
      + '</tbody></table></div>' : '<div class="muted">No imports saved yet.</div>');
}
function impViewEntry(id){ const e = impFindEntry(id); if (e) modal('Import Costing — ' + (e.ref || fmtDate(e.date)), impSheetModalHtml(e, false)); }
window.renderImports = renderImports; window.impHdr = impHdr; window.impChg = impChg; window.impAddCharge = impAddCharge; window.impDelCharge = impDelCharge;
window.impSet = impSet; window.impAddRow = impAddRow; window.impDelRow = impDelRow; window.impModel = impModel; window.impPasteForm = impPasteForm; window.impPasteApply = impPasteApply;
window.impPreview = impPreview; window.impSave = impSave; window.impClear = impClear; window.impPrintSheet = impPrintSheet; window.impCsv = impCsv;
window.impViewEntry = impViewEntry;

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
        if (r.error === 'Unauthorized') sessionStorage.clear();   // do not clear the session on a network error
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
window.renderQuotation=renderQuotation;window.pickQuotationCustomer=pickQuotationCustomer;window.addQuotationLine=addQuotationLine;window.removeQuotationLine=removeQuotationLine;window.quotationModelChanged=quotationModelChanged;window.updateQuotationTotal=updateQuotationTotal;window.saveQuotation=saveQuotation;window.reviseQuotation=reviseQuotation;window.quotationCustomerBlur=quotationCustomerBlur;window.printQuotationFromForm=printQuotationFromForm;window.loadQTHistory=loadQTHistory;window.filterQTHistory=filterQTHistory;window.viewQuotation=viewQuotation;window.renderEnquiries=renderEnquiries;window.enquiryForm=enquiryForm;window.saveEnquiry=saveEnquiry;window.filterEnquiries=filterEnquiries;window.makeQuotationFromEnquiry=makeQuotationFromEnquiry;window.viewEnquiryQuotation=viewEnquiryQuotation;window.quotationStatusForm=quotationStatusForm;window.saveQuotationStatus=saveQuotationStatus;
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
window.renderProductSales = renderProductSales;
window.psSet = psSet;
window.psCsv = psCsv;
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
   existing function, data or variable).
   Purpose:
     - Top loading bar on every button / link / navigation click
     - Loading bar on page changes through showPage()
     - Bar while backend API calls (fetch / XHR) are running
     - Loading bar on initial load, reload, and back/forward navigation
   Manual: SFSLoader.start() | SFSLoader.finish() | SFSLoader.pulse()
   To disable it: add class="no-loader" to a button.
   ============================================================ */
(function () {
  'use strict';
  if (window.SFSLoader && window.SFSLoader.__v) return;   // double-load guard

  var MIN_SHOW = 420, TRICKLE_MS = 250, MAX_TRICKLE = 92;

  /* ---------- CSS (not injected if index.html already contains it) ---------- */
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

  /* ---------- Bar element (not created again if index.html already contains it) ---------- */
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
     HOOKS  (all inside try/catch — no effect on the app)
     ============================================================ */
  var safe = function (fn) { try { fn(); } catch (e) { /* the app must never break */ } };

  /* 1) First page load */
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

  /* 4) fetch() — the bar keeps running until the backend data arrives */
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

  /* 5) XMLHttpRequest (if used anywhere) */
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

  /* 6) SPA router — showPage() wrap (available because this block runs after app.js) */
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

/* ============================================================
   SFS — UNSAVED CHANGES PROTECTION
   ------------------------------------------------------------
   Visual/UX safety feature:
   - Detects unfinished form work before changing ERP pages.
   - Gives: Save & Continue / Discard / Cancel.
   - Uses the existing Save/Update button of the current module.
   - Does not change backend, API, data model or existing save functions.
   ============================================================ */
(function(){
  'use strict';

  if (window.SFSUnsavedChanges && window.SFSUnsavedChanges.__v) return;

  var dirty = false;
  var baseline = '';
  var currentPage = '';
  var pendingNav = null;
  var bypass = false;
  var observer = null;

  function controls(){
    var root = document.getElementById('content');
    if (!root) return [];
    return Array.prototype.slice.call(root.querySelectorAll('input,select,textarea'))
      .filter(function(el){
        if (el.disabled) return false;
        if (el.closest('.toolbar')) return false;
        if (el.closest('.table-wrap')) return false;
        if (el.closest('.no-dirty-track')) return false;
        if (el.type === 'button' || el.type === 'submit' || el.type === 'reset') return false;
        if (el.type === 'search') return false;
        if (typeof sfsIsFilterControl === 'function' && sfsIsFilterControl(el)) return false;   /* list search / filter boxes are not unsaved work */
        return true;
      });
  }

  function state(){
    return controls().map(function(el){
      var v;
      if (el.type === 'checkbox' || el.type === 'radio') v = el.checked ? '1' : '0';
      else v = el.value == null ? '' : String(el.value);
      return el.name + '|' + el.id + '|' + el.type + '|' + v;
    }).join('||');
  }

  function markClean(page){
    baseline = state();
    dirty = false;
    currentPage = page || currentPage;
  }

  function checkDirty(){
    if (!baseline) return false;
    dirty = state() !== baseline;
    return dirty;
  }

  function css(){
    if (document.getElementById('sfsUnsavedStyles')) return;
    var s = document.createElement('style');
    s.id = 'sfsUnsavedStyles';
    s.textContent = [
      '#sfsUnsavedOverlay{position:fixed;inset:0;background:rgba(17,43,75,.38);backdrop-filter:blur(3px);',
        'display:flex;align-items:center;justify-content:center;padding:20px;z-index:2147482500}',
      '#sfsUnsavedBox{width:min(440px,100%);background:#fff;border:1px solid #DCE7F3;border-radius:14px;',
        'box-shadow:0 22px 60px rgba(20,55,95,.22);padding:26px 28px;font-family:Inter,Arial,sans-serif}',
      '#sfsUnsavedIcon{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
        'background:#FFF5DF;color:#E89B12;font-size:23px;font-weight:700;margin-bottom:14px}',
      '#sfsUnsavedBox h3{margin:0 0 8px;color:#17345F;font-size:20px}',
      '#sfsUnsavedBox p{margin:0 0 22px;color:#647B99;font-size:13.5px;line-height:1.6}',
      '#sfsUnsavedActions{display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap}',
      '#sfsUnsavedActions button{border:1px solid #D2DEEC;background:#fff;color:#284A78;border-radius:7px;',
        'padding:9px 14px;font:600 13px Inter,Arial,sans-serif;cursor:pointer}',
      '#sfsUnsavedActions button:hover{background:#F5F8FD}',
      '#sfsUnsavedSave{background:#2F80ED!important;border-color:#2F80ED!important;color:#fff!important}',
      '#sfsUnsavedSave:hover{background:#1769D2!important;border-color:#1769D2!important}',
      '#sfsUnsavedDiscard{color:#D44747!important;border-color:#F0C8C8!important}',
      '@media(max-width:560px){#sfsUnsavedBox{padding:22px}.#sfsUnsavedActions{justify-content:stretch}#sfsUnsavedActions button{flex:1}}'
    ].join('');
    document.head.appendChild(s);
  }

  function closePrompt(){
    var x = document.getElementById('sfsUnsavedOverlay');
    if (x) x.remove();
  }

  function navigate(){
    var n = pendingNav;
    pendingNav = null;
    dirty = false;
    baseline = '';
    if (!n) return;
    bypass = true;
    try {
      originalShowPage.apply(window, n.args);
    } finally {
      bypass = false;
      setTimeout(function(){ markClean(n.args[0] || ''); }, 0);
    }
  }

  function findSaveButton(){
    var root = document.getElementById('content');
    if (!root) return null;
    var buttons = Array.prototype.slice.call(root.querySelectorAll('button'));
    var good = buttons.filter(function(b){
      if (b.disabled || b.closest('.no-save-detect')) return false;
      var t = (b.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      return /^(save|update|submit|create)\b/.test(t) ||
             /\b(save|update)\b/.test(t);
    });
    return good[0] || null;
  }

  function saveAndNavigate(){
    var save = findSaveButton();
    if (!save){
      closePrompt();
      alert('Current page has unsaved work, but no Save/Update button was found.');
      return;
    }

    closePrompt();
    save.click();

    /* Existing save functions call api(), which increments SFS_BUSY.
       Wait for those existing requests to finish before moving away. */
    var started = Date.now();
    var timer = setInterval(function(){
      var elapsed = Date.now() - started;
      var busy = (typeof SFS_BUSY !== 'undefined') ? SFS_BUSY : 0;
      if (busy === 0 && elapsed > 350 || elapsed > 15000){
        clearInterval(timer);
        dirty = false;
        baseline = '';
        navigate();
      }
    }, 150);
  }

  function prompt(args){
    pendingNav = {args: args};
    css();
    closePrompt();

    var o = document.createElement('div');
    o.id = 'sfsUnsavedOverlay';
    o.innerHTML =
      '<div id="sfsUnsavedBox" role="dialog" aria-modal="true" aria-labelledby="sfsUnsavedTitle">' +
        '<div id="sfsUnsavedIcon">!</div>' +
        '<h3 id="sfsUnsavedTitle">Unsaved Changes</h3>' +
        '<p>You have unfinished work on this page. Do you want to save it before leaving?</p>' +
        '<div id="sfsUnsavedActions">' +
          '<button type="button" id="sfsUnsavedCancel">Cancel</button>' +
          '<button type="button" id="sfsUnsavedDiscard">Discard</button>' +
          '<button type="button" id="sfsUnsavedSave">Save &amp; Continue</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(o);
    document.getElementById('sfsUnsavedCancel').onclick = closePrompt;
    document.getElementById('sfsUnsavedDiscard').onclick = function(){
      closePrompt();
      navigate();
    };
    document.getElementById('sfsUnsavedSave').onclick = saveAndNavigate;

    o.addEventListener('click', function(e){
      if (e.target === o) closePrompt();
    });
  }

  /* The original router remains untouched; this wrapper only guards navigation. */
  var originalShowPage = window.showPage;
  if (typeof originalShowPage !== 'function') return;

  window.showPage = function(){
    var args = Array.prototype.slice.call(arguments);
    if (!bypass && checkDirty()){
      prompt(args);
      return false;
    }
    var out = originalShowPage.apply(window, args);
    setTimeout(function(){ markClean(args[0] || ''); }, 0);
    return out;
  };
  window.showPage.__sfsUnsavedWrapped = true;

  /* Any actual edit marks the current page dirty. */
  document.addEventListener('input', function(e){
    if (!e.target || !e.target.closest('#content')) return;
    if (e.target.closest('.toolbar') || e.target.closest('.no-dirty-track')) return;
    setTimeout(checkDirty, 0);
  }, true);

  document.addEventListener('change', function(e){
    if (!e.target || !e.target.closest('#content')) return;
    if (e.target.closest('.toolbar') || e.target.closest('.no-dirty-track')) return;
    setTimeout(checkDirty, 0);
  }, true);

  /* Adding/removing invoice/DC/quotation lines is also considered work. */
  document.addEventListener('click', function(e){
    var el = e.target && e.target.closest ? e.target.closest('#content button') : null;
    if (!el || el.closest('.no-dirty-track') || el.closest('.toolbar')) return;
    var t = (el.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
    if (/^(\+\s*)?(add|remove|delete|edit line|new line)\b/.test(t)){
      setTimeout(checkDirty, 30);
    }
  }, true);

  /* Mark the currently rendered page clean after initial/router renders. */
  setTimeout(function(){
    var active = document.querySelector('.navbtn.active');
    var m = active && active.getAttribute('onclick') && active.getAttribute('onclick').match(/'([^']+)'/);
    markClean(m ? m[1] : '');
  }, 100);

  window.SFSUnsavedChanges = {
    __v:'1.0',
    isDirty:function(){ return checkDirty(); },
    markClean:markClean,
    discard:function(){ dirty=false; baseline=''; navigate(); }
  };
})();

/* ============================================================
   NOTIFICATION BELL (header)
   Low Stock • Overdue Payments • Pending Enquiries
   Read-only add-on: only reads data the ERP already loads, never saves anything.
   Respects module access: each section shows only if the user can open that module.
   ============================================================ */
(function(){
  var NB = {low:[], overdue:[], soon:[], enq:[], loading:false, loadedAt:0};

  function canSee(mod){ try { return typeof hasMod === 'function' && hasMod(mod); } catch(e){ return false; } }

  function ensureBell(){
    var host = document.querySelector('header .header-actions');
    if (!host || document.getElementById('nbBell')) return;
    var st = document.createElement('style');
    st.textContent = '#nbBell{position:relative;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;padding:0}'
      + '#nbBell svg{width:19px;height:19px}'
      + '#nbBell .nb-count{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#c0392b;color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;box-shadow:0 0 0 2px #fff}'
      + '#nbBell .nb-count.hidden{display:none}'
      + '.nb-sec{margin:0 0 18px}.nb-sec h4{margin:0 0 8px;display:flex;justify-content:space-between;align-items:center;gap:10px}'
      + '.nb-sec .table-wrap{max-height:260px;overflow:auto}.nb-empty{color:#1a7f3c;font-weight:600;padding:6px 0}'
      + '@media print{#nbBell{display:none!important}}';
    document.head.appendChild(st);
    var b = document.createElement('button');
    b.id = 'nbBell'; b.type = 'button'; b.className = 'btn'; b.title = 'Notifications';
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span class="nb-count hidden" id="nbCount">0</span>';
    b.onclick = function(){ openPanel(); };
    host.insertBefore(b, host.firstChild);
  }

  function setCount(){
    var el = document.getElementById('nbCount'); if (!el) return;
    var n = NB.low.length + NB.overdue.length + NB.enq.length;
    el.textContent = n > 99 ? '99+' : String(n);
    el.classList.toggle('hidden', n === 0);
    var b = document.getElementById('nbBell');
    if (b) b.title = n ? (n + ' notification' + (n === 1 ? '' : 's')) : 'No notifications';
  }

  async function load(){
    if (NB.loading || typeof S === 'undefined' || !S.user) return;
    NB.loading = true;
    try {
      /* 1. Low stock: same rule as the Dashboard (uses the products already loaded) */
      NB.low = (S.products || []).filter(function(p){ return Number(p.currentStock) <= reorderOf(p) && (p.Status || 'Active') === 'Active'; })
        .sort(function(a, b){ return Number(a.currentStock) - Number(b.currentStock); });

      /* 2. Overdue / due soon: same rule as "Payments Due & Overdue" */
      NB.overdue = []; NB.soon = [];
      if (canSee('accounts')) {
        var r = await api('getOutstanding', {});
        if (r && r.ok) {
          var canonName = pdCanonName();
          (r.rows || []).forEach(function(x){
            if (!(Number(x.outstanding) > 0.5)) return;
            var cust = canonName(x.customer), t = paymentTermsOf(cust), di = dueInfo(x.date, t.days);
            if (!di) return;
            var row = {no:x.no, customer:cust, due:di.due, daysOver:di.daysOver, outstanding:Number(x.outstanding)};
            if (di.daysOver > 0) NB.overdue.push(row); else if (di.daysOver >= -7) NB.soon.push(row);
          });
          NB.overdue.sort(function(a, b){ return b.daysOver - a.daysOver; });
          NB.soon.sort(function(a, b){ return b.daysOver - a.daysOver; });
        }
      }

      /* 3. Pending enquiries: status "New" */
      NB.enq = [];
      if (canSee('enquiries') || canSee('sales')) {
        var e = await api('getEnquiries');
        if (e && e.ok) NB.enq = (e.documents || []).filter(function(d){ return (d.status || 'New') === 'New'; });
      }
      NB.loadedAt = Date.now();
    } catch (err) {
      /* a notification problem must never disturb the rest of the ERP */
    } finally {
      NB.loading = false;
      setCount();
    }
  }

  function daysTxt(n){ return n + ' day' + (n === 1 ? '' : 's'); }

  function panelHtml(){
    var h = '';
    var low = NB.low, ov = NB.overdue, so = NB.soon, en = NB.enq;
    var sum = function(l){ return l.reduce(function(a, x){ return a + x.outstanding; }, 0); };

    if (canSee('accounts')) {
      h += '<div class="nb-sec"><h4><span style="color:#c0392b">Overdue Payments (' + ov.length + ')' + (ov.length ? ' — ' + money(sum(ov)) : '') + '</span>'
        + '<button class="btn small" onclick="closeModal();showPage(\'accounts\')">Open Accounts →</button></h4>'
        + (ov.length ? '<div class="table-wrap"><table><thead><tr><th>Invoice #</th><th>Client</th><th>Due Date</th><th>Overdue</th><th>Outstanding</th></tr></thead><tbody>'
          + ov.map(function(x){ return '<tr><td><b>' + esc(x.no) + '</b></td><td>' + esc(x.customer) + '</td><td>' + fmtDate(x.due) + '</td><td><b style="color:#c0392b">' + daysTxt(x.daysOver) + '</b></td><td><b>' + money(x.outstanding) + '</b></td></tr>'; }).join('')
          + '</tbody></table></div>' : '<div class="nb-empty">✓ No overdue payments.</div>')
        + (so.length ? '<div class="muted small" style="margin-top:6px">Also due in the next 7 days: <b>' + so.length + '</b> invoice(s), ' + money(sum(so)) + '</div>' : '')
        + '</div>';
    }
    if ((S.products || []).length) {
      h += '<div class="nb-sec"><h4><span style="color:#c0392b">Low Stock (' + low.length + ')</span>'
        + '<button class="btn small" onclick="closeModal();openLowStock()">Open Low Stock →</button></h4>'
        + (low.length ? '<div class="table-wrap"><table><thead><tr><th>Model / Part No.</th><th>Description</th><th>Stock</th><th>Reorder Level</th></tr></thead><tbody>'
          + low.map(function(p){ var s = Number(p.currentStock); return '<tr><td><b>' + esc(p['Model / Part No.']) + '</b></td><td>' + esc(String(p.Description || '').slice(0, 70)) + '</td><td><b style="color:' + (s <= 0 ? '#c0392b' : '#d97706') + '">' + esc(p.currentStock) + '</b></td><td>' + reorderOf(p) + '</td></tr>'; }).join('')
          + '</tbody></table></div>' : '<div class="nb-empty">✓ No low stock items.</div>')
        + '</div>';
    }
    if (canSee('enquiries') || canSee('sales')) {
      h += '<div class="nb-sec"><h4><span style="color:#b86e00">Pending Enquiries (' + en.length + ')</span>'
        + '<button class="btn small" onclick="closeModal();showPage(\'enquiries\')">Open Enquiries →</button></h4>'
        + (en.length ? '<div class="table-wrap"><table><thead><tr><th>Enquiry #</th><th>Date</th><th>Customer</th><th>Requirement</th></tr></thead><tbody>'
          + en.map(function(d){ return '<tr><td><b>' + esc(d.id) + '</b></td><td>' + fmtDate(d.date) + '</td><td>' + esc(d.customerName) + '</td><td>' + esc(String(d.requirement || '').slice(0, 80)) + '</td></tr>'; }).join('')
          + '</tbody></table></div>' : '<div class="nb-empty">✓ No pending enquiries.</div>')
        + '</div>';
    }
    if (!h) h = '<div class="muted">No notifications for your modules.</div>';
    var when = NB.loadedAt ? new Date(NB.loadedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
    return h + '<div class="actions"><span class="muted small" style="margin-right:auto">' + (when ? 'Updated ' + when : '') + '</span>'
      + '<button class="btn" onclick="SFSNotify.reload(true)">↻ Check again</button><button class="btn primary" onclick="closeModal()">Close</button></div>';
  }

  async function openPanel(){
    modal('Notifications', '<div class="muted">Checking…</div>');
    if (!NB.loadedAt || Date.now() - NB.loadedAt > 60000) await load();
    if (!$('modal').classList.contains('hidden') && $('modalTitle').textContent === 'Notifications') $('modalBody').innerHTML = panelHtml();
  }

  /* Start once the user is logged in; re-check every 10 minutes and after every ↻ Refresh */
  var started = false;
  function tick(){
    if (typeof S === 'undefined' || !S.user || !document.querySelector('header .header-actions')) return;
    var app = document.getElementById('app');
    if (app && app.classList.contains('hidden')) return;
    ensureBell();
    if (!started) { started = true; load(); }
  }
  setInterval(tick, 1500);
  setInterval(function(){ if (started) load(); }, 10 * 60 * 1000);

  var origRefresh = window.refresh;
  if (typeof origRefresh === 'function') {
    window.refresh = async function(){
      var res = await origRefresh.apply(this, arguments);
      if (started) load();
      return res;
    };
  }

  window.SFSNotify = {
    reload:async function(reopen){ await load(); if (reopen && !$('modal').classList.contains('hidden') && $('modalTitle').textContent === 'Notifications') $('modalBody').innerHTML = panelHtml(); },
    data:function(){ return NB; }
  };
})();


/* ============================================================
   USER ACTIVITY (Reports page, Admin only, read-only)
   Who made which document + every save / edit / status change.
   ============================================================ */
const UA = {data:null, year:'', month:'', user:'', q:'', show:150};
const UA_ACTIONS = {
  saveQuotation:'Created quotation', updateQuotation:'Edited quotation', updateQuotationStatus:'Changed quotation status',
  saveDC:'Created delivery challan', dc:'Created delivery challan', updateDC:'Edited delivery challan',
  saveInvoice:'Created invoice', invoice:'Created invoice', updateInvoice:'Edited invoice',
  savePayment:'Received payment', saveSupplierPayment:'Paid supplier',
  saveInward:'Stock inward', inward:'Stock inward', saveImportCosting:'Saved import costing',
  saveProduct:'Added product', product:'Added product', updateProduct:'Edited product', setProductStatus:'Changed product status',
  saveCustomer:'Added customer', updateCustomer:'Edited customer', setCustomerStatus:'Changed customer status',
  saveSupplier:'Added supplier', updateSupplier:'Edited supplier', setSupplierStatus:'Changed supplier status',
  saveEnquiry:'Created enquiry', saveTarget:'Set sales target',
  saveUser:'Added user', updateUser:'Edited user', disableUser:'Disabled user', changePassword:'Changed password',
  refreshSource:'Refreshed source data', sync:'Refreshed source data'
};
const UA_TYPES = ['Quotation','Delivery Challan','Invoice','Payment Received','Enquiry','Inward','Supplier Payment'];

function uaName(un){
  const k = String(un || '').trim(); if (!k || k === '~none') return '(not recorded)'; if (k.toLowerCase() === 'email') return 'Email (automatic)';
  const n = UA.data && UA.data.names ? UA.data.names[k.toLowerCase()] : '';
  return n && n.toLowerCase() !== k.toLowerCase() ? n + ' (' + k + ')' : (n || k);
}
function uaInMonth(v){ if (UA.month === '') return true; const d = new Date(v); return !isNaN(d) && d.getMonth() === Number(UA.month); }
function uaWhen(v){ const d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}) + ' ' + d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }

async function loadUserActivity(year, month){
  const host = $('uaSection'); if (!host) return;
  UA.year = String(year || ''); UA.month = month === undefined ? '' : String(month);
  host.innerHTML = '<div class="panel"><h3>User Activity</h3><div class="muted">Loading…</div></div>';
  const r = await api('getUserActivity', {year:Number(year) || new Date().getFullYear()});
  const h2 = $('uaSection'); if (!h2) return;
  if (!r || !r.ok) {
    const unknown = r && /unknown action/i.test(r.error || '');
    h2.innerHTML = '<div class="panel"><h3>User Activity</h3><div style="color:#c0392b">' + esc((r && r.error) || 'Could not load.') + (unknown ? ' — paste the new Code.gs in Apps Script and deploy a New version.' : '') + '</div></div>';
    return;
  }
  UA.data = r; drawUserActivity();
}

function drawUserActivity(){
  const host = $('uaSection'); if (!host || !UA.data) return;
  const d = UA.data;
  const docs = (d.docs || []).filter(x => uaInMonth(x.date));
  const audit = (d.audit || []).filter(x => uaInMonth(x.time));
  /* one row per user */
  const by = {};
  const row = un => { const k = String(un || '').trim().toLowerCase() || '(not recorded)'; return by[k] || (by[k] = {un:String(un || '').trim() || '~none', t:{}, amt:{}, actions:0, edits:0, last:null}); };
  (d.users || []).forEach(u => row(u.username));
  docs.forEach(x => { const g = row(x.user); g.t[x.type] = (g.t[x.type] || 0) + 1; g.amt[x.type] = (g.amt[x.type] || 0) + (Number(x.amount) || 0); const t = new Date(x.date); if (!isNaN(t) && (!g.last || t > g.last)) g.last = t; });
  audit.forEach(x => { const g = row(x.user); g.actions++; if (/^(update|set|disable)/.test(x.action)) g.edits++; const t = new Date(x.time); if (!isNaN(t) && (!g.last || t > g.last)) g.last = t; });
  const rows = Object.values(by).filter(g => g.un !== 'Email' || Object.keys(g.t).length);
  rows.sort((a, b) => (b.actions + Object.values(b.t).reduce((s, n) => s + n, 0)) - (a.actions + Object.values(a.t).reduce((s, n) => s + n, 0)));
  const cell = (g, type, withAmt) => { const n = g.t[type] || 0; if (!n) return '<td class="muted">—</td>'; return '<td><b>' + n + '</b>' + (withAmt && g.amt[type] ? '<div class="muted small">' + money(g.amt[type]) + '</div>' : '') + '</td>'; };
  const period = (UA.month === '' ? 'Year ' : PS_MONTHS[Number(UA.month)] + ' ') + UA.year;

  const userOpts = rows.map(g => '<option value="' + esc(g.un) + '"' + (g.un === UA.user ? ' selected' : '') + '>' + esc(uaName(g.un)) + '</option>').join('');
  const selU = UA.user.toLowerCase(), q = norm(UA.q);
  const userKey = u => String(u || '').trim().toLowerCase() || '~none';
  /* a saved document is already listed with its amount, so hide its duplicate "Created …" audit line */
  const docNos = new Set(docs.map(x => String(x.no)));
  const dupSave = x => /^(save|invoice$|dc$|inward$|product$)/.test(x.action) && /(?:^|;\s*)id=([^;]+)/.test(x.details || '') && docNos.has(String(x.details).match(/(?:^|;\s*)id=([^;]+)/)[1].trim());
  /* combined timeline: documents + audit entries */
  let tl = audit.filter(x => !dupSave(x)).map(x => ({t:new Date(x.time), user:x.user, what:UA_ACTIONS[x.action] || x.action, det:String(x.details || '').replace(/;\s*/g, ' · '), kind:'a'}))
    .concat(docs.map(x => ({t:new Date(x.date), user:x.user, what:x.type + ' ' + x.no, det:[x.party, x.amount ? money(x.amount) : '', x.qty ? x.qty + ' qty' : ''].filter(Boolean).join(' · '), kind:'d'})));
  tl = tl.filter(x => (!selU || userKey(x.user) === selU) && (!q || norm(x.what + ' ' + x.det + ' ' + uaName(x.user)).includes(q)));
  tl.sort((a, b) => (b.t - a.t) || (a.kind === 'a' ? -1 : 1));
  const shown = tl.slice(0, UA.show);

  host.innerHTML = '<div class="panel"><div class="panel-head"><div><h3 style="margin:0">User Activity — ' + esc(period) + '</h3>'
    + '<div class="muted small">Who made what (from each document\'s “Created By”) and every save / edit / status change (Audit Log). Only Admin can see this.</div></div></div>'
    + '<div class="table-wrap"><table><thead><tr><th>User</th><th>Quotations</th><th>Delivery Challans</th><th>Invoices</th><th>Payments Recv.</th><th>Enquiries</th><th>Inward</th><th>Supplier Pay.</th><th>Edits / Changes</th><th>All Actions</th><th>Last Active</th></tr></thead><tbody>'
    + (rows.length ? rows.map(g => '<tr style="cursor:pointer" title="Show this user\'s activity" onclick="uaPickUser(\'' + encA(g.un) + '\')"><td><b>' + esc(uaName(g.un)) + '</b></td>'
        + cell(g, 'Quotation', true) + cell(g, 'Delivery Challan') + cell(g, 'Invoice', true) + cell(g, 'Payment Received', true) + cell(g, 'Enquiry') + cell(g, 'Inward') + cell(g, 'Supplier Payment', true)
        + '<td>' + (g.edits ? '<b>' + g.edits + '</b>' : '<span class="muted">—</span>') + '</td><td>' + (g.actions ? '<b>' + g.actions + '</b>' : '<span class="muted">—</span>') + '</td>'
        + '<td>' + (g.last ? esc(fmtDate(g.last)) : '<span class="muted">No activity</span>') + '</td></tr>').join('') : '<tr><td colspan="11" class="muted">No activity in this period.</td></tr>')
    + '</tbody></table></div>'
    + '<h4 style="margin:18px 0 8px">Activity Log</h4>'
    + '<div class="toolbar" style="flex-wrap:wrap"><select id="uaUser" onchange="uaPickUser(encodeURIComponent(this.value))"><option value="">All users</option>' + userOpts + '</select>'
    + '<input id="uaQ" type="search" placeholder="Search customer, document #, action…" value="' + esc(UA.q) + '" oninput="uaSearch(this.value)" style="flex:1;min-width:220px">'
    + '<span class="muted small">Showing ' + shown.length + ' of ' + tl.length + '</span></div>'
    + '<div class="table-wrap" style="max-height:480px;overflow:auto"><table><thead><tr><th>When</th><th>User</th><th>What</th><th>Details</th></tr></thead><tbody>'
    + (shown.length ? shown.map(x => '<tr><td style="white-space:nowrap">' + esc(x.kind === 'a' ? uaWhen(x.t) : fmtDate(x.t)) + '</td><td>' + esc(uaName(x.user)) + '</td><td><b>' + esc(x.what) + '</b></td><td class="muted">' + esc(x.det) + '</td></tr>').join('') : '<tr><td colspan="4" class="muted">Nothing found.</td></tr>')
    + '</tbody></table></div>'
    + (tl.length > shown.length ? '<div style="margin-top:8px"><button class="btn small" onclick="UA.show+=300;drawUserActivity()">Show more</button></div>' : '')
    + ((d.audit || []).length ? '' : '<div class="muted small" style="margin-top:8px">The Audit Log has no entries for this year yet — edits and status changes appear here from now on.</div>')
    + '</div>';
  const qi = $('uaQ'); if (qi && UA._focus) { qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length); UA._focus = false; }
}
function uaPickUser(enc){ UA.user = decodeURIComponent(enc || ''); UA.show = 150; drawUserActivity(); const s = $('uaUser'); if (s) s.scrollIntoView({block:'nearest'}); }
function uaSearch(v){ UA.q = v; UA.show = 150; UA._focus = true; drawUserActivity(); }
window.loadUserActivity = loadUserActivity; window.drawUserActivity = drawUserActivity; window.uaPickUser = uaPickUser; window.uaSearch = uaSearch;

/* ============================================================
   NEW DASHBOARD (Oct 2026)
   Quick actions • KPI cards • Sales vs Target • Today's to-do •
   Overdue clients • Pipeline • Top customers • Team activity (Admin) •
   Search (Ctrl+K).  Read-only: it only reads data the ERP already serves.
   The previous dashboard is kept under "Detailed views" (loads on demand).
   ============================================================ */
const DB2 = {data:{}, seq:0, pipe:'month'};

function db2Short(n){
  n = Number(n) || 0; const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e7) return s + (a / 1e7).toFixed(a >= 1e8 ? 1 : 2).replace(/\.?0+$/, '') + ' Cr';
  if (a >= 1e5) return s + (a / 1e5).toFixed(a >= 1e6 ? 1 : 2).replace(/\.?0+$/, '') + ' Lac';
  return s + Math.round(a).toLocaleString('en-US');
}
function db2Day(v){ const d = new Date(v); return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function db2Can(m){ try { return hasMod(m); } catch (e) { return false; } }
function db2Go(page, after){
  const btn = document.querySelector('.navbtn[onclick*="\'' + page + '\'"]');
  if (showPage(page, btn || undefined) === false) return;
  if (after) setTimeout(after, 0);
}
function db2OpenDoc(page, field, noEnc){
  db2Go(page, () => { const el = $(field); if (el) { el.value = decodeURIComponent(noEnc); el.dispatchEvent(new Event('input', {bubbles:true})); } });
}
function db2SetFilter(id, value, fn){ const el = $(id); if (el) { el.value = value; if (typeof fn === 'function') fn(); } }

function renderDashboard(){
  const host = $('dash'); if (!host) return;
  const seq = ++DB2.seq; DB2.data = {};
  const now = new Date(), h = now.getHours();
  const hello = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first = String((S.user && (S.user.name || S.user.username)) || '').split(' ')[0];
  const qa = [
    {k:'Q', label:'New Quotation', icon:'＋', color:'#2563eb', mod:'sales', go:() => db2Go('quotations')},
    {k:'E', label:'New Enquiry', icon:'✉', color:'#7c3aed', mod:'enquiries', go:() => db2Go('enquiries', () => { if (typeof enquiryForm === 'function') enquiryForm(); })},
    {k:'D', label:'Delivery Challan', icon:'⛟', color:'#0891b2', mod:'sales', go:() => db2Go('dc')},
    {k:'I', label:'New Invoice', icon:'▤', color:'#1f3b63', mod:'sales', go:() => db2Go('invoices')},
    {k:'P', label:'Receive Payment', icon:'Rs', color:'#16a34a', mod:'accounts', go:() => db2Go('accounts')},
    {k:'W', label:'Stock Inward', icon:'⬇', color:'#ea580c', mod:'products', go:() => db2Go('inward')}
  ].filter(x => db2Can(x.mod));
  window.DB2_QA = qa;

  host.innerHTML = '<div class="db2 no-dirty-track">'   /* dashboard has nothing to save: never trigger the unsaved-changes prompt */
    + '<div class="db2-top"><div><h2>' + esc(hello) + (first ? ', ' + esc(first) : '') + '</h2><p>' + esc(now.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'})) + ' · Here\'s what needs you today</p></div>'
    + '<button class="db2-search" type="button" onclick="db2OpenSearch()"><span>🔍 Search customer, part no., invoice, quotation…</span><kbd>Ctrl K</kbd></button></div>'
    + (qa.length ? '<div class="db2-qa">' + qa.map((x, i) => '<button type="button" onclick="DB2_QA[' + i + '].go()" title="Shortcut: ' + x.k + '"><i style="background:' + x.color + '">' + x.icon + '</i><span>' + esc(x.label) + '<small>' + x.k + '</small></span></button>').join('') + '</div>' : '')
    + '<div class="db2-kpis" id="db2Kpis"></div>'
    + '<div class="db2-grid"><div class="db2-col">'
    + (db2Can('reports') ? '<div class="db2-card" id="db2Chart"><div class="muted">Loading sales…</div></div>' : '')
    + (db2Can('reports') ? '<div class="db2-card" id="db2Top"><div class="muted">Loading top customers…</div></div>' : '')
    + ((db2Can('sales') || db2Can('enquiries')) ? '<div class="db2-card" id="db2Pipe"><div class="muted">Loading pipeline…</div></div>' : '')
    + '</div><div class="db2-col">'
    + '<div class="db2-card" id="db2Todo"><div class="muted">Checking what needs attention…</div></div>'
    + (db2Can('accounts') ? '<div class="db2-card" id="db2Over"><div class="muted">Loading…</div></div>' : '')
    + (isAdmin() ? '<div class="db2-card" id="db2Act"><div class="muted">Loading team activity…</div></div>' : '')
    + '</div></div>'
    + '<details class="db2-more" id="db2More" ontoggle="db2MoreToggle(this)"><summary>Detailed views — payments table, sales target, low stock, stock by category, pipeline</summary><div id="dashClassic"></div></details>'
    + '</div>';

  db2Kpis();   /* stock card can show at once */
  const yr = now.getFullYear();
  const jobs = [];
  const take = (key, p) => jobs.push(p.then(r => { if (seq !== DB2.seq) return; DB2.data[key] = r && r.ok ? r : null; db2Paint(); }).catch(() => {}));
  if (db2Can('reports')) take('sales', api('getSalesSummary', {year:yr}));
  if (db2Can('accounts')) take('out', api('getOutstanding', {}));
  if (db2Can('sales')) {
    take('qt', api('quotationHistory'));
    take('dcs', api('getReports', {mode:'docs', type:'DC'}));
    take('invs', api('getReports', {mode:'docs', type:'INVOICE'}));
  }
  if (db2Can('enquiries') || db2Can('sales')) take('enq', api('getEnquiries'));
  if (isAdmin()) take('act', api('getUserActivity', {year:yr}));
  Promise.all(jobs).then(() => { if (seq === DB2.seq) { DB2.done = true; db2Paint(); } });
}

function db2MoreToggle(el){ if (el.open && !el.dataset.loaded) { el.dataset.loaded = '1'; renderDashboardClassic(); } }

function db2Paint(){ db2Kpis(); db2Chart(); db2Todo(); db2Over(); db2Pipe(); db2Top(); db2Act(); }

/* ---------- derived data ---------- */
function db2Overdue(){
  const r = DB2.data.out; if (!r) return null;
  const canon = pdCanonName();
  return (r.rows || []).filter(x => Number(x.outstanding) > 0.5).map(x => {
    const cust = canon(x.customer), t = paymentTermsOf(cust), di = dueInfo(x.date, t.days);
    return {no:x.no, customer:cust, terms:t.days, out:Number(x.outstanding) || 0, daysOver:di ? di.daysOver : null};
  });
}
function db2Invoiced(){
  const r = DB2.data.invs; return new Set(r ? (r.documents || []).map(x => String(x.dc || '').trim()).filter(Boolean) : []);
}

/* ---------- KPI cards ---------- */
function db2Kpis(){
  const host = $('db2Kpis'); if (!host) return;
  const now = new Date(), m = now.getMonth(), cards = [];
  const sales = DB2.data.sales;
  if (db2Can('reports')) {
    if (sales) {
      const ms = sales.monthlySales || [], cur = Number((ms[m] || {}).amount) || 0, prev = m > 0 ? Number((ms[m - 1] || {}).amount) || 0 : 0;
      const target = Number(sales.target) || 0, yearSales = Number(sales.totalSales) || 0;
      const pct = target > 0 ? Math.round(yearSales / target * 100) : null;            /* ANNUAL: year-to-date sales vs annual target */
      const delta = prev > 0 ? Math.round((cur - prev) / prev * 100) : null;
      const ring = pct === null ? '' : '<div class="db2-ring" style="--p:' + Math.min(100, Math.max(0, pct)) + '" title="' + pct + '% of the ' + esc(sales.year) + ' annual target"><b>' + pct + '%</b></div>';
      cards.push('<div class="db2-kpi db2-hero" onclick="db2Go(\'reports\')" title="Open Reports"><div><span>ANNUAL SALES ' + esc(sales.year) + '</span><strong>' + db2Short(yearSales) + (target > 0 ? ' <small>/ ' + db2Short(target) + '</small>' : '') + '</strong>'
        + '<em>' + (target > 0 ? db2Short(Math.max(0, target - yearSales)) + ' remaining' : 'No annual target set') + ' · ' + esc(PS_MONTHS[m]) + ': ' + db2Short(cur) + (delta !== null ? ' <b class="' + (delta >= 0 ? 'up' : 'dn') + '">' + (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta) + '%</b>' : '') + '</em></div>' + ring + '</div>');
    } else cards.push('<div class="db2-kpi db2-hero"><div><span>SALES — ' + esc(PS_MONTHS[m].toUpperCase()) + '</span><strong>…</strong><em>Loading</em></div></div>');
  }
  if (db2Can('accounts')) {
    const od = db2Overdue();
    if (od) {
      const tot = od.reduce((a, x) => a + x.out, 0), ov = od.filter(x => x.daysOver > 0), ovAmt = ov.reduce((a, x) => a + x.out, 0), ovC = new Set(ov.map(x => x.customer)).size;
      cards.push('<div class="db2-kpi" onclick="db2Go(\'accounts\')" title="Open Accounts"><span>OUTSTANDING</span><strong>' + db2Short(tot) + '</strong><em>' + (ovAmt > 0 ? '<b class="dn">' + db2Short(ovAmt) + ' overdue</b> · ' + ovC + ' client' + (ovC === 1 ? '' : 's') : '<b class="up">Nothing overdue</b>') + '</em></div>');
    } else cards.push('<div class="db2-kpi"><span>OUTSTANDING</span><strong>…</strong><em>Loading</em></div>');
  }
  if (db2Can('sales')) {
    const q = DB2.data.qt;
    if (q) {
      const docs = q.documents || [], inM = docs.filter(d => { const x = db2Day(d.date); return x && x.getMonth() === m && x.getFullYear() === now.getFullYear(); });
      const won = inM.filter(d => d.status === 'Won').length, lost = inM.filter(d => d.status === 'Lost').length, pend = docs.filter(d => (d.status || 'Pending') === 'Pending').length;
      const rate = won + lost ? Math.round(won / (won + lost) * 100) + '%' : '—';
      cards.push('<div class="db2-kpi" onclick="db2Go(\'qthistory\')" title="Open Quotation History"><span>QUOTATIONS (' + esc(PS_MONTHS[m].toUpperCase()) + ')</span><strong>' + inM.length + ' <small>· ' + db2Short(inM.reduce((a, d) => a + (+d.subtotal || 0), 0)) + '</small></strong><em>Win rate <b class="up">' + rate + '</b> · ' + pend + ' pending</em></div>');
    } else cards.push('<div class="db2-kpi"><span>QUOTATIONS</span><strong>…</strong><em>Loading</em></div>');
  }
  const P = (S.products || []).filter(p => (p.Status || 'Active') === 'Active');
  if (P.length && !(isAdmin() || db2Can('stockvalue'))) {   /* stock value is only for Admin and users given the special permission */
    const low = P.filter(p => Number(p.currentStock) <= reorderOf(p)).length, outN = P.filter(p => Number(p.currentStock) <= 0).length;
    cards.push('<div class="db2-kpi" onclick="openLowStock()" title="Open Low Stock"><span>STOCK STATUS</span><strong>' + low + ' <small>low</small></strong><em>' + (outN ? '<b class="dn">' + outN + ' out of stock</b>' : '<b class="up">Nothing out of stock</b>') + '</em></div>');
  } else if (P.length) {
    const val = P.reduce((a, p) => a + Math.max(0, Number(p.currentStock) || 0) * (Number(p['Sale Price']) || 0), 0);
    const low = P.filter(p => Number(p.currentStock) <= reorderOf(p)).length, outN = P.filter(p => Number(p.currentStock) <= 0).length;
    cards.push('<div class="db2-kpi" onclick="db2Go(\'products\')" title="Open Products"><span>' + (val > 0 ? 'STOCK VALUE <small>(sale price)</small>' : 'STOCK') + '</span><strong>' + (val > 0 ? db2Short(val) : P.reduce((a, p) => a + Math.max(0, Number(p.currentStock) || 0), 0).toLocaleString() + ' <small>units</small>') + '</strong><em>' + (low ? '<b class="dn">' + low + ' low</b>' : '<b class="up">No low stock</b>') + ' · ' + outN + ' out of stock</em></div>');
  }
  host.style.gridTemplateColumns = cards.length ? (db2Can('reports') ? '1.35fr ' : '') + 'repeat(' + (cards.length - (db2Can('reports') ? 1 : 0)) + ',1fr)' : '';
  host.innerHTML = cards.join('');
}

/* ---------- Sales vs Target chart ---------- */
function db2Chart(){
  const host = $('db2Chart'); if (!host) return;
  const s = DB2.data.sales;
  if (!s) { if (DB2.done) host.innerHTML = '<h3>Sales vs Target</h3><div class="muted">Sales data could not be loaded.</div>'; return; }
  const ms = (s.monthlySales || []).map(x => Number(x.amount) || 0), mt = (Number(s.target) || 0) / 12, m = new Date().getMonth();
  const max = Math.max(mt, ...ms, 1) * 1.08;
  host.innerHTML = '<h3>Sales vs Target — ' + esc(s.year) + ' <a onclick="db2Go(\'reports\')">Open Reports →</a></h3>'
    + '<div class="db2-bars">' + ms.map((v, i) => '<div class="db2-bar' + (i === m ? ' cur' : '') + (i > m ? ' fut' : '') + '" style="height:' + Math.max(i > m ? 2 : 1.5, v / max * 100) + '%" title="' + PS_MONTHS[i] + ': Rs ' + money(v) + '"><span>' + (v > 0 ? db2Short(v) : '') + '</span></div>').join('')
    + (mt > 0 ? '<div class="db2-tline" style="bottom:' + (mt / max * 100) + '%"><span>Monthly target ' + db2Short(mt) + '</span></div>' : '') + '</div>'
    + '<div class="db2-months">' + PS_MONTHS.map(x => '<span>' + x + '</span>').join('') + '</div>'
    + (mt > 0 ? '' : '<div class="muted small" style="margin-top:6px">No annual target set — open “Detailed views” below → Sales Target → Edit Target.</div>');
}

/* ---------- Today's to-do ---------- */
function db2Todo(){
  const host = $('db2Todo'); if (!host) return;
  const rows = [], pend = [];
  const add = (cls, icon, text, badge, onclick) => rows.push('<button type="button" class="db2-todo-row" onclick="' + onclick + '"><i class="' + cls + '">' + icon + '</i><span>' + text + '</span><b class="' + cls + '">' + badge + '</b></button>');
  if (db2Can('accounts')) {
    const od = db2Overdue();
    if (od) { const ov = od.filter(x => x.daysOver > 0); if (ov.length) add('t-red', 'Rs', 'Overdue payments to follow up', ov.length + ' · ' + db2Short(ov.reduce((a, x) => a + x.out, 0)), "db2Go('accounts')"); } else pend.push(1);
  }
  if (db2Can('enquiries') || db2Can('sales')) {
    const e = DB2.data.enq;
    if (e) { const n = (e.documents || []).filter(d => (d.status || 'New') === 'New').length; if (n) add('t-violet', '✉', 'Enquiries waiting for quotation', n, "db2Go('enquiries',()=>db2SetFilter('enqStatus','New',window.filterEnquiries))"); } else if (!DB2.done) pend.push(1);
  }
  if (db2Can('sales')) {
    const q = DB2.data.qt, today = db2Day(new Date());
    if (q) { const n = (q.documents || []).filter(d => (d.status || 'Pending') === 'Pending' && db2Day(d.date) && (today - db2Day(d.date)) / 864e5 > 7).length; if (n) add('t-amber', '⏳', 'Quotations pending more than 7 days (follow up)', n, "db2Go('qthistory',()=>db2SetFilter('qtSt','Pending',window.filterQTHistory))"); } else pend.push(1);
    const dcs = DB2.data.dcs;
    if (dcs && DB2.data.invs) { const inv = db2Invoiced(); const n = (dcs.documents || []).filter(d => !inv.has(String(d.no).trim())).length; if (n) add('t-blue', '⛟', 'Delivery challans not invoiced yet', n, "db2Go('dchistory',()=>db2SetFilter('dchInv','no',window.filterDCHistory))"); } else if (!DB2.done) pend.push(1);
  }
  const P = (S.products || []).filter(p => (p.Status || 'Active') === 'Active');
  const outN = P.filter(p => Number(p.currentStock) <= 0).length, lowN = P.filter(p => Number(p.currentStock) > 0 && Number(p.currentStock) <= reorderOf(p)).length;
  if (outN) add('t-red', '!', 'Out of stock items', outN, 'openLowStock()');
  if (lowN) add('t-amber', '↓', 'Low stock items (reorder)', lowN, 'openLowStock()');
  host.innerHTML = '<h3>Today\'s to-do <span class="muted small">' + (rows.length ? rows.length + ' item' + (rows.length === 1 ? '' : 's') : '') + '</span></h3>'
    + (rows.length ? '<div class="db2-todo">' + rows.join('') + '</div>' : (pend.length && !DB2.done ? '<div class="muted">Checking…</div>' : '<div class="db2-ok">✓ All clear — nothing needs attention right now.</div>'));
}

/* ---------- Overdue clients ---------- */
function db2Over(){
  const host = $('db2Over'); if (!host) return;
  const od = db2Overdue(); if (!od) { if (DB2.done) host.innerHTML = '<h3>Overdue clients</h3><div class="muted">Could not load.</div>'; return; }
  const by = {};
  od.forEach(x => { const g = by[x.customer] || (by[x.customer] = {c:x.customer, over:0, out:0, max:-1e9, inv:[], terms:x.terms}); g.out += x.out; if (x.daysOver > 0) g.over += x.out; g.max = Math.max(g.max, x.daysOver === null ? -1e9 : x.daysOver); g.inv.push(x.no); });
  const list = Object.values(by).filter(g => g.max >= -7).sort((a, b) => b.max - a.max || b.out - a.out).slice(0, 5);
  const badge = d => d > 0 ? '<span class="db2-pill t-red">' + d + ' day' + (d === 1 ? '' : 's') + ' late</span>' : d === 0 ? '<span class="db2-pill t-amber">due today</span>' : '<span class="db2-pill t-amber">due in ' + (-d) + ' day' + (d === -1 ? '' : 's') + '</span>';
  host.innerHTML = '<h3>Overdue &amp; due this week <a onclick="db2Go(\'accounts\')">All →</a></h3>'
    + (list.length ? '<table class="db2-tbl">' + list.map(g => '<tr><td><b>' + esc(g.c) + '</b><div class="muted small">' + esc(g.inv.slice(0, 3).join(', ')) + (g.inv.length > 3 ? ' +' + (g.inv.length - 3) : '') + ' · ' + g.terms + ' days terms</div></td><td class="r"><b class="' + (g.max > 0 ? 'dn' : '') + '">' + money(g.max > 0 ? g.over : g.out) + '</b><div>' + badge(g.max) + '</div></td></tr>').join('') + '</table>'
      : '<div class="db2-ok">✓ No client is overdue or due this week.</div>');
}

/* ---------- Pipeline ---------- */
function db2PipeSet(v){ DB2.pipe = v; db2Pipe(); }
function db2Pipe(){
  const host = $('db2Pipe'); if (!host) return;
  const q = DB2.data.qt, e = DB2.data.enq;
  if (!q && !e) { if (DB2.done) host.innerHTML = '<h3>Enquiry → Order pipeline</h3><div class="muted">Could not load.</div>'; return; }
  const now = new Date(), from = DB2.pipe === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : DB2.pipe === 'q' ? new Date(now.getFullYear(), now.getMonth() - 2, 1) : new Date(now.getFullYear(), 0, 1);
  const inP = v => { const d = db2Day(v); return d && d >= from; };
  const enq = e ? (e.documents || []).filter(d => inP(d.date)) : [];
  const qts = q ? (q.documents || []).filter(d => inP(d.date)) : [];
  const won = qts.filter(d => d.status === 'Won'), lost = qts.filter(d => d.status === 'Lost'), pend = qts.filter(d => (d.status || 'Pending') === 'Pending');
  const steps = [];
  if (e) steps.push({n:enq.length, t:enq.length + ' Enquiries', c:'#94a3b8'});
  steps.push({n:qts.length, t:qts.length + ' Quoted · ' + db2Short(qts.reduce((a, d) => a + (+d.subtotal || 0), 0)), c:'#3b6fb6'});
  steps.push({n:won.length, t:won.length + ' Won · ' + db2Short(won.reduce((a, d) => a + (+d.subtotal || 0), 0)), c:'#16a34a'});
  steps.push({n:pend.length, t:pend.length + ' Pending', c:'#d97706'});
  steps.push({n:lost.length, t:lost.length + ' Lost', c:'#c8102e'});
  const max = Math.max(1, ...steps.map(s => s.n));
  const reasons = {}; lost.forEach(d => { const r = String(d.lossReason || '').trim(); if (r) reasons[r] = (reasons[r] || 0) + 1; });
  const topR = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
  host.innerHTML = '<h3>Enquiry → Order pipeline <select onchange="db2PipeSet(this.value)" class="db2-sel"><option value="month"' + (DB2.pipe === 'month' ? ' selected' : '') + '>This month</option><option value="q"' + (DB2.pipe === 'q' ? ' selected' : '') + '>Last 3 months</option><option value="y"' + (DB2.pipe === 'y' ? ' selected' : '') + '>This year</option></select></h3>'
    + '<div class="db2-funnel">' + steps.map(s => '<div><i style="width:' + Math.max(1.5, s.n / max * 55) + '%;background:' + s.c + '"></i><span>' + esc(s.t) + '</span></div>').join('') + '</div>'
    + '<div class="muted small" style="margin-top:6px">' + (won.length + lost.length ? 'Win rate <b>' + Math.round(won.length / (won.length + lost.length) * 100) + '%</b>' : 'No decided quotations yet') + (topR ? ' · Top loss reason: <b>' + esc(topR[0]) + '</b> (' + topR[1] + ')' : '') + '</div>';
}

/* ---------- Top customers ---------- */
function db2TopYear(y){
  DB2.topYear = Number(y);
  const cy = new Date().getFullYear();
  if (DB2.topYear === cy || (DB2.topCache && DB2.topCache[DB2.topYear])) { db2Top(); return; }
  const host = $('db2Top'); if (host) host.querySelector('.db2-tbars') && (host.querySelector('.db2-tbars').style.opacity = '.4');
  api('getSalesSummary', {year:DB2.topYear}).then(r => { DB2.topCache = DB2.topCache || {}; if (r && r.ok) DB2.topCache[DB2.topYear] = r; db2Top(); });
}
function db2TopMode(m){ DB2.topMode = m; DB2.topOpen = {}; try { localStorage.setItem('sfsTopMode', m); } catch (e) {} db2Top(); }
function db2TopToggle(k){ k = decodeURIComponent(k); DB2.topOpen = DB2.topOpen || {}; DB2.topOpen[k] = !DB2.topOpen[k]; db2Top(); }
function db2Top(){
  const host = $('db2Top'); if (!host) return;
  if (!DB2.topMode) { try { DB2.topMode = localStorage.getItem('sfsTopMode') || 'company'; } catch (e) { DB2.topMode = 'company'; } }
  const cy = new Date().getFullYear(), y = DB2.topYear || cy, mode = DB2.topMode === 'group' ? 'group' : 'company';
  const s = y === cy ? DB2.data.sales : (DB2.topCache || {})[y];
  const sel = '<span class="db2-topctl"><span class="db2-seg"><button type="button" class="' + (mode === 'company' ? 'on' : '') + '" onclick="db2TopMode(\'company\')">Company</button><button type="button" class="' + (mode === 'group' ? 'on' : '') + '" onclick="db2TopMode(\'group\')">Group</button></span>'
    + '<select class="db2-sel" onchange="db2TopYear(this.value)">' + [cy, cy - 1, cy - 2].map(v => '<option value="' + v + '"' + (v === y ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></span>';
  const title = '<h3><span>Top 10 ' + (mode === 'group' ? 'customer groups' : 'customers') + ' <span class="muted small">by sales (excl. GST)</span></span>' + sel + '</h3>';
  if (!s) { if (DB2.done || y !== cy) host.innerHTML = title + '<div class="muted">' + (y !== cy ? 'Loading…' : 'Could not load.') + '</div>'; return; }
  const all = (s.customerSales || []).filter(x => (+x.amount || 0) > 0);
  const total = all.reduce((a, x) => a + (+x.amount || 0), 0) || Number(s.totalSales) || 0;
  const canOpen = db2Can('parties') || db2Can('accounts');
  /* rows: one per company, or one per group (companies without a group stay on their own) */
  let rows;
  if (mode === 'group') {
    const by = {};
    all.forEach(x => {
      const g = customerGroupOf(x.customer), key = g ? 'G:' + g.toUpperCase() : 'C:' + norm(x.customer);
      const r = by[key] || (by[key] = {key:key, name:g || x.customer, group:!!g, amount:0, members:[]});
      r.amount += +x.amount || 0; r.members.push(x);
    });
    rows = Object.values(by).sort((a, b) => b.amount - a.amount);
  } else rows = all.map(x => ({key:'C:' + norm(x.customer), name:x.customer, group:false, amount:+x.amount || 0, members:[x]}));
  const list = rows.slice(0, 10), max = Math.max(1, ...list.map(r => r.amount)), top10 = list.reduce((a, r) => a + r.amount, 0);
  const groups = allCustomerGroups().length;
  const bar = (i, r) => {
    const w = Math.max(1.5, r.amount / max * 100), share = total ? Math.round(r.amount / total * 1000) / 10 : 0, open = r.group && (DB2.topOpen || {})[r.key];
    const click = r.group ? ' onclick="db2TopToggle(\'' + encA(r.key) + '\')" title="Show the companies of ' + esc(r.name) + '"' : (canOpen ? ' onclick="ledger(\'Customer\',\'' + encA(r.name) + '\')" title="Open ledger of ' + esc(r.name) + '"' : ' title="' + esc(r.name) + '"');
    let h = '<div class="db2-tbar' + (r.group || canOpen ? ' click' : '') + (r.group ? ' grp' : '') + '"' + click + '>'
      + '<span class="db2-tbar-rank' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span>'
      + '<span class="db2-tbar-name">' + (r.group ? '<b>' + esc(r.name) + '</b> <span class="db2-grpn">' + (open ? '▾ ' : '▸ ') + r.members.length + ' compan' + (r.members.length === 1 ? 'y' : 'ies') + '</span>' : esc(r.name)) + '</span>'
      + '<span class="db2-tbar-track"><i style="width:' + w + '%"></i></span>'
      + '<span class="db2-tbar-val"><b>' + db2Short(r.amount) + '</b><small>' + share + '%</small></span></div>';
    if (open) h += '<div class="db2-tsub">' + r.members.sort((a, b) => (+b.amount || 0) - (+a.amount || 0)).map(m => {
        const a = +m.amount || 0;
        return '<div class="db2-tbar sub' + (canOpen ? ' click' : '') + '"' + (canOpen ? ' onclick="event.stopPropagation();ledger(\'Customer\',\'' + encA(m.customer) + '\')" title="Open ledger"' : '') + '><span></span><span class="db2-tbar-name">' + esc(m.customer) + '</span><span class="db2-tbar-track"><i style="width:' + Math.max(1.5, a / r.amount * 100) + '%"></i></span><span class="db2-tbar-val"><b>' + db2Short(a) + '</b><small>' + Math.round(a / r.amount * 100) + '% of group</small></span></div>';
      }).join('') + '</div>';
    return h;
  };
  host.innerHTML = title
    + (list.length ? '<div class="db2-tbars">' + list.map((r, i) => bar(i, r)).join('') + '</div>'
      + '<div class="muted small" style="margin-top:8px">Top 10 = <b>' + db2Short(top10) + '</b>' + (total ? ' (' + Math.round(top10 / total * 100) + '% of ' + y + ' sales)' : '') + ' · ' + all.length + ' customers bought in ' + y
      + (mode === 'group' ? ' · ' + (groups ? groups + ' group' + (groups === 1 ? '' : 's') + ' set' : 'no groups set yet') + ((db2Can('parties') || isAdmin()) ? ' · <a class="model-link" onclick="customerGroupsManager()">Manage groups</a>' : '') : '') + '</div>'
      : '<div class="muted">No invoice sales in ' + y + '.</div>');
}

/* ---------- Team activity (Admin) ---------- */
function db2Details(raw){
  const kv = {}; String(raw || '').split(/;\s*/).forEach(p => { const i = p.indexOf('='); if (i > 0) kv[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  const parts = [];
  const doc = kv.id || kv.no || kv.invoiceNo || kv.dc; if (doc) parts.push(doc);
  if (kv.customer || kv.supplier || kv.name) parts.push(kv.customer || kv.supplier || kv.name);
  if (kv.model) parts.push(kv.model);
  if (kv.status) parts.push('→ ' + kv.status);
  if (kv.amount && !isNaN(Number(kv.amount))) parts.push('Rs ' + money(kv.amount));
  if (kv.items) parts.push(kv.items + ' item' + (kv.items === '1' ? '' : 's'));
  return parts.length ? parts.join(' · ') : String(raw || '').replace(/;\s*/g, ' · ');
}
function db2Act(){
  const host = $('db2Act'); if (!host) return;
  const r = DB2.data.act;
  if (!r) { if (DB2.done) host.innerHTML = '<h3>Team activity</h3><div class="muted">Not available yet — paste the new Code.gs in Apps Script and deploy a New version.</div>'; return; }
  const names = r.names || {}, nm = u => { const k = String(u || '').trim(); if (!k) return 'Someone'; if (k.toLowerCase() === 'email') return 'Email (automatic)'; return names[k.toLowerCase()] || k; };
  const ini = u => nm(u).split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const docNos = new Set((r.docs || []).map(x => String(x.no)));
  const audit = (r.audit || []).filter(x => !(/^(save|invoice$|dc$|inward$|product$)/.test(x.action) && /id=([^;]+)/.test(x.details || '') && docNos.has(String(x.details).match(/id=([^;]+)/)[1].trim())))
    .map(x => ({t:new Date(x.time), u:x.user, w:(typeof UA_ACTIONS !== 'undefined' && UA_ACTIONS[x.action]) || x.action, d:db2Details(x.details), exact:true}));
  const docs = (r.docs || []).map(x => ({t:new Date(x.date), u:x.user, w:'created ' + x.type + ' ' + x.no, d:[x.party, x.amount ? db2Short(x.amount) : ''].filter(Boolean).join(' · ')}));
  const list = audit.concat(docs).filter(x => !isNaN(x.t)).sort((a, b) => b.t - a.t).slice(0, 6);
  const when = x => { const d = db2Day(x.t), t = db2Day(new Date()), diff = Math.round((t - d) / 864e5); const day = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : fmtDate(x.t); return x.exact ? day + ' ' + x.t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : day; };
  host.innerHTML = '<h3>Team activity <a onclick="db2Go(\'reports\')">Full report →</a></h3>'
    + (list.length ? '<div class="db2-act">' + list.map(x => '<div><span class="db2-av">' + esc(ini(x.u)) + '</span><div><b>' + esc(nm(x.u)) + '</b> ' + esc(x.w.charAt(0).toLowerCase() + x.w.slice(1)) + (x.d ? ' <span class="muted">· ' + esc(x.d) + '</span>' : '') + '<div class="muted small">' + esc(when(x)) + '</div></div></div>').join('') + '</div>' : '<div class="muted">No activity recorded this year yet.</div>');
}

/* ---------- Search (Ctrl+K) ---------- */
async function db2OpenSearch(){
  modal('Search', '<input id="db2Q" type="search" placeholder="Type a customer, part no., invoice #, quotation #, DC #…" autocomplete="off" style="width:100%;font-size:15px;padding:12px 14px" oninput="db2Search(this.value)"><div id="db2Res" class="db2-res"><div class="muted small" style="padding:10px 2px">Start typing — results appear as you type.</div></div>');
  setTimeout(() => { const i = $('db2Q'); if (i) i.focus(); }, 30);
  if (db2Can('sales') && (!DB2.data.qt || !DB2.data.invs || !DB2.data.dcs)) {
    const [q, iv, dc] = await Promise.all([api('quotationHistory'), api('getReports', {mode:'docs', type:'INVOICE'}), api('getReports', {mode:'docs', type:'DC'})]);
    if (q && q.ok) DB2.data.qt = q; if (iv && iv.ok) DB2.data.invs = iv; if (dc && dc.ok) DB2.data.dcs = dc;
    const i = $('db2Q'); if (i && i.value) db2Search(i.value);
  }
}
function db2Search(v){
  const box = $('db2Res'); if (!box) return;
  const q = norm(v); if (q.length < 2) { box.innerHTML = '<div class="muted small" style="padding:10px 2px">Type at least 2 letters.</div>'; return; }
  const out = [], hit = (...xs) => xs.some(x => norm(x).includes(q));
  const add = (group, title, sub, act) => out.push({group, title, sub, act});
  (S.customers || []).filter(c => hit(c['Customer Name'], c['Contact Person'], c.Phone, c['Customer ID'])).slice(0, 6)
    .forEach(c => add('Customers', c['Customer Name'], [c['Contact Person'], c.Phone].filter(Boolean).join(' · '), "closeModal();ledger('Customer','" + encA(c['Customer Name']) + "')"));
  (S.products || []).filter(p => hit(p['Model / Part No.'], p.Description, p.Brand)).slice(0, 8)
    .forEach(p => add('Products', p['Model / Part No.'], [p.Description, p.Brand, 'Stock ' + (p.currentStock ?? '')].filter(Boolean).join(' · '), "closeModal();productDetail('" + encA(p['Model / Part No.']) + "')"));
  const docs = (key, group, page, field, label) => { const r = DB2.data[key]; if (!r) return; (r.documents || []).filter(d => hit(d.no, d.customer, d.po, d.ref)).slice(0, 6)
    .forEach(d => add(group, label + ' ' + d.no, [d.customer, fmtDate(d.date), d.subtotal ? money(d.subtotal) : ''].filter(Boolean).join(' · '), "closeModal();db2OpenDoc('" + page + "','" + field + "','" + encA(d.no) + "')")); };
  docs('qt', 'Quotations', 'qthistory', 'qts', 'Quotation');
  docs('invs', 'Invoices', 'ivhistory', 'ivhSearch', 'Invoice');
  docs('dcs', 'Delivery Challans', 'dchistory', 'dchSearch', 'DC');
  if (!out.length) { box.innerHTML = '<div class="muted small" style="padding:10px 2px">Nothing found for “' + esc(v) + '”.</div>'; return; }
  let g = '', html = '';
  out.forEach(x => { if (x.group !== g) { g = x.group; html += '<div class="db2-res-g">' + esc(g) + '</div>'; } html += '<button type="button" class="db2-res-i" onclick="' + esc(x.act) + '"><b>' + esc(x.title) + '</b><span>' + esc(x.sub) + '</span></button>'; });
  box.innerHTML = html;
}

/* Keyboard: Ctrl+K = search (anywhere). Q/E/D/I/P/W = quick actions (on the dashboard, when not typing). */
document.addEventListener('keydown', function(e){
  if (typeof S === 'undefined' || !S.user) return;
  const tag = (e.target && e.target.tagName) || '', typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && String(e.key).toLowerCase() === 'k') { e.preventDefault(); db2OpenSearch(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!document.querySelector('#dash .db2') || !$('modal').classList.contains('hidden')) return;
  const k = String(e.key).toUpperCase(), qa = (window.DB2_QA || []).find(x => x.k === k);
  if (qa) { e.preventDefault(); qa.go(); }
});
Object.assign(window, {renderDashboard, renderDashboardClassic, db2Go, db2OpenDoc, db2Details, db2TopYear, db2TopMode, db2TopToggle, db2SetFilter, db2MoreToggle, db2PipeSet, db2OpenSearch, db2Search});

/* ============================================================
   ENQUIRY BOX (free — no paid AI)
   One box for every enquiry: drop / choose / paste (Ctrl+V) a photo,
   screenshot or PDF, or paste the customer's text. Staff choose the
   customer and type / correct the items. Items do NOT have to be our
   own products (import / local items are fine).
   - Text and text-PDFs: "Find items" suggests item lines (editable).
   - Files are kept in Google Drive and shown again on the quotation.
   - E-mail enquiries open in the same box via ✎ Edit.
   ============================================================ */
const ENQF = {files:[], editId:null, existing:[], pdfText:{}, items:[]};
const ENQ_SOURCES = ['Phone', 'WhatsApp', 'Email', 'Walk-in', 'Website', 'Other'];
const ENQ_OK_TYPES = /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf)$/i;

function enqCustHtml(d){
  const n = String(d.customerName || '').trim();
  if (!n || /^\(/.test(n)) return '<a class="model-link" style="color:#c0392b;font-weight:700" onclick="enquiryForm(\'' + encA(d.id) + '\')">⚠ Customer not identified — choose</a>';
  return esc(n);
}
function enqEditBtn(d){ return '<button class="btn small" style="margin-top:4px" onclick="enquiryForm(\'' + encA(d.id) + '\')">✎ Edit</button>'; }
function enqDriveId(a){ if (a && a.id) return a.id; const m = String((a && a.url) || '').match(/\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})/); return m ? (m[1] || m[2]) : ''; }
function enqIsImage(a){ return /^image\//i.test(String(a.type || '')) || /\.(jpe?g|png|webp|gif)$/i.test(String(a.name || '')); }
function enqAttHtml(a){
  const id = enqDriveId(a);
  if (enqIsImage(a) && id) return '<a href="' + esc(a.url) + '" target="_blank" rel="noopener" title="' + esc(a.name) + '" class="enqf-thumb"><img src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w320" alt="' + esc(a.name) + '" loading="lazy" onerror="this.parentNode.classList.add(\'noimg\')"><span>' + esc(a.name) + '</span></a>';
  return '<a class="btn small" style="text-decoration:none" target="_blank" rel="noopener" href="' + esc(a.url) + '">📎 ' + esc(a.name) + '</a>';
}

/* ---------- open the box (new, or ✎ edit an existing enquiry) ---------- */
function enquiryForm(idEnc){
  const id = idEnc ? decodeURIComponent(idEnc) : '';
  const d = id ? (ENQ_CACHE || []).find(x => x.id === id) : null;
  if (id && !d) return toast('Enquiry not found — press Refresh and try again.', true);
  ENQF.files.forEach(f => { if (f.url) URL.revokeObjectURL(f.url); });
  Object.assign(ENQF, {files:[], editId:d ? d.id : null, existing:d ? (d.attachments || []) : [], pdfText:{}, items:d && d.items ? d.items.map(x => ({desc:x.desc || '', qty:x.qty || '', unit:x.unit || 'Nos', note:x.note || ''})) : []});
  const cn = d && !/^\(/.test(String(d.customerName || '')) ? d.customerName : '';
  const src = d ? (d.source && d.source !== 'Manual' ? d.source : '') : 'Phone';
  modal(d ? 'Edit Enquiry ' + d.id : 'New Enquiry', '<div class="enqf">'
    + (d && d.needsReview ? '<div class="imp-warn" style="margin:0 0 10px"><b>⚠ Please check this enquiry.</b> ' + esc(d.aiNote || '') + ' Saving marks it as checked.</div>' : '')
    + '<div class="form-grid">'
    + '<label>Customer *<input id="enqfCust" list="clist" autocomplete="off" value="' + esc(cn) + '" placeholder="Choose from list or type a new name" onchange="enqfPickCustomer()"></label>'
    + '<label>Date<input id="enqfDate" type="date" value="' + esc(d && d.date ? toInputDate(d.date) : todayStr()) + '"></label>'
    + '<label>Contact person<input id="enqfContact" value="' + esc(d ? d.contactPerson || '' : '') + '"></label>'
    + '<label>Phone<input id="enqfPhone" value="' + esc(d ? d.phone || '' : '') + '"></label>'
    + '<label>Email<input id="enqfEmail" type="email" value="' + esc(d ? d.email || '' : '') + '"></label>'
    + '<label>Came by<select id="enqfSource"' + (d && d.source === 'Email' ? ' disabled title="E-mail enquiry"' : '') + '>' + (d && d.source === 'Email' ? '<option>Email</option>' : '<option value="">—</option>' + ENQ_SOURCES.map(s => '<option' + (s === src ? ' selected' : '') + '>' + s + '</option>').join('')) + '</select></label>'
    + '<label>Customer ref / RFQ #<input id="enqfRef" value="' + esc(d ? d.customerRef || '' : '') + '"></label>'
    + '<label>Subject<input id="enqfSubject" value="' + esc(d ? d.subject || '' : '') + '" placeholder="optional"></label>'
    + '</div>'
    + '<div id="enqfDrop" class="enqf-drop" tabindex="0" onclick="if(event.target===this||event.target.classList.contains(\'enqf-hint\'))$(\'enqfFile\').click()">'
    + '<div class="enqf-hint"><b>📥 Drop photo / PDF here</b>, <a class="model-link" onclick="$(\'enqfFile\').click()">choose files</a>, or press <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste a screenshot or text</div>'
    + '<div class="muted small enqf-hint">JPG, PNG, PDF · up to 10 MB each · WhatsApp: open the picture → Share / Copy, then paste here</div>'
    + '<input id="enqfFile" type="file" multiple accept="image/*,application/pdf" style="display:none" onchange="enqfAddFiles(this.files);this.value=\'\'">'
    + '<div id="enqfFiles" class="enqf-files"></div></div>'
    + '<label class="enqf-lbl">Customer\'s message / enquiry text<textarea id="enqfText" rows="5" placeholder="Paste the e-mail, WhatsApp message or write what the customer asked for…">' + esc(d ? d.requirement || '' : '') + '</textarea></label>'
    + '<div class="enqf-items-head"><b>Items</b> <span class="muted small">— any item, our product or not. These lines go into the quotation.</span>'
    + '<span style="margin-left:auto;display:flex;gap:6px"><button class="btn small" type="button" onclick="enqfFindItems()">✨ Find items in text / PDF</button><button class="btn small" type="button" onclick="enqfAddItem()">+ Add item</button></span></div>'
    + '<div class="table-wrap"><table class="enqf-items"><thead><tr><th style="width:34px">#</th><th>Description / Part no.</th><th style="width:80px">Qty</th><th style="width:80px">Unit</th><th style="width:26%">Remarks</th><th style="width:34px"></th></tr></thead><tbody id="enqfItems"></tbody></table></div>'
    + '<div class="actions"><button class="btn" onclick="closeModal()">Cancel</button>'
    + '<button class="btn" id="enqfSave1" onclick="enqfSave(false)">' + (d ? 'Save changes' : 'Save Enquiry') + '</button>'
    + (!d || d.status === 'New' ? '<button class="btn primary" id="enqfSave2" onclick="enqfSave(true)">' + (d ? 'Save & Make Quotation' : 'Save & Make Quotation') + '</button>' : '')
    + '</div></div>');
  enqfRenderFiles(); enqfRenderItems();
  const drop = $('enqfDrop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) enqfAddFiles(e.dataTransfer.files); else { const t = e.dataTransfer && e.dataTransfer.getData('text'); if (t) enqfAppendText(t); } });
  setTimeout(() => { const c = $('enqfCust'); if (c && !c.value) c.focus(); }, 40);
}

function enqfPickCustomer(){
  const c = findCust(($('enqfCust') || {}).value || ''); if (!c) return;
  const fill = (id, v) => { const el = $(id); if (el && !el.value && v) el.value = v; };
  fill('enqfContact', c['Contact Person']); fill('enqfPhone', c['Phone']); fill('enqfEmail', c['Email']);
  $('enqfCust').value = c['Customer Name'];
}
function enqfAppendText(t){
  const ta = $('enqfText'); if (!ta) return;
  ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n\n' : '') + String(t).trim();
}

/* ---------- files ---------- */
function enqfAddFiles(list){
  const arr = Array.from(list || []); let bad = 0;
  arr.forEach(f => {
    const type = String(f.type || '').toLowerCase();
    if (!ENQ_OK_TYPES.test(type)) { bad++; return; }
    if (f.size > 25 * 1024 * 1024) { toast('Too large: ' + f.name, true); return; }
    if (ENQF.files.length + ENQF.existing.length >= 20) { toast('At most 20 files per enquiry.', true); return; }
    const isImg = /^image\//.test(type);
    let name = f.name || ''; if (!name || /^image\.(png|jpe?g)$/i.test(name)) name = 'screenshot-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') + '.' + (type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const item = {file:f, name:name, type:type, url:isImg ? URL.createObjectURL(f) : '', note:''};
    ENQF.files.push(item);
    if (type === 'application/pdf') enqfReadPdf(item);
  });
  if (bad) toast(bad + ' file(s) skipped — only photos (JPG, PNG) and PDF can be added.', true);
  enqfRenderFiles();
}
function enqfRemoveFile(i){ const f = ENQF.files[i]; if (f && f.url) URL.revokeObjectURL(f.url); ENQF.files.splice(i, 1); enqfRenderFiles(); }
function enqfRenderFiles(){
  const host = $('enqfFiles'); if (!host) return;
  const old = ENQF.existing.map(a => '<div class="enqf-file saved">' + enqAttHtml(a) + '<small>saved</small></div>').join('');
  const now = ENQF.files.map((f, i) => '<div class="enqf-file">' + (f.url ? '<img src="' + f.url + '" alt="">' : '<div class="enqf-pdf">PDF</div>')
    + '<div class="enqf-fn" title="' + esc(f.name) + '">' + esc(f.name) + '</div>' + (f.note ? '<small>' + esc(f.note) + '</small>' : '') + '<button type="button" title="Remove" onclick="enqfRemoveFile(' + i + ')">×</button></div>').join('');
  host.innerHTML = old + now;
  host.parentNode.classList.toggle('has-files', !!(old || now));
}

/* ---------- PDF text (free, in the browser, pdf.js) ---------- */
let ENQ_PDFJS = null;
function enqLoadPdfJs(){
  if (ENQ_PDFJS) return ENQ_PDFJS;
  ENQ_PDFJS = new Promise((res, rej) => {
    if (window.pdfjsLib) return res(window.pdfjsLib);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; res(window.pdfjsLib); } catch (e) { rej(e); } };
    s.onerror = () => { ENQ_PDFJS = null; rej(new Error('pdf reader could not load')); };
    document.head.appendChild(s);
  });
  return ENQ_PDFJS;
}
async function enqfReadPdf(item){
  item.note = 'reading…'; enqfRenderFiles();
  try {
    const lib = await enqLoadPdfJs();
    const pdf = await lib.getDocument({data:new Uint8Array(await item.file.arrayBuffer())}).promise;
    const lines = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 15); p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      const rows = {};
      tc.items.forEach(t => { if (!String(t.str).trim()) return; const y = Math.round(t.transform[5] / 3); (rows[y] = rows[y] || []).push({x:t.transform[4], s:t.str}); });
      Object.keys(rows).map(Number).sort((a, b) => b - a).forEach(y => lines.push(rows[y].sort((a, b) => a.x - b.x).map(r => r.s.trim()).join('   ')));
    }
    const text = lines.join('\n').trim();
    ENQF.pdfText[item.name] = text;
    item.note = text.length > 20 ? 'text found ✓' : 'scanned — type items';
  } catch (e) { item.note = 'could not read'; }
  enqfRenderFiles();
}

/* ---------- items ---------- */
function enqfRenderItems(){
  const h = $('enqfItems'); if (!h) return;
  if (!ENQF.items.length) { h.innerHTML = '<tr><td colspan="6" class="muted small" style="text-align:center;padding:14px">No items yet — press “Find items” or “+ Add item”. You can also leave items empty and add them on the quotation.</td></tr>'; return; }
  h.innerHTML = ENQF.items.map((it, i) => '<tr><td class="muted">' + (i + 1) + '</td>'
    + '<td><input list="mlist" value="' + esc(it.desc) + '" placeholder="Description or part no. (any item)" oninput="ENQF.items[' + i + '].desc=this.value"></td>'
    + '<td><input type="number" min="0" step="any" value="' + esc(it.qty) + '" oninput="ENQF.items[' + i + '].qty=this.value"></td>'
    + '<td><input value="' + esc(it.unit || 'Nos') + '" oninput="ENQF.items[' + i + '].unit=this.value"></td>'
    + '<td><input value="' + esc(it.note || '') + '" oninput="ENQF.items[' + i + '].note=this.value"></td>'
    + '<td><button class="btn danger small" type="button" title="Remove" onclick="ENQF.items.splice(' + i + ',1);enqfRenderItems()">×</button></td></tr>').join('');
}
function enqfAddItem(){ ENQF.items.push({desc:'', qty:'', unit:'Nos', note:''}); enqfRenderItems(); const rows = document.querySelectorAll('#enqfItems input[list]'); if (rows.length) rows[rows.length - 1].focus(); }

/* Simple, free item finder: lines such as "Solenoid valve 1/2 - 4 nos", "4 x FRL 1/2", "Coil 24VDC qty 4" or table rows */
function enqParseItems(text){
  const U = 'nos|no|pcs|pc|piece|pieces|set|sets|mtr|mtrs|meter|meters|metre|m|kg|kgs|ltr|ltrs|litre|liters|lit|unit|units|pair|pairs|roll|rolls|box|boxes|each|ea|lot|pkt|packet|feet|ft|length|lengths';
  const cap = u => { u = String(u || 'Nos'); return u.charAt(0).toUpperCase() + u.slice(1).toLowerCase(); };
  const out = [];
  String(text || '').split(/\r?\n/).forEach(raw => {
    let line = raw.replace(/ /g, ' ').trim(); if (!line || line.length > 300) return;
    if (/^(dear|hi|hello|regards|thanks|thank you|best|sir|madam|please|kindly|from|to|sent|subject|cc|date)\b/i.test(line) && !/\d+\s*(nos|pcs|qty)/i.test(line)) return;
    const cells = line.split(/\t+| {3,}|\s*\|\s*/).map(x => x.trim()).filter(Boolean);
    if (cells.length >= 3 && typeof qtItemFromCells === 'function') { const it = qtItemFromCells(cells); if (it && it.qty) { out.push({desc:it.desc, qty:it.qty, unit:it.unit || 'Nos', note:it.note || ''}); return; } }
    line = line.replace(/^(?:\d{1,3}[.)\-:]|[-•*▪●])\s+/, '');
    let m = line.match(new RegExp('^(.*?\\S)\\s*(?:[-–:,=(]|\\bqty\\b\\.?|\\bquantity\\b|\\bx\\b|×)?\\s*(\\d+(?:\\.\\d+)?)\\s*(' + U + ')\\.?\\)?\\s*$', 'i'));
    if (m) { out.push({desc:m[1].replace(/[\s\-–:,=(x×]+$/i, '').trim(), qty:+m[2], unit:cap(m[3]), note:''}); return; }
    m = line.match(new RegExp('^(?:qty\\.?\\s*)?(\\d+(?:\\.\\d+)?)\\s*(' + U + ')?\\.?\\s*(?:x|×|of|-|–|:)\\s*(.{3,})$', 'i'));
    if (m) { out.push({desc:m[3].trim(), qty:+m[1], unit:cap(m[2]), note:''}); return; }
    m = line.match(/^(.*\S)\s*[,(-]?\s*(?:qty|quantity)\s*[:=.-]?\s*(\d+(?:\.\d+)?)\s*\)?\s*$/i);
    if (m) { out.push({desc:m[1].replace(/[\s\-–:,(]+$/, '').trim(), qty:+m[2], unit:'Nos', note:''}); return; }
  });
  return out.filter(x => x.desc && x.desc.length > 1 && x.qty > 0 && x.qty < 1e6);
}
function enqfFindItems(){
  const pending = ENQF.files.filter(f => f.type === 'application/pdf' && f.note === 'reading…');
  if (pending.length) return toast('Still reading the PDF — try again in a moment.');
  const txt = [($('enqfText') || {}).value || ''].concat(Object.values(ENQF.pdfText)).join('\n');
  const found = enqParseItems(txt);
  if (!found.length) {
    const imgs = ENQF.files.filter(f => /^image\//.test(f.type)).length;
    return toast(imgs ? 'Photos cannot be read automatically in the free version — please type the items from the picture.' : 'No item lines with a quantity were found. Please add the items yourself.', true);
  }
  const key = it => norm(it.desc) + '|' + it.qty;
  const have = new Set(ENQF.items.map(key));
  ENQF.items = ENQF.items.filter(it => String(it.desc || '').trim() || it.qty);
  let added = 0; found.forEach(it => { if (!have.has(key(it))) { ENQF.items.push(it); have.add(key(it)); added++; } });
  enqfRenderItems();
  toast(added ? added + ' item(s) found — please check them.' : 'Those items are already in the list.');
}

/* ---------- save ---------- */
async function enqfFileData(f){
  let blob = f.file, type = f.type === 'image/jpg' ? 'image/jpeg' : f.type, name = f.name;
  if (/^image\/(jpeg|png|webp)$/.test(type) && blob.size > 1.2 * 1024 * 1024 && window.createImageBitmap) {
    try {
      const bmp = await createImageBitmap(blob), sc = Math.min(1, 2200 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const small = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
      if (small && small.size < blob.size) { blob = small; type = 'image/jpeg'; name = name.replace(/\.\w+$/, '') + '.jpg'; }
    } catch (e) {}
  }
  if (blob.size > 10 * 1024 * 1024) throw new Error('File is larger than 10 MB: ' + f.name);
  const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(new Error('Could not read ' + f.name)); fr.readAsDataURL(blob); });
  return {name:name, type:type, data:data};
}
async function enqfSave(thenQuote){
  const cust = (($('enqfCust') || {}).value || '').trim();
  if (!cust) { toast('Please choose the customer.', true); $('enqfCust').focus(); return; }
  const items = ENQF.items.map(it => ({desc:String(it.desc || '').trim(), qty:it.qty, unit:String(it.unit || '').trim(), note:String(it.note || '').trim()})).filter(it => it.desc || Number(it.qty) > 0);
  if (items.some(it => !it.desc)) return toast('An item has a quantity but no description.', true);
  const text = (($('enqfText') || {}).value || '').trim();
  if (!items.length && !text && !ENQF.files.length && !ENQF.existing.length) return toast('Add the customer\'s text, a file, or at least one item.', true);
  const btns = ['enqfSave1', 'enqfSave2'].map(id => $(id)).filter(Boolean); btns.forEach(b => b.disabled = true);
  try {
    let files = [];
    try { files = await Promise.all(ENQF.files.map(enqfFileData)); } catch (e) { return toast(e.message, true); }
    const src = $('enqfSource');
    const p = {customerName:cust, date:$('enqfDate').value, contactPerson:$('enqfContact').value, phone:$('enqfPhone').value, email:$('enqfEmail').value,
      customerRef:$('enqfRef').value, subject:$('enqfSubject').value, requirement:text, items:items, files:files};
    if (src && !src.disabled) p.source = src.value || 'Manual';
    if (ENQF.editId) { p.id = ENQF.editId; p.reviewed = true; }
    const r = await api(ENQF.editId ? 'updateEnquiry' : 'saveEnquiry', p);
    if (!r || !r.ok) {
      const unknown = r && /unknown action/i.test(r.error || '');
      return toast(((r && r.error) || 'Could not save.') + (unknown ? ' — paste the new Code.gs in Apps Script and deploy a New version.' : ''), true);
    }
    const id = ENQF.editId || r.id;
    ENQF.files.forEach(f => { if (f.url) URL.revokeObjectURL(f.url); }); ENQF.files = [];
    closeModal();
    toast((ENQF.editId ? 'Enquiry updated: ' : 'Enquiry saved: ') + id);
    if (typeof renderEnquiries === 'function' && $('enqRows')) await renderEnquiries();
    else { const e = await api('getEnquiries'); if (e && e.ok) ENQ_CACHE = e.documents || []; }
    if (thenQuote) { const d = (ENQ_CACHE || []).find(x => x.id === id); if (d) startQuotationFromEnquiry(d); }
  } finally { btns.forEach(b => b.disabled = false); }
}
/* the older name, still used by a few buttons */
function saveEnquiry(){ return enqfSave(false); }

/* paste anywhere while the box is open: pictures become files, text goes into the message */
document.addEventListener('paste', function(e){
  if (!$('enqfDrop') || $('modal').classList.contains('hidden')) return;
  const cd = e.clipboardData; if (!cd) return;
  const files = Array.from(cd.files || []).filter(f => ENQ_OK_TYPES.test(f.type || ''));
  if (files.length) { e.preventDefault(); enqfAddFiles(files); return; }
  const t = cd.getData('text');
  const tag = (e.target && e.target.tagName) || '';
  if (t && !/INPUT|TEXTAREA/.test(tag)) { e.preventDefault(); enqfAppendText(t); }
});
Object.assign(window, {enquiryForm, saveEnquiry, enqfSave, enqfPickCustomer, enqfAddFiles, enqfRemoveFile, enqfFindItems, enqfAddItem, enqParseItems, enqCustHtml, enqEditBtn, enqAttHtml});


/* ============================================================
   QUOTATION ITEM PICTURES (optional, one per item)
   Paste (click the box, Ctrl+V), choose a file, or use the product's own photo.
   No picture = nothing changes on the quotation.
   ============================================================ */
function qtDriveThumb(u){
  const m = String(u || '').match(/[?&]id=([\w-]{10,})|\/d\/([\w-]{10,})/);
  return m ? 'https://drive.google.com/thumbnail?id=' + (m[1] || m[2]) + '&sz=w1000' : String(u || '');
}
function qtImgSrc(x){ return x ? (x.imagePreview || (x.image ? qtDriveThumb(x.image) : '')) : ''; }
function qtPhotoCell(x, i){
  const src = qtImgSrc(x), p = findProd(x.model) || {};
  if (src) return '<div class="qt-photo has"><img src="' + esc(src) + '" alt=""><button type="button" title="Remove picture" onclick="qtPhotoRemove(' + i + ')">×</button></div>';
  return '<div class="qt-photo" tabindex="0" data-i="' + i + '" title="Click here and press Ctrl+V to paste a picture">'
    + '<span>📷 Picture (optional): <a class="model-link" onclick="qtPhotoPick(' + i + ')">choose</a> or click here &amp; <kbd>Ctrl</kbd>+<kbd>V</kbd></span>'
    + (p['Product Image'] ? ' <a class="model-link" onclick="qtPhotoUseProduct(' + i + ')">use product photo</a>' : '') + '</div>';
}
async function qtPhotoPrep(file){
  let blob = file, type = String(file.type || '').toLowerCase();
  if (!/^image\/(jpeg|jpg|png|webp|gif)$/.test(type)) throw new Error('Please use a JPG or PNG picture.');
  if (window.createImageBitmap && type !== 'image/gif') {
    try {
      const bmp = await createImageBitmap(blob), sc = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      if (sc < 1 || blob.size > 600 * 1024) {
        const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
        const small = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)); if (small) { blob = small; type = 'image/jpeg'; }
      }
    } catch (e) {}
  }
  if (blob.size > 5 * 1024 * 1024) throw new Error('Picture is larger than 5 MB.');
  const data = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(new Error('Could not read the picture.')); fr.readAsDataURL(blob); });
  return {name:(String(file.name || 'item').replace(/\.\w+$/, '') || 'item') + (type === 'image/png' ? '.png' : '.jpg'), type:type, data:data, preview:URL.createObjectURL(blob)};
}
async function qtPhotoSet(i, file){
  const x = QTL[i]; if (!x) return;
  try {
    const r = await qtPhotoPrep(file);
    if (x.imagePreview) URL.revokeObjectURL(x.imagePreview);
    x.imageNew = {name:r.name, type:r.type, data:r.data}; x.imagePreview = r.preview; x.image = '';
    renderQuotationLines();
  } catch (e) { toast(e.message, true); }
}
function qtPhotoPick(i){
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { if (inp.files && inp.files[0]) qtPhotoSet(i, inp.files[0]); };
  inp.click();
}
function qtPhotoUseProduct(i){
  const x = QTL[i], p = x && findProd(x.model); if (!p || !p['Product Image']) return;
  if (x.imagePreview) URL.revokeObjectURL(x.imagePreview);
  x.image = p['Product Image']; x.imageNew = null; x.imagePreview = ''; renderQuotationLines();
}
function qtPhotoRemove(i){
  const x = QTL[i]; if (!x) return;
  if (x.imagePreview) URL.revokeObjectURL(x.imagePreview);
  x.image = ''; x.imageNew = null; x.imagePreview = ''; renderQuotationLines();
}
document.addEventListener('paste', function(e){
  const box = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.qt-photo[data-i]') : null;
  if (!box || !e.clipboardData) return;
  const f = Array.from(e.clipboardData.files || []).find(x => /^image\//.test(x.type || ''));
  if (!f) { toast('No picture found on the clipboard — copy a picture first.', true); return; }
  e.preventDefault(); qtPhotoSet(Number(box.dataset.i), f);
});
Object.assign(window, {qtPhotoPick, qtPhotoUseProduct, qtPhotoRemove, qtPhotoSet, qtImgSrc});


/* ============================================================
   CUSTOMER GROUPS — manager with suggestions
   Groups only change how the dashboard Top 10 adds sales up.
   DCs, invoices, quotations, ledgers and outstanding stay per company.
   ============================================================ */
const CG_SKIP = new Set(['the','m/s','ms','pak','pakistan','al','new','national','united','international','global','general','star','royal','city','karachi','lahore','sindh','punjab']);
function cgFirstWord(n){ const w = String(n || '').replace(/^m\/s\.?\s*/i, '').trim().split(/[\s\-.,&()]+/)[0] || ''; return w.length >= 4 && !CG_SKIP.has(w.toLowerCase()) ? w : ''; }
function cgNtn(c){ const d = String(c['NTN/Tax ID'] || '').replace(/\D/g, ''); return d.length >= 5 ? d : ''; }
function cgSuggestions(){
  const cs = (S.customers || []).filter(c => String(c.Status || 'Active').toLowerCase() !== 'inactive' && c['Customer Name']);
  const out = [], used = new Set();
  const push = (why, list, name) => {
    const ungrouped = list.filter(c => !groupOfRemarks(c.Remarks));
    if (list.length < 2 || !ungrouped.length) return;
    const k = list.map(c => norm(c['Customer Name'])).sort().join('|'); if (used.has(k)) return; used.add(k);
    const existing = list.map(c => groupOfRemarks(c.Remarks)).find(Boolean);
    out.push({why:why, name:existing || name, members:list});
  };
  const byNtn = {}; cs.forEach(c => { const n = cgNtn(c); if (n) (byNtn[n] = byNtn[n] || []).push(c); });
  Object.entries(byNtn).forEach(([n, l]) => push('Same NTN ' + n, l, (cgFirstWord(l[0]['Customer Name']) || l[0]['Customer Name']).toUpperCase() + ' GROUP'));
  const byWord = {}; cs.forEach(c => { const w = cgFirstWord(c['Customer Name']); if (w) (byWord[w.toLowerCase()] = byWord[w.toLowerCase()] || []).push(c); });
  Object.values(byWord).forEach(l => push('Names start with “' + cgFirstWord(l[0]['Customer Name']) + '”', l, cgFirstWord(l[0]['Customer Name']).toUpperCase() + ' GROUP'));
  /* drop a suggestion whose companies are all inside a bigger suggestion */
  const keyset = g => new Set(g.members.map(c => norm(c['Customer Name'])));
  const sets = out.map(keyset);
  return out.filter((g, i) => !sets.some((t, j) => j !== i && t.size > sets[i].size && [...sets[i]].every(x => t.has(x)))).sort((a, b) => b.members.length - a.members.length).slice(0, 30);
}
function customerGroupsManager(){
  const can = isAdmin() || hasMod('parties');
  const groups = {};
  (S.customers || []).forEach(c => { const g = groupOfRemarks(c.Remarks); if (g) (groups[g.toUpperCase()] = groups[g.toUpperCase()] || {name:g, list:[]}).list.push(c['Customer Name']); });
  const glist = Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  window.CG_SUG = can ? cgSuggestions() : [];
  modal('Customer Groups', '<div class="cg">'
    + '<p class="muted" style="margin-top:0">A group only adds the sales of its companies together in the dashboard <b>Top 10</b> (switch “Group”). DCs, invoices, quotations, ledgers and outstanding stay separate for every company. To put one customer in a group, you can also use <b>Customers → Edit → Group</b>.</p>'
    + '<h4>Groups (' + glist.length + ')</h4>'
    + (glist.length ? glist.map(g => '<div class="cg-g"><b>' + esc(g.name) + '</b> <span class="muted small">' + g.list.length + ' compan' + (g.list.length === 1 ? 'y' : 'ies') + '</span><div class="cg-chips">' + g.list.map(n => '<span>' + esc(n) + (can ? ' <a title="Remove from group" onclick="cgRemove(\'' + encA(n) + '\')">×</a>' : '') + '</span>').join('') + '</div></div>').join('') : '<div class="muted">No groups yet.</div>')
    + (can ? '<h4 style="margin-top:18px">Suggestions (' + CG_SUG.length + ')</h4>'
      + (CG_SUG.length ? CG_SUG.map((g, i) => '<div class="cg-s"><div class="cg-s-head"><span class="muted small">' + esc(g.why) + '</span><input id="cgName' + i + '" value="' + esc(g.name) + '" placeholder="Group name"><button class="btn small primary" onclick="cgApply(' + i + ')">Make group</button></div><div class="cg-chips">'
          + g.members.map((c, k) => { const cur = groupOfRemarks(c.Remarks); return '<label><input type="checkbox" id="cgM' + i + '_' + k + '" checked> ' + esc(c['Customer Name']) + (cur ? ' <small class="muted">(' + esc(cur) + ')</small>' : '') + '</label>'; }).join('') + '</div></div>').join('')
        : '<div class="muted">No suggestions — customers with the same NTN or the same first word in their name will appear here.</div>') : '')
    + '<div class="actions"><button class="btn" onclick="closeModal()">Close</button></div></div>');
}
async function cgSetGroup(names, group){
  let ok = 0, fail = [];
  for (const n of names) {
    const c = findCust(n); if (!c) { fail.push(n); continue; }
    if ((groupOfRemarks(c.Remarks) || '').toUpperCase() === String(group || '').trim().toUpperCase()) { ok++; continue; }
    const r = await api('updateCustomer', {name:c['Customer Name'], contact:c['Contact Person'] || '', phone:c.Phone || '', email:c.Email || '', address:c.Address || '', ntn:c['NTN/Tax ID'] || '', remarks:remarksWithGroup(c.Remarks || '', group)});
    if (r && r.ok) { ok++; c.Remarks = remarksWithGroup(c.Remarks || '', group); } else fail.push(n + (r && r.error ? ' (' + r.error + ')' : ''));
  }
  return {ok, fail};
}
async function cgApply(i){
  const g = (window.CG_SUG || [])[i]; if (!g) return;
  const name = (($('cgName' + i) || {}).value || '').trim().replace(/\s+/g, ' ');
  if (!name) return toast('Please write a group name.', true);
  const names = g.members.filter((c, k) => ($('cgM' + i + '_' + k) || {}).checked).map(c => c['Customer Name']);
  if (names.length < 2) return toast('Tick at least 2 companies.', true);
  const res = await cgSetGroup(names, name);
  if (res.fail.length) toast('Could not update: ' + res.fail.join(', '), true); else toast('Group “' + name + '” saved for ' + res.ok + ' companies.');
  await refresh(); customerGroupsManager();
}
async function cgRemove(enc){
  const n = decodeURIComponent(enc);
  if (!confirm('Remove ' + n + ' from its group?')) return;
  const res = await cgSetGroup([n], '');
  if (res.fail.length) toast('Could not update: ' + res.fail.join(', '), true); else toast(n + ' removed from the group.');
  await refresh(); customerGroupsManager();
}
Object.assign(window, {customerGroupsManager, cgApply, cgRemove});


/* ============================================================
   STOCK TOOLS — where the stock comes from, old sheet record, Set Stock (Admin)
   Stock in the ERP = old live-inventory sheet (column G, copied at "Refresh Source")
                    + ERP entries (Inward / Import +, DC −, Stock Adjustment ±)
   ============================================================ */
async function loadSourceRecords(model, hostId, full){
  const host = $(hostId); if (!host) return;
  const r = await api('getSourceRecords', {model:model});
  const h = $(hostId); if (!h) return;
  if (!r || !r.ok) { h.innerHTML = '<span class="muted small">' + esc((r && r.error) || 'Could not load the old sheet record.') + (r && /unknown action/i.test(r.error || '') ? ' — paste the new Code.gs in Apps Script and deploy a New version.' : '') + '</span>'; return; }
  const u = r.used || {}, fmt = n => (Math.round((Number(n) || 0) * 1000) / 1000).toLocaleString();
  const near = (r.sheets || []).reduce((a, s) => a + (s.rows || []).filter(x => !x.exact).length, 0);
  const line = '<b>Stock ' + fmt(u.erpStock) + '</b> = old inventory sheet <b>' + fmt(u.sourceQty) + '</b>' + (u.sourceRows > 1 ? ' <span class="pd-warn">(' + u.sourceRows + ' rows added together)</span>' : u.sourceRows === 0 ? ' <span class="pd-warn">(not in the old sheet)</span>' : '')
    + ' + ERP entries <b>' + (Number(u.erpMoves) > 0 ? '+' : '') + fmt(u.erpMoves) + '</b>'
    + (near ? ' · <span class="pd-warn">⚠ ' + near + ' row(s) in the old sheet have this model written differently</span>' : '');
  if (!full) { h.innerHTML = line + ' · <a class="model-link" onclick="showProductHistory(\'' + encA(model) + '\')">see record</a>'; return; }
  h.innerHTML = '<h4 style="margin:0 0 6px">Old inventory sheet (as last copied by “Refresh Source”)</h4><div class="muted small" style="margin-bottom:8px">' + line + '</div>'
    + (r.sheets || []).map(sh => {
        const nm = sh.sheet.replace('Source ', '');
        if (sh.missing) return '<div class="muted small" style="margin:6px 0">' + esc(nm) + ': not copied yet.</div>';
        if (!sh.rows.length) return '<div class="muted small" style="margin:6px 0">' + esc(nm) + ': no rows for this model.</div>';
        return '<div style="margin:10px 0 4px"><b>' + esc(nm) + '</b> <span class="muted small">' + sh.rows.length + ' row(s)' + (sh.more ? ' (+' + sh.more + ' more)' : '') + '</span></div>'
          + '<div class="table-wrap"><table class="src-tbl"><thead><tr><th>Row</th>' + sh.headers.map(x => '<th>' + esc(x || '—') + '</th>').join('') + '</tr></thead><tbody>'
          + sh.rows.map(x => '<tr' + (x.exact ? '' : ' class="src-near" title="Model written differently in the old sheet"') + '><td class="muted">' + x.row + (x.exact ? '' : ' ⚠') + '</td>' + x.cells.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('')
          + '</tbody></table></div>';
      }).join('');
}

function setStockForm(em){
  const m = decodeURIComponent(em), p = S.products.find(x => x['Model / Part No.'] === m); if (!p) return;
  modal('Set Stock — ' + m, '<div class="form-grid">'
    + '<label>Stock in ERP now<input value="' + esc(p.currentStock) + '" readonly></label>'
    + '<label>Correct quantity (physical) *<input id="ssQty" type="number" min="0" step="any" placeholder="e.g. 12"></label>'
    + '<label>Reason<select id="ssWhy"><option>Physical count</option><option>Damaged / scrapped</option><option>Lost / missing</option><option>Found in store</option><option>Data correction</option><option>Other</option></select></label>'
    + '<label>Note <small>(optional)</small><input id="ssNote" placeholder="e.g. counted by Ali, rack R-12"></label></div>'
    + '<div class="imp-warn" style="margin-top:10px">The ERP will add one <b>Stock Adjustment</b> entry for the difference. Nothing else is changed, and the entry shows in Product History.</div>'
    + '<div class="actions"><button class="btn" onclick="productDetail(\'' + encA(m) + '\')">Back</button><button class="btn primary" id="ssSave" onclick="saveSetStock(\'' + encA(m) + '\')">Set Stock</button></div>');
  setTimeout(() => { const q = $('ssQty'); if (q) q.focus(); }, 30);
}
async function saveSetStock(em){
  const m = decodeURIComponent(em), q = ($('ssQty') || {}).value;
  if (q === '' || q == null) return toast('Enter the correct quantity.', true);
  if (Number(q) < 0) return toast('Quantity cannot be negative.', true);
  const reason = [($('ssWhy') || {}).value, (($('ssNote') || {}).value || '').trim()].filter(Boolean).join(' — ');
  const b = $('ssSave'); if (b) b.disabled = true;
  const r = await api('adjustStock', {model:m, qty:q, reason:reason});
  if (b) b.disabled = false;
  if (!r || !r.ok) return toast(((r && r.error) || 'Could not set stock.') + (r && /unknown action/i.test(r.error || '') ? ' — paste the new Code.gs in Apps Script and deploy a New version.' : ''), true);
  toast(r.changed ? 'Stock of ' + m + ' set to ' + r.after + ' (' + (r.changed > 0 ? '+' : '') + r.changed + ').' : (r.message || 'No change.'));
  await refresh();
  productDetail(encodeURIComponent(m));
}
Object.assign(window, {loadSourceRecords, setStockForm, saveSetStock});
