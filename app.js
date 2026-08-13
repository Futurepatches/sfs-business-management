
const STOCK2_URL = "STOCK2_Products.csv";
let products = [];

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  setupNavigation();
  setupLogin();
  setupProductControls();
  await loadStock2();
}

function setupLogin() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username")?.value.trim();
    const password = document.getElementById("password")?.value;

    if (username === "admin" && password === "admin123") {
      localStorage.setItem("sfsLoggedIn", "true");
      showApp();
    } else {
      const msg = document.getElementById("loginError");
      if (msg) msg.textContent = "Invalid username or password.";
    }
  });

  if (localStorage.getItem("sfsLoggedIn") === "true") showApp();
}

function showApp() {
  document.getElementById("loginScreen")?.classList.add("hidden");
  document.getElementById("appShell")?.classList.remove("hidden");
}

function setupNavigation() {
  document.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(page)?.classList.remove("hidden");
  document.querySelectorAll("[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === page));
  if (page === "products") renderProducts();
}

function setupProductControls() {
  const search = document.getElementById("productSearch");
  const category = document.getElementById("categoryFilter");
  const brand = document.getElementById("brandFilter");
  const status = document.getElementById("statusFilter");
  [search, category, brand, status].forEach(el => el?.addEventListener("input", renderProducts));
}

async function loadStock2() {
  try {
    const res = await fetch(STOCK2_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("STOCK2 file not found");
    const text = await res.text();
    products = parseCSV(text);
    populateFilters();
    renderProducts();
    updateProductCount();
  } catch (err) {
    console.warn(err);
    const saved = JSON.parse(localStorage.getItem("sfsProducts") || "[]");
    products = saved;
    populateFilters();
    renderProducts();
    updateProductCount();
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i], next=text[i+1];
    if (ch === '"') {
      if (quoted && next === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(field); field="";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(field); field="";
      if (row.some(v => v.trim() !== "")) rows.push(row);
      row=[];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some(v => v.trim() !== "")) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const o={};
    headers.forEach((h,i)=>o[h]=(r[i] ?? "").trim());
    return o;
  });
}

function populateFilters() {
  const cat = document.getElementById("categoryFilter");
  const brand = document.getElementById("brandFilter");
  if (!cat || !brand) return;

  const categories = [...new Set(products.map(p=>p["Category"]).filter(Boolean))].sort();
  const brands = [...new Set(products.map(p=>p["Brand"]).filter(Boolean))].sort();

  cat.innerHTML = '<option value="">All Categories</option>' + categories.map(x=>`<option>${escapeHtml(x)}</option>`).join("");
  brand.innerHTML = '<option value="">All Brands</option>' + brands.map(x=>`<option>${escapeHtml(x)}</option>`).join("");
}

function renderProducts() {
  const tbody = document.getElementById("productTableBody");
  if (!tbody) return;

  const q=(document.getElementById("productSearch")?.value || "").toLowerCase();
  const cat=document.getElementById("categoryFilter")?.value || "";
  const brand=document.getElementById("brandFilter")?.value || "";
  const status=document.getElementById("statusFilter")?.value || "";

  const filtered=products.filter(p=>{
    const hay=[p["Model / Part No."],p["Description"],p["Category"],p["Brand"],p["Location"]].join(" ").toLowerCase();
    return (!q || hay.includes(q)) &&
      (!cat || p["Category"]===cat) &&
      (!brand || p["Brand"]===brand) &&
      (!status || p["Status"]===status);
  });

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>${escapeHtml(p["Model / Part No."])}</td>
      <td>${escapeHtml(p["Description"])}</td>
      <td>${escapeHtml(p["Category"])}</td>
      <td>${escapeHtml(p["Brand"])}</td>
      <td>${escapeHtml(p["Location"])}</td>
      <td>${escapeHtml(p["Current Stock"])}</td>
      <td><span class="status-badge">${escapeHtml(p["Status"] || "Active")}</span></td>
    </tr>
  `).join("");

  const count=document.getElementById("productResultCount");
  if (count) count.textContent=`Showing ${filtered.length} of ${products.length} products`;
}

function updateProductCount() {
  document.querySelectorAll("[data-product-count]").forEach(el=>el.textContent=products.length);
}

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
