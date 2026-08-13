const $=id=>document.getElementById(id);
const loginPage=$('loginPage'), appPage=$('appPage'), loginForm=$('loginForm'), loginError=$('loginError');
const content=$('content'), sidebar=document.querySelector('.sidebar'), modal=$('productModal');
const categories=['Airline Equipment','Valves','Cylinder','Fittings/Tubing','Others'];
const pageNames={dashboard:['Dashboard','Overview of your business'],products:['Products','Product master and inventory'],inward:['Inward','Receive stock into the office'],challan:['Delivery Challan','Create and post stock-out challans'],invoices:['Invoices','Invoices linked to delivery challans'],purchases:['Purchases','Purchase and local purchase records'],customers:['Customers','Customer master and ledger'],suppliers:['Suppliers','Supplier master and purchases'],reports:['Reports','Sales, stock and category analysis'],movement:['Stock Movement','Complete stock transaction history'],users:['Users & Roles','Manage access and permissions'],settings:['Settings','System configuration']};

function getProducts(){return JSON.parse(localStorage.getItem('sfs_products')||'[]')}
function setProducts(p){localStorage.setItem('sfs_products',JSON.stringify(p))}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function catClass(c){return {'Airline Equipment':'c1','Valves':'c2','Cylinder':'c3','Fittings/Tubing':'c4','Others':'c5'}[c]||'c1'}

loginForm.addEventListener('submit',e=>{e.preventDefault();if($('username').value==='admin'&&$('password').value==='admin123'){localStorage.setItem('sfs_logged_in','1');loginPage.classList.add('hidden');appPage.classList.remove('hidden');showPage('dashboard')}else loginError.textContent='Invalid username or password.'});
$('logoutBtn').onclick=()=>{localStorage.removeItem('sfs_logged_in');appPage.classList.add('hidden');loginPage.classList.remove('hidden');loginForm.reset()};
$('menuBtn').onclick=()=>sidebar.classList.toggle('open');

document.querySelectorAll('.sidebar a').forEach(a=>a.onclick=e=>{e.preventDefault();showPage(a.dataset.page);sidebar.classList.remove('open')});

function showPage(key){
 document.querySelectorAll('.sidebar a').forEach(x=>x.classList.toggle('active',x.dataset.page===key));
 $('pageTitle').textContent=pageNames[key][0];$('pageSubtitle').textContent=pageNames[key][1];
 if(key==='products') renderProducts(); else if(key==='dashboard') renderDashboard(); else renderPlaceholder(key);
}
function renderDashboard(){
 content.innerHTML=`<div class="cards">
 <div class="card blue"><span>Total Products</span><strong>${getProducts().length}</strong><small>View products →</small></div>
 <div class="card green"><span>Current Stock</span><strong>45,680</strong><small>All categories</small></div>
 <div class="card orange"><span>Today's Inward</span><strong>125</strong><small>Quantity received</small></div>
 <div class="card red"><span>Today's Sales</span><strong>350</strong><small>Quantity sold</small></div></div>
 <div class="panel" style="margin-top:16px;padding:22px"><h3>Product categories</h3><p style="color:#718096;font-size:12px">Airline Equipment • Valves • Cylinder • Fittings/Tubing • Others</p></div>`;
}
function renderPlaceholder(key){
 const d=pageNames[key];content.innerHTML=`<div class="panel" style="padding:55px;text-align:center"><h3>${d[0]}</h3><p style="color:#7a8797">This module is ready for the next development step.</p></div>`;
}
function renderProducts(){
 const products=getProducts();
 content.innerHTML=`<div class="product-toolbar"><div class="toolbar-row">
 <input id="searchProduct" placeholder="Search Model, Part No, Description...">
 <select id="filterCat"><option value="">All Categories</option>${categories.map(c=>`<option>${c}</option>`).join('')}</select>
 <select id="filterBrand"><option value="">All Brands</option>${[...new Set(products.map(p=>p.brand).filter(Boolean))].map(b=>`<option>${esc(b)}</option>`).join('')}</select>
 <select id="filterStatus"><option value="">All Status</option><option>Active</option><option>Inactive</option></select>
 <button class="primary" id="searchBtn">⌕ Search</button><button class="secondary" id="resetBtn">Reset</button>
 </div></div>
 <div class="panel table-panel"><div class="table-top"><b>Total Products: <span id="productCount">${products.length}</span></b><div style="display:flex;gap:8px"><button class="secondary" id="exportBtn">↓ Export</button><button class="primary" id="addProductBtn">＋ Add Product</button></div></div>
 <div class="table-wrap"><table><thead><tr><th>#</th><th>Image</th><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Brand</th><th>Unit</th><th>Location</th><th>Cost Price</th><th>Sale Price</th><th>Current Stock</th><th>Status</th><th>Action</th></tr></thead><tbody id="productBody"></tbody></table></div></div>`;
 $('addProductBtn').onclick=()=>openProductModal();
 $('searchBtn').onclick=applyFilters;$('resetBtn').onclick=()=>{['searchProduct','filterCat','filterBrand','filterStatus'].forEach(id=>$(id).value='');applyFilters()};
 $('searchProduct').oninput=applyFilters;$('filterCat').onchange=applyFilters;$('filterBrand').onchange=applyFilters;$('filterStatus').onchange=applyFilters;
 $('exportBtn').onclick=exportCSV; applyFilters();
}
function applyFilters(){
 let p=getProducts();const q=$('searchProduct').value.toLowerCase(),c=$('filterCat').value,b=$('filterBrand').value,s=$('filterStatus').value;
 p=p.filter(x=>(!q||[x.model,x.description,x.brand].join(' ').toLowerCase().includes(q))&&(!c||x.category===c)&&(!b||x.brand===b)&&(!s||x.status===s));
 $('productCount').textContent=p.length;
 $('productBody').innerHTML=p.length?p.map((x,i)=>`<tr>
 <td>${i+1}</td><td>${x.image?`<img class="product-thumb" src="${x.image}">`:'—'}</td><td><b>${esc(x.model)}</b></td><td>${esc(x.description)}</td>
 <td><span class="cat ${catClass(x.category)}">${esc(x.category)}</span></td><td>${esc(x.brand)}</td><td>${esc(x.unit)}</td><td>${esc(x.location)}</td>
 <td>${Number(x.cost||0).toLocaleString()}</td><td>${Number(x.sale||0).toLocaleString()}</td><td>${Number(x.stock||0).toLocaleString()}</td>
 <td><span class="status">${esc(x.status)}</span></td><td><div class="actions">
 <button class="action edit" onclick="editProduct('${x.id}')">Edit</button><button class="action del" onclick="deleteProduct('${x.id}')">Delete</button><button class="action view" onclick="viewProduct('${x.id}')">View</button>
 </div></td></tr>`).join(''):`<tr><td colspan="13" class="empty">No products found. Click <b>Add Product</b> to create your first product.</td></tr>`;
}
function openProductModal(product=null){
 $('modalTitle').textContent=product?'Edit Product':'Add Product';$('editIndex').value=product?.id||'';
 $('pModel').value=product?.model||'';$('pDescription').value=product?.description||'';$('pCategory').value=product?.category||'';
 $('pBrand').value=product?.brand||'';$('pUnit').value=product?.unit||'Pcs';$('pLocation').value=product?.location||'';
 $('pCost').value=product?.cost??'';$('pSale').value=product?.sale??'';$('pRemarks').value=product?.remarks||'';$('pStatus').value=product?.status||'Active';$('pImage').value='';
 modal.classList.remove('hidden');
}
function closeModal(){modal.classList.add('hidden');$('productForm').reset();$('editIndex').value=''}
$('closeModal').onclick=closeModal;$('cancelProduct').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};

$('productForm').onsubmit=async e=>{
 e.preventDefault();
 const products=getProducts(), id=$('editIndex').value||crypto.randomUUID();
 const old=products.find(p=>p.id===id);
 let image=old?.image||'';
 const file=$('pImage').files[0];
 if(file){image=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(file)})}
 const product={id,model:$('pModel').value.trim(),description:$('pDescription').value.trim(),category:$('pCategory').value,brand:$('pBrand').value.trim(),unit:$('pUnit').value,location:$('pLocation').value.trim(),cost:Number($('pCost').value||0),sale:Number($('pSale').value||0),stock:old?.stock||0,image,remarks:$('pRemarks').value.trim(),status:$('pStatus').value};
 if(old){products[products.findIndex(p=>p.id===id)]=product;toast('Product updated successfully')}else{products.unshift(product);toast('Product saved successfully')}
 setProducts(products);closeModal();showPage('products');
};
window.editProduct=id=>{const p=getProducts().find(x=>x.id===id);if(p)openProductModal(p)};
window.deleteProduct=id=>{if(confirm('Delete this product? This demo removes it from the local product list.')){setProducts(getProducts().filter(x=>x.id!==id));toast('Product deleted');renderProducts()}};
window.viewProduct=id=>{const p=getProducts().find(x=>x.id===id);if(p)alert(`Model: ${p.model}\nDescription: ${p.description}\nCategory: ${p.category}\nBrand: ${p.brand||'-'}\nUnit: ${p.unit}\nLocation: ${p.location||'-'}\nCurrent Stock: ${p.stock}\nCost: ${p.cost}\nSale: ${p.sale}`)};
function exportCSV(){const rows=getProducts();const head=['Model','Description','Category','Brand','Unit','Location','Cost Price','Sale Price','Current Stock','Status'];const csv=[head,...rows.map(p=>[p.model,p.description,p.category,p.brand,p.unit,p.location,p.cost,p.sale,p.stock,p.status])].map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='SFS_Products.csv';a.click();URL.revokeObjectURL(a.href)}
if(localStorage.getItem('sfs_logged_in')==='1'){loginPage.classList.add('hidden');appPage.classList.remove('hidden');showPage('dashboard')}
