// Standard Fluid Systems - Main Application Logic
const SFS_CONFIG = {
    scriptUrl: "https://script.google.com/macros/s/AKfycbwL0yc-sfBcxnyuD1eYk4AlYY1xEoyMjjFLLAP_7XQPnVud-Otyndoj46ydPVYSKE02OQ/exec"
};

let appState = {
    user: null,
    inventory: [],
    deliveries: [],
    invoices: [],
    inward: [],
    customers: [],
    suppliers: [],
    activeTab: 'dashboard'
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = handleLoginSubmit;
    }
    fetchDataFromSheets();
});

function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    const userInput = document.getElementById('userInput');
    const passInput = document.getElementById('passInput');
    const errorDiv = document.getElementById('loginError');

    const user = userInput ? userInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';
    
    if (user !== "" && pass !== "") {
        appState.user = user;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        initDashboard();
    } else {
        if (errorDiv) errorDiv.innerText = 'Please enter valid username and password.';
    }
    return false;
}

async function fetchDataFromSheets() {
    try {
        const response = await fetch(SFS_CONFIG.scriptUrl);
        const data = await response.json();
        if (data) {
            appState.inventory = data.inventory || data.products || [];
            appState.deliveries = data.deliveries || [];
            appState.invoices = data.invoices || [];
            appState.inward = data.inward || data.purchases || [];
            appState.customers = data.customers || [];
            appState.suppliers = data.suppliers || [];
            
            initDashboard();
            populateDCDropdown();
        }
    } catch (error) {
        console.error("Error fetching data from Google Sheets:", error);
    }
}

function switchTab(tabId) {
    appState.activeTab = tabId;
    document.querySelectorAll('.navbtn').forEach(btn => btn.classList.remove('active'));
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
    const target = document.getElementById(tabId + 'View');
    if (target) target.classList.remove('hidden');

    if (tabId === 'products') loadProductsData();
    if (tabId === 'inward') loadInwardData();
    if (tabId === 'deliveries') loadDeliveriesData();
    if (tabId === 'invoices') loadInvoicesData();
    if (tabId === 'customers') loadCustomersData();
    if (tabId === 'suppliers') loadSuppliersData();
}

function initDashboard() {
    const totalProdEl = document.getElementById('dashTotalProducts');
    const totalDcEl = document.getElementById('dashTotalDC');
    const totalInvEl = document.getElementById('dashTotalInv');

    if (totalProdEl) totalProdEl.innerText = appState.inventory.length;
    if (totalDcEl) totalDcEl.innerText = appState.deliveries.length;
    if (totalInvEl) totalInvEl.innerText = appState.invoices.length;
}

function loadProductsData() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    tbody.innerHTML = appState.inventory.length ===0 ? '<tr><td colspan="4" style="text-align:center;">No products found.</td></tr>' : '';
    appState.inventory.forEach(item => {
        tbody.innerHTML += `<tr><td>${item.model || item.itemCode || ''}</td><td>${item.description || ''}</td><td>${item.category || ''}</td><td>${item.qty || item.stock || 0}</td></tr>`;
    });
}

function loadInwardData() {
    const tbody = document.getElementById('inwardTableBody');
    if (!tbody) return;
    tbody.innerHTML = appState.inward.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No inward records found.</td></tr>' : '';
    appState.inward.forEach(i => {
        tbody.innerHTML += `<tr><td>${i.id || i.poNo || ''}</td><td>${i.supplier || ''}</td><td>${i.date || ''}</td><td>${i.itemsCount || 0}</td></tr>`;
    });
}

function loadDeliveriesData() {
    const tbody = document.getElementById('deliveriesTableBody');
    if (!tbody) return;
    tbody.innerHTML = appState.deliveries.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No delivery challans found.</td></tr>' : '';
    appState.deliveries.forEach(dc => {
        tbody.innerHTML += `<tr><td>${dc.dcNumber || dc.challanNo || ''}</td><td>${dc.date || ''}</td><td>${dc.customerName || dc.m_s || ''}</td><td>${dc.poNo || ''}</td></tr>`;
    });
}

function loadCustomersData() {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    tbody.innerHTML = appState.customers.length === 0 ? '<tr><td colspan="3" style="text-align:center;">No customers found.</td></tr>' : '';
    appState.customers.forEach(c => {
        tbody.innerHTML += `<tr><td>${c.name || c.customerName || ''}</td><td>${c.ntn || ''}</td><td>${c.address || ''}</td></tr>`;
    });
}

function loadSuppliersData() {
    const tbody = document.getElementById('suppliersTableBody');
    if (!tbody) return;
    tbody.innerHTML = appState.suppliers.length === 0 ? '<tr><td colspan="3" style="text-align:center;">No suppliers found.</td></tr>' : '';
    appState.suppliers.forEach(s => {
        tbody.innerHTML += `<tr><td>${s.name || ''}</td><td>${s.contact || ''}</td><td>${s.phone || s.email || ''}</td></tr>`;
    });
}

function populateDCDropdown() {
    const dcSelect = document.getElementById('dcSelectDropdown');
    if (dcSelect && appState.deliveries.length > 0) {
        dcSelect.innerHTML = '<option value="">Select DC Number</option>';
        appState.deliveries.forEach(dc => {
            const dcNo = dc.dcNumber || dc.challanNo;
            if (dcNo) {
                const opt = document.createElement('option');
                opt.value = dcNo;
                opt.textContent = `DC-${dcNo} (${dc.customerName || dc.m_s || 'Client'})`;
                dcSelect.appendChild(opt);
            }
        });
    }
}

function handleDCSelection(dcNumber) {
    const selectedDC = appState.deliveries.find(d => (d.dcNumber == dcNumber || d.challanNo == dcNumber));
    if (!selectedDC) return;

    document.getElementById('invCustomer').value = selectedDC.customerName || selectedDC.m_s || '';
    document.getElementById('invAddress').value = selectedDC.address || '';
    document.getElementById('invPoNo').value = selectedDC.poNo || '';
    document.getElementById('invPoDate').value = selectedDC.poDate || '';
    document.getElementById('invDcDate').value = selectedDC.date || '';
    document.getElementById('invStn').value = selectedDC.stn || '';
    document.getElementById('invNtn').value = selectedDC.ntn || '';

    const itemsTableBody = document.getElementById('invoiceItemsBody');
    if (itemsTableBody && selectedDC.items) {
        itemsTableBody.innerHTML = '';
        selectedDC.items.forEach((item, index) => {
            itemsTableBody.innerHTML += `<tr><td>${index + 1}</td><td>${item.description || ''}</td><td>${item.model || ''}</td><td>${item.qty || 1}</td><td>${item.rate || 0}</td><td>${(item.qty || 1) * (item.rate || 0)}</td></tr>`;
        });
    }
}

function loadInvoicesData() {
    populateDCDropdown();
    const dcSelect = document.getElementById('dcSelectDropdown');
    if (dcSelect) {
        dcSelect.onchange = function(e) {
            handleDCSelection(e.target.value);
        };
    }
}
