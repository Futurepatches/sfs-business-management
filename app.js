const DEFAULT_API=localStorage.sfsApiUrl||'';const CATS=['Airline Equipment','Valves','Cylinder','Fittings/Tubing','Others'];let S={session:sessionStorage.sfsSession||'',user:null,products:[],customers:[],suppliers:[],tx:[],api:localStorage.sfsApiUrl||''};const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function nav(){const items=[['dashboard','Dashboard'],['products','Products'],['inward','Inward / Purchase'],['dc','Delivery Challans'],['invoices','Invoices'],['customers','Customers'],['suppliers','Suppliers'],['reports','Reports'],['settings','Settings']];if(S.user?.role==='ADMIN')items.push(['users','Users / Staff']);$('nav').innerHTML=items.map(x=>`<button class="navbtn ${x[0]==='dashboard'?'active':''}" onclick="showPage('${x[0]}',this)">${x[1]}</button>`).join('');}
async function api(action,data={}){if(!S.api)return {ok:false,error:'Backend URL not configured'};const r=await fetch(S.api,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,session:S.session,...data})});return r.json();}
async function login(){const user=$('loginUser').value.trim(),pass=$('loginPass').value;let url=localStorage.sfsApiUrl;if(!url){$('loginError').textContent='Enter the Apps Script Web App URL first in settings.';return}S.api=url;const r=await api('login',{username:user,password:pass});if(!r.ok){$('loginError').textContent=r.error||'Invalid username or password';return}S.session=r.session;S.user=r.user;sessionStorage.sfsSession=S.session;enter();}
async function enter(){ $('login').classList.add('hidden');$('app').classList.remove('hidden');$('who').textContent=S.user.name;$('role').textContent=S.user.role;nav();await refresh();}
function logout(){if(S.session)api('logout').catch(()=>{});sessionStorage.clear();location.reload()}
async function refresh(){const r=await api('bootstrap');if(!r.ok){if(r.error==='Unauthorized'){logout();return}alert(r.error||'Could not load data');return}S.user=r.user;S.products=r.products||[];S.customers=r.customers||[];S.suppliers=r.suppliers||[];S.tx=r.transactions||[];renderCurrent();}
function showPage(p,btn){document.querySelectorAll('.navbtn').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');$('pageTitle').textContent=btn?btn.textContent:p;$('content').innerHTML=pages[p]?pages[p]():'';if(p==='dashboard')renderDashboard();if(p==='products')renderProducts();if(p==='inward')renderInward();if(p==='dc')renderDC();if(p==='invoices')renderInvoice();if(p==='customers')renderCustomers();if(p==='suppliers')renderSuppliers();if(p==='reports')renderReports();if(p==='settings')renderSettings();if(p==='users')renderUsers();}
function renderCurrent(){const active=document.querySelector('.navbtn.active');showPage(active?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1]||'dashboard',active)}
const pages={dashboard:()=>`<div class="wrap" id="dash"></div>`,products:()=>`<div class="wrap"><div class="toolbar"><input id="ps" placeholder="Search model / description / location" oninput="renderProducts()"><select id="pc" onchange="renderProducts()"><option value="">All Categories</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select><button class="btn primary" onclick="productForm()">+ Add Product</button></div><div class="panel table-wrap"><table><thead><tr><th>Image</th><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Location</th><th>Stock</th></tr></thead><tbody id="prows"></tbody></table></div></div>`,inward:()=>`<div class="wrap"><div class="panel"><h3>Inward / Local Purchase</h3><div class="form-grid"><label>Date<input id="idate" type="date"></label><label>Source Type<select id="itype"><option>Local Purchase</option><option>Import</option><option>Opening</option><option>Customer Return</option></select></label><label>Model / Part No.<input id="imodel" list="mlist"></label><label>Quantity<input id="iqty" type="number" min="0.01"></label><label>Supplier<input id="isupplier"></label><label>Supplier Reference<input id="iref"></label><label>Purchase Cost<input id="icost" type="number" min="0"></label><label>Remarks<input id="irem"></label></div><button class="btn primary" onclick="saveInward()">Save Inward</button></div></div>`,dc:()=>`<div class="wrap"><div class="panel"><h3>Delivery Challan</h3><div class="form-grid"><label>Challan #<input id="dcno"></label><label>Date<input id="dcdate" type="date"></label><label>Customer<input id="dccust" list="clist"></label><label>Customer ID<input id="dcid"></label><label>PO #<input id="dcpo"></label><label>PO Date<input id="dcpodate" type="date"></label><label>STN<input id="dcstn" value="3277876141543"></label><label>NTN<input id="dcntn" value="2221343-7"></label><label class="wide">Address<textarea id="dcaddr"></textarea></label><label>Attn<input id="dcattn"></label></div><div class="panel"><button class="btn small" onclick="addDc()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Unit</th><th></th></tr></thead><tbody id="dclines"></tbody></table></div></div><div class="actions"><button class="btn primary" onclick="saveDC(false)">Save DC</button><button class="btn ghost" onclick="saveDC(true)">Save & Print</button></div></div></div>`,invoices:()=>`<div class="wrap"><div class="panel"><h3>Invoice</h3><div class="form-grid"><label>Invoice #<input id="ivno"></label><label>Date<input id="ivdate" type="date"></label><label>Customer<input id="ivcust" list="clist"></label><label>PO #<input id="ivpo"></label><label>PO Date<input id="ivpodate" type="date"></label><label>DC #<input id="ivdc"></label><label>DC Date<input id="ivdcdate" type="date"></label><label>STN<input id="ivstn" value="3277876141543"></label><label>NTN<input id="ivntn" value="2221343-7"></label><label class="wide">Address<textarea id="ivaddr"></textarea></label><label>Attn<input id="ivattn"></label></div><div class="panel"><button class="btn small" onclick="addInv()">+ Add Item</button><div class="table-wrap"><table><thead><tr><th>Model</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead><tbody id="ivlines"></tbody></table></div><h3 class="right">Subtotal: <span id="ivtotal">0.00</span></h3></div><div class="actions"><button class="btn primary" onclick="saveInvoice(false)">Save Invoice</button><button class="btn ghost" onclick="saveInvoice(true)">Save & Print</button></div></div></div>`,customers:()=>`<div class="wrap"><div class="panel-head"><h3>Customers</h3><button class="btn primary" onclick="partyForm('Customer')">+ Add Customer</button></div><div class="panel"><div id="customers"></div></div></div>`,suppliers:()=>`<div class="wrap"><div class="panel-head"><h3>Suppliers</h3><button class="btn primary" onclick="partyForm('Supplier')">+ Add Supplier</button></div><div class="panel"><div id="suppliers"></div></div></div>`,reports:()=>`<div class="wrap"><div class="toolbar"><select id="ry"><option>2026</option><option>2025</option><option>2024</option></select><button class="btn" onclick="renderReports()">Refresh</button></div><div id="reports"></div></div>`,settings:()=>`<div class="wrap"><div class="panel"><h3>System Settings</h3><p class="muted">The original live inventory remains read-only. This software writes only to the separate database.</p><label>Apps Script Web App URL<input id="apiurl" class="input" value="${esc(S.api)}"></label><div class="actions"><button class="btn primary" onclick="saveSettings()">Save Settings</button></div><hr><button class="btn" onclick="changePasswordForm()">Change My Password</button>${S.user?.role==='ADMIN'?'<button class="btn" onclick="refreshSource()">Refresh Source Snapshot</button>':''}</div></div>`,users:()=>`<div class="wrap"><div class="panel-head"><h3>Users / Staff</h3><button class="btn primary" onclick="userForm()">+ Add Staff</button></div><div class="panel"><div id="users"></div></div></div>`};
function renderDashboard(){$('dash').innerHTML=`<div class="cards"><div class="card"><span>Products</span><strong>${S.products.length}</strong></div><div class="card"><span>Current Stock</span><strong>${S.products.reduce((a,x)=>a+(+x.currentStock||0),0).toLocaleString()}</strong></div><div class="card"><span>Customers</span><strong>${S.customers.length}</strong></div><div class="card"><span>Suppliers</span><strong>${S.suppliers.length}</strong></div></div><div class="panel"><h3>Categories</h3><div class="catgrid">${CATS.map(c=>`<div class="cat"><span>${c}</span><b>${S.products.filter(p=>p.Category===c).length}</b><small class="muted">Products</small></div>`).join('')}</div></div>`}
function renderProducts(){let q=($('ps')?.value||'').toLowerCase(),c=$('pc')?.value||'';let a=S.products.filter(p=>[p['Model / Part No.'],p.Description,p.Location].join(' ').toLowerCase().includes(q)&&( !c||p.Category===c));$('prows').innerHTML=a.slice(0,1000).map(p=>`<tr><td>${p['Product Image']?`<img class="thumb" src="${esc(p['Product Image'])}">`:'—'}</td><td><a class="model-link" onclick="productDetail('${encodeURIComponent(p['Model / Part No.'])}')">${esc(p['Model / Part No.'])}</a></td><td>${esc(p.Description)}</td><td>${esc(p.Category)}</td><td>${esc(p.Location)}</td><td>${p.currentStock}</td></tr>`).join('')||'<tr><td colspan="6">No products found.</td></tr>'}
function productDetail(em){const m=decodeURIComponent(em),p=S.products.find(x=>x['Model / Part No.']===m);if(!p)return;modal('Product Details — '+m,`<div class="detail"><div>${p['Product Image']?`<img src="${esc(p['Product Image'])}">`:'No image'}</div><div class="detail-grid"><div class="kv"><b>Model</b><br>${esc(p['Model / Part No.'])}</div><div class="kv"><b>Description</b><br>${esc(p.Description)}</div><div class="kv"><b>Category</b><br>${esc(p.Category)}</div><div class="kv"><b>Location</b><br>${esc(p.Location)}</div><div class="kv"><b>Current Stock</b><br>${p.currentStock}</div><div class="kv"><b>Sale Price</b><br>${esc(p['Sale Price'])}</div></div></div>`)}
function productForm(){modal('Add / Edit Product',`<div class="form-grid"><label>Model / Part No.<input id="pm"></label><label>Category<select id="pcat">${CATS.map(c=>`<option>${c}</option>`).join('')}</select></label><label class="wide">Description<input id="pdesc"></label><label>Brand<input id="pbrand"></label><label>Unit<input id="punit" value="Pcs"></label><label>Location<input id="ploc"></label><label>Cost Price<input id="pcost" type="number"></label><label>Sale Price<input id="pprice" type="number"></label><label>Opening Stock<input id="pop" type="number" value="0"></label><label>Product Image<input id="pimg" type="file" accept="image/*"></label><label class="wide">Remarks<textarea id="prem"></textarea></label></div><button class="btn primary" onclick="saveProduct()">Save Product</button>`)}
async function saveProduct(){const f=$('pimg').files[0];let b='';if(f)b=await file64(f);const r=await api('saveProduct',{model:$('pm').value,category:$('pcat').value,description:$('pdesc').value,brand:$('pbrand').value,unit:$('punit').value,location:$('ploc').value,costPrice:$('pcost').value,salePrice:$('pprice').value,openingStock:$('pop').value,remarks:$('prem').value,imageBase64:b,imageName:f?.name});if(!r.ok)return alert(r.error);closeModal();await refresh();showPage('products',document.querySelector('.navbtn:nth-child(2)'));alert('Product saved.');}
function renderInward(){const d=new Date().toISOString().slice(0,10);$('idate').value=d}
async function saveInward(){const r=await api('saveInward',{date:$('idate').value,sourceType:$('itype').value,model:$('imodel').value,quantity:$('iqty').value,supplier:$('isupplier').value,supplierReference:$('iref').value,purchaseCost:$('icost').value,remarks:$('irem').value});if(!r.ok)return alert(r.error);alert('Inward saved. Stock increased automatically.');await refresh()}
let dcl=[],ivl=[];function renderDC(){dcl=[];addDc();$('dcdate').value=new Date().toISOString().slice(0,10)}function addDc(){dcl.push({model:'',qty:'',unit:'Pcs'});renderDcLines()}function renderDcLines(){if(!$('dclines'))return;$('dclines').innerHTML=dcl.map((x,i)=>`<tr><td><input value="${esc(x.model)}" list="ml" onchange="dcl[${i}].model=this.value;pickLine(dcl,${i})"></td><td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{}).Description||'')}</td><td><input type="number" value="${x.qty}" onchange="dcl[${i}].qty=this.value"></td><td><input value="${x.unit}" onchange="dcl[${i}].unit=this.value"></td><td><button class="btn small" onclick="dcl.splice(${i},1);renderDcLines()">×</button></td></tr>`).join('');$('dclines').insertAdjacentHTML('afterend',`<datalist id="ml">${S.products.map(p=>`<option value="${esc(p['Model / Part No.'])}">`).join('')}</datalist>`)}function pickLine(a,i){renderDcLines()}
async function saveDC(print){if(!dcl.length)return;const p={no:$('dcno').value,date:$('dcdate').value,customer:$('dccust').value,customerId:$('dcid').value,po:$('dcpo').value,poDate:$('dcpodate').value,stn:$('dcstn').value,ntn:$('dcntn').value,address:$('dcaddr').value,attn:$('dcattn').value,items:dcl};const r=await api('saveDC',p);if(!r.ok)return alert(r.error);if(print)printDC(p);alert('Delivery Challan saved and stock reduced.');dcl=[];await refresh();}
function renderInvoice(){ivl=[];addInv();$('ivdate').value=new Date().toISOString().slice(0,10)}function addInv(){ivl.push({model:'',qty:'',rate:''});renderIvLines()}function renderIvLines(){if(!$('ivlines'))return;$('ivlines').innerHTML=ivl.map((x,i)=>`<tr><td><input value="${esc(x.model)}" list="ivml" onchange="ivl[${i}].model=this.value;renderIvLines()"></td><td>${esc((S.products.find(p=>p['Model / Part No.']===x.model)||{}).Description||'')}</td><td><input type="number" value="${x.qty}" onchange="ivl[${i}].qty=this.value;renderIvLines()"></td><td><input type="number" value="${x.rate}" onchange="ivl[${i}].rate=this.value;renderIvLines()"></td><td>${((+x.qty||0)*(+x.rate||0)).toFixed(2)}</td><td><button class="btn small" onclick="ivl.splice(${i},1);renderIvLines()">×</button></td></tr>`).join('');$('ivlines').insertAdjacentHTML('afterend',`<datalist id="ivml">${S.products.map(p=>`<option value="${esc(p['Model / Part No.'])}">`).join('')}</datalist>`);$('ivtotal').textContent=ivl.reduce((a,x)=>a+(+x.qty||0)*(+x.rate||0),0).toFixed(2)}
async function saveInvoice(print){const p={no:$('ivno').value,date:$('ivdate').value,customer:$('ivcust').value,po:$('ivpo').value,poDate:$('ivpodate').value,dc:$('ivdc').value,dcDate:$('ivdcdate').value,stn:$('ivstn').value,ntn:$('ivntn').value,address:$('ivaddr').value,attn:$('ivattn').value,items:ivl};const r=await api('saveInvoice',p);if(!r.ok)return alert(r.error);if(print)printInvoice({...p,total:r.subtotal});alert('Invoice saved.');await refresh()}
function renderCustomers(){$('customers').innerHTML=S.customers.map(c=>`<div class="kv"><b>${esc(c.Name)}</b> — ${esc(c['Customer ID'])}<br>${esc(c['Contact Person'])} • ${esc(c.Phone)} • ${esc(c.Email)}<br>${esc(c.Address)}<br><button class="btn small" onclick="ledger('Customer','${encodeURIComponent(c.Name)}')">Ledger</button></div>`).join('')||'No customers yet.'}function renderSuppliers(){$('suppliers').innerHTML=S.suppliers.map(c=>`<div class="kv"><b>${esc(c.Name)}</b> — ${esc(c['Supplier ID'])}<br>${esc(c['Contact Person'])} • ${esc(c.Phone)} • ${esc(c.Email)}<br>${esc(c.Address)}<br><button class="btn small" onclick="ledger('Supplier','${encodeURIComponent(c.Name)}')">Ledger</button></div>`).join('')||'No suppliers yet.'}
function partyForm(type){modal('Add '+type,`<div class="form-grid"><label>Name<input id="pn"></label><label>Contact Person<input id="pcontact"></label><label>Phone<input id="pphone"></label><label>Email<input id="pemail"></label><label>City<input id="pcity"></label><label>NTN<input id="pntn"></label><label>STN<input id="pstn"></label><label class="wide">Address<textarea id="paddr"></textarea></label><label class="wide">Remarks<textarea id="pr"></textarea></label></div><button class="btn primary" onclick="saveParty('${type}')">Save</button>`)}async function saveParty(type){const r=await api(type==='Customer'?'saveCustomer':'saveSupplier',{name:$('pn').value,contact:$('pcontact').value,phone:$('pphone').value,email:$('pemail').value,city:$('pcity').value,ntn:$('pntn').value,stn:$('pstn').value,address:$('paddr').value,remarks:$('pr').value});if(!r.ok)return alert(r.error);closeModal();await refresh()}
async function ledger(type,name){const r=await api('getLedger',{type,name:decodeURIComponent(name)});if(!r.ok)return alert(r.error);modal(type+' Ledger — '+decodeURIComponent(name),`<table><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Remarks</th></tr>${r.transactions.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.type)}</td><td>${esc(x.ref)}</td><td>${x.debit}</td><td>${x.credit}</td><td>${esc(x.remarks)}</td></tr>`).join('')||'<tr><td colspan="6">No transactions.</td></tr>'}</table>`)}
async function renderReports(){const r=await api('getReports',{year:$('ry')?.value||new Date().getFullYear()});if(!r.ok)return alert(r.error);$('reports').innerHTML=`<div class="cards"><div class="card"><span>Invoices</span><strong>${r.sales.length}</strong></div><div class="card"><span>Sales</span><strong>${r.sales.reduce((a,x)=>a+(+x.total||0),0).toLocaleString()}</strong></div></div><div class="panel"><h3>Sales by Category</h3><div class="catgrid">${CATS.map(c=>`<div class="cat"><span>${c}</span><b>${(r.categorySales[c]||0).toLocaleString()}</b></div>`).join('')}</div></div><div class="panel table-wrap"><h3>Recent Stock Movement</h3><tr><th>Date</th><th>Type</th><th>Model</th><th>IN</th><th>OUT</th><th>Party</th><th>Reference</th><th>By</th></tr>${r.movements.map(x=>`<tr><td>${esc(x.Date)}</td><td>${esc(x.Type)}</td><td>${esc(x['Model / Part No.'])}</td><td>${x['Qty IN']}</td><td>${x['Qty OUT']}</td><td>${esc(x.Party)}</td><td>${esc(x.Reference)}</td><td>${esc(x['Created By'])}</td></tr>`).join('')}</table></div>`}
function renderSettings(){}function saveSettings(){S.api=$('apiurl').value.trim();localStorage.sfsApiUrl=S.api;alert('Backend URL saved.');}async function refreshSource(){const r=await api('refreshSource');alert(r.ok?'Source snapshot refreshed.':r.error);await refresh()}function changePasswordForm(){modal('Change Password',`<label>Current Password<input id="cp1" type="password"></label><label>New Password<input id="cp2" type="password"></label><label>Confirm Password<input id="cp3" type="password"></label><button class="btn primary" onclick="changePassword()">Change Password</button>`)}async function changePassword(){if($('cp2').value!==$('cp3').value)return alert('Passwords do not match');const r=await api('changePassword',{currentPassword:$('cp1').value,newPassword:$('cp2').value});if(!r.ok)return alert(r.error);closeModal();alert('Password changed. Please login again.');logout()}
async function renderUsers(){const r=await api('listUsers');if(!r.ok)return alert(r.error);$('users').innerHTML=r.users.map(u=>`<div class="kv"><b>${esc(u.Name)}</b> — ${esc(u.Username)} — ${esc(u.Role)} — ${esc(u.Status)} <button class="btn small" onclick="toggleUser('${encodeURIComponent(u.Username)}','${encodeURIComponent(u.Status)}')">${u.Status==='Active'?'Disable':'Enable'}</button></div>`).join('')||'No users.'}function userForm(){modal('Add Staff',`<div class="form-grid"><label>Name<input id="un"></label><label>Username<input id="uu"></label><label>Password<input id="up" type="password"></label><label>Role<select id="ur"><option>STAFF</option><option>ADMIN</option></select></label><label>Phone<input id="uph"></label><label>Email<input id="ue"></label></div><button class="btn primary" onclick="saveUser()">Create User</button>`)}async function saveUser(){const r=await api('saveUser',{name:$('un').value,username:$('uu').value,password:$('up').value,role:$('ur').value,phone:$('uph').value,email:$('ue').value});if(!r.ok)return alert(r.error);closeModal();renderUsers()}async function toggleUser(u,st){const r=await api('disableUser',{username:decodeURIComponent(u),status:decodeURIComponent(st)});if(!r.ok)return alert(r.error);renderUsers()}
function modal(t,b){$('modalTitle').textContent=t;$('modalBody').innerHTML=b;$('modal').classList.remove('hidden')}function closeModal(){$('modal').classList.add('hidden')}function file64(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}

function printDC(d){
    const rows=d.items.map((x,i)=>{
        const pObj=S.products.find(p=>p['Model / Part No.']===x.model)||{};
        return `<tr>
            <td style="text-align:center;">${i+1}</td>
            <td>
                <strong>${esc(pObj.Description || x.model)}</strong><br>
                ${pObj['Model / Part No.'] ? `Model.: ${esc(pObj['Model / Part No.'])}<br>` : ''}
                Make: ${esc(pObj.Brand || 'UNIVER ITALY')}
            </td>
            <td style="text-align:center;">${esc(x.model)}</td>
            <td style="text-align:center;">${esc(x.qty)}<br><span style="font-size:11px;color:#555;">${esc(x.unit)}</span></td>
            <td style="text-align:right;">-</td>
        </tr>`;
    }).join('');

    printDoc(`
        <div class="sfs-header">
            <div class="sfs-company-info">
                <h2>STANDARD FLUID SYSTEMS</h2>
                <p>Pneumatic Solution Provider</p>
            </div>
            <div class="sfs-doc-title">DELIVERY CHALLAN</div>
        </div>
        <div class="sfs-meta-section">
            <div class="sfs-client-box">
                <strong>M/S:</strong> ${esc(d.customer)}<br>
                <strong>Address:</strong> ${esc(d.address)}<br><br>
                <strong>Attn:</strong> ${esc(d.attn || '')}
            </div>
            <div class="sfs-details-box">
                <table style="width:100%; border:none; font-size:13px;">
                    <tr><td><strong>Date:</strong></td><td>${esc(d.date)}</td></tr>
                    <tr><td><strong>Challan #:</strong></td><td>${esc(d.no)}</td></tr>
                    <tr><td><strong>Customer ID:</strong></td><td>${esc(d.customerId)}</td></tr>
                    <tr><td><strong>P.O #:</strong></td><td>${esc(d.po)}</td></tr>
                    <tr><td><strong>P.O Date:</strong></td><td>${esc(d.poDate || '')}</td></tr>
                    <tr><td><strong>STN #:</strong></td><td>${esc(d.stn)}</td></tr>
                    <tr><td><strong>NTN #:</strong></td><td>${esc(d.ntn)}</td></tr>
                </table>
            </div>
        </div>
        <table class="sfs-table">
            <thead>
                <tr>
                    <th style="width: 8%;">Item</th>
                    <th style="width: 42%;">Description</th>
                    <th style="width: 22%;">Item Code #</th>
                    <th style="width: 10%;">Qty.</th>
                    <th style="width: 18%;">Rate / Unit</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="sfs-footer">
            <div><br><br><div class="sfs-signature">Receiver's Signature</div></div>
            <div style="text-align: right;"><br><br><div class="sfs-signature" style="margin-left: auto;">For STANDARD FLUID SYSTEMS</div></div>
        </div>
    `);
}

function printInvoice(d){
    const rows=d.items.map((x,i)=>{
        const pObj=S.products.find(p=>p['Model / Part No.']===x.model)||{};
        const amt=((+x.qty||0)*(+x.rate||0)).toFixed(2);
        return `<tr>
            <td style="text-align:center;">${i+1}</td>
            <td>
                <strong>${esc(pObj.Description || x.model)}</strong><br>
                ${pObj['Model / Part No.'] ? `Model.: ${esc(pObj['Model / Part No.'])}<br>` : ''}
                Make: ${esc(pObj.Brand || 'UNIVER ITALY')}
            </td>
            <td style="text-align:center;">${esc(x.model)}</td>
            <td style="text-align:center;">${esc(x.qty)}</td>
            <td style="text-align:right;">${esc(x.rate)}</td>
            <td style="text-align:right;">${amt}</td>
        </tr>`;
    }).join('');

    printDoc(`
        <div class="sfs-header">
            <div class="sfs-company-info">
                <h2>STANDARD FLUID SYSTEMS</h2>
                <p>Pneumatic Solution Provider</p>
            </div>
            <div class="sfs-doc-title">INVOICE</div>
        </div>
        <div class="sfs-meta-section">
            <div class="sfs-client-box">
                <strong>M/S:</strong> ${esc(d.customer)}<br>
                <strong>Address:</strong> ${esc(d.address || '')}<br><br>
                <strong>Attn:</strong> ${esc(d.attn || '')}
            </div>
            <div class="sfs-details-box">
                <table style="width:100%; border:none; font-size:13px;">
                    <tr><td><strong>Date:</strong></td><td>${esc(d.date)}</td></tr>
                    <tr><td><strong>Invoice #:</strong></td><td>${esc(d.no)}</td></tr>
                    <tr><td><strong>P.O #:</strong></td><td>${esc(d.po)}</td></tr>
                    <tr><td><strong>P.O Date:</strong></td><td>${esc(d.poDate || '')}</td></tr>
                    <tr><td><strong>DC #:</strong></td><td>${esc(d.dc || '')}</td></tr>
                    <tr><td><strong>DC Date:</strong></td><td>${esc(d.dcDate || '')}</td></tr>
                    <tr><td><strong>STN #:</strong></td><td>${esc(d.stn)}</td></tr>
                    <tr><td><strong>NTN #:</strong></td><td>${esc(d.ntn)}</td></tr>
                </table>
            </div>
        </div>
        <table class="sfs-table">
            <thead>
                <tr>
                    <th style="width: 8%;">Item</th>
                    <th style="width: 38%;">Description</th>
                    <th style="width: 18%;">Item Code #</th>
                    <th style="width: 10%;">Qty.</th>
                    <th style="width: 13%;">Rate / Unit</th>
                    <th style="width: 13%;">Amount</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div style="text-align: right; font-size: 14px; font-weight: bold; margin-bottom: 20px;">
            Subtotal: ${d.total}
        </div>
        <div class="sfs-footer">
            <div><br><br><div class="sfs-signature">Receiver's Signature</div></div>
            <div style="text-align: right;"><br><br><div class="sfs-signature" style="margin-left: auto;">For STANDARD FLUID SYSTEMS</div></div>
        </div>
    `);
}

function printDoc(body){
    $('printAreainnerHTML`=<div class="sfs-doc-container">${body}</div>`;
    setTimeout(()=>window.print(), 100);
}

function init(){S.api=localStorage.sfsApiUrl||'';if(S.session&&S.api){api('bootstrap').then(r=>{if(r.ok){S.user=r.user;S.products=r.products||[];S.customers=r.customers||[];S.suppliers=r.suppliers||[];S.tx=r.transactions||[];enter()}else{sessionStorage.clear();}})} }init();
