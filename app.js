/*
SFS BUSINESS MANAGEMENT - FRONTEND ENGINE
PHASE 3 COMPLETE IMPLEMENTATION
*/

let state = {
  user: null,
  session: null,
  products: [],
  customers: [],
  suppliers: [],
  transactions: []
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  const savedSession = localStorage.getItem('sfs_session');
  const savedUser = localStorage.getItem('sfs_user');
  
  if (savedSession && savedUser) {
    state.session = savedSession;
    state.user = JSON.parse(savedUser);
    initApp();
  } else {
    showLogin();
  }
});

/* ---------- AUTHENTICATION ---------- */

async function login() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const errDiv = document.getElementById('loginError');

  if (!u || !p) {
    errDiv.textContent = 'Please enter both username and password.';
    return;
  }

  errDiv.textContent = 'Logging in...';

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action: 'login', username: u, password: p })
    });
    
    const data = await res.json();

    if (data.ok) {
      state.session = data.session;
      state.user = data.user;
      localStorage.setItem('sfs_session', data.session);
      localStorage.setItem('sfs_user', JSON.stringify(data.user));
      errDiv.textContent = '';
      initApp();
    } else {
      errDiv.textContent = data.error || 'Invalid credentials.';
    }
  } catch (err) {
    console.error("Login Fetch Error:", err);
    errDiv.textContent = 'Connection error. Please try again.';
  }
}
function logout() {
  if (state.session) {
    fetch(CONFIG.API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'logout', session: state.session })
    }).catch(() => {});
  }
  state.session = null;
  state.user = null;
  localStorage.removeItem('sfs_session');
  localStorage.removeItem('sfs_user');
  showLogin();
}

function showLogin() {
  document.getElementById('login').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function initApp() {
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('who').textContent = state.user.name || state.user.username;
  document.getElementById('role').textContent = state.user.role;

  renderNav();
  await refresh();
}

async function refresh() {
  try {
    const res = await apiCall('bootstrap');
    if (res.ok) {
      state.products = res.products || [];
      state.customers = res.customers || [];
      state.suppliers = res.suppliers || [];
      state.transactions = res.transactions || [];
      navigate('dashboard');
    } else {
      alert(res.error || 'Failed to sync database state.');
    }
  } catch (e) {
    console.error('Refresh failed:', e);
  }
}

async function apiCall(action, payload = {}) {
  payload.action = action;
  payload.session = state.session;

  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  
  return await res.json();
}
/* ---------- NAVIGATION ---------- */

function renderNav() {
  const nav = document.getElementById('nav');
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'products', label: 'Products', icon: '📦' },
    { id: 'dc_create', label: 'Create DC', icon: '🚚' },
    { id: 'dc_search', label: 'DC History', icon: '🔍' },
    { id: 'inv_create', label: 'Create Invoice', icon: '🧾' },
    { id: 'inv_search', label: 'Invoice History', icon: '📑' },
    { id: 'inward', label: 'Inward / Stock In', icon: '📥' },
    { id: 'cust_ledger', label: 'Customer Ledger', icon: '👤' },
    { id: 'sup_ledger', label: 'Supplier Ledger', icon: '🏭' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'suppliers', label: 'Suppliers', icon: '🏬' }
  ];

  nav.innerHTML = items.map(i => `
    <button class="nav-item" onclick="navigate('${i.id}')">
      <span>${i.icon}</span> <span>${i.label}</span>
    </button>
  `).join('');
}

function navigate(pageId) {
  const titleMap = {
    dashboard: 'Dashboard',
    products: 'Product Inventory',
    dc_create: 'New Delivery Challan',
    dc_search: 'Delivery Challan History',
    inv_create: 'New Sales Invoice',
    inv_search: 'Invoice History',
    inward: 'Stock Inward Purchase',
    cust_ledger: 'Customer Financial Ledger',
    sup_ledger: 'Supplier Financial Ledger',
    customers: 'Customer Master',
    suppliers: 'Supplier Master'
  };

  document.getElementById('pageTitle').textContent = titleMap[pageId] || 'SFS System';
  const content = document.getElementById('content');

  switch (pageId) {
    case 'dashboard': renderDashboard(content); break;
    case 'products': renderProducts(content); break;
    case 'dc_create': renderDCCreate(content); break;
    case 'dc_search': renderDCSearch(content); break;
    case 'inv_create': renderInvoiceCreate(content); break;
    case 'inv_search': renderInvoiceSearch(content); break;
    case 'inward': renderInward(content); break;
    case 'cust_ledger': renderCustomerLedgerView(content); break;
    case 'sup_ledger': renderSupplierLedgerView(content); break;
    case 'customers': renderCustomers(content); break;
    case 'suppliers': renderSuppliers(content); break;
    default: content.innerHTML = '<h3>Page Under Construction</h3>';
  }
}

/* ---------- AUTOCOMPLETE DROPDOWNS ---------- */

function createAutocomplete(containerId, options = {}) {
  const { placeholder = 'Search...', data = [], getValue, getLabel, onSelect } = options;
  const container = document.getElementById(containerId);
  
  container.className = 'ac-container';
  container.innerHTML = `
    <input type="text" class="ac-input" placeholder="${placeholder}" autocomplete="off">
    <div class="ac-dropdown hidden"></div>
  `;

  const input = container.querySelector('.ac-input');
  const dropdown = container.querySelector('.ac-dropdown');

  input.addEventListener('input', () => {
    const val = input.value.trim().toLowerCase();
    if (!val) {
      dropdown.classList.add('hidden');
      return;
    }

    const matches = data.filter(item => getLabel(item).toLowerCase().includes(val)).slice(0, 20);
    if (!matches.length) {
      dropdown.innerHTML = '<div class="ac-item empty">No match found</div>';
    } else {
      dropdown.innerHTML = matches.map((item, idx) => `
        <div class="ac-item" data-idx="${idx}">${getLabel(item)}</div>
      `).join('');
    }

    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('.ac-item:not(.empty)').forEach(el => {
      el.addEventListener('click', () => {
        const selected = matches[parseInt(el.dataset.idx)];
        input.value = getValue(selected);
        dropdown.classList.add('hidden');
        if (onSelect) onSelect(selected);
      });
    });
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) dropdown.classList.add('hidden');
  });
}

/* ---------- 1 & 2. DC & INVOICE SEARCH / HISTORY ---------- */

async function renderDCSearch(container) {
  container.innerHTML = `
    <div class="card">
      <div class="search-bar">
        <input type="text" id="dcSearchInput" placeholder="Search by DC No, Customer Name/ID, PO #, Model No...">
        <button class="btn primary" onclick="executeDCSearch()">Search</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>DC No.</th><th>Date</th><th>Customer</th><th>PO No.</th><th>Total Qty</th><th>Status</th><th>Action</th>
          </tr>
        </thead>
        <tbody id="dcSearchBody"><tr><td colspan="7">Loading history...</td></tr></tbody>
      </table>
    </div>
  `;
  executeDCSearch();
}

async function executeDCSearch() {
  const q = document.getElementById('dcSearchInput')?.value || '';
  const body = document.getElementById('dcSearchBody');
  if (!body) return;

  const res = await apiCall('searchDCs', { query: q });
  if (!res.ok) { body.innerHTML = `<tr><td colspan="7">${res.error}</td></tr>`; return; }

  if (!res.data.length) {
    body.innerHTML = `<tr><td colspan="7">No Delivery Challans found.</td></tr>`;
    return;
  }

  body.innerHTML = res.data.map(d => `
    <tr>
      <td><b>${d.dcNo}</b></td>
      <td>${new Date(d.date).toLocaleDateString()}</td>
      <td>${d.customer}</td>
      <td>${d.poNo || '--'}</td>
      <td>${d.totalQty}</td>
      <td><span class="badge ${d.status === 'Invoiced' ? 'success' : 'warning'}">${d.status}</span></td>
      <td>
        <button class="btn ghost btn-sm" onclick="viewDocument('DC', '${d.dcNo}')">View</button>
        <button class="btn primary btn-sm" onclick="printDocument('DC', '${d.dcNo}')">Print</button>
      </td>
    </tr>
  `).join('');
}

async function renderInvoiceSearch(container) {
  container.innerHTML = `
    <div class="card">
      <div class="search-bar">
        <input type="text" id="invSearchInput" placeholder="Search by Invoice No, Customer, DC No, PO #, Model No...">
        <button class="btn primary" onclick="executeInvoiceSearch()">Search</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Invoice No.</th><th>Date</th><th>Customer</th><th>DC No.</th><th>PO No.</th><th>Total Amount</th><th>Action</th>
          </tr>
        </thead>
        <tbody id="invSearchBody"><tr><td colspan="7">Loading history...</td></tr></tbody>
      </table>
    </div>
  `;
  executeInvoiceSearch();
}

async function executeInvoiceSearch() {
  const q = document.getElementById('invSearchInput')?.value || '';
  const body = document.getElementById('invSearchBody');
  if (!body) return;

  const res = await apiCall('searchInvoices', { query: q });
  if (!res.ok) { body.innerHTML = `<tr><td colspan="7">${res.error}</td></tr>`; return; }

  if (!res.data.length) {
    body.innerHTML = `<tr><td colspan="7">No Invoices found.</td></tr>`;
    return;
  }

  body.innerHTML = res.data.map(i => `
    <tr>
      <td><b>${i.invoiceNo}</b></td>
      <td>${new Date(i.date).toLocaleDateString()}</td>
      <td>${i.customer}</td>
      <td>${i.dcNo || '--'}</td>
      <td>${i.poNo || '--'}</td>
      <td><b>${Number(i.totalAmount).toLocaleString('en-PK', {minimumFractionDigits:2})}</b></td>
      <td>
        <button class="btn ghost btn-sm" onclick="viewDocument('Invoice', '${i.invoiceNo}')">View</button>
        <button class="btn primary btn-sm" onclick="printDocument('Invoice', '${i.invoiceNo}')">Print</button>
      </td>
    </tr>
  `).join('');
}

/* ---------- 3 & 4. CUSTOMER / SUPPLIER AUTO-FILL IN FORMS ---------- */

function renderDCCreate(container) {
  container.innerHTML = `
    <div class="card">
      <h2>Create Delivery Challan</h2>
      <div class="form-grid">
        <div>
          <label>Customer Search (Name / ID / Keyword)</label>
          <div id="custACContainer"></div>
        </div>
        <div><label>Customer ID</label><input type="text" id="dcCustId" readonly></div>
        <div><label>Customer Name</label><input type="text" id="dcCustName"></div>
        <div><label>Delivery Address</label><input type="text" id="dcAddr"></div>
        <div><label>PO Number</label><input type="text" id="dcPO"></div>
        <div><label>PO Date</label><input type="date" id="dcPODate"></div>
        <div><label>NTN</label><input type="text" id="dcNTN"></div>
        <div><label>STN</label><input type="text" id="dcSTN"></div>
      </div>

      <hr class="divider">
      <h3>Items</h3>
      <table class="data-table" id="dcItemsTable">
        <thead>
          <tr>
            <th>Product (Model / Keyword)</th><th>Description</th><th>Stock Avail</th><th>Qty</th><th>Unit</th><th>Action</th>
          </tr>
        </thead>
        <tbody id="dcItemsBody"></tbody>
      </table>
      <button class="btn ghost" onclick="addDCItemRow()">+ Add Item</button>

      <div class="form-actions" style="margin-top: 20px;">
        <button class="btn primary full" onclick="submitDC()">Save Delivery Challan</button>
      </div>
    </div>
  `;

  createAutocomplete('custACContainer', {
    placeholder: 'Type Customer Name / ID...',
    data: state.customers,
    getValue: c => c['Customer Name'],
    getLabel: c => `${c['Customer Name']} (${c['Customer ID']})`,
    onSelect: c => {
      document.getElementById('dcCustId').value = c['Customer ID'] || '';
      document.getElementById('dcCustName').value = c['Customer Name'] || '';
      document.getElementById('dcAddr').value = c.Address || '';
      document.getElementById('dcNTN').value = c['NTN/Tax ID'] || '';
      document.getElementById('dcSTN').value = c.STN || '';
    }
  });

  addDCItemRow();
}

function addDCItemRow() {
  const tbody = document.getElementById('dcItemsBody');
  const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.innerHTML = `
    <td><div id="prodAC_${rowId}"></div></td>
    <td><input type="text" class="desc" readonly></td>
    <td><span class="stock-badge">0</span></td>
    <td><input type="number" class="qty" min="1" value="1"></td>
    <td><input type="text" class="unit" value="Pcs"></td>
    <td><button class="btn ghost btn-sm" onclick="this.closest('tr').remove()">×</button></td>
  `;
  tbody.appendChild(tr);

  createAutocomplete(`prodAC_${rowId}`, {
    placeholder: 'Search Model / Part No...',
    data: state.products,
    getValue: p => p['Model / Part No.'],
    getLabel: p => `${p['Model / Part No.']} - ${p.Description || ''} (Stock: ${p['Current Stock'] || 0})`,
    onSelect: p => {
      tr.querySelector('.desc').value = p.Description || '';
      tr.querySelector('.stock-badge').textContent = p['Current Stock'] || 0;
      tr.querySelector('.unit').value = p.Unit || 'Pcs';
      tr.dataset.model = p['Model / Part No.'];
      tr.dataset.stock = p['Current Stock'] || 0;
    }
  });
}

/* ---------- 8, 9, 10, 11, 12. DC → INVOICE AUTO-FILL & RULES ---------- */

function renderInvoiceCreate(container) {
  container.innerHTML = `
    <div class="card">
      <h2>Create Sales Invoice</h2>
      <div class="form-grid" style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <div style="grid-column: span 2;">
          <label><b>CORE REQUIREMENT: Select Delivery Challan (DC No)</b></label>
          <div id="dcACContainer"></div>
          <small class="text-muted">Selecting a DC will automatically populate customer, PO, and items.</small>
        </div>
      </div>

      <div class="form-grid">
        <div><label>Customer Name</label><input type="text" id="invCustName" readonly></div>
        <div><label>Customer ID</label><input type="text" id="invCustId" readonly></div>
        <div><label>DC No.</label><input type="text" id="invDCNo" readonly></div>
        <div><label>DC Date</label><input type="text" id="invDCDate" readonly></div>
        <div><label>PO Number</label><input type="text" id="invPO" readonly></div>
        <div><label>PO Date</label><input type="text" id="invPODate" readonly></div>
        <div><label>NTN</label><input type="text" id="invNTN" readonly></div>
        <div><label>STN</label><input type="text" id="invSTN" readonly></div>
      </div>

      <hr class="divider">
      <h3>Invoice Line Items</h3>
      <table class="data-table" id="invItemsTable">
        <thead>
          <tr>
            <th>Model / Part No.</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate / Unit (Editable)</th><th>Amount</th>
          </tr>
        </thead>
        <tbody id="invItemsBody">
          <tr><td colspan="6">Please select a Delivery Challan to load items.</td></tr>
        </tbody>
      </table>

      <div style="text-align: right; margin-top: 15px; font-size: 1.2rem;">
        <b>Subtotal Amount: Rs. <span id="invSubtotal">0.00</span></b>
      </div>

      <div class="form-actions" style="margin-top: 20px;">
        <button class="btn primary full" onclick="submitInvoice()">Save & Issue Invoice</button>
      </div>
    </div>
  `;

  loadDCDropdownForInvoice();
}

async function loadDCDropdownForInvoice() {
  const res = await apiCall('searchDCs', { query: '' });
  if (!res.ok) return;

  createAutocomplete('dcACContainer', {
    placeholder: 'Type DC Number (e.g. DC-2026-000001)...',
    data: res.data,
    getValue: d => d.dcNo,
    getLabel: d => `${d.dcNo} - ${d.customer} (${new Date(d.date).toLocaleDateString()}) [Status: ${d.status}]`,
    onSelect: async d => {
      if (d.status === 'Invoiced') {
        alert(`Duplicate Protection Notice:\nInvoice already exists against this Delivery Challan (${d.dcNo}).`);
        renderInvoiceCreate(document.getElementById('content'));
        return;
      }
      
      const dcDetails = await apiCall('getDCDetails', { dcNo: d.dcNo });
      if (!dcDetails.ok) { alert(dcDetails.error); return; }

      const dc = dcDetails.dc;
      document.getElementById('invCustName').value = dc.customer || '';
      document.getElementById('invCustId').value = dc.customerId || '';
      document.getElementById('invDCNo').value = dc.dcNo || '';
      document.getElementById('invDCDate').value = dc.date ? new Date(dc.date).toLocaleDateString() : '';
      document.getElementById('invPO').value = dc.po || '';
      document.getElementById('invPODate').value = dc.poDate ? new Date(dc.poDate).toLocaleDateString() : '';
      document.getElementById('invNTN').value = dc.ntn || '';
      document.getElementById('invSTN').value = dc.stn || '';

      populateInvoiceItemsFromDC(dc.items);
    }
  });
}

function populateInvoiceItemsFromDC(items) {
  const tbody = document.getElementById('invItemsBody');
  tbody.innerHTML = '';

  items.forEach(it => {
    const prod = state.products.find(p => p['Model / Part No.'] === it.model) || {};
    const salePrice = Number(prod['Sale Price'] || 0);

    const tr = document.createElement('tr');
    tr.dataset.model = it.model;
    tr.innerHTML = `
      <td><b>${it.model}</b></td>
      <td>${it.desc || prod.Description || ''}</td>
      <td class="qty">${it.qty}</td>
      <td>${it.unit || 'Pcs'}</td>
      <td><input type="number" class="rate" value="${salePrice}" min="0" step="any" oninput="calcInvoiceTotals()"></td>
      <td class="amount"><b>0.00</b></td>
    `;
    tbody.appendChild(tr);
  });

  calcInvoiceTotals();
}

function calcInvoiceTotals() {
  let subtotal = 0;
  document.querySelectorAll('#invItemsBody tr').forEach(tr => {
    const qty = Number(tr.querySelector('.qty').textContent || 0);
    const rate = Number(tr.querySelector('.rate').value || 0);
    const amount = qty * rate;
    tr.querySelector('.amount').textContent = amount.toLocaleString('en-PK', {minimumFractionDigits: 2});
    subtotal += amount;
  });
  document.getElementById('invSubtotal').textContent = subtotal.toLocaleString('en-PK', {minimumFractionDigits: 2});
}

/* ---------- 6. STOCK VALIDATION & SUBMIT DC / INVOICE ---------- */

async function submitDC() {
  const customer = document.getElementById('dcCustName').value.trim();
  const customerId = document.getElementById('dcCustId').value.trim();
  const address = document.getElementById('dcAddr').value.trim();
  const po = document.getElementById('dcPO').value.trim();
  const poDate = document.getElementById('dcPODate').value;
  const ntn = document.getElementById('dcNTN').value.trim();
  const stn = document.getElementById('dcSTN').value.trim();

  if (!customer) { alert('Please select/enter a Customer.'); return; }

  const items = [];
  let stockError = false;

  document.querySelectorAll('#dcItemsBody tr').forEach(tr => {
    const model = tr.dataset.model;
    const desc = tr.querySelector('.desc').value;
    const qty = Number(tr.querySelector('.qty').value || 0);
    const available = Number(tr.dataset.stock || 0);
    const unit = tr.querySelector('.unit').value;

    if (!model) return;

    if (qty > available) {
      alert(`Insufficient Stock for Model: ${model}\nRequested: ${qty}, Available Stock: ${available}`);
      stockError = true;
      return;
    }

    if (qty > 0) items.push({ model, desc, qty, unit });
  });

  if (stockError) return;
  if (!items.length) { alert('Please add at least one valid item to the DC.'); return; }

  const res = await apiCall('saveDC', { customerId, customer, address, po, poDate, ntn, stn, items });
  if (res.ok) {
    alert('Delivery Challan created successfully!');
    await refresh();
    navigate('dc_search');
  } else {
    alert(res.error || 'Failed to save Delivery Challan.');
  }
}

async function submitInvoice() {
  const dcNo = document.getElementById('invDCNo').value;
  const customer = document.getElementById('invCustName').value;
  const customerId = document.getElementById('invCustId').value;
  const po = document.getElementById('invPO').value;
  const poDate = document.getElementById('invPODate').value;
  const dcDate = document.getElementById('invDCDate').value;
  const ntn = document.getElementById('invNTN').value;
  const stn = document.getElementById('invSTN').value;

  if (!dcNo) { alert('Please select a Delivery Challan first.'); return; }

  const items = [];
  document.querySelectorAll('#invItemsBody tr').forEach(tr => {
    const model = tr.dataset.model;
    const qty = Number(tr.querySelector('.qty').textContent || 0);
    const rate = Number(tr.querySelector('.rate').value || 0);
    if (model && qty > 0) items.push({ model, qty, rate });
  });

  const res = await apiCall('saveInvoice', { dc: dcNo, customerId, customer, po, poDate, dcDate, ntn, stn, items });
  if (res.ok) {
    alert('Invoice created successfully! Stock was preserved (no double-deduction).');
    await refresh();
    navigate('inv_search');
  } else {
    alert(res.error || 'Failed to create Invoice.');
  }
}

/* ---------- 13 & 14. CUSTOMER & SUPPLIER LEDGERS ---------- */

function renderCustomerLedgerView(container) {
  container.innerHTML = `
    <div class="card">
      <h2>Customer Financial Ledger</h2>
      <div class="form-grid">
        <div>
          <label>Select Customer</label>
          <div id="ledgerCustAC"></div>
        </div>
        <div><label>Date From</label><input type="date" id="ledgerCustFrom"></div>
        <div><label>Date To</label><input type="date" id="ledgerCustTo"></div>
      </div>
      <div style="margin-top: 15px;">
        <button class="btn primary" onclick="fetchCustomerLedgerData()">Generate Ledger</button>
      </div>

      <hr class="divider">
      <div id="ledgerResult" class="hidden">
        <div class="form-grid" style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
          <div><b>Total Debit:</b> Rs. <span id="lblTotalDebit">0.00</span></div>
          <div><b>Total Credit:</b> Rs. <span id="lblTotalCredit">0.00</span></div>
          <div><b>Closing Balance:</b> Rs. <span id="lblClosingBalance">0.00</span></div>
        </div>
        <br>
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
          </thead>
          <tbody id="custLedgerBody"></tbody>
        </table>
      </div>
    </div>
  `;

  createAutocomplete('ledgerCustAC', {
    placeholder: 'Type Customer Name...',
    data: state.customers,
    getValue: c => c['Customer Name'],
    getLabel: c => `${c['Customer Name']} (${c['Customer ID']})`,
    onSelect: c => { state.selectedLedgerCustomer = c['Customer Name']; }
  });
}

async function fetchCustomerLedgerData() {
  const custName = state.selectedLedgerCustomer;
  if (!custName) { alert('Please select a Customer.'); return; }

  const dateFrom = document.getElementById('ledgerCustFrom').value;
  const dateTo = document.getElementById('ledgerCustTo').value;

  const res = await apiCall('getCustomerLedger', { customer: custName, dateFrom, dateTo });
  if (!res.ok) { alert(res.error); return; }

  document.getElementById('ledgerResult').classList.remove('hidden');
  document.getElementById('lblTotalDebit').textContent = res.totalDebit.toLocaleString('en-PK', {minimumFractionDigits: 2});
  document.getElementById('lblTotalCredit').textContent = res.totalCredit.toLocaleString('en-PK', {minimumFractionDigits: 2});
  document.getElementById('lblClosingBalance').textContent = res.closingBalance.toLocaleString('en-PK', {minimumFractionDigits: 2});

  const tbody = document.getElementById('custLedgerBody');
  tbody.innerHTML = res.ledger.map(r => `
    <tr>
      <td>${new Date(r.date).toLocaleDateString()}</td>
      <td>${r.type}</td>
      <td>${r.ref}</td>
      <td>${r.description}</td>
      <td>${r.debit ? r.debit.toLocaleString('en-PK', {minimumFractionDigits: 2}) : '--'}</td>
      <td>${r.credit ? r.credit.toLocaleString('en-PK', {minimumFractionDigits: 2}) : '--'}</td>
      <td><b>${r.balance.toLocaleString('en-PK', {minimumFractionDigits: 2})}</b></td>
    </tr>
  `).join('');
}

function renderSupplierLedgerView(container) {
  container.innerHTML = `
    <div class="card">
      <h2>Supplier Financial Ledger</h2>
      <div class="form-grid">
        <div>
          <label>Select Supplier</label>
          <div id="ledgerSupAC"></div>
        </div>
        <div><label>Date From</label><input type="date" id="ledgerSupFrom"></div>
        <div><label>Date To</label><input type="date" id="ledgerSupTo"></div>
      </div>
      <div style="margin-top: 15px;">
        <button class="btn primary" onclick="fetchSupplierLedgerData()">Generate Ledger</button>
      </div>

      <hr class="divider">
      <div id="supLedgerResult" class="hidden">
        <div class="form-grid" style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
          <div><b>Total Purchases (Credit):</b> Rs. <span id="lblSupCredit">0.00</span></div>
          <div><b>Total Paid (Debit):</b> Rs. <span id="lblSupDebit">0.00</span></div>
          <div><b>Closing Balance:</b> Rs. <span id="lblSupBalance">0.00</span></div>
        </div>
        <br>
        <table class="data-table">
          <thead>
            <tr><th>Date</th><th>Type</th><th>Reference</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr>
          </thead>
          <tbody id="supLedgerBody"></tbody>
        </table>
      </div>
    </div>
  `;

  createAutocomplete('ledgerSupAC', {
    placeholder: 'Type Supplier Name...',
    data: state.suppliers,
    getValue: s => s['Supplier Name'],
    getLabel: s => `${s['Supplier Name']} (${s['Supplier ID']})`,
    onSelect: s => { state.selectedLedgerSupplier = s['Supplier Name']; }
  });
}

async function fetchSupplierLedgerData() {
  const supName = state.selectedLedgerSupplier;
  if (!supName) { alert('Please select a Supplier.'); return; }

  const dateFrom = document.getElementById('ledgerSupFrom').value;
  const dateTo = document.getElementById('ledgerSupTo').value;

  const res = await apiCall('getSupplierLedger', { supplier: supName, dateFrom, dateTo });
  if (!res.ok) { alert(res.error); return; }

  document.getElementById('supLedgerResult').classList.remove('hidden');
  document.getElementById('lblSupDebit').textContent = res.totalDebit.toLocaleString('en-PK', {minimumFractionDigits: 2});
  document.getElementById('lblSupCredit').textContent = res.totalCredit.toLocaleString('en-PK', {minimumFractionDigits: 2});
  document.getElementById('lblSupBalance').textContent = res.closingBalance.toLocaleString('en-PK', {minimumFractionDigits: 2});

  const tbody = document.getElementById('supLedgerBody');
  tbody.innerHTML = res.ledger.map(r => `
    <tr>
      <td>${new Date(r.date).toLocaleDateString()}</td>
      <td>${r.type}</td>
      <td>${r.ref}</td>
      <td>${r.description}</td>
      <td>${r.debit ? r.debit.toLocaleString('en-PK', {minimumFractionDigits: 2}) : '--'}</td>
      <td>${r.credit ? r.credit.toLocaleString('en-PK', {minimumFractionDigits: 2}) : '--'}</td>
      <td><b>${r.balance.toLocaleString('en-PK', {minimumFractionDigits: 2})}</b></td>
    </tr>
  `).join('');
}

/* ---------- 15. VIEW & REPRINT BUSINESS DOCUMENTS ---------- */

async function viewDocument(type, docNo) {
  const action = type === 'DC' ? 'getDCDetails' : 'getInvoiceDetails';
  const param = type === 'DC' ? { dcNo: docNo } : { invoiceNo: docNo };

  const res = await apiCall(action, param);
  if (!res.ok) { alert(res.error); return; }

  const modal = document.getElementById('modal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = `${type} Details: ${docNo}`;

  if (type === 'DC') {
    const dc = res.dc;
    body.innerHTML = `
      <div>
        <p><b>Customer:</b> ${dc.customer} (ID: ${dc.customerId})</p>
        <p><b>Date:</b> ${new Date(dc.date).toLocaleDateString()} | <b>PO #:</b> ${dc.po || '--'}</p>
        <p><b>Linked Invoice:</b> ${dc.invoiceNo ? `<b>${dc.invoiceNo}</b>` : 'None (Pending Invoice)'}</p>
        <hr>
        <table class="data-table">
          <thead><tr><th>Model / Part No.</th><th>Description</th><th>Qty</th><th>Unit</th></tr></thead>
          <tbody>
            ${dc.items.map(i => `<tr><td><b>${i.model}</b></td><td>${i.desc || ''}</td><td>${i.qty}</td><td>${i.unit}</td></tr>`).join('')}
          </tbody>
        </table>
        <br>
        <button class="btn primary full" onclick="printDocument('DC', '${docNo}')">Print Official DC</button>
      </div>
    `;
  } else {
    const inv = res.invoice;
    body.innerHTML = `
      <div>
        <p><b>Customer:</b> ${inv.customer}</p>
        <p><b>Invoice Date:</b> ${new Date(inv.date).toLocaleDateString()} | <b>DC #:</b> ${inv.dcNo || '--'}</p>
        <hr>
        <table class="data-table">
          <thead><tr><th>Model / Part No.</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            ${inv.items.map(i => `<tr><td><b>${i.model}</b></td><td>${i.qty}</td><td>${i.rate.toFixed(2)}</td><td><b>${i.amount.toFixed(2)}</b></td></tr>`).join('')}
          </tbody>
        </table>
        <br>
        <button class="btn primary full" onclick="printDocument('Invoice', '${docNo}')">Print Official Invoice</button>
      </div>
    `;
  }

  modal.classList.remove('hidden');
}

async function printDocument(type, docNo) {
  const action = type === 'DC' ? 'getDCDetails' : 'getInvoiceDetails';
  const param = type === 'DC' ? { dcNo: docNo } : { invoiceNo: docNo };

  const res = await apiCall(action, param);
  if (!res.ok) { alert(res.error); return; }

  closeModal();

  const printArea = document.getElementById('printArea');
  document.getElementById('printDocTitle').textContent = type === 'DC' ? 'DELIVERY CHALLAN' : 'SALES INVOICE';
  document.getElementById('printDocNo').textContent = docNo;

  const data = type === 'DC' ? res.dc : res.invoice;
  document.getElementById('printDocDate').textContent = new Date(data.date).toLocaleDateString();
  document.getElementById('printDocRef').textContent = type === 'DC' ? (data.po || '--') : (data.dcNo || '--');
  document.getElementById('printCustName').textContent = data.customer || '--';
  document.getElementById('printCustAddr').textContent = data.address || '--';
  document.getElementById('printCustNTN').textContent = data.ntn || '--';
  document.getElementById('printCustSTN').textContent = data.stn || '--';

  const body = document.getElementById('printTableBody');
  const invOnlyEls = document.querySelectorAll('.inv-only');

  if (type === 'DC') {
    invOnlyEls.forEach(el => el.style.display = 'none');
    body.innerHTML = data.items.map((it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${it.model}</b></td>
        <td>${it.desc || ''}</td>
        <td>${it.qty}</td>
        <td>${it.unit || 'Pcs'}</td>
      </tr>
    `).join('');
  } else {
    invOnlyEls.forEach(el => el.style.display = 'table-cell');
    document.querySelector('.print-totals.inv-only').style.display = 'block';

    let total = 0;
    body.innerHTML = data.items.map((it, idx) => {
      total += it.amount;
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><b>${it.model}</b></td>
          <td>${it.desc || ''}</td>
          <td>${it.qty}</td>
          <td>${it.unit || 'Pcs'}</td>
          <td>${it.rate.toFixed(2)}</td>
          <td><b>${it.amount.toFixed(2)}</b></td>
        </tr>
      `;
    }).join('');
    document.getElementById('printGrandTotal').textContent = total.toLocaleString('en-PK', {minimumFractionDigits: 2});
  }

  printArea.classList.remove('hidden');
  window.print();
  printArea.classList.add('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

/* ---------- OTHER VIEWS ---------- */

function renderDashboard(container) {
  container.innerHTML = `
    <div class="card-grid">
      <div class="card metric"><h3>Total Products</h3><p>${state.products.length}</p></div>
      <div class="card metric"><h3>Total Customers</h3><p>${state.customers.length}</p></div>
      <div class="card metric"><h3>Total Suppliers</h3><p>${state.suppliers.length}</p></div>
    </div>
  `;
}

function renderProducts(container) {
  container.innerHTML = `
    <div class="card">
      <table class="data-table">
        <thead>
          <tr><th>Model / Part No.</th><th>Description</th><th>Category</th><th>Location</th><th>Current Stock</th><th>Sale Price</th></tr>
        </thead>
        <tbody>
          ${state.products.map(p => `
            <tr>
              <td><b>${p['Model / Part No.']}</b></td>
              <td>${p.Description || ''}</td>
              <td>${p.Category || ''}</td>
              <td>${p.Location || ''}</td>
              <td><span class="stock-badge">${p['Current Stock'] || 0}</span></td>
              <td>${p['Sale Price'] || '--'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderCustomers(container) {
  container.innerHTML = `
    <div class="card">
      <table class="data-table">
        <thead>
          <tr><th>Customer ID</th><th>Customer Name</th><th>Phone</th><th>NTN/Tax ID</th><th>Address</th></tr>
        </thead>
        <tbody>
          ${state.customers.map(c => `
            <tr>
              <td>${c['Customer ID']}</td>
              <td><b>${c['Customer Name']}</b></td>
              <td>${c.Phone || ''}</td>
              <td>${c['NTN/Tax ID'] || ''}</td>
              <td>${c.Address || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSuppliers(container) {
  container.innerHTML = `
    <div class="card">
      <table class="data-table">
        <thead>
          <tr><th>Supplier ID</th><th>Supplier Name</th><th>Phone</th><th>NTN/Tax ID</th><th>Address</th></tr>
        </thead>
        <tbody>
          ${state.suppliers.map(s => `
            <tr>
              <td>${s['Supplier ID']}</td>
              <td><b>${s['Supplier Name']}</b></td>
              <td>${s.Phone || ''}</td>
              <td>${s['NTN/Tax ID'] || ''}</td>
              <td>${s.Address || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderInward(container) {
  container.innerHTML = `
    <div class="card">
      <h2>Inward Purchase Stock</h2>
      <div class="form-grid">
        <div><label>Supplier Search</label><div id="inwSupAC"></div></div>
        <div><label>Product Search</label><div id="inwProdAC"></div></div>
        <div><label>Quantity</label><input type="number" id="inwQty" min="1" value="1"></div>
        <div><label>Purchase Cost</label><input type="number" id="inwCost" step="any"></div>
      </div>
      <button class="btn primary" style="margin-top: 15px;" onclick="submitInward()">Save Inward</button>
    </div>
  `;

  createAutocomplete('inwSupAC', {
    placeholder: 'Search Supplier...',
    data: state.suppliers,
    getValue: s => s['Supplier Name'],
    getLabel: s => s['Supplier Name'],
    onSelect: s => { state.inwSupplier = s['Supplier Name']; }
  });

  createAutocomplete('inwProdAC', {
    placeholder: 'Search Product Model...',
    data: state.products,
    getValue: p => p['Model / Part No.'],
    getLabel: p => `${p['Model / Part No.']} - ${p.Description || ''}`,
    onSelect: p => { state.inwModel = p['Model / Part No.']; }
  });
}

async function submitInward() {
  const model = state.inwModel;
  const supplier = state.inwSupplier;
  const qty = Number(document.getElementById('inwQty').value);
  const purchaseCost = document.getElementById('inwCost').value;

  if (!model || !supplier || qty <= 0) { alert('Please fill required fields.'); return; }

  const res = await apiCall('saveInward', { model, supplier, qty, purchaseCost });
  if (res.ok) {
    alert('Inward entry recorded successfully!');
    await refresh();
    navigate('products');
  } else {
    alert(res.error);
  }
}
