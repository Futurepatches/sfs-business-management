// Standard Fluid Systems - Complete Application Logic (`app.js`)
const SFS_CONFIG = {
    scriptUrl: "https://script.google.com/macros/s/AKfycbwL0yc-sfBcxnyuD1eYk4AlYY1xEoyMjjFLLAP_7XQPnVud-Otyndoj46ydPVYSKE02OQ/exec"
};

let appState = {
    user: null,
    session: null,
    inventory: [
        { model: "AA-0404", description: "3/2 Electro/CNOMO N.O. 1.5MM", category: "Valves", qty: 25 },
        { model: "HA345418", description: "Connector 1/8 x 4mm", category: "Fittings", qty: 500 }
    ],
    deliveries: [
        {
            dcNumber: "123",
            customerName: "M/S ABC Engineering",
            address: "Plot 45, SITE Area, Karachi",
            poNo: "PO-9988",
            poDate: "2026-08-15",
            date: "2026-08-17",
            stn: "3277876141543",
            ntn: "2221343-7",
            items: [
                { description: "Connector 1/8 x 4mm", model: "HA345418", qty: 350, rate: 150 },
                { description: "3/2 Electro/CNOMO N.O. 1.5MM", model: "AA-0404", qty: 1, rate: 24000 }
            ]
        }
    ],
    invoices: [],
    inward: [
        { id: "PO-501", supplier: "UNIVER Italy", date: "2026-08-01", itemsCount: 12 }
    ],
    customers: [
        { name: "M/S ABC Engineering", ntn: "2221343-7", address: "Plot 45, SITE Area, Karachi" }
    ],
    suppliers: [
        { name: "UNIVER Italy", contact: "Mr. Rossi", phone: "+39 030 21841" }
    ],
    activeTab: 'dashboard'
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = handleLoginSubmit;
    }
    initDashboard();
    populateDCDropdown();
});

// JSONP-based Login to completely bypass CORS restrictions
function handleLoginSubmit(e) {
    if (e) e.preventDefault();
    const userInput = document.getElementById('userInput');
    const passInput = document.getElementById('passInput');
    const errorDiv = document.getElementById('loginError');

    const username = userInput ? userInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';
    
    if (!username || !password) {
        if (errorDiv) errorDiv.innerText = 'Please enter username and password.';
        return false;
    }

    if (errorDiv) errorDiv.innerText = 'Logging in...';

    const callbackName = 'sfs_login_' + Math.random().toString(36).substring(2, 9);
    const url = `${SFS_CONFIG.scriptUrl}?action=login&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&callback=${callbackName}`;

    window[callbackName] = function(response) {
        delete window[callbackName];
        const scriptEl = document.getElementById('jsonp_login_script');
        if (scriptEl) scriptEl.remove();

        if (response && response.ok) {
            appState.user = response.user;
            appState.session = response.session;
            const loginScreen = document.getElementById('loginScreen');
            const appDiv = document.getElementById('app');
            if (loginScreen) loginScreen.classList.add('hidden');
            if (appDiv) appDiv.classList.remove('hidden');
            initDashboard();
            fetchDataFromSheets();
        } else {
            if (errorDiv) errorDiv.innerText = (response && response.error) ? response.error : 'Invalid username or password.';
        }
    };

    const script = document.createElement('script');
    script.id = 'jsonp_login_script';
    script.src = url;
    script.onerror = function() {
        if (errorDiv) errorDiv.innerText = 'Cannot reach Apps Script backend. Please check deployment access.';
        delete window[callbackName];
        script.remove();
    };
    document.body.appendChild(script);

    return false;
}

function fetchDataFromSheets() {
    try {
        const callbackName = 'sfs_bootstrap_' + Math.random().toString(36).substring(2, 9);
        const url = `${SFS_CONFIG.scriptUrl}?action=bootstrap&session=${encodeURIComponent(appState.session || '')}&callback=${callbackName}`;

        window[callbackName] = function(data) {
            delete window[callbackName];
            const scriptEl = document.getElementById('jsonp_boot_script');
            if (scriptEl) scriptEl.remove();

            if (data && data.ok) {
                if (data.products && data.products.length > 0) appState.inventory = data.products;
                if (data.customers && data.customers.length > 0) appState.customers = data.customers;
                if (data.suppliers && data.suppliers.length > 0) appState.suppliers = data.suppliers;
                
                initDashboard();
                populateDCDropdown();
                const statusEl = document.getElementById('backendStatus');
                if (statusEl) {
                    statusEl.innerText = "Active & Synced";
                    statusEl.style.color = "#22c55e";
                }
            }
        };

        const script = document.createElement('script');
        script.id = 'jsonp_boot_script';
        script.src = url;
        document.body.appendChild(script);

    } catch (error) {
        console.warn("Using default operational data (Network/CORS fallback):", error);
        const statusEl = document.getElementById('backendStatus');
        if (statusEl) {
            statusEl.innerText = "Running (Fallback Mode)";
            statusEl.style.color = "#f59e0b";
        }
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
    tbody.innerHTML = appState.inventory.length === 0 ? '<tr><td colspan="4" style="text-align:center;">No products found.</td></tr>' : '';
    appState.inventory.forEach(item => {
        tbody.innerHTML += `<tr><td>${item.model || item['Model / Part No.'] || ''}</td><td>${item.description || item['Description'] || ''}</td><td>${item.category || item['Category'] || ''}</td><td>${item.qty || item['Current Stock'] || 0}</td></tr>`;
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
        tbody.innerHTML += `<tr><td>${c.name || c['Customer Name'] || ''}</td><td>${c.ntn || c['NTN/Tax ID'] || ''}</td><td>${c.address || c['Address'] || ''}</td></tr>`;
    });
}

function loadSuppliersData() {
    const tbody = document.getElementById('suppliersTableBody');
    if (!tbody) return;
    tbody.innerHTML = appState.suppliers.length === 0 ? '<tr><td colspan="3" style="text-align:center;">No suppliers found.</td></tr>' : '';
    appState.suppliers.forEach(s => {
        tbody.innerHTML += `<tr><td>${s.name || s['Supplier Name'] || ''}</td><td>${s.contact || s['Contact Person'] || ''}</td><td>${s.phone || s['Phone'] || ''}</td></tr>`;
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
