const CATEGORIES=["Airline Equipment","Valves","Cylinder","Fittings/Tubing","Others"];
let products=[];

const pageInfo={
 dashboard:["Dashboard","Overview of your business"],
 products:["Products","Product master and inventory"],
 inward:["Inward","Receive stock into the office"],
 challan:["Delivery Challan","Create and post stock-out challans"],
 invoices:["Invoices","Invoices linked to delivery challans"],
 purchases:["Purchases","Purchase and local purchase records"],
 customers:["Customers","Customer master and ledger"],
 suppliers:["Suppliers","Supplier master and purchases"],
 reports:["Reports","Sales, stock and category analysis"],
 movement:["Stock Movement","Complete stock transaction history"],
 users:["Users & Roles","Manage access and permissions"],
 settings:["Settings","System configuration"]
};

function q(id){return document.getElementById(id)}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(m){const t=q("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function csvParse(text){
  const out=[];let row=[],f="",quote=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
    if(c=='"'){if(quote&&n=='"'){f+='"';i++}else quote=!quote}
    else if(c==","&&!quote){row.push(f);f=""}
    else if((c=="\n"||c=="\r")&&!quote){if(c=="\r"&&n=="\n")i++;row.push(f);f="";if(row.some(v=>v.trim()))out.push(row);row=[]}
    else f+=c;
  }
  if(f!==""||row.length){row.push(f);if(row.some(v=>v.trim()))out.push(row)}
  const h=(out.shift()||[]).map(x=>x.trim());
  return out.map(r=>{const o={};h.forEach((x,i)=>o[x]=(r[i]??"").trim());return o})
}
async function loadProducts(){
  try{
    const r=await fetch("./STOCK2_Products.csv?cb="+Date.now(),{cache:"no-store"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const text=await r.text();
    const rows=csvParse(text);
    if(!rows.length) throw new Error("CSV empty");
    products=rows;
    console.log("STOCK2 loaded:",products.length);
    populateFilters();
    renderProducts();
  }catch(e){
    console.error("STOCK2 load failed:",e);
    products=[];
    q("content").innerHTML=`<div class="panel" style="padding:40px;text-align:center"><h3>STOCK2 could not be loaded</h3><p style="color:#7d8b9a">Make sure <b>STOCK2_Products.csv</b> is uploaded in the same GitHub repository folder as index.html.</p><p style="font-size:12px;color:#c33">${esc(e.message)}</p></div>`;
  }
}
function populateFilters(){
  const cat=q("filterCategory"),brand=q("filterBrand");
  if(!cat||!brand)return;
  const cats=[...new Set(products.map(x=>x["Category"]).filter(Boolean))].sort();
  const brands=[...new Set(products.map(x=>x["Brand"]).filter(Boolean))].sort();
  cat.innerHTML='<option value="">All Categories</option>'+cats.map(x=>`<option>${esc(x)}</option>`).join("");
  brand.innerHTML='<option value="">All Brands</option>'+brands.map(x=>`<option>${esc(x)}</option>`).join("");
}
function renderProducts(){
  const c=q("content");
  if(!c)return;
  c.innerHTML=`
    <div class="panel toolbar">
      <input id="productSearch" placeholder="Search Model / Part No., Description, Brand...">
      <select id="filterCategory"><option value="">All Categories</option></select>
      <select id="filterBrand"><option value="">All Brands</option></select>
      <select id="filterStatus"><option value="">All Status</option><option>Active</option><option>Inactive</option></select>
      <button class="secondary" id="clearFilters">Reset</button>
    </div>
    <div class="panel">
      <div class="table-top">
        <div><b>Products</b><div id="productCountText" style="color:#7d8b9a;font-size:11px">Loading...</div></div>
        <button class="primary" id="addProductBtn">＋ Add Product</button>
      </div>
      <div class="table-wrap">
        <table><thead><tr><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Brand</th><th>Unit</th><th>Location</th><th>Cost</th><th>Sale</th><th>Current Stock</th><th>Status</th></tr></thead>
        <tbody id="productTableBody"></tbody></table>
      </div>
    </div>`;
  populateFilters();
  q("productSearch").oninput=applyFilters;q("filterCategory").onchange=applyFilters;q("filterBrand").onchange=applyFilters;q("filterStatus").onchange=applyFilters;
  q("clearFilters").onclick=()=>{q("productSearch").value="";q("filterCategory").value="";q("filterBrand").value="";q("filterStatus").value="";applyFilters()};
  q("addProductBtn").onclick=()=>openModal();
  applyFilters();
}
function applyFilters(){
  const text=(q("productSearch")?.value||"").toLowerCase();
  const cat=q("filterCategory")?.value||"", brand=q("filterBrand")?.value||"", status=q("filterStatus")?.value||"";
  const filtered=products.filter(p=>{
    const hay=[p["Model / Part No."],p["Description"],p["Brand"],p["Location"],p["Category"]].join(" ").toLowerCase();
    return(!text||hay.includes(text))&&(!cat||p["Category"]===cat)&&(!brand||p["Brand"]===brand)&&(!status||p["Status"]===status);
  });
  q("productCountText").textContent=`Showing ${filtered.length.toLocaleString()} of ${products.length.toLocaleString()} products`;
  q("productTableBody").innerHTML=filtered.length?filtered.map(p=>`<tr>
    <td><b>${esc(p["Model / Part No."])}</b></td><td>${esc(p["Description"])}</td><td>${esc(p["Category"])}</td><td>${esc(p["Brand"])}</td>
    <td>${esc(p["Unit"])}</td><td>${esc(p["Location"])}</td><td>${esc(p["Cost Price"])}</td><td>${esc(p["Sale Price"])}</td>
    <td><b>${esc(p["Current Stock"])}</b></td><td><span class="pill active-pill">${esc(p["Status"]||"Active")}</span></td></tr>`).join(""):`<tr><td colspan="10" class="empty">No products found.</td></tr>`;
}
function setupModal(){
  q("pCategory").innerHTML='<option value="">Select Category</option>'+CATEGORIES.map(x=>`<option>${x}</option>`).join("");
  q("closeModal").onclick=closeModal;q("cancelProduct").onclick=closeModal;
  q("productModal").onclick=e=>{if(e.target===q("productModal"))closeModal()};
  q("productForm").onsubmit=e=>{e.preventDefault();closeModal();toast("Product saving will use the database in the next phase.")};
}
function openModal(){q("productModal").classList.remove("hidden")}
function closeModal(){q("productModal").classList.add("hidden");q("productForm").reset();q("editId").value=""}
function showPage(page){
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  q("pageTitle").textContent=pageInfo[page][0];q("pageSubtitle").textContent=pageInfo[page][1];
  if(page==="products") renderProducts();
  else if(page==="dashboard") renderDashboard();
  else q("content").innerHTML=`<div class="panel" style="padding:55px;text-align:center"><h3>${esc(pageInfo[page][0])}</h3><p style="color:#7d8b9a">This module is scheduled for the next development phase.</p></div>`;
}
function renderDashboard(){q("content").innerHTML=`<div class="cards">
<div class="card blue"><span>Total Products</span><b>${products.length.toLocaleString()}</b><small>STOCK2</small></div>
<div class="card green"><span>Current Stock</span><b>${products.reduce((a,p)=>a+(parseFloat(p["Current Stock"])||0),0).toLocaleString()}</b><small>From STOCK2</small></div>
<div class="card orange"><span>Categories</span><b>5</b><small>Configured categories</small></div>
<div class="card red"><span>Data Source</span><b>STOCK2</b><small>Read-only import for now</small></div></div>
<div class="panel" style="margin-top:16px;padding:22px"><h3>Categories</h3><p style="color:#7d8b9a">Airline Equipment • Valves • Cylinder • Fittings/Tubing • Others</p></div>`}
function setup(){
  q("loginForm").onsubmit=e=>{e.preventDefault();if(q("username").value==="admin"&&q("password").value==="admin123"){localStorage.setItem("sfsLoggedIn","1");q("loginScreen").classList.add("hidden");q("appShell").classList.remove("hidden");loadProducts()}else q("loginError").textContent="Invalid username or password."};
  q("logoutBtn").onclick=()=>{localStorage.removeItem("sfsLoggedIn");location.reload()};
  q("menuBtn").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
  document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>{showPage(n.dataset.page);document.querySelector(".sidebar").classList.remove("open")});
  setupModal();
  if(localStorage.getItem("sfsLoggedIn")==="1"){q("loginScreen").classList.add("hidden");q("appShell").classList.remove("hidden");loadProducts()}else showPage("dashboard");
}
setup();
