const DEFAULT_API=(window.SFS_CONFIG&&window.SFS_CONFIG.API_URL)||localStorage.sfsApiUrl||'';
const CATS=['Airline Equipment','Valves','Cylinder','Fittings/Tubing','Others'];
const ALL_MODULES=[
  {id:'products', label:'Products'},
  {id:'sales',    label:'Sales (DC / Invoice)'},
  {id:'accounts', label:'Accounts (Payments)'},
  {id:'parties',  label:'Parties (Customers / Suppliers)'},
  {id:'reports',  label:'Reports'}
];

let S={session:sessionStorage.sfsSession||'',user:null,products:[],customers:[],suppliers:[],tx:[],api:DEFAULT_API};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* ---------- MODULE HELPERS ---------- */
function isAdmin(){ return S.user && String(S.user.role||'').toUpperCase()==='ADMIN'; }
function userModules(){ return Array.isArray(S.user?.modules) ? S.user.modules : []; }
function hasMod(id){
  if (isAdmin()) return true;
  return userModules().indexOf(id) !== -1;
}

/* ---------- NAV ---------- */
function nav(){
  const all=[
    ['dashboard','Dashboard', null],
    ['products','Products', 'products'],
    ['inward','Inward / Purchase', 'products'],
    ['dc','Delivery Challans', 'sales'],
    ['invoices','Invoices', 'sales'],
    ['accounts','Accounts / Payments', 'accounts'],
    ['customers','Customers', 'parties'],
    ['suppliers','Suppliers', 'parties'],
    ['reports','Reports', 'reports'],
    ['settings','Settings', null]
  ];
  if (isAdmin()) all.push(['users','Users / Staff', null]);

  const items = all.filter(x => x[2] === null || hasMod(x[2]));

  $('nav').innerHTML = items.map(x => 
    `<button class="navbtn" onclick="showPage('${x[0]}',this)">${x[1]}</button>`
  ).join('');

  // Default page: agar dashboard available hai to woh, warna pehla item
  const first = items.find(x => x[0] === 'dashboard') || items[0];
  if (first) {
    const btn = document.querySelector(`.navbtn[onclick*="'${first[0]}'"]`);
    if (btn) showPage(first[0], btn);
  }
}

/* ---------- JSONP + API ---------- */
function jsonpRequest(url,payload){
  return new Promise(function(resolve){
    var cb='sfs_cb_'+Date.now()+'_'+Math.floor(Math.random()*100000),
        script=document.createElement('script'),done=false;
    window[cb]=function(data){done=true;cleanup();resolve(data)};
    function cleanup(){
      try{delete window[cb]}catch(e){window[cb]=undefined}
      if(script.parentNode)script.parentNode.removeChild(script)
    }
    script.onerror=function(){if(done)return;done=true;cleanup();resolve({ok:false,error:'Connection error. Please try again.'})};
    var params=new URLSearchParams();
    params.set('action',payload.action||'');
    params.set('callback',cb);
    var copy=Object.assign({},payload);
    delete copy.action;
    if(copy.session)params.set('session',copy.session);
    delete copy.session;
    if(Object.keys(copy).length)params.set('data',encodeURIComponent(JSON.stringify(copy)));
    script.src=url+(url.indexOf('?')>=0?'&':'?')+params.toString();
    document.head.appendChild(script);
    setTimeout(function(){if(!done){done=true;cleanup();resolve({ok:false,error:'Connection timeout. Please try again.'})}},15000)
  })
}

async function api(action,data={}){
  if(!S.api)return {ok:false,error:'Backend URL not configured'};
  var payload=Object.assign({action:action,session:S.session||''},data||{});
  try{
    var r=await fetch(S.api,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    var text=await r.text(),j;
    try{j=JSON.parse(text)}catch(e){j=null}
    if(j)return j;
  }catch(e){console.warn('POST failed; JSONP fallback.',e)}
  return await jsonpRequest(S.api,payload);
}

/* ---------- LOGIN ---------- */
async function login(){
  const user=$('loginUser').value.trim(),pass=$('loginPass').value;
  S.api=(window.SFS_CONFIG&&window.SFS_CONFIG.API_URL)||DEFAULT_API||localStorage.sfsApiUrl||'';
  if(!S.api){$('loginError').textContent='System connection is not configured.';return}
  if(!user||!pass){$('loginError').textContent='Username and password are required.';return}
  $('loginError').textContent='Signing in...';
  const r=await api('login',{username:user,password:pass});
  if(!r.ok){$('loginError').textContent=r.error||'Invalid username or password';return}
  S.session=r.session;S.user=r.user;
  sessionStorage.sfsSession=S.session;
  sessionStorage.sfsUser=JSON.stringify(S.user||{});
  enter();
}

async function enter(){
  $('login').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('who').textContent=S.user.name;
  $('role').textContent=S.user.role;
  nav();
  await refresh();
}

function logout(){
  if(S.session)api('logout').catch(()=>{});
  sessionStorage.clear();
  localStorage.removeItem('sfsSession');
  localStorage.removeItem('sfsUser');
  location.reload();
}

async function refresh(){
  const r=await api('bootstrap');
  if(!r.ok){if(r.error==='Unauthorized'){logout();return}toast(r.error||'Could not load data',true);return}
  S.user=r.user;
  S.products=r.products||[];
  S.customers=r.customers||[];
  S.suppliers=r.suppliers||[];
  S.tx=r.transactions||[];
  // Nav dobara render karo (modules change ho sakte hain)
  nav();
}

/* ---------- PAGE ROUTER ---------- */
function showPage(p,btn){
  document.querySelectorAll('.navbtn').forEach(x=>x.classList.remove('active'));
  if(btn)btn.classList.add('active');
  $('pageTitle').textContent=btn?btn.textContent:p;
  if(!pages[p]){ $('content').innerHTML='<div class="wrap"><div class="panel">Page not found.</div></div>'; return; }
  $('content').innerHTML=pages[p]();
  if(p==='dashboard')renderDashboard();
  if(p==='products')renderProducts();
  if(p==='inward')renderInward();
  if(p==='dc')renderDC();
  if(p==='invoices')renderInvoice();
  if(p==='accounts')renderAccounts();
  if(p==='customers')renderCustomers();
  if(p==='suppliers')renderSuppliers();
  if(p==='reports')renderReports();
  if(p==='settings')renderSettings();
  if(p==='users')renderUsers();
}

/* ---------- PAGES ---------- */
const pages={
  dashboard:()=>`<div class="wrap" id="dash"></div>`,
  products:()=>`<div class="wrap"><div class="toolbar"><input id="ps" placeholder="Search model / description / location" oninput="renderProducts()"><select id="pc" onchange="renderProducts()"><option value="">All Categories</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select><button class="btn primary" onclick="productForm()">+ Add Product</button></div><div class="panel table-wrap"><table><thead><tr><th>Image</th><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Location</th><th>Stock</th></tr></thead><tbody id="prows"></tbody></table></div></div>`,
  inward:()=>`<div class="wrap"><div class="panel"><h3>Inward / Local Purchase</h3><div class="form-grid"><label>Date<input id="idate" type="date"></label><label>Source Type<select id="itype"><option>Local Purchase</option><option>Import</option><option>Opening</option><option>Customer Return</option></select></label><label>Model / Part No.<input id="imodel" list="mlist"></label><label>Quantity<input id="iqty" type="number" min="0.01"></label><label>Supplier<input id="isupplier"></label><label>Supplier Reference<input id="iref"></label><label>Purchase Cost<input id="icost" type="number" min="0"></label><label>Remarks<input id="irem"></label></div><button class="btn primary" onclick="saveInward()">Save Inward</button></div></div>`,
  dc:()=>`<div class="wrap"><div class="panel"><h3>Delivery Challan</h3><div class="form-grid"><label>Challan #<input id="dcno"></label><label>Date<input id="dcdate" type="date"></label><label>Customer<input id="dccust" list="clist"></label><label>Customer ID<input id="dcid"></label><label>PO #<input id="dcpo"></label><label>PO Date<input id="dcpodate" type="date"></label><label>STN<input id="dcstn"></label><label>NTN<input id="dcntn"></label><label class="wide">Address<textarea id="dcaddr"></textarea></label></div><div class="panel"><button class="btn small" onclick="addDc()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Unit</th><th></th></tr></thead><tbody id="dclines"></tbody></table></div></div><div class="actions"><button class="btn primary" onclick="saveDC(false)">Save DC</button><button class="btn ghost" onclick="saveDC(true)">Save & Print</button></div></div></div>`,
  invoices:()=>`<div class="wrap"><div class="panel"><h3>Invoice</h3><div class="form-grid"><label>Invoice #<input id="ivno"></label><label>Date<input id="ivdate" type="date"></label><label>Customer<input id="ivcust" list="clist"></label><label>PO #<input id="ivpo"></label><label>PO Date<input id="ivpodate"></label><label>DC #<input id="ivdc"></label><label>DC Date<input id="ivdcdate"></label><label>STN<input id="ivstn"></label><label>NTN<input id="ivntn"></label></div><div class="panel"><button class="btn small" onclick="addInv()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead><tbody id="ivlines"></tbody></table></div><h3 class="right">Subtotal: <span id="ivtotal">0.00</span></h3></div><div class="actions"><button class="btn primary" onclick="saveInvoice(false)">Save Invoice</button><button class="btn ghost" onclick="saveInvoice(true)">Save & Print</button></div></div></div>`,
  accounts:()=>`<div class="wrap"><div class="panel-head"><h3>Accounts / Payments</h3></div><div class="panel"><p class="muted">Customer payments, supplier payments, outstanding — Accounts module ke through.</p><div class="actions"><button class="btn" onclick="renderAccounts()">Refresh</button></div></div><div id="accountsBody"></div></div>`,
  customers:()=>`<div class="wrap"><div class="panel-head"><h3>Customers</h3><button class="btn primary" onclick="partyForm('Customer')">+ Add Customer</button></div><div class="panel"><div id="customers"></div></div></div>`,
  suppliers:()=>`<div class="wrap"><div class="panel-head"><h3>Suppliers</h3><button class="btn primary" onclick="partyForm('Supplier')">+ Add Supplier</button></div><div class="panel"><div id="suppliers"></div></div></div>`,
  reports:()=>`<div class="wrap"><div class="toolbar"><select id="ry"><option>2026</option><option>2025</option><option>2024</option></select><button class="btn" onclick="renderReports()">Refresh</button></div><div id="reports"></div></div>`,
  settings:()=>`<div class="wrap"><div class="panel"><h3>System Settings</h3><p class="muted">Original live inventory read-only hai. Ye software sirf apni separate database mein likhta hai.</p><label>Apps Script Web App URL<input id="apiurl" class="input" value="${esc(S.api)}"></label><div class="actions"><button class="btn primary" onclick="saveSettings()">Save Settings</button></div><hr><button class="btn" onclick="changePasswordForm()">Change My Password</button>${isAdmin()?'<button class="btn" onclick="refreshSource()">Refresh Source Snapshot</button>':''}</div></div>`,
  users:()=>`<div class="wrap"><div class="panel-head"><h3>Users / Staff</h3><button class="btn primary" onclick="userForm()">+ Add Staff</button></div><div class="panel"><div id="users"></div></div></div>`
};

/* ---------- DASHBOARD ---------- */
function renderDashboard(){
  $('dash').innerHTML=
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
  let q=($('ps')?.value||'').toLowerCase(),c=$('pc')?.value||'';
  let a=S.products.filter(p=>[p['Model / Part No.'],p.Description,p.Location].join(' ').toLowerCase().includes(q)&&(!c||p.Category===c));
  $('prows').innerHTML=a.slice(0,1000).map(p=>
    `<tr>
       <td>${p['Product Image']?`<img class="thumb" src="${esc(p['Product Image'])}">`:'—'}</td>
       <td><a class="model-link" onclick="productDetail('${encodeURIComponent(p['Model / Part No.'])}')">${esc(p['Model / Part No.'])}</a></td>
       <td>${esc(p.Description)}</td>
       <td>${esc(p.Category)}</td>
       <td>${esc(p.Location)}</td>
       <td>${p.currentStock}</td>
     </tr>`).join('')||'<tr><td colspan="6">No products found.</td></tr>';
}

function productDetail(em){
  const m=decodeURIComponent(em),p=S.products.find(x=>x['Model / Part No.']===m);if(!p)return;
  modal('Product Details — '+m,
    `<div class="detail">
       <div>${p['Product Image']?`<img src="${esc(p['Product Image'])}">`:'No image'}</div>
       <div class="detail-grid">
         <div class="kv"><b>Model</b><br>${esc(p['Model / Part No.'])}</div>
         <div class="kv"><b>Description</b><br>${esc(p.Description)}</div>
         <div class="kv"><b>Category</b><br>${esc(p.Category)}</div>
         <div class="kv"><b>Location</b><br>${esc(p.Location)}</div>
         <div class="kv"><b>Current Stock</b><br>${p.currentStock}</div>
         <div class="kv"><b>Sale Price</b><br>${esc(p['Sale Price'])}</div>
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
     <button class="btn primary" onclick="saveProduct()">Save Product</button>`);
}

async function saveProduct(){
  const f=$('pimg').files[0];let b='';if(f)b=await file64(f);
  const r=await api('saveProduct',{model:$('pm').value,category:$('pcat').value,description:$('pdesc').value,brand:$('pbrand').value,unit:$('punit').value,location:$('ploc').value,costPrice:$('pcost').value,salePrice:$('pprice').value,openingStock:$('pop').value,remarks:$('prem').value,imageBase64:b,imageName:f?.name});
  if(!r.ok)return toast(r.error,true);
  closeModal();await refresh();toast('Product saved.');
}

/* ---------- INWARD ---------- */
function renderInward(){$('idate').value=new Date().toISOString().slice(0,10)}
let SFS_SAVING=false;
async function guardedSave(fn){if(SFS_SAVING)return;SFS_SAVING=true;try{await fn()}finally{SFS_SAVING=false}}

async function saveInward(){
  await guardedSave(async()=>{
    const r=await api('saveInward',{date:$('idate').value,sourceType:$('itype').value,model:$('imodel').value,quantity:$('iqty').value,supplier:$('isupplier').value,supplierReference:$('iref').value,purchaseCost:$('icost').value,remarks:$('irem').value});
    if(!r.ok)return toast(r.error,true);
    toast('Inward saved. Stock increased.');
    await refresh();
  });
}

/* ---------- DC ---------- */
let dcl=[],ivl=[];
function renderDC(){dcl=[];addDc();$('dcdate').value=new Date().toISOString().slice(0,10)}
function addDc(){dcl.push({model:'',qty:'',unit:'Pcs'});renderDcLines()}
function renderDcLines(){
  if(!$('dclines'))return;
  $('dclines').innerHTML=dcl.map((x,i)=>
    `<tr>
       <td><input value="${esc(x.model)}" list="ml" onchange="dcl[${i}].model=this.value;renderDcLines()"></td>
       <td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{}).Description||'')}</td>
       <td><input type="number" value="${x.qty}" onchange="dcl[${i}].qty=this.value"></td>
       <td><input value="${x.unit}" onchange="dcl[${i}].unit=this.value"></td>
       <td><button class="btn small" onclick="dcl.splice(${i},1);renderDcLines()">×</button></td>
     </tr>`).join('');
  $('dclines').insertAdjacentHTML('afterend',`<datalist id="ml">${S.products.map(p=>`<option value="${esc(p['Model / Part No.'])}">`).join('')}</datalist>`);
}

async function saveDC(print){
  if(!dcl.length)return;
  await guardedSave(async()=>{
    const p={no:$('dcno').value,date:$('dcdate').value,customer:$('dccust').value,customerId:$('dcid').value,po:$('dcpo').value,poDate:$('dcpodate').value,stn:$('dcstn').value,ntn:$('dcntn').value,address:$('dcaddr').value,items:dcl};
    const r=await api('saveDC',p);
    if(!r.ok)return toast(r.error,true);
    if(print)printDC(p);
    toast('Delivery Challan saved and stock reduced.');
    dcl=[];await refresh();
  });
}

/* ---------- INVOICE ---------- */
function renderInvoice(){ivl=[];addInv();$('ivdate').value=new Date().toISOString().slice(0,10)}
function addInv(){ivl.push({model:'',qty:'',rate:''});renderIvLines()}
function renderIvLines(){
  if(!$('ivlines'))return;
  $('ivlines').innerHTML=ivl.map((x,i)=>
    `<tr>
       <td><input value="${esc(x.model)}" list="ivml" onchange="ivl[${i}].model=this.value;renderIvLines()"></td>
       <td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{}).Description||'')}</td>
       <td><input type="number" value="${x.qty}" onchange="ivl[${i}].qty=this.value;renderIvLines()"></td>
       <td><input type="number" value="${x.rate}" onchange="ivl[${i}].rate=this.value;renderIvLines()"></td>
       <td>${((+x.qty||0)*(+x.rate||0)).toFixed(2)}</td>
       <td><button class="btn small" onclick="ivl.splice(${i},1);renderIvLines()">×</button></td>
     </tr>`).join('');
  $('ivlines').insertAdjacentHTML('afterend',`<datalist id="ivml">${S.products.map(p=>`<option value="${esc(p['Model / Part No.'])}">`).join('')}</datalist>`);
  $('ivtotal').textContent=ivl.reduce((a,x)=>a+(+x.qty||0)*(+x.rate||0),0).toFixed(2);
}

async function saveInvoice(print){
  await guardedSave(async()=>{
    const p={no:$('ivno').value,date:$('ivdate').value,customer:$('ivcust').value,po:$('ivpo').value,poDate:$('ivpodate').value,dc:$('ivdc').value,dcDate:$('ivdcdate').value,stn:$('ivstn').value,ntn:$('ivntn').value,items:ivl};
    const r=await api('saveInvoice',p);
    if(!r.ok)return toast(r.error,true);
    if(print)printInvoice({...p,total:r.subtotal});
    toast('Invoice saved.');
    await refresh();
  });
}

/* ---------- ACCOUNTS (placeholder page — payments future) ---------- */
function renderAccounts(){
  const body=$('accountsBody');
  if(!body) return;
  body.innerHTML=`<div class="panel"><h3>Coming Soon</h3><p class="muted">Payments aur outstanding ka full UI yahan aayega. Filhaal API ready hai.</p></div>`;
}

/* ---------- CUSTOMERS / SUPPLIERS ---------- */
function renderCustomers(){
  $('customers').innerHTML=S.customers.map(c=>
    `<div class="kv">
       <b>${esc(c.Name)}</b> — ${esc(c['Customer ID'])}<br>
       ${esc(c['Contact Person'])} • ${esc(c.Phone)} • ${esc(c.Email)}<br>
       ${esc(c.Address)}<br>
       <button class="btn small" onclick="ledger('Customer','${encodeURIComponent(c.Name)}')">Ledger</button>
     </div>`).join('')||'No customers yet.';
}

function renderSuppliers(){
  $('suppliers').innerHTML=S.suppliers.map(c=>
    `<div class="kv">
       <b>${esc(c.Name)}</b> — ${esc(c['Supplier ID'])}<br>
       ${esc(c['Contact Person'])} • ${esc(c.Phone)} • ${esc(c.Email)}<br>
       ${esc(c.Address)}<br>
       <button class="btn small" onclick="ledger('Supplier','${encodeURIComponent(c.Name)}')">Ledger</button>
     </div>`).join('')||'No suppliers yet.';
}

function partyForm(type){
  modal('Add '+type,
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
     <button class="btn primary" onclick="saveParty('${type}')">Save</button>`);
}

async function saveParty(type){
  const r=await api(type==='Customer'?'saveCustomer':'saveSupplier',{name:$('pn').value,contact:$('pcontact').value,phone:$('pphone').value,email:$('pemail').value,city:$('pcity').value,ntn:$('pntn').value,stn:$('pstn').value,address:$('paddr').value,remarks:$('pr').value});
  if(!r.ok)return toast(r.error,true);
  closeModal();await refresh();
  toast(type+' saved.');
}

async function ledger(type,name){
  const r=await api('getLedger',{type,name:decodeURIComponent(name)});
  if(!r.ok)return toast(r.error,true);
  modal(type+' Ledger — '+decodeURIComponent(name),
    `<table>
       <tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Remarks</th></tr>
       ${r.transactions.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.type)}</td><td>${esc(x.ref)}</td><td>${x.debit}</td><td>${x.credit}</td><td>${esc(x.remarks)}</td></tr>`).join('')||'<tr><td colspan="6">No transactions.</td></tr>'}
     </table>`);
}

/* ---------- REPORTS ---------- */
async function renderReports(){
  const r=await api('getReports',{year:$('ry')?.value||new Date().getFullYear()});
  if(!r.ok)return toast(r.error,true);
  $('reports').innerHTML=
    `<div class="cards">
       <div class="card"><span>Invoices</span><strong>${r.sales.length}</strong></div>
       <div class="card"><span>Sales</span><strong>${r.sales.reduce((a,x)=>a+(+x.total||0),0).toLocaleString()}</strong></div>
     </div>
     <div class="panel"><h3>Sales by Category</h3><div class="catgrid">${CATS.map(c=>`<div class="cat"><span>${c}</span><b>${(r.categorySales[c]||0).toLocaleString()}</b></div>`).join('')}</div></div>
     <div class="panel table-wrap"><h3>Recent Stock Movement</h3>
       <table>
         <tr><th>Date</th><th>Type</th><th>Model</th><th>IN</th><th>OUT</th><th>Party</th><th>Reference</th><th>By</th></tr>
         ${r.movements.map(x=>`<tr><td>${esc(x.Date)}</td><td>${esc(x.Type)}</td><td>${esc(x['Model / Part No.'])}</td><td>${x['Qty IN']}</td><td>${x['Qty OUT']}</td><td>${esc(x.Party)}</td><td>${esc(x.Reference)}</td><td>${esc(x['Created By'])}</td></tr>`).join('')}
       </table>
     </div>`;
}

/* ---------- SETTINGS ---------- */
function renderSettings(){}
function saveSettings(){
  S.api=$('apiurl').value.trim();
  localStorage.sfsApiUrl=S.api;
  toast('Backend URL saved. Login again.');
  logout();
}
async function refreshSource(){
  const r=await api('refreshSource');
  toast(r.ok?'Source snapshot refreshed.':r.error, !r.ok);
  await refresh();
}
function changePasswordForm(){
  modal('Change Password',
    `<label>Current Password<input id="cp1" type="password"></label>
     <label>New Password<input id="cp2" type="password"></label>
     <label>Confirm Password<input id="cp3" type="password"></label>
     <button class="btn primary" onclick="changePassword()">Change Password</button>`);
}
async function changePassword(){
  if($('cp2').value!==$('cp3').value)return toast('Passwords do not match',true);
  const r=await api('changePassword',{currentPassword:$('cp1').value,newPassword:$('cp2').value});
  if(!r.ok)return toast(r.error,true);
  closeModal();toast('Password changed. Login again.');logout();
}

/* ---------- USERS ---------- */
async function renderUsers(){
  const r=await api('listUsers');
  if(!r.ok)return toast(r.error,true);
  $('users').innerHTML=r.users.map(u=>{
    const mods = Array.isArray(u.Modules) ? u.Modules : [];
    const isAdminRow = String(u.Role||'').toUpperCase()==='ADMIN';
    const modBadges = isAdminRow
      ? '<span class="badge badge-admin">All Modules</span>'
      : (mods.length
          ? mods.map(m=>`<span class="badge">${esc((ALL_MODULES.find(x=>x.id===m)||{}).label||m)}</span>`).join('')
          : '<span class="badge badge-none">No modules</span>');

    return `<div class="kv user-row">
      <div class="user-info">
        <b>${esc(u.Name)}</b> — ${esc(u.Username)} — <span class="role">${esc(u.Role)}</span> — <span class="${u.Status==='Active'?'ok':'off'}">${esc(u.Status)}</span>
        <div class="modules-row">${modBadges}</div>
      </div>
      <div class="user-actions">
        <button class="btn small" onclick="userForm('${encodeURIComponent(u.Username)}','${encodeURIComponent(u.Name||'')}','${encodeURIComponent(u.Role||'')}',${JSON.stringify(mods).replace(/"/g,'&quot;')})">Edit Modules</button>
        <button class="btn small" onclick="toggleUser('${encodeURIComponent(u.Username)}','${encodeURIComponent(u.Status)}')">${u.Status==='Active'?'Disable':'Enable'}</button>
      </div>
    </div>`;
  }).join('')||'No users.';
}

function userForm(editUsername, editName, editRole, editModules){
  const isEdit = !!editUsername;
  const u = editUsername ? decodeURIComponent(editUsername) : '';
  const n = editName ? decodeURIComponent(editName) : '';
  const ro = editRole ? decodeURIComponent(editRole) : 'STAFF';
  const mods = Array.isArray(editModules) ? editModules : [];

  modal(isEdit ? 'Edit Staff — '+u : 'Add Staff',
    `<div class="form-grid">
       <label>Name<input id="un" value="${esc(n)}"></label>
       <label>Username<input id="uu" value="${esc(u)}" ${isEdit?'readonly':''}></label>
       <label>Password ${isEdit?'(khaali chhoro agar change nahi karni)':''}<input id="up" type="password"></label>
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
    modules: modules
  };
  if(!payload.username) return toast('Username is required',true);
  if(!isEdit && !payload.password) return toast('Password is required',true);

  const r = await api(isEdit ? 'updateUser' : 'saveUser', payload);
  if(!r.ok) return toast(r.error,true);
  closeModal();
  toast(isEdit ? 'User updated.' : 'Staff created.');
  renderUsers();
}

async function toggleUser(u,st){
  const r=await api('disableUser',{username:decodeURIComponent(u),status:decodeURIComponent(st)==='Active'?'Inactive':'Active'});
  if(!r.ok)return toast(r.error,true);
  renderUsers();
}

/* ---------- TOAST / MODAL / PRINT ---------- */
function toast(msg,isError){
  const host=$('toastHost');
  if(!host){alert(msg);return}
  if(!host.dataset.sfsPositioned){
    host.style.cssText='position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;';
    host.dataset.sfsPositioned='1';
  }
  const el=document.createElement('div');
  el.textContent=msg;
  el.style.cssText='margin-top:8px;padding:10px 16px;border-radius:6px;color:#fff;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.2);'+(isError?'background:#c0392b;':'background:#27ae60;');
  host.appendChild(el);
  setTimeout(()=>{el.remove()},4000);
}

function modal(t,b){
  $('modalTitle').textContent=t;
  $('modalBody').innerHTML=b;
  $('modal').classList.remove('hidden');
}
function closeModal(){$('modal').classList.add('hidden')}
function file64(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}

function printDC(d){
  const rows=d.items.map((x,i)=>
    `<tr>
       <td>${i+1}</td>
       <td>${esc(x.model)}</td>
       <td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{}).Description||'')}</td>
       <td>${x.qty}</td>
       <td>${esc(x.unit)}</td>
     </tr>`).join('');
  printDoc(
    `<h1>DELIVERY CHALLAN</h1>
     <div class="meta">
       <div><b>M/S:</b> ${esc(d.customer)}</div>
       <div><b>DATE:</b> ${esc(d.date)}</div>
       <div><b>CHALLAN #:</b> ${esc(d.no)}</div>
       <div><b>PO #:</b> ${esc(d.po)}</div>
       <div><b>Customer ID:</b> ${esc(d.customerId)}</div>
       <div><b>STN:</b> ${esc(d.stn)}</div>
       <div><b>NTN:</b> ${esc(d.ntn)}</div>
       <div><b>Address:</b> ${esc(d.address)}</div>
     </div>
     <table>
       <tr><th>#</th><th>Model</th><th>Description</th><th>Qty</th><th>Unit</th></tr>
       ${rows}
     </table>
     <div class="footer">Prepared by: ____________________ &nbsp;&nbsp; Received by: ____________________</div>`);
}

function printInvoice(d){
  const rows=d.items.map((x,i)=>
    `<tr>
       <td>${i+1}</td>
       <td>${esc(x.model)}</td>
       <td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{}).Description||'')}</td>
       <td>${x.qty}</td>
       <td>${x.rate}</td>
       <td>${((+x.qty||0)*(+x.rate||0)).toFixed(2)}</td>
     </tr>`).join('');
  printDoc(
    `<h1>INVOICE</h1>
     <div class="meta">
       <div><b>M/S:</b> ${esc(d.customer)}</div>
       <div><b>DATE:</b> ${esc(d.date)}</div>
       <div><b>INVOICE #:</b> ${esc(d.no)}</div>
       <div><b>PO #:</b> ${esc(d.po)}</div>
       <div><b>DC #:</b> ${esc(d.dc)}</div>
       <div><b>STN:</b> ${esc(d.stn)}</div>
       <div><b>NTN:</b> ${esc(d.ntn)}</div>
     </div>
     <table>
       <tr><th>#</th><th>Model</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
       ${rows}
       <tr><td colspan="5" class="right"><b>SUB TOTAL</b></td><td><b>${d.total}</b></td></tr>
     </table>
     <div class="footer">Authorized Signature: ____________________</div>`);
}

function printDoc(body){
  $('printArea').innerHTML=
    `<div class="print-doc">
       <div class="company">
         <h2>STANDARD FLUID SYSTEMS</h2>
         <div>General Industrial Machinery & Equipment</div>
         <div>1410, 14th Floor, K.S Trade Tower, New Challi, Karachi</div>
         <div>Ph: 021 32464447 • Cell: 0301 8212041</div>
       </div>
       ${body}
     </div>`;
  setTimeout(()=>window.print(),100);
}

/* ---------- INIT ---------- */
function showLogin(){
  $('app').classList.add('hidden');
  $('login').classList.remove('hidden');
  $('loginUser')?.focus();
}

function init(){
  S.api=(window.SFS_CONFIG&&window.SFS_CONFIG.API_URL)||localStorage.sfsApiUrl||'';
  if(S.session&&S.api){
    api('bootstrap').then(r=>{
      if(r.ok){
        S.user=r.user;
        S.products=r.products||[];
        S.customers=r.customers||[];
        S.suppliers=r.suppliers||[];
        S.tx=r.transactions||[];
        enter();
      }else{
        sessionStorage.clear();
        showLogin();
      }
    });
  }else{
    showLogin();
  }
}
init();

/* ---------- Global exports for inline onclick ---------- */
window.showPage=showPage;
window.productForm=productForm;
window.saveProduct=saveProduct;
window.productDetail=productDetail;
window.renderProducts=renderProducts;
window.addDc=addDc;
window.addInv=addInv;
window.saveDC=saveDC;
window.saveInvoice=saveInvoice;
window.saveInward=saveInward;
window.renderInward=renderInward;
window.renderCustomers=renderCustomers;
window.renderSuppliers=renderSuppliers;
window.partyForm=partyForm;
window.saveParty=saveParty;
window.ledger=ledger;
window.renderReports=renderReports;
window.renderSettings=renderSettings;
window.saveSettings=saveSettings;
window.refreshSource=refreshSource;
window.changePasswordForm=changePasswordForm;
window.changePassword=changePassword;
window.renderUsers=renderUsers;
window.userForm=userForm;
window.saveUser=saveUser;
window.toggleUser=toggleUser;
window.closeModal=closeModal;
window.login=login;
window.logout=logout;
