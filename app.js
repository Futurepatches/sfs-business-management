
const CATEGORIES=["Airline Equipment","Valves","Cylinder","Fittings/Tubing","Others"];
let products=[],transactions=[],inwardRecords=[];

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

const q=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(m){const t=q("toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}

function parseCSV(text){
  const out=[];let row=[],f="",quote=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(c=='"'){if(quote&&n=='"'){f+='"';i++}else quote=!quote}
    else if(c==","&&!quote){row.push(f);f=""}
    else if((c=="\n"||c=="\r")&&!quote){
      if(c=="\r"&&n=="\n")i++;
      row.push(f);f="";
      if(row.some(v=>v.trim()))out.push(row);
      row=[];
    } else f+=c
  }
  if(f!==""||row.length){row.push(f);if(row.some(v=>v.trim()))out.push(row)}
  const h=(out.shift()||[]).map(x=>x.trim());
  return out.map(r=>{const o={};h.forEach((x,i)=>o[x]=(r[i]??"").trim());return o});
}

async function loadCSV(file){
  const r=await fetch("./"+file+"?cb="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw new Error(file+" HTTP "+r.status);
  return parseCSV(await r.text());
}

function saveLocalState(){
  localStorage.setItem("sfs_products_runtime",JSON.stringify(products));
  localStorage.setItem("sfs_transactions_runtime",JSON.stringify(transactions));
  localStorage.setItem("sfs_inwards_runtime",JSON.stringify(inwardRecords));
}

function loadLocalState(){
  try{
    const p=JSON.parse(localStorage.getItem("sfs_products_runtime")||"null");
    const t=JSON.parse(localStorage.getItem("sfs_transactions_runtime")||"null");
    const i=JSON.parse(localStorage.getItem("sfs_inwards_runtime")||"null");
    if(Array.isArray(p)&&p.length) products=p;
    if(Array.isArray(t)) transactions=t;
    if(Array.isArray(i)) inwardRecords=i;
  }catch(e){console.warn(e)}
}

async function loadProducts(){
  try{
    products=await loadCSV("STOCK2_Products.csv");
    transactions=await loadCSV("STOCK2_Stock_Transactions.csv");
    loadLocalState();
    populateFilters();
    renderDashboard();
  }catch(e){
    console.error(e);
    q("content").innerHTML=`<div class="panel" style="padding:40px;text-align:center"><h3>STOCK2 could not be loaded</h3><p>Make sure STOCK2 files are in the repository root.</p><p style="color:#c33">${esc(e.message)}</p></div>`;
  }
}

function populateFilters(){
  const cat=q("filterCategory"),brand=q("filterBrand");
  if(!cat||!brand)return;
  cat.innerHTML='<option value="">All Categories</option>'+[...new Set(products.map(x=>x["Category"]).filter(Boolean))].sort().map(x=>`<option>${esc(x)}</option>`).join("");
  brand.innerHTML='<option value="">All Brands</option>'+[...new Set(products.map(x=>x["Brand"]).filter(Boolean))].sort().map(x=>`<option>${esc(x)}</option>`).join("");
}

function renderProducts(){
  q("content").innerHTML=`<div class="panel toolbar">
    <input id="productSearch" placeholder="Search Model / Part No., Description, Brand...">
    <select id="filterCategory"></select><select id="filterBrand"></select>
    <select id="filterStatus"><option value="">All Status</option><option>Active</option><option>Inactive</option></select>
    <button class="secondary" id="clearFilters">Reset</button>
  </div>
  <div class="panel"><div class="table-top">
    <div><b>Products</b><div id="productCountText" style="color:#7d8b9a;font-size:11px"></div></div>
    <button class="primary" id="addProductBtn">＋ Add Product</button>
  </div>
  <div class="table-wrap"><table><thead><tr>
    <th>Model / Part No.</th><th>Description</th><th>Category</th><th>Brand</th><th>Unit</th><th>Location</th><th>Cost</th><th>Sale</th><th>Current Stock</th><th>Status</th><th>Action</th>
  </tr></thead><tbody id="productTableBody"></tbody></table></div></div>`;
  populateFilters();
  q("productSearch").oninput=applyFilters;q("filterCategory").onchange=applyFilters;q("filterBrand").onchange=applyFilters;q("filterStatus").onchange=applyFilters;
  q("clearFilters").onclick=()=>{q("productSearch").value="";q("filterCategory").value="";q("filterBrand").value="";q("filterStatus").value="";applyFilters()};
  q("addProductBtn").onclick=()=>openModal();
  applyFilters();
}

function applyFilters(){
  const text=(q("productSearch")?.value||"").toLowerCase(),cat=q("filterCategory")?.value||"",brand=q("filterBrand")?.value||"",status=q("filterStatus")?.value||"";
  const filtered=products.filter(p=>{
    const hay=[p["Model / Part No."],p["Description"],p["Brand"],p["Location"],p["Category"]].join(" ").toLowerCase();
    return(!text||hay.includes(text))&&(!cat||p["Category"]===cat)&&(!brand||p["Brand"]===brand)&&(!status||p["Status"]===status)
  });
  q("productCountText").textContent=`Showing ${filtered.length.toLocaleString()} of ${products.length.toLocaleString()} products`;
  q("productTableBody").innerHTML=filtered.length?filtered.map(p=>`<tr>
    <td><b>${esc(p["Model / Part No."])}</b></td><td>${esc(p["Description"])}</td><td>${esc(p["Category"])}</td><td>${esc(p["Brand"])}</td>
    <td>${esc(p["Unit"])}</td><td>${esc(p["Location"])}</td><td>${esc(p["Cost Price"])}</td><td>${esc(p["Sale Price"])}</td>
    <td><b>${esc(p["Current Stock"])}</b></td><td><span class="pill active-pill">${esc(p["Status"]||"Active")}</span></td>
    <td><button class="view-btn" onclick='openDetail(${JSON.stringify(p["Product ID"])})'>View</button></td>
  </tr>`).join(""):`<tr><td colspan="11" class="empty">No products found.</td></tr>`;
}

function renderDashboard(){
  const total=products.reduce((a,p)=>a+(parseFloat(p["Current Stock"])||0),0);
  q("content").innerHTML=`<div class="cards">
    <div class="card blue"><span>Total Products</span><b>${products.length.toLocaleString()}</b><small>STOCK2</small></div>
    <div class="card green"><span>Current Stock</span><b>${total.toLocaleString()}</b><small>Live in this browser</small></div>
    <div class="card orange"><span>Categories</span><b>5</b><small>Configured categories</small></div>
    <div class="card red"><span>Inward Entries</span><b>${inwardRecords.length.toLocaleString()}</b><small>Local prototype records</small></div>
  </div>
  <div class="panel" style="margin-top:16px;padding:22px"><h3>Categories</h3><p style="color:#7d8b9a">Airline Equipment • Valves • Cylinder • Fittings/Tubing • Others</p></div>`;
}

function renderInward(){
  q("content").innerHTML=`<div class="panel">
    <div class="table-top"><div><b>Inward / Goods Received</b><div style="color:#7d8b9a;font-size:11px">Every item received into the office is recorded here.</div></div>
    <button class="primary" id="newInwardBtn">＋ New Inward</button></div>
    <div style="padding:16px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        <div class="detail-item"><span>Source Types</span><b>Import • Local Purchase • Return • Transfer</b></div>
        <div class="detail-item"><span>Stock Rule</span><b>Posted Inward → Stock +</b></div>
        <div class="detail-item"><span>Saved Entries</span><b>${inwardRecords.length}</b></div>
      </div>
      <div style="margin-top:18px" class="table-wrap">
        <table><thead><tr><th>Inward No.</th><th>Date</th><th>Product</th><th>Qty</th><th>Source Type</th><th>Supplier/Source</th><th>User</th><th>Action</th></tr></thead>
        <tbody>${inwardRecords.length?inwardRecords.slice().reverse().map(x=>`<tr><td>${esc(x.number)}</td><td>${esc(x.date)}</td><td>${esc(x.model)}</td><td>+${esc(x.qty)}</td><td>${esc(x.sourceType)}</td><td>${esc(x.source)}</td><td>${esc(x.user)}</td><td><button class="action del" onclick='reverseInward(${JSON.stringify(x.number)})'>Reverse</button></td></tr>`).join(""):`<tr><td colspan="8" class="empty">No new inward records yet.</td></tr>`}</tbody></table>
      </div>
    </div></div>`;
  q("newInwardBtn").onclick=openInward;
}

function nextInwardNumber(){
  const n=Number(localStorage.getItem("sfsInwardCounter")||"0")+1;
  localStorage.setItem("sfsInwardCounter",String(n));
  return "IN-"+String(n).padStart(6,"0");
}

function openInward(){
  q("iNumber").value=nextInwardNumber();
  q("iDate").value=new Date().toISOString().slice(0,10);
  q("iProduct").innerHTML='<option value="">Select / type product</option>'+products.map(p=>`<option value="${esc(p["Product ID"])}">${esc(p["Model / Part No."])} — ${esc(p["Description"]||"")}</option>`).join("");
  q("iQty").value="";q("iUnit").value="";q("iSourceType").value="";q("iSource").value="";q("iReference").value="";q("iCost").value="";q("iRemarks").value="";
  updateInwardPreview();q("inwardModal").classList.remove("hidden");
}

function closeInward(){q("inwardModal").classList.add("hidden")}

function updateInwardPreview(){
  const p=products.find(x=>x["Product ID"]===q("iProduct").value);
  const current=Number(p?.["Current Stock"]||0),qty=Number(q("iQty").value||0);
  q("iUnit").value=p?.["Unit"]||"";q("iCurrentStock").textContent=current.toLocaleString();q("iPreviewQty").textContent=qty.toLocaleString();q("iNewStock").textContent=(current+qty).toLocaleString();
}

function setupInward(){
  q("closeInward").onclick=closeInward;q("cancelInward").onclick=closeInward;q("inwardModal").onclick=e=>{if(e.target===q("inwardModal"))closeInward()};
  q("iProduct").onchange=updateInwardPreview;q("iQty").oninput=updateInwardPreview;
  q("inwardForm").onsubmit=e=>{
    e.preventDefault();
    const p=products.find(x=>x["Product ID"]===q("iProduct").value),qty=Number(q("iQty").value||0);
    if(!p){toast("Please select a product.");return}
    if(qty<=0){toast("Please enter a valid quantity.");return}
    const entry={
      number:q("iNumber").value,date:q("iDate").value,productId:p["Product ID"],model:p["Model / Part No."],
      description:p["Description"],qty,sourceType:q("iSourceType").value,source:q("iSource").value.trim(),
      reference:q("iReference").value.trim(),cost:q("iCost").value,remarks:q("iRemarks").value.trim(),user:"Admin"
    };
    const current=Number(p["Current Stock"]||0);
    p["Current Stock"]=String(current+qty);
    transactions.push({
      "Transaction ID":"TX-LOCAL-"+Date.now(),"Date / Reference":entry.date,"Type":"IN","Product ID":p["Product ID"],
      "Model / Part No.":p["Model / Part No."],"Quantity (+/-)":String(qty),"Source / Destination":entry.source,
      "Reference Type":"Inward","Reference No.":entry.number,"Customer / Supplier":entry.source,"User":"Admin","Remarks":entry.remarks
    });
    inwardRecords.push(entry);
    saveLocalState();
    closeInward();
    renderInward();
    toast(`Inward saved: ${entry.number}. Stock increased by ${qty}.`);
  };
}

function setupProductDetail(){
  if(!q("closeDetail"))return;
  q("closeDetail").onclick=closeDetail;
  q("productDetailModal").onclick=e=>{if(e.target===q("productDetailModal"))closeDetail()};
}
window.openDetail=function(id){
  const p=products.find(x=>x["Product ID"]===id);if(!p)return;
  q("dModel").textContent=p["Model / Part No."]||"—";q("dDescription").textContent=p["Description"]||"—";q("dCategory").textContent=p["Category"]||"—";
  q("dBrand").textContent=p["Brand"]||"—";q("dUnit").textContent=p["Unit"]||"—";q("dLocation").textContent=p["Location"]||"—";
  q("dCost").textContent=p["Cost Price"]||"—";q("dSale").textContent=p["Sale Price"]||"—";q("dStock").textContent=p["Current Stock"]||"0";q("dStatus").textContent=p["Status"]||"Active";
  const moves=transactions.filter(t=>t["Product ID"]===id);
  q("historyCount").textContent=`${moves.length} movements`;
  q("historyBody").innerHTML=moves.length?moves.slice().reverse().map(t=>`<tr><td>${esc(t["Date / Reference"])}</td><td>${esc(t["Type"])}</td><td>${esc(t["Quantity (+/-)"])}</td><td>${esc(t["Source / Destination"])}</td><td>${esc(t["Reference Type"])}</td><td>${esc(t["Reference No."])}</td><td>${esc(t["User"])}</td></tr>`).join(""):`<tr><td colspan="7" class="empty">No movement found.</td></tr>`;
  q("productDetailModal").classList.remove("hidden");
}
function closeDetail(){q("productDetailModal").classList.add("hidden")}

function openModal(){q("productModal").classList.remove("hidden")}
function closeModal(){q("productModal").classList.add("hidden");if(q("productForm"))q("productForm").reset()}

function showPage(page){
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===page));
  q("pageTitle").textContent=pageInfo[page][0];q("pageSubtitle").textContent=pageInfo[page][1];
  if(page==="products")renderProducts(); else if(page==="inward")renderInward(); else if(page==="dashboard")renderDashboard();
  else q("content").innerHTML=`<div class="panel" style="padding:55px;text-align:center"><h3>${esc(pageInfo[page][0])}</h3><p style="color:#7d8b9a">This module is scheduled for the next development phase.</p></div>`;
}

function setupModal(){
  if(q("pCategory"))q("pCategory").innerHTML='<option value="">Select Category</option>'+CATEGORIES.map(x=>`<option>${x}</option>`).join("");
  if(q("closeModal"))q("closeModal").onclick=closeModal;if(q("cancelProduct"))q("cancelProduct").onclick=closeModal;
  if(q("productModal"))q("productModal").onclick=e=>{if(e.target===q("productModal"))closeModal()};
  if(q("productForm"))q("productForm").onsubmit=e=>{e.preventDefault();closeModal();toast("Product creation will be connected to the database later.")};
}

async function setup(){
  q("loginForm").onsubmit=async e=>{
    e.preventDefault();
    if(q("username").value==="admin"&&q("password").value==="admin123"){
      localStorage.setItem("sfsLoggedIn","1");q("loginScreen").classList.add("hidden");q("appShell").classList.remove("hidden");
      await loadProducts();setupInward();setupProductDetail();
    }else q("loginError").textContent="Invalid username or password."
  };
  q("logoutBtn").onclick=()=>{localStorage.removeItem("sfsLoggedIn");location.reload()};
  q("menuBtn").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
  document.querySelectorAll(".nav").forEach(n=>n.onclick=()=>{showPage(n.dataset.page);document.querySelector(".sidebar").classList.remove("open")});
  setupModal();setupInward();setupProductDetail();
  if(localStorage.getItem("sfsLoggedIn")==="1"){q("loginScreen").classList.add("hidden");q("appShell").classList.remove("hidden");await loadProducts();setupInward();setupProductDetail()}
}
setup();

window.reverseInward=function(number){
  const idx=inwardRecords.findIndex(x=>x.number===number);
  if(idx<0){toast("Inward record not found.");return}
  const entry=inwardRecords[idx];
  if(entry.reversed){toast("This inward is already reversed.");return}
  if(!confirm(`Reverse ${entry.number}?\n\nProduct: ${entry.model}\nQuantity: ${entry.qty}\n\nStock will be reduced by ${entry.qty}.`)) return;

  const p=products.find(x=>x["Product ID"]===entry.productId);
  if(!p){toast("Product not found.");return}
  const current=Number(p["Current Stock"]||0);
  const qty=Number(entry.qty||0);

  if(current<qty){
    alert(`Cannot reverse ${entry.number}.\nCurrent stock (${current}) is less than the inward quantity (${qty}).`);
    return;
  }

  p["Current Stock"]=String(current-qty);
  entry.reversed=true;
  entry.reversedAt=new Date().toISOString();

  transactions.push({
    "Transaction ID":"TX-REV-"+Date.now(),
    "Date / Reference":new Date().toISOString().slice(0,10),
    "Type":"REVERSAL",
    "Product ID":entry.productId,
    "Model / Part No.":entry.model,
    "Quantity (+/-)":String(-qty),
    "Source / Destination":"Office",
    "Reference Type":"Inward Reversal",
    "Reference No.":entry.number,
    "Customer / Supplier":entry.source,
    "User":"Admin",
    "Remarks":"Reversal of test/incorrect inward"
  });

  saveLocalState();
  renderInward();
  toast(`${entry.number} reversed. Stock reduced by ${qty}.`);
};
